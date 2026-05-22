// src/config.rs
use dotenv::dotenv;
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    // Server
    pub host: String,
    pub port: u16,

    // Database
    pub db_protocol: String,
    pub db_host: String,
    pub db_port: u16,
    pub db_user: String,
    pub db_password: String,
    pub db_name: String,

    // API
    pub api_prefix: String,

    // Tushare
    pub tushare_token: String,
    pub tushare_app_id: String,

    // Data Collector
    pub data_cache_dir: String,
    pub history_start_date: String,

    // Admin
    pub admin_default_password: String,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        dotenv().ok();

        Ok(Self {
            host: env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8080),

            db_protocol: env::var("DB_PROTOCOL").unwrap_or_else(|_| "postgres".to_string()),
            db_host: env::var("DB_HOST").unwrap_or_else(|_| "localhost".to_string()),
            db_port: env::var("DB_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(5432),
            db_user: env::var("DB_USER").unwrap_or_else(|_| "postgres".to_string()),
            db_password: env::var("DB_PASSWORD").unwrap_or_else(|_| "password".to_string()),
            db_name: env::var("DB_NAME").unwrap_or_else(|_| "chanlun".to_string()),

            api_prefix: env::var("API_PREFIX").unwrap_or_else(|_| "/api/v1".to_string()),

            tushare_token: env::var("TUSHARE_TOKEN").unwrap_or_else(|_| "".to_string()),
            tushare_app_id: env::var("TUSHARE_APP_ID").unwrap_or_else(|_| "".to_string()),

            data_cache_dir: env::var("DATA_CACHE_DIR")
                .unwrap_or_else(|_| "./data_cache".to_string()),
            history_start_date: env::var("HISTORY_START_DATE")
                .unwrap_or_else(|_| "20100101".to_string()),

            admin_default_password: env::var("ADMIN_DEFAULT_PASSWORD")
                .unwrap_or_else(|_| "admin123".to_string()),
        })
    }

    pub fn database_url(&self) -> String {
        format!(
            "{}://{}:{}@{}:{}/{}",
            self.db_protocol,
            self.db_user,
            self.db_password,
            self.db_host,
            self.db_port,
            self.db_name
        )
    }
}
