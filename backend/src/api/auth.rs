// src/api/auth.rs
use actix_web::{dev::Payload, web, FromRequest, HttpRequest, HttpResponse};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::Utc;
use futures::future::{ready, Ready};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, TokenData, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use crate::db::models::{LoginRequest, LoginResponse, RegisterRequest, User, UserInfo};

const JWT_SECRET: &[u8] = b"chanlun_secret_key_change_in_production_12345";
const JWT_EXPIRATION_HOURS: i64 = 24 * 7; // 7 days

/// JWT Claims 结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtClaims {
    pub sub: i32, // user id
    pub username: String,
    pub role: String,
    pub tushare_token: Option<String>,
    pub exp: i64, // expiration timestamp
    pub iat: i64, // issued at
}

impl FromRequest for JwtClaims {
    type Error = actix_web::Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        log::info!("JwtClaims::from_request called");

        let auth_header = match req.headers().get("Authorization") {
            Some(h) => h,
            None => {
                log::warn!("No Authorization header found");
                return ready(Err(actix_web::error::ErrorUnauthorized(
                    "Missing Authorization header",
                )));
            }
        };

        let auth_str = match auth_header.to_str() {
            Ok(s) => s,
            Err(e) => {
                log::warn!("Invalid Authorization header: {}", e);
                return ready(Err(actix_web::error::ErrorUnauthorized(
                    "Invalid Authorization header",
                )));
            }
        };

        if !auth_str.starts_with("Bearer ") {
            log::warn!("Authorization header doesn't start with Bearer");
            return ready(Err(actix_web::error::ErrorUnauthorized(
                "Invalid token format",
            )));
        }

        let token = &auth_str[7..];
        log::info!("Token received (length: {})", token.len());

        match verify_token(token) {
            Ok(token_data) => {
                log::info!(
                    "Token verified successfully for user: {}",
                    token_data.claims.username
                );
                ready(Ok(token_data.claims))
            }
            Err(e) => {
                log::error!("Token verification failed: {}", e);
                ready(Err(actix_web::error::ErrorUnauthorized("Invalid token")))
            }
        }
    }
}

/// 生成 JWT token
fn generate_token(user: &User) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now().timestamp();
    let expiration = now + JWT_EXPIRATION_HOURS * 3600;

    let claims = JwtClaims {
        sub: user.id,
        username: user.username.clone(),
        role: user.role.clone(),
        tushare_token: user.tushare_token.clone(),
        exp: expiration,
        iat: now,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET),
    )
}

/// 验证 JWT token
pub fn verify_token(token: &str) -> Result<TokenData<JwtClaims>, jsonwebtoken::errors::Error> {
    decode::<JwtClaims>(
        token,
        &DecodingKey::from_secret(JWT_SECRET),
        &Validation::default(),
    )
}

/// 哈希密码
fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(password.as_bytes(), &salt)?;
    Ok(password_hash.to_string())
}

/// 验证密码
fn verify_password(
    password: &str,
    password_hash: &str,
) -> Result<bool, argon2::password_hash::Error> {
    let parsed_hash = PasswordHash::new(password_hash)?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

/// 注册新用户
pub async fn register(pool: web::Data<PgPool>, body: web::Json<RegisterRequest>) -> HttpResponse {
    // 检查用户名是否已存在
    let existing: Option<User> = sqlx::query_as("SELECT * FROM users WHERE username = $1")
        .bind(&body.username)
        .fetch_optional(pool.get_ref())
        .await
        .unwrap_or(None);

    if existing.is_some() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "用户名已存在"
        }));
    }

    // 哈希密码
    let password_hash = match hash_password(&body.password) {
        Ok(hash) => hash,
        Err(e) => {
            log::error!("Failed to hash password: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "密码处理失败"
            }));
        }
    };

    // 插入新用户
    let now = Utc::now().naive_utc();
    let result = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (username, password_hash, email, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, 'user', true, $4, $4)
        RETURNING *
        "#,
    )
    .bind(&body.username)
    .bind(&password_hash)
    .bind(&body.email)
    .bind(now)
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(user) => {
            let user_info = UserInfo {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                tushare_token: user.tushare_token,
                gemini_token: user.gemini_token,
                openai_token: user.openai_token,
                preferred_ai_provider: user.preferred_ai_provider,
                openai_base_url: user.openai_base_url,
                openai_model: user.openai_model,
            };
            HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": "注册成功",
                "data": user_info
            }))
        }
        Err(e) => {
            log::error!("Failed to create user: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "注册失败"
            }))
        }
    }
}

