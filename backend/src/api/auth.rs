// src/api/auth.rs
use actix_web::{web, HttpResponse};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::Utc;
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
    pub exp: i64, // expiration timestamp
    pub iat: i64, // issued at
}

/// 生成 JWT token
fn generate_token(user: &User) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now().timestamp();
    let expiration = now + JWT_EXPIRATION_HOURS * 3600;

    let claims = JwtClaims {
        sub: user.id,
        username: user.username.clone(),
        role: user.role.clone(),
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
            };
            HttpResponse::Ok().json(serde_json::json!({
                "message": "注册成功",
                "user": user_info
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
        },
    };

    HttpResponse::Ok().json(response)
}

/// 获取当前用户信息
pub async fn get_current_user(
    pool: web::Data<PgPool>,
    claims: web::ReqData<JwtClaims>,
) -> HttpResponse {
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
            };
            HttpResponse::Ok().json(user_info)
        }
        None => HttpResponse::NotFound().json(serde_json::json!({
            "error": "用户不存在"
        })),
    }
}

/// 创建 auth 路由scope
pub fn auth_scope() -> actix_web::Scope {
    web::scope("/auth")
        .route("/register", web::post().to(register))
        .route("/login", web::post().to(login))
        .route("/me", web::get().to(get_current_user))
}
