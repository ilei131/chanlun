// src/db/mod.rs
pub mod migrations;
pub mod models;

use actix_web::web;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use log::{info, warn};
use sqlx::postgres::{PgPool, PgPoolOptions};

use crate::config::Config;

pub type DbPool = PgPool;

pub async fn ensure_database_exists(config: &Config) -> Result<(), String> {
    let admin_url = format!(
        "{}://{}:{}@{}:{}/postgres",
        config.db_protocol, config.db_user, config.db_password, config.db_host, config.db_port
    );

    info!("Checking database connection to postgres...");
    let admin_pool = match PgPoolOptions::new()
        .max_connections(1)
        .connect(&admin_url)
        .await
    {
        Ok(pool) => pool,
        Err(e) => {
            warn!("Cannot connect to postgres database: {}. Will try to connect directly to target database.", e);
            return Ok(());
        }
    };

    let exists: Option<(i32,)> =
        sqlx::query_as("SELECT oid::int FROM pg_database WHERE datname = $1")
            .bind(&config.db_name)
            .fetch_optional(&admin_pool)
            .await
            .map_err(|e| format!("Failed to check database existence: {}", e))?;

    if exists.is_none() {
        info!("Creating database '{}'...", config.db_name);
        sqlx::query(&format!("CREATE DATABASE {}", config.db_name))
            .execute(&admin_pool)
            .await
            .map_err(|e| format!("Failed to create database: {}", e))?;
        info!("Database '{}' created successfully.", config.db_name);
    } else {
        info!("Database '{}' already exists.", config.db_name);
    }

    Ok(())
}

/// 确保数据库表存在（使用迁移系统）
pub async fn ensure_tables_exist(pool: &DbPool) -> Result<(), String> {
    migrations::run_migrations(pool).await
}

pub async fn init_pool(config: &Config) -> Result<DbPool, String> {
    ensure_database_exists(config).await?;

    info!("Connecting to database: {}", config.db_name);
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url())
        .await
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    ensure_tables_exist(&pool).await?;

    // 初始化 admin 用户
    init_admin_user(&pool).await?;

    Ok(pool)
}

/// 初始化 admin 用户
pub async fn init_admin_user(pool: &DbPool) -> Result<(), String> {
    // 检查 admin 用户是否已存在
    let existing: Option<(i32,)> = sqlx::query_as("SELECT id FROM users WHERE username = 'admin'")
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Failed to check admin user: {}", e))?;

    if existing.is_some() {
        info!("Admin user already exists.");
        return Ok(());
    }

    // 创建 admin 用户，默认密码为 admin123
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password("admin123".as_bytes(), &salt)
        .map_err(|e| format!("Failed to hash password: {}", e))?;

    let now = chrono::Utc::now().naive_utc();
    sqlx::query(
        r#"
        INSERT INTO users (username, password_hash, email, role, is_active, created_at, updated_at)
        VALUES ('admin', $1, 'admin@chanlun.local', 'admin', true, $2, $2)
        "#,
    )
    .bind(password_hash.to_string())
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create admin user: {}", e))?;

    info!("Admin user created successfully. Default password: admin123");
    info!("Please change the password after first login!");
    Ok(())
}

pub fn get_pool(data: &web::Data<DbPool>) -> DbPool {
    data.get_ref().clone()
}
