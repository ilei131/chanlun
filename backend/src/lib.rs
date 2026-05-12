// src/lib.rs
//! 缠论选股系统核心库

pub mod api;
pub mod algorithms;
pub mod config;
pub mod db;

use actix_web::{App, HttpServer};
use dotenv::dotenv;
use log::info;

use crate::config::Config;
use crate::db::init_pool;

pub async fn run_server() -> std::io::Result<()> {
    dotenv().ok();
    env_logger::init();

    let config = Config::from_env().expect("Failed to load config");

    info!("Starting ChanLun Server...");
    info!("Database: {}://{}:{}@{}/{}",
        config.db_protocol,
        config.db_user,
        "***",
        config.db_host,
        config.db_name
    );

    let pool = init_pool(&config).await
        .map_err(|e| {
            log::error!("Failed to initialize database: {}", e);
            std::io::Error::new(std::io::ErrorKind::Other, e)
        })?;

    info!("Database initialized successfully.");
    info!("Server ready. Starting HTTP server on {}:{}", config.host, config.port);

    HttpServer::new(move || {
        App::new()
            .app_data(actix_web::web::Data::new(pool.clone()))
            .configure(api::init_routes)
    })
    .bind((config.host.as_str(), config.port))?
    .run()
    .await
}