/// 用户登录
pub async fn login(pool: web::Data<PgPool>, body: web::Json<LoginRequest>) -> HttpResponse {
    // 查找用户
    let user: Option<User> =
        sqlx::query_as("SELECT * FROM users WHERE username = $1 AND is_active = true")
            .bind(&body.username)
            .fetch_optional(pool.get_ref())
            .await
            .unwrap_or(None);

    let user = match user {
        Some(u) => u,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "用户名或密码错误"
            }));
        }
    };

    // 验证密码
    match verify_password(&body.password, &user.password_hash) {
        Ok(valid) if valid => {}
        _ => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "用户名或密码错误"
            }));
        }
    }

    // 生成 JWT token
    let token = match generate_token(&user) {
        Ok(t) => t,
        Err(e) => {
            log::error!("Failed to generate token: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "登录失败"
            }));
        }
    };

    let response = LoginResponse {
        token,
        user: UserInfo {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            tushare_token: user.tushare_token,
            gemini_token: user.gemini_token,
            openai_token: user.openai_token,
            preferred_ai_provider: user.preferred_ai_provider,
            openai_base_url: user.openai_base_url,
            openai_model: user.openai_model,
        },
    };

    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "登录成功",
        "data": response
    }))
}

/// 获取当前用户信息
pub async fn get_current_user(pool: web::Data<PgPool>, claims: JwtClaims) -> HttpResponse {
    let user: Option<User> =
        sqlx::query_as("SELECT * FROM users WHERE id = $1 AND is_active = true")
            .bind(claims.sub)
            .fetch_optional(pool.get_ref())
            .await
            .unwrap_or(None);

    match user {
        Some(u) => {
            let user_info = UserInfo {
                id: u.id,
                username: u.username,
                email: u.email,
                role: u.role,
                tushare_token: u.tushare_token,
                gemini_token: u.gemini_token,
                openai_token: u.openai_token,
                preferred_ai_provider: u.preferred_ai_provider,
                openai_base_url: u.openai_base_url,
                openai_model: u.openai_model,
            };
            HttpResponse::Ok().json(user_info)
        }
        None => HttpResponse::NotFound().json(serde_json::json!({
            "error": "用户不存在"
        })),
    }
}

/// 更新 tushare token
#[derive(Debug, Deserialize)]
pub struct UpdateTushareTokenRequest {
    pub tushare_token: String,
}

pub async fn update_tushare_token(
    pool: web::Data<PgPool>,
    claims: JwtClaims,
    body: web::Json<UpdateTushareTokenRequest>,
) -> HttpResponse {
    // 记录请求到达
    log::info!("update_tushare_token request received");

    // 记录用户信息
    log::info!(
        "User ID: {}, Username: {:?}, Tushare token in claims: {:?}",
        claims.sub,
        claims.username,
        claims.tushare_token
    );

    // 记录请求体
    log::info!("Request body: {:?}", body);

    let token = body.tushare_token.trim();

    // 验证 token 格式（tushare token 通常是十六进制字符串）
    if token.is_empty() {
        log::warn!("Empty token received from user {}", claims.sub);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "token 不能为空"
        }));
    }

    // 记录 token（脱敏显示）
    log::info!(
        "Token length: {}, First 8 chars: {}",
        token.len(),
        &token[0..std::cmp::min(8, token.len())]
    );

    let now = Utc::now().naive_utc();
    log::info!(
        "Attempting to update tushare_token for user {} at {}",
        claims.sub,
        now
    );

    let result = sqlx::query("UPDATE users SET tushare_token = $1, updated_at = $2 WHERE id = $3")
        .bind(token)
        .bind(now)
        .bind(claims.sub)
        .execute(pool.get_ref())
        .await;

    match result {
        Ok(res) => {
            log::info!(
                "tushare token updated successfully for user {}: rows affected = {}",
                claims.sub,
                res.rows_affected()
            );
            HttpResponse::Ok().json(serde_json::json!({
                "message": "tushare token 更新成功"
            }))
        }
        Err(e) => {
            log::error!(
                "Failed to update tushare token for user {}: {}",
                claims.sub,
                e
            );
            log::error!("Error details: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "更新失败"
            }))
        }
    }
}

