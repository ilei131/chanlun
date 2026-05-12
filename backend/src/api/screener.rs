// src/api/screener.rs
use actix_web::{web, HttpResponse, Scope};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use crate::db::models::Stock;

#[derive(Debug, Deserialize)]
pub struct ScreenerRequest {
    pub chanlun_buy: Option<ChanlunBuyCondition>,
    pub fractal: Option<FractalCondition>,
    pub kdj_cross: Option<CrossCondition>,
    pub macd_cross: Option<CrossCondition>,
    pub price_range: Option<PriceRangeCondition>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ChanlunBuyCondition {
    pub enabled: bool,
    pub types: Vec<String>,
    pub require_current: bool,
}

#[derive(Debug, Deserialize)]
pub struct FractalCondition {
    pub enabled: bool,
    pub types: Vec<String>,
    pub periods: Vec<String>,
    pub require_confirmed: bool,
    pub min_quality_score: Option<f64>,
    pub days_within: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CrossCondition {
    pub enabled: bool,
    pub periods: Vec<String>,
    pub days_within: i32,
}

#[derive(Debug, Deserialize)]
pub struct PriceRangeCondition {
    pub enabled: bool,
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Serialize)]
pub struct ScreenerResponse {
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
    pub data: Vec<ScreenerResult>,
}

#[derive(Debug, Serialize)]
pub struct ScreenerResult {
    pub stock_id: i32,
    pub code: String,
    pub name: String,
    pub current_price: Option<f64>,
    pub change_pct: Option<f64>,
    pub matched_conditions: MatchedConditions,
    pub match_count: i32,
    pub match_ratio: f64,
}

#[derive(Debug, Serialize, Default)]
pub struct MatchedConditions {
    pub chanlun_buy: Option<ChanlunBuyMatch>,
    pub fractal: Option<FractalMatch>,
    pub kdj_cross: Option<CrossMatch>,
    pub macd_cross: Option<CrossMatch>,
}

#[derive(Debug, Serialize)]
pub struct ChanlunBuyMatch {
    pub types: Vec<String>,
    pub signal_date: String,
}

#[derive(Debug, Serialize)]
pub struct FractalMatch {
    pub types: Vec<String>,
    pub fx_date: String,
    pub quality_score: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct CrossMatch {
    pub periods: Vec<String>,
    pub latest_cross_date: String,
}

pub fn screener_scope() -> Scope {
    web::scope("/screener")
        .route("/run", web::post().to(run_screener))
}

async fn run_screener(
    pool: web::Data<PgPool>,
    body: web::Json<ScreenerRequest>
) -> actix_web::Result<HttpResponse> {
    let request = body.into_inner();

    let page = request.page.unwrap_or(1);
    let page_size = request.page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;

    let mut conditions_enabled = 0;
    let mut stock_ids: Vec<i32> = Vec::new();

    if let Some(ref cb) = request.chanlun_buy {
        if cb.enabled && !cb.types.is_empty() {
            conditions_enabled += 1;
            
            let placeholders: Vec<String> = cb.types.iter().enumerate()
                .map(|(i, _)| format!("${}", i + 1))
                .collect();
            
            let is_current_param = format!("${}", cb.types.len() + 1);
            let query = format!(
                "SELECT DISTINCT stock_id FROM cs_signals WHERE signal_type IN ({}) AND is_current = {}",
                placeholders.join(", "), is_current_param
            );
            
            let mut query_builder = sqlx::query_scalar::<_, i32>(&query);
            
            for t in &cb.types {
                query_builder = query_builder.bind(t);
            }
            query_builder = query_builder.bind(cb.require_current);
            
            let results = query_builder.fetch_all(pool.get_ref()).await;
            
            if let Ok(ids) = results {
                stock_ids.extend(ids);
            }
        }
    }

    if let Some(ref kdj) = request.kdj_cross {
        if kdj.enabled && !kdj.periods.is_empty() {
            conditions_enabled += 1;
            
            let placeholders: Vec<String> = kdj.periods.iter().enumerate()
                .map(|(i, _)| format!("${}", i + 1))
                .collect();
            
            let days_within_param = format!("${}", kdj.periods.len() + 1);
            let query = format!(
                "SELECT DISTINCT stock_id FROM cs_cross_signals WHERE signal_type = 'kdj_gold_cross' AND period IN ({}) AND signal_date >= CURRENT_DATE - INTERVAL '1 day' * {}",
                placeholders.join(", "), days_within_param
            );
            
            let mut query_builder = sqlx::query_scalar::<_, i32>(&query);
            
            for p in &kdj.periods {
                query_builder = query_builder.bind(p);
            }
            query_builder = query_builder.bind(kdj.days_within);
            
            let results = query_builder.fetch_all(pool.get_ref()).await;
            
            if let Ok(ids) = results {
                stock_ids.extend(ids);
            }
        }
    }

    if let Some(ref macd) = request.macd_cross {
        if macd.enabled && !macd.periods.is_empty() {
            conditions_enabled += 1;
            
            let placeholders: Vec<String> = macd.periods.iter().enumerate()
                .map(|(i, _)| format!("${}", i + 1))
                .collect();
            
            let days_within_param = format!("${}", macd.periods.len() + 1);
            let query = format!(
                "SELECT DISTINCT stock_id FROM cs_cross_signals WHERE signal_type = 'macd_gold_cross' AND period IN ({}) AND signal_date >= CURRENT_DATE - INTERVAL '1 day' * {}",
                placeholders.join(", "), days_within_param
            );
            
            let mut query_builder = sqlx::query_scalar::<_, i32>(&query);
            
            for p in &macd.periods {
                query_builder = query_builder.bind(p);
            }
            query_builder = query_builder.bind(macd.days_within);
            
            let results = query_builder.fetch_all(pool.get_ref()).await;
            
            if let Ok(ids) = results {
                stock_ids.extend(ids);
            }
        }
    }

    let final_stock_ids: Vec<i32>;
    
    if conditions_enabled > 0 && !stock_ids.is_empty() {
        let mut id_counts: std::collections::HashMap<i32, usize> = std::collections::HashMap::new();
        for id in stock_ids {
            *id_counts.entry(id).or_insert(0) += 1;
        }
        
        final_stock_ids = id_counts.into_iter()
            .filter(|(_, count)| *count >= conditions_enabled)
            .map(|(id, _)| id)
            .collect();
    } else {
        final_stock_ids = sqlx::query_scalar::<_, i32>("SELECT id FROM stocks WHERE is_active = true")
            .fetch_all(pool.get_ref())
            .await
            .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Query error: {}", e)))?;
    }

    let total = final_stock_ids.len() as i64;

    let paginated_ids: Vec<i32> = final_stock_ids.into_iter()
        .skip(offset as usize)
        .take(page_size as usize)
        .collect();

    if paginated_ids.is_empty() {
        return Ok(HttpResponse::Ok().json(ScreenerResponse {
            total: 0,
            page,
            page_size,
            data: Vec::new(),
        }));
    }

    let placeholders: Vec<String> = paginated_ids.iter().enumerate()
        .map(|(i, _)| format!("${}", i + 1))
        .collect();
    
    let query = format!(
        "SELECT id, code, name, market, stock_type, list_date, delist_date, is_active, created_at, updated_at FROM stocks WHERE id IN ({})",
        placeholders.join(", ")
    );
    
    let mut query_builder = sqlx::query_as::<_, Stock>(&query);
    
    for id in &paginated_ids {
        query_builder = query_builder.bind(id);
    }
    
    let results = query_builder.fetch_all(pool.get_ref()).await
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Query error: {}", e)))?;

    let screener_results = results.into_iter().map(|stock| {
        ScreenerResult {
            stock_id: stock.id,
            code: stock.code,
            name: stock.name,
            current_price: None,
            change_pct: None,
            matched_conditions: MatchedConditions::default(),
            match_count: conditions_enabled as i32,
            match_ratio: 1.0,
        }
    }).collect();

    Ok(HttpResponse::Ok().json(ScreenerResponse {
        total,
        page,
        page_size,
        data: screener_results,
    }))
}
