// src/db/migrations.rs
// 数据库迁移管理模块
// 用于管理数据库表结构的版本升级

use log::{info, warn};
use sqlx::{postgres::PgPool, query, query_as};

/// 迁移版本结构体
#[derive(Debug, Clone)]
struct Migration {
    version: i32,
    name: &'static str,
    sql: &'static str,
}

/// 所有迁移定义
const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "create_users_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(100),
                role VARCHAR(20) NOT NULL DEFAULT 'user',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        "#,
    },
    Migration {
        version: 2,
        name: "create_stocks_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS stocks (
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
            )
        "#,
    },
    Migration {
        version: 3,
        name: "create_klines_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS klines (
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
            )
        "#,
    },
    Migration {
        version: 4,
        name: "create_technical_indicators_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS technical_indicators (
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
            )
        "#,
    },
    Migration {
        version: 5,
        name: "create_cs_bi_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS cs_bi (
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
            )
        "#,
    },
    Migration {
        version: 6,
        name: "create_cs_xd_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS cs_xd (
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
            )
        "#,
    },
    Migration {
        version: 7,
        name: "create_cs_zs_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS cs_zs (
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
            )
        "#,
    },
    Migration {
        version: 8,
        name: "create_cs_signals_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS cs_signals (
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
            )
        "#,
    },
    Migration {
        version: 9,
        name: "create_stock_screener_results_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS stock_screener_results (
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
            )
        "#,
    },
    Migration {
        version: 10,
        name: "create_data_update_log_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS data_update_log (
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
            )
        "#,
    },
    Migration {
        version: 11,
        name: "create_cs_cross_signals_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS cs_cross_signals (
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
            )
        "#,
    },
    Migration {
        version: 12,
        name: "create_stock_screener_results_ext_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS stock_screener_results_ext (
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
            )
        "#,
    },
    Migration {
        version: 13,
        name: "add_tushare_token_to_users",
        sql: r#"
            ALTER TABLE users ADD COLUMN IF NOT EXISTS tushare_token VARCHAR(255)
        "#,
    },
    Migration {
        version: 14,
        name: "create_indexes",
        sql: r#"
            CREATE INDEX IF NOT EXISTS idx_stocks_code ON stocks(code);
            CREATE INDEX IF NOT EXISTS idx_stocks_market ON stocks(market);
            CREATE INDEX IF NOT EXISTS idx_stocks_active ON stocks(is_active);
            CREATE INDEX IF NOT EXISTS idx_klines_stock_date ON klines(stock_id, trade_date);
            CREATE INDEX IF NOT EXISTS idx_klines_period_date ON klines(period, trade_date);
            CREATE INDEX IF NOT EXISTS idx_klines_stock_period ON klines(stock_id, period);
            CREATE INDEX IF NOT EXISTS idx_ti_stock_date ON technical_indicators(stock_id, trade_date);
            CREATE INDEX IF NOT EXISTS idx_ti_period ON technical_indicators(period);
            CREATE INDEX IF NOT EXISTS idx_bi_stock_period ON cs_bi(stock_id, period);
            CREATE INDEX IF NOT EXISTS idx_bi_dates ON cs_bi(stock_id, start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_xd_stock_period ON cs_xd(stock_id, period);
            CREATE INDEX IF NOT EXISTS idx_zs_stock_period ON cs_zs(stock_id, period);
            CREATE INDEX IF NOT EXISTS idx_zs_dates ON cs_zs(stock_id, start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_signals_stock ON cs_signals(stock_id, period);
            CREATE INDEX IF NOT EXISTS idx_signals_type ON cs_signals(signal_type);
            CREATE INDEX IF NOT EXISTS idx_signals_current ON cs_signals(stock_id, is_current);
            CREATE INDEX IF NOT EXISTS idx_signals_date ON cs_signals(signal_date DESC);
            CREATE INDEX IF NOT EXISTS idx_screener_period ON stock_screener_results(period, signal_type);
            CREATE INDEX IF NOT EXISTS idx_screener_date ON stock_screener_results(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_log_type_status ON data_update_log(data_type, status);
            CREATE INDEX IF NOT EXISTS idx_log_created ON data_update_log(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_cross_signals_stock ON cs_cross_signals(stock_id, period);
            CREATE INDEX IF NOT EXISTS idx_cross_signals_type ON cs_cross_signals(signal_type);
            CREATE INDEX IF NOT EXISTS idx_cross_signals_date ON cs_cross_signals(signal_date DESC);
            CREATE INDEX IF NOT EXISTS idx_cross_signals_efficient ON cs_cross_signals(stock_id, signal_type, signal_date DESC);
            CREATE INDEX IF NOT EXISTS idx_screener_ext_period ON stock_screener_results_ext(period);
            CREATE INDEX IF NOT EXISTS idx_screener_ext_kdj ON stock_screener_results_ext(kdj_cross_enabled, kdj_cross_period);
            CREATE INDEX IF NOT EXISTS idx_screener_ext_macd ON stock_screener_results_ext(macd_cross_enabled, macd_cross_period);
        "#,
    },
    Migration {
        version: 15,
        name: "add_ai_tokens_to_users",
        sql: r#"
            ALTER TABLE users ADD COLUMN IF NOT EXISTS gemini_token VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS openai_token VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_ai_provider VARCHAR(20);
        "#,
    },
    Migration {
        version: 16,
        name: "create_stock_analysis_reports_table",
        sql: r#"
            CREATE TABLE IF NOT EXISTS stock_analysis_reports (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                stock_code VARCHAR(10) NOT NULL,
                stock_name VARCHAR(100) NOT NULL,
                market VARCHAR(20) NOT NULL,
                analysis_date DATE NOT NULL,
                ai_provider VARCHAR(20) NOT NULL,
                report_content TEXT NOT NULL,
                summary TEXT,
                investment_rating VARCHAR(20),
                target_price DECIMAL(12, 2),
                confidence_score DECIMAL(5, 2),
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        "#,
    },
    Migration {
        version: 17,
        name: "create_reports_indexes",
        sql: r#"
            CREATE INDEX IF NOT EXISTS idx_reports_user_id ON stock_analysis_reports(user_id);
            CREATE INDEX IF NOT EXISTS idx_reports_stock_code ON stock_analysis_reports(stock_code);
            CREATE INDEX IF NOT EXISTS idx_reports_analysis_date ON stock_analysis_reports(analysis_date DESC);
            CREATE INDEX IF NOT EXISTS idx_reports_status ON stock_analysis_reports(status);
            CREATE INDEX IF NOT EXISTS idx_reports_created_at ON stock_analysis_reports(created_at DESC);
        "#,
    },
];

/// 初始化迁移历史表
async fn init_migration_history(pool: &PgPool) -> Result<(), String> {
    let create_history_table = r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            version INTEGER NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    "#;

    query(create_history_table)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to create schema_migrations table: {}", e))?;

    Ok(())
}

/// 获取当前数据库版本
async fn get_current_version(pool: &PgPool) -> Result<i32, String> {
    let result: Option<(Option<i32>,)> = query_as("SELECT MAX(version) FROM schema_migrations")
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Failed to get current version: {}", e))?;

    Ok(result.map_or(0, |v| v.0.unwrap_or(0)))
}

/// 记录迁移执行历史
async fn record_migration(pool: &PgPool, migration: &Migration) -> Result<(), String> {
    let now = chrono::Utc::now().naive_utc();
    query("INSERT INTO schema_migrations (version, name, executed_at) VALUES ($1, $2, $3)")
        .bind(migration.version)
        .bind(migration.name)
        .bind(now)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to record migration {}: {}", migration.version, e))?;

    Ok(())
}

/// 执行所有未执行的迁移
pub async fn run_migrations(pool: &PgPool) -> Result<(), String> {
    info!("Running database migrations...");

    // 初始化迁移历史表
    init_migration_history(pool).await?;

    // 获取当前版本
    let current_version = get_current_version(pool).await?;
    info!("Current database version: {}", current_version);

    // 筛选需要执行的迁移
    let pending_migrations: Vec<&Migration> = MIGRATIONS
        .iter()
        .filter(|m| m.version > current_version)
        .collect();

    if pending_migrations.is_empty() {
        info!("No pending migrations. Database is up to date.");
        return Ok(());
    }

    info!("Found {} pending migrations:", pending_migrations.len());
    for migration in &pending_migrations {
        info!("  - {} (version {})", migration.name, migration.version);
    }

    // 执行迁移
    for migration in pending_migrations {
        info!(
            "Executing migration {}: {}",
            migration.version, migration.name
        );

        // 将SQL按分号分割，支持多条语句
        let sql_statements: Vec<&str> = migration
            .sql
            .split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();

        let mut migration_success = true;

        for (idx, sql) in sql_statements.iter().enumerate() {
            info!(
                "Executing statement {}/{} for migration {}",
                idx + 1,
                sql_statements.len(),
                migration.version
            );

            match query(sql).execute(pool).await {
                Ok(_) => {
                    info!(
                        "Statement {}/{} executed successfully",
                        idx + 1,
                        sql_statements.len()
                    );
                }
                Err(e) => {
                    warn!(
                        "Failed to execute statement {}/{} for migration {}: {}",
                        idx + 1,
                        sql_statements.len(),
                        migration.version,
                        e
                    );
                    // 如果是重复执行错误，跳过
                    if e.to_string().contains("already exists") {
                        info!(
                            "Statement {}/{} already executed, skipping...",
                            idx + 1,
                            sql_statements.len()
                        );
                    } else {
                        migration_success = false;
                        break;
                    }
                }
            }
        }

        if migration_success {
            record_migration(pool, migration).await?;
            info!("Migration {} executed successfully", migration.version);
        } else {
            return Err(format!("Migration {} failed", migration.version));
        }
    }

    info!("All migrations completed successfully.");
    Ok(())
}

/// 获取最新迁移版本号
pub fn get_latest_version() -> i32 {
    MIGRATIONS.last().map_or(0, |m| m.version)
}
