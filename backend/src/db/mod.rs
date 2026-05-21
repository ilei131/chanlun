// src/db/mod.rs
pub mod models;

use actix_web::web;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, SaltString},
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

pub async fn ensure_tables_exist(pool: &DbPool) -> Result<(), String> {
    info!("Checking and creating tables if needed...");

    // Users table for authentication
    let users_table = r#"
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            email VARCHAR(100),
            role VARCHAR(20) NOT NULL DEFAULT 'user',
            is_active BOOLEAN DEFAULT true,
            tushare_token VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    "#;

    if let Err(e) = sqlx::query(users_table).execute(pool).await {
        return Err(format!("Failed to create users table: {}", e));
    }

    let sql_statements = vec![
        "CREATE TABLE IF NOT EXISTS stocks (
            id SERIAL PRIMARY KEY,
            code VARCHAR(10) NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            market VARCHAR(20) NOT NULL,
            stock_type VARCHAR(20) NOT NULL,
            list_date DATE,
            delist_date DATE,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE INDEX IF NOT EXISTS idx_stocks_code ON stocks(code)",
        "CREATE INDEX IF NOT EXISTS idx_stocks_market ON stocks(market)",
        "CREATE INDEX IF NOT EXISTS idx_stocks_active ON stocks(is_active)",
        "CREATE TABLE IF NOT EXISTS klines (
            id BIGSERIAL PRIMARY KEY,
            stock_id INTEGER NOT NULL REFERENCES stocks(id),
            trade_date DATE NOT NULL,
            period VARCHAR(10) NOT NULL,
            open DECIMAL(12, 3) NOT NULL,
            high DECIMAL(12, 3) NOT NULL,
            low DECIMAL(12, 3) NOT NULL,
            close DECIMAL(12, 3) NOT NULL,
            volume BIGINT NOT NULL,
            amount DECIMAL(20, 2),
            turnover_rate DECIMAL(8, 4),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(stock_id, trade_date, period)
        )",
        "CREATE INDEX IF NOT EXISTS idx_klines_stock_date ON klines(stock_id, trade_date)",
        "CREATE INDEX IF NOT EXISTS idx_klines_period_date ON klines(period, trade_date)",
        "CREATE INDEX IF NOT EXISTS idx_klines_stock_period ON klines(stock_id, period)",
        "CREATE TABLE IF NOT EXISTS technical_indicators (
            id BIGSERIAL PRIMARY KEY,
            stock_id INTEGER NOT NULL REFERENCES stocks(id),
            trade_date DATE NOT NULL,
            period VARCHAR(10) NOT NULL,
            ma5 DECIMAL(12, 3),
            ma10 DECIMAL(12, 3),
            ma20 DECIMAL(12, 3),
            ma30 DECIMAL(12, 3),
            ma60 DECIMAL(12, 3),
            ma120 DECIMAL(12, 3),
            ma250 DECIMAL(12, 3),
            macd_dif DECIMAL(12, 4),
            macd_dea DECIMAL(12, 4),
            macd_hist DECIMAL(12, 4),
            kdj_k DECIMAL(8, 4),
            kdj_d DECIMAL(8, 4),
            kdj_j DECIMAL(8, 4),
            rsi_6 DECIMAL(8, 4),
            rsi_12 DECIMAL(8, 4),
            rsi_24 DECIMAL(8, 4),
            boll_upper DECIMAL(12, 3),
            boll_mid DECIMAL(12, 3),
            boll_lower DECIMAL(12, 3),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(stock_id, trade_date, period)
        )",
        "CREATE INDEX IF NOT EXISTS idx_ti_stock_date ON technical_indicators(stock_id, trade_date)",
        "CREATE INDEX IF NOT EXISTS idx_ti_period ON technical_indicators(period)",
        "CREATE TABLE IF NOT EXISTS cs_bi (
            id BIGSERIAL PRIMARY KEY,
            stock_id INTEGER NOT NULL REFERENCES stocks(id),
            period VARCHAR(10) NOT NULL,
            bi_no INTEGER NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            start_price DECIMAL(12, 3) NOT NULL,
            end_price DECIMAL(12, 3) NOT NULL,
            bi_type VARCHAR(10) NOT NULL,
            start_kline_id BIGINT,
            end_kline_id BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(stock_id, period, bi_no)
        )",
        "CREATE INDEX IF NOT EXISTS idx_bi_stock_period ON cs_bi(stock_id, period)",
        "CREATE INDEX IF NOT EXISTS idx_bi_dates ON cs_bi(stock_id, start_date, end_date)",
        "CREATE TABLE IF NOT EXISTS cs_xd (
            id BIGSERIAL PRIMARY KEY,
            stock_id INTEGER NOT NULL REFERENCES stocks(id),
            period VARCHAR(10) NOT NULL,
            xd_no INTEGER NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            start_price DECIMAL(12, 3) NOT NULL,
            end_price DECIMAL(12, 3) NOT NULL,
            xd_type VARCHAR(10) NOT NULL,
            start_bi_id BIGINT,
            end_bi_id BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(stock_id, period, xd_no)
        )",
        "CREATE INDEX IF NOT EXISTS idx_xd_stock_period ON cs_xd(stock_id, period)",
        "CREATE TABLE IF NOT EXISTS cs_zs (
            id BIGSERIAL PRIMARY KEY,
            stock_id INTEGER NOT NULL REFERENCES stocks(id),
            period VARCHAR(10) NOT NULL,
            zs_no INTEGER NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            zg DECIMAL(12, 3) NOT NULL,
            zd DECIMAL(12, 3) NOT NULL,
            gg DECIMAL(12, 3),
            dd DECIMAL(12, 3),
            zs_type VARCHAR(10),
            start_xd_id BIGINT,
            end_xd_id BIGINT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(stock_id, period, zs_no)
        )",
        "CREATE INDEX IF NOT EXISTS idx_zs_stock_period ON cs_zs(stock_id, period)",
        "CREATE INDEX IF NOT EXISTS idx_zs_dates ON cs_zs(stock_id, start_date, end_date)",
        "CREATE TABLE IF NOT EXISTS cs_signals (
            id BIGSERIAL PRIMARY KEY,
            stock_id INTEGER NOT NULL REFERENCES stocks(id),
            period VARCHAR(10) NOT NULL,
            signal_type VARCHAR(20) NOT NULL,
            signal_date DATE NOT NULL,
            signal_price DECIMAL(12, 3) NOT NULL,
            bi_no INTEGER,
            xd_no INTEGER,
            zs_id INTEGER,
            is_current BOOLEAN DEFAULT false,
            is_valid BOOLEAN DEFAULT true,
            confidence DECIMAL(5, 2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE INDEX IF NOT EXISTS idx_signals_stock ON cs_signals(stock_id, period)",
        "CREATE INDEX IF NOT EXISTS idx_signals_type ON cs_signals(signal_type)",
        "CREATE INDEX IF NOT EXISTS idx_signals_current ON cs_signals(stock_id, is_current)",
        "CREATE INDEX IF NOT EXISTS idx_signals_date ON cs_signals(signal_date DESC)",
        "CREATE TABLE IF NOT EXISTS stock_screener_results (
            id BIGSERIAL PRIMARY KEY,
            screener_name VARCHAR(100) NOT NULL,
            period VARCHAR(10) NOT NULL,
            stock_id INTEGER NOT NULL REFERENCES stocks(id),
            signal_type VARCHAR(20) NOT NULL,
            price DECIMAL(12, 3),
            change_pct DECIMAL(8, 2),
            volume_ratio DECIMAL(8, 2),
            signal_date DATE,
            signal_price DECIMAL(12, 3),
            zs_zg DECIMAL(12, 3),
            zs_zd DECIMAL(12, 3),
            zs_date DATE,
            ma5 DECIMAL(12, 3),
            ma10 DECIMAL(12, 3),
            ma20 DECIMAL(12, 3),
            macd_dif DECIMAL(12, 4),
            macd_dea DECIMAL(12, 4),
            kdj_k DECIMAL(8, 4),
            kdj_d DECIMAL(8, 4),
            kdj_j DECIMAL(8, 4),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(screener_name, period, stock_id)
        )",
        "CREATE INDEX IF NOT EXISTS idx_screener_period ON stock_screener_results(period, signal_type)",
        "CREATE INDEX IF NOT EXISTS idx_screener_date ON stock_screener_results(created_at DESC)",
        "CREATE TABLE IF NOT EXISTS data_update_log (
            id BIGSERIAL PRIMARY KEY,
            data_type VARCHAR(50) NOT NULL,
            period VARCHAR(10),
            status VARCHAR(20) NOT NULL,
            total_count INTEGER,
            success_count INTEGER,
            error_message TEXT,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        "CREATE INDEX IF NOT EXISTS idx_log_type_status ON data_update_log(data_type, status)",
        "CREATE INDEX IF NOT EXISTS idx_log_created ON data_update_log(created_at DESC)",
        "CREATE TABLE IF NOT EXISTS cs_cross_signals (
            id BIGSERIAL PRIMARY KEY,
            stock_id INTEGER NOT NULL REFERENCES stocks(id),
            period VARCHAR(10) NOT NULL,
            signal_type VARCHAR(30) NOT NULL,
            signal_date DATE NOT NULL,
            signal_price DECIMAL(12, 3),
            kdj_k_before DECIMAL(8, 4),
            kdj_k_after DECIMAL(8, 4),
            kdj_d_before DECIMAL(8, 4),
            kdj_d_after DECIMAL(8, 4),
            macd_dif_before DECIMAL(12, 4),
            macd_dif_after DECIMAL(12, 4),
            macd_dea_before DECIMAL(12, 4),
            macd_dea_after DECIMAL(12, 4),
            is_current BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(stock_id, period, signal_type, signal_date)
        )",
        "CREATE INDEX IF NOT EXISTS idx_cross_signals_stock ON cs_cross_signals(stock_id, period)",
        "CREATE INDEX IF NOT EXISTS idx_cross_signals_type ON cs_cross_signals(signal_type)",
        "CREATE INDEX IF NOT EXISTS idx_cross_signals_date ON cs_cross_signals(signal_date DESC)",
        "CREATE INDEX IF NOT EXISTS idx_cross_signals_efficient ON cs_cross_signals(stock_id, signal_type, signal_date DESC)",
        "CREATE TABLE IF NOT EXISTS stock_screener_results_ext (
            id BIGSERIAL PRIMARY KEY,
            screener_name VARCHAR(100) NOT NULL,
            period VARCHAR(10) NOT NULL,
            stock_id INTEGER NOT NULL REFERENCES stocks(id),
            chanlun_signal_type VARCHAR(20),
            chanlun_signal_date DATE,
            chanlun_signal_price DECIMAL(12, 3),
            chanlun_confidence DECIMAL(5, 2),
            kdj_cross_enabled BOOLEAN DEFAULT false,
            kdj_cross_date DATE,
            kdj_cross_period VARCHAR(10),
            kdj_cross_days INTEGER,
            macd_cross_enabled BOOLEAN DEFAULT false,
            macd_cross_date DATE,
            macd_cross_period VARCHAR(10),
            macd_cross_days INTEGER,
            current_price DECIMAL(12, 3),
            change_pct DECIMAL(8, 2),
            zs_zg DECIMAL(12, 3),
            zs_zd DECIMAL(12, 3),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(screener_name, period, stock_id)
        )",
        "CREATE INDEX IF NOT EXISTS idx_screener_ext_period ON stock_screener_results_ext(period)",
        "CREATE INDEX IF NOT EXISTS idx_screener_ext_kdj ON stock_screener_results_ext(kdj_cross_enabled, kdj_cross_period)",
        "CREATE INDEX IF NOT EXISTS idx_screener_ext_macd ON stock_screener_results_ext(macd_cross_enabled, macd_cross_period)",
    ];

    for (i, sql) in sql_statements.iter().enumerate() {
        if let Err(e) = sqlx::query(sql).execute(pool).await {
            info!("Table creation warning at statement {}: {}", i, e);
        }
    }

    info!("All tables are ready.");
    Ok(())
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
