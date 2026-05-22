// src/api/mod.rs
pub mod analysis;
pub mod auth;
pub mod indicators;
pub mod screener;
pub mod stocks;

use actix_web::web;

use crate::api::analysis::routes as analysis_routes;
use crate::api::auth::auth_scope;
use crate::api::indicators::indicators_scope;
use crate::api::screener::screener_scope;
use crate::api::stocks::stocks_scope;

pub fn init_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1")
            .service(auth_scope())
            .service(stocks_scope())
            .service(indicators_scope())
            .service(screener_scope())
            .service(analysis_routes()),
    );
}