/// 删除 tushare token
pub async fn delete_tushare_token(pool: web::Data<PgPool>, claims: JwtClaims) -> HttpResponse {
    // 记录请求到达
    log::info!("delete_tushare_token request received");

    // 记录用户信息
    log::info!("User ID: {}, Username: {:?}", claims.sub, claims.username);

    let now = Utc::now().naive_utc();
    log::info!(
        "Attempting to delete tushare_token for user {} at {}",
        claims.sub,
        now
    );

    let result =
        sqlx::query("UPDATE users SET tushare_token = NULL, updated_at = $1 WHERE id = $2")
            .bind(now)
            .bind(claims.sub)
            .execute(pool.get_ref())
            .await;

    match result {
        Ok(res) => {
            log::info!(
                "tushare token deleted successfully for user {}: rows affected = {}",
                claims.sub,
                res.rows_affected()
            );
            HttpResponse::Ok().json(serde_json::json!({
                "message": "tushare token 已删除"
            }))
        }
        Err(e) => {
            log::error!(
                "Failed to delete tushare token for user {}: {}",
                claims.sub,
                e
            );
            log::error!("Error details: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "删除失败"
            }))
        }
    }
}

/// 更新 AI token 请求
#[derive(Debug, Deserialize)]
pub struct UpdateAiTokenRequest {
    pub gemini_token: Option<String>,
    pub openai_token: Option<String>,
    pub preferred_ai_provider: Option<String>,
    pub openai_base_url: Option<String>,
    pub openai_model: Option<String>,
}

/// 更新 AI token
pub async fn update_ai_token(
    pool: web::Data<PgPool>,
    claims: JwtClaims,
    body: web::Json<UpdateAiTokenRequest>,
) -> HttpResponse {
    log::info!("update_ai_token request received for user {}", claims.sub);

    let now = Utc::now().naive_utc();

    let result = sqlx::query(
        "UPDATE users 
         SET gemini_token = COALESCE($1, gemini_token), 
             openai_token = COALESCE($2, openai_token),
             preferred_ai_provider = COALESCE($3, preferred_ai_provider),
             openai_base_url = COALESCE($4, openai_base_url),
             openai_model = COALESCE($5, openai_model),
             updated_at = $6 
         WHERE id = $7",
    )
    .bind(&body.gemini_token)
    .bind(&body.openai_token)
    .bind(&body.preferred_ai_provider)
    .bind(&body.openai_base_url)
    .bind(&body.openai_model)
    .bind(now)
    .bind(claims.sub)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(res) => {
            log::info!(
                "AI token updated successfully for user {}: rows affected = {}",
                claims.sub,
                res.rows_affected()
            );
            HttpResponse::Ok().json(serde_json::json!({
                "message": "AI token 更新成功"
            }))
        }
        Err(e) => {
            log::error!("Failed to update AI token for user {}: {}", claims.sub, e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "更新失败"
            }))
        }
    }
}

/// 删除 AI token
pub async fn delete_ai_token(pool: web::Data<PgPool>, claims: JwtClaims) -> HttpResponse {
    log::info!("delete_ai_token request received for user {}", claims.sub);

    let now = Utc::now().naive_utc();

    let result = sqlx::query(
        "UPDATE users 
         SET gemini_token = NULL, 
             openai_token = NULL,
             preferred_ai_provider = NULL,
             openai_base_url = NULL,
             openai_model = NULL,
             updated_at = $1 
         WHERE id = $2",
    )
    .bind(now)
    .bind(claims.sub)
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(res) => {
            log::info!(
                "AI token deleted successfully for user {}: rows affected = {}",
                claims.sub,
                res.rows_affected()
            );
            HttpResponse::Ok().json(serde_json::json!({
                "message": "AI token 已删除"
            }))
        }
        Err(e) => {
            log::error!("Failed to delete AI token for user {}: {}", claims.sub, e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "删除失败"
            }))
        }
    }
}

/// 创建 auth 路由 scope
pub fn auth_scope() -> actix_web::Scope {
    web::scope("/auth")
        .route("/register", web::post().to(register))
        .route("/login", web::post().to(login))
        .route("/me", web::get().to(get_current_user))
        .route("/tushare-token", web::put().to(update_tushare_token))
        .route("/tushare-token", web::delete().to(delete_tushare_token))
        .route("/ai-token", web::put().to(update_ai_token))
        .route("/ai-token", web::delete().to(delete_ai_token))
}
