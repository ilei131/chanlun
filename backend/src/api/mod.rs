// src/api/mod.rs
pub mod indicators;
pub mod screener;
pub mod stocks;

use actix_web::web;

use crate::api::indicators::indicators_scope;
use crate::api::screener::screener_scope;
use crate::api::stocks::stocks_scope;

pub fn init_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1")
            .service(stocks_scope())
            .service(indicators_scope())
            .service(screener_scope()),
    );
}
