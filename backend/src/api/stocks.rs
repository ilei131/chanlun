// src/api/stocks.rs
use actix_web::{web, HttpResponse, Scope};
use sqlx::PgPool;

use crate::db::models::{NewStock, Stock};
use crate::db::DbPool;

pub fn stocks_scope() -> Scope {
    web::scope("/stocks")
        .route("", web::get().to(get_stocks))
        .route("/{id}", web::get().to(get_stock_by_id))
        .route("", web::post().to(create_stock))
        .route("/{id}", web::delete().to(delete_stock))
}

async fn get_stocks(pool: web::Data<PgPool>) -> actix_web::Result<HttpResponse> {
    let stocks = sqlx::query_as::<_, Stock>(
        "SELECT id, code, name, market, stock_type, list_date, delist_date, is_active, created_at, updated_at FROM stocks WHERE is_active = true ORDER BY updated_at DESC"
    )
    .fetch_all(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Query error: {}", e)))?;

    Ok(HttpResponse::Ok().json(stocks))
}

async fn get_stock_by_id(
    pool: web::Data<PgPool>,
    path: web::Path<i32>
) -> actix_web::Result<HttpResponse> {
    let stock_id = path.into_inner();

    let stock = sqlx::query_as::<_, Stock>(
        "SELECT id, code, name, market, stock_type, list_date, delist_date, is_active, created_at, updated_at FROM stocks WHERE id = $1"
    )
    .bind(stock_id)
    .fetch_optional(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Query error: {}", e)))?
    .ok_or_else(|| actix_web::error::ErrorNotFound("Stock not found"))?;

    Ok(HttpResponse::Ok().json(stock))
}

async fn create_stock(
    pool: web::Data<PgPool>,
    body: web::Json<NewStock>
) -> actix_web::Result<HttpResponse> {
    let new_stock = body.into_inner();

    let stock = sqlx::query_as::<_, Stock>(
        r#"
        INSERT INTO stocks (code, name, market, stock_type, is_active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id, code, name, market, stock_type, list_date, delist_date, is_active, created_at, updated_at
        "#
    )
    .bind(&new_stock.code)
    .bind(&new_stock.name)
    .bind(&new_stock.market)
    .bind(&new_stock.stock_type)
    .fetch_one(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Insert error: {}", e)))?;

    Ok(HttpResponse::Created().json(stock))
}

async fn delete_stock(
    pool: web::Data<PgPool>,
    path: web::Path<i32>
) -> actix_web::Result<HttpResponse> {
    let stock_id = path.into_inner();

    let result = sqlx::query("UPDATE stocks SET is_active = false WHERE id = $1")
        .bind(stock_id)
        .execute(pool.get_ref())
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Delete error: {}", e)))?;

    if result.rows_affected() == 0 {
        return Err(actix_web::error::ErrorNotFound("Stock not found").into());
    }

    Ok(HttpResponse::NoContent().finish())
}
