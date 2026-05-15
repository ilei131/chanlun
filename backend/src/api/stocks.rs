// src/api/stocks.rs
use actix_web::{web, HttpResponse, Scope};
use chrono::{NaiveDate, NaiveDateTime};
use log::{debug, info};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;

use crate::algorithms::czsc_integration::{self, ChanlunAnalyzer};
use crate::db::models::{NewStock, Stock};
use crate::tushare::client::TushareClient;
use czsc_core::objects::bar::RawBar;

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub stock_id: Option<i32>,
    pub ts_code: String,
    pub code: String,
    pub name: String,
    pub market: String,
    pub area: Option<String>,
    pub industry: Option<String>,
    pub list_date: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StockDetail {
    pub ts_code: String,
    pub code: String,
    pub name: String,
    pub market: String,
    pub current_price: Option<f64>,
    pub change_pct: Option<f64>,
    pub area: Option<String>,
    pub industry: Option<String>,
    pub list_date: Option<String>,
    pub stock_type: Option<String>,
    pub kline_data: Vec<KlineResponse>,
    pub chanlun_signals: ChanlunSignals,
    pub indicators: TechnicalIndicators,
}

#[derive(Debug, Serialize)]
pub struct KlineResponse {
    pub trade_date: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    pub amount: Option<f64>,
    pub bi_points: Vec<BiPoint>,
}

#[derive(Debug, Serialize)]
pub struct BiPoint {
    pub position: usize,
    pub direction: String,
    pub price: f64,
    pub date: String,
}

#[derive(Debug, Serialize)]
pub struct ChanlunSignals {
    pub buy_signals: Vec<BuySignalResponse>,
    pub zs_list: Vec<ZhongShuResponse>,
    pub fx_list: Vec<FenXingResponse>,
    pub bi_list: Vec<BiResponse>,
}

#[derive(Debug, Serialize)]
pub struct BiResponse {
    pub start_date: String,
    pub end_date: String,
    pub direction: String,
    pub price_change: f64,
    pub high: f64,
    pub low: f64,
}

#[derive(Debug, Serialize)]
pub struct BuySignalResponse {
    pub signal_type: String,
    pub date: String,
    pub price: f64,
}

#[derive(Debug, Serialize)]
pub struct ZhongShuResponse {
    pub start_date: String,
    pub end_date: String,
    pub zd: f64,
    pub zg: f64,
    pub bi_count: usize,
}

#[derive(Debug, Serialize)]
pub struct FenXingResponse {
    pub date: String,
    pub price: f64,
    pub direction: String,
}

#[derive(Debug, Serialize)]
pub struct TechnicalIndicators {
    pub macd: Vec<MacdData>,
    pub kdj: Vec<KdjData>,
}

#[derive(Debug, Serialize)]
pub struct MacdData {
    pub trade_date: String,
    pub dif: f64,
    pub dea: f64,
    pub hist: f64,
}

#[derive(Debug, Serialize)]
pub struct KdjData {
    pub trade_date: String,
    pub k: f64,
    pub d: f64,
    pub j: f64,
}

#[derive(Debug, Deserialize)]
pub struct StockDetailRequest {
    pub code: String,
    pub period: Option<String>,
    pub days: Option<i32>,
}

pub fn stocks_scope() -> Scope {
    web::scope("/stocks")
        .route("", web::get().to(get_stocks))
        .route("/search", web::get().to(search_stocks))
        .route("/detail", web::post().to(get_stock_detail))
        .route("/{id}", web::get().to(get_stock_by_id))
        .route("", web::post().to(create_stock))
        .route("/{id}", web::delete().to(delete_stock))
        .route("/sync", web::post().to(sync_stock_basic))
}

async fn search_stocks(
    pool: web::Data<PgPool>,
    query: web::Query<SearchQuery>,
) -> actix_web::Result<HttpResponse> {
    let keyword = &query.keyword;
    let trimmed_keyword = keyword.trim();

    if trimmed_keyword.is_empty() || trimmed_keyword.len() < 2 {
        return Ok(HttpResponse::Ok().json(Vec::<SearchResult>::new()));
    }

    let db_stocks = sqlx::query_as::<_, Stock>(
        "SELECT id, code, name, market, stock_type, list_date, delist_date, is_active, created_at, updated_at
         FROM stocks
         WHERE code = $1 AND is_active = true
         LIMIT 1"
    )
    .bind(trimmed_keyword)
    .fetch_all(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Query error: {}", e)))?;

    if !db_stocks.is_empty() {
        let results: Vec<SearchResult> = db_stocks
            .iter()
            .map(|s| {
                let ts_code = if s.market == "SH" {
                    format!("{}.SH", s.code)
                } else if s.market == "BJ" {
                    format!("{}.BJ", s.code)
                } else {
                    format!("{}.SZ", s.code)
                };
                SearchResult {
                    stock_id: Some(s.id),
                    ts_code,
                    code: s.code.clone(),
                    name: s.name.clone(),
                    market: s.market.clone(),
                    area: None,
                    industry: None,
                    list_date: s.list_date.map(|d| d.to_string()),
                }
            })
            .collect();
        return Ok(HttpResponse::Ok().json(results));
    }

    let search_pattern = format!("%{}%", trimmed_keyword);
    let db_stocks = sqlx::query_as::<_, Stock>(
        "SELECT id, code, name, market, stock_type, list_date, delist_date, is_active, created_at, updated_at
         FROM stocks
         WHERE (code ILIKE $1 OR name ILIKE $1) AND is_active = true
         ORDER BY
             CASE WHEN code ILIKE $2 THEN 0 WHEN name ILIKE $2 THEN 1 ELSE 2 END,
             updated_at DESC
         LIMIT 20"
    )
    .bind(&search_pattern)
    .bind(format!("{}%", trimmed_keyword))
    .fetch_all(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Query error: {}", e)))?;

    if !db_stocks.is_empty() {
        let results: Vec<SearchResult> = db_stocks
            .iter()
            .map(|s| {
                let ts_code = if s.market == "SH" {
                    format!("{}.SH", s.code)
                } else if s.market == "BJ" {
                    format!("{}.BJ", s.code)
                } else {
                    format!("{}.SZ", s.code)
                };
                SearchResult {
                    stock_id: Some(s.id),
                    ts_code,
                    code: s.code.clone(),
                    name: s.name.clone(),
                    market: s.market.clone(),
                    area: None,
                    industry: None,
                    list_date: s.list_date.map(|d| d.to_string()),
                }
            })
            .collect();
        return Ok(HttpResponse::Ok().json(results));
    }

    if !can_call_stock_basic() {
        info!("[search_stocks] stock_basic接口调用频率超限，跳过Tushare查询");
        return Ok(HttpResponse::Ok().json(Vec::<SearchResult>::new()));
    }

    let client = TushareClient::new();
    let result = client.search_stocks(keyword).await;

    match result {
        Ok(stocks) => {
            let mut results = Vec::new();
            for stock in stocks {
                let market = if stock.ts_code.ends_with(".SH") {
                    "SH"
                } else if stock.ts_code.ends_with(".BJ") {
                    "BJ"
                } else {
                    "SZ"
                };

                results.push(SearchResult {
                    stock_id: None,
                    ts_code: stock.ts_code,
                    code: stock.symbol,
                    name: stock.name,
                    market: market.to_string(),
                    area: stock.area,
                    industry: stock.industry,
                    list_date: stock.list_date,
                });
            }
            Ok(HttpResponse::Ok().json(results))
        }
        Err(_) => Ok(HttpResponse::Ok().json(Vec::<SearchResult>::new())),
    }
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub keyword: String,
}

async fn get_stock_detail(
    _pool: web::Data<PgPool>,
    body: web::Json<StockDetailRequest>,
) -> actix_web::Result<HttpResponse> {
    let code = &body.code;
    let period = body.period.as_deref().unwrap_or("daily");
    let days = body.days.unwrap_or(365);

    let ts_code = TushareClient::convert_ts_code(code);

    let client = TushareClient::new();

    let end_date = chrono::Local::now().format("%Y%m%d").to_string();
    let start_date = (chrono::Local::now() - chrono::Duration::days(days as i64))
        .format("%Y%m%d")
        .to_string();

    let kline_result = client
        .get_kline_data(&ts_code, &start_date, &end_date, period)
        .await;

    let kline_data = match kline_result {
        Ok(data) => data,
        Err(e) => {
            return Err(actix_web::error::ErrorInternalServerError(format!(
                "Failed to fetch kline data: {}",
                e
            ))
            .into());
        }
    };

    if kline_data.is_empty() {
        return Err(actix_web::error::ErrorNotFound("No kline data found").into());
    }

    let mut sorted_data = kline_data.clone();
    sorted_data.sort_by(|a, b| a.trade_date.cmp(&b.trade_date));

    info!("=== K线数据排序 ===");
    info!(
        "排序前第一条日期: {}",
        kline_data.first().unwrap().trade_date
    );
    info!(
        "排序前最后一条日期: {}",
        kline_data.last().unwrap().trade_date
    );
    info!(
        "排序后第一条日期: {}",
        sorted_data.first().unwrap().trade_date
    );
    info!(
        "排序后最后一条日期: {}",
        sorted_data.last().unwrap().trade_date
    );
    info!("=== K线数据排序结束 ===");

    let bars: Vec<RawBar> = sorted_data
        .iter()
        .enumerate()
        .map(|(i, k)| {
            let date = NaiveDate::parse_from_str(&k.trade_date, "%Y%m%d").unwrap();
            let datetime = NaiveDateTime::new(date, chrono::NaiveTime::default());
            czsc_integration::convert_to_raw_bar(
                &k.ts_code, datetime, k.open, k.high, k.low, k.close, k.vol, i as i32,
            )
        })
        .collect();

    info!("=== RawBar 数据 ===");
    if !bars.is_empty() {
        info!(
            "第一个 bar: symbol={}, dt={}, open={}, high={}, low={}, close={}",
            bars[0].symbol, bars[0].dt, bars[0].open, bars[0].high, bars[0].low, bars[0].close
        );
        info!(
            "最后一个 bar: symbol={}, dt={}, open={}, high={}, low={}, close={}",
            bars.last().unwrap().symbol,
            bars.last().unwrap().dt,
            bars.last().unwrap().open,
            bars.last().unwrap().high,
            bars.last().unwrap().low,
            bars.last().unwrap().close
        );
    }
    info!("bars 数量: {}", bars.len());
    info!("=== RawBar 数据结束 ===");

    let analyzer = ChanlunAnalyzer::new(bars, 50);
    let signals = analyzer.detect_buy_signals();
    let _bi_list = analyzer.get_bi_list();
    let zs_list = analyzer.get_zs_list();
    let fx_list = analyzer.get_fx_list();

    info!("=== 缠论分析结果 ===");
    info!("K线数据数量: {}", kline_data.len());
    info!("笔数量: {}", _bi_list.len());
    info!("中枢数量: {}", zs_list.len());
    info!("分型数量: {}", fx_list.len());
    info!("信号数量: {}", signals.len());
    signals.iter().for_each(|s| {
        info!(
            "  信号类型: {:?}, 日期: {}, 价格: {}",
            s.signal_type,
            s.date.format("%Y%m%d"),
            s.price
        );
    });
    info!("=== 缠论分析结束 ===");

    let market = if ts_code.ends_with(".SH") {
        "SH"
    } else if ts_code.ends_with(".BJ") {
        "BJ"
    } else {
        "SZ"
    };

    let current_price = kline_data.last().map(|k| k.close);
    let change_pct = if kline_data.len() >= 2 {
        let current = kline_data.last().unwrap().close;
        let prev = kline_data[kline_data.len() - 2].close;
        Some(((current - prev) / prev) * 100.0)
    } else {
        None
    };

    let kline_response: Vec<KlineResponse> = kline_data
        .into_iter()
        .enumerate()
        .map(|(_i, k)| KlineResponse {
            trade_date: k.trade_date,
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
            volume: k.vol,
            amount: k.amount,
            bi_points: Vec::new(),
        })
        .collect();

    let buy_signals: Vec<BuySignalResponse> = signals
        .into_iter()
        .map(|s| BuySignalResponse {
            signal_type: match s.signal_type {
                czsc_integration::BuySignalType::FirstBuy => "first_buy",
                czsc_integration::BuySignalType::SecondBuy => "second_buy",
                czsc_integration::BuySignalType::ThirdBuy => "third_buy",
                czsc_integration::BuySignalType::FirstSell => "first_sell",
                czsc_integration::BuySignalType::SecondSell => "second_sell",
                czsc_integration::BuySignalType::ThirdSell => "third_sell",
            }
            .to_string(),
            date: s.date.format("%Y%m%d").to_string(),
            price: s.price,
        })
        .collect();

    let zs_responses: Vec<ZhongShuResponse> = zs_list
        .into_iter()
        .map(|zs| ZhongShuResponse {
            start_date: zs.bis[0].start_dt().format("%Y%m%d").to_string(),
            end_date: zs.bis.last().unwrap().end_dt().format("%Y%m%d").to_string(),
            zd: zs.zd,
            zg: zs.zg,
            bi_count: zs.bis.len(),
        })
        .collect();

    let fx_responses: Vec<FenXingResponse> = fx_list
        .into_iter()
        .map(|fx| {
            let direction = match fx.mark {
                czsc_core::objects::mark::Mark::G => "top",
                czsc_core::objects::mark::Mark::D => "bottom",
            };
            FenXingResponse {
                date: fx.dt.format("%Y%m%d").to_string(),
                price: fx.fx,
                direction: direction.to_string(),
            }
        })
        .collect();

    let bi_responses: Vec<BiResponse> = _bi_list
        .into_iter()
        .map(|bi| {
            let direction = match bi.direction {
                czsc_core::objects::direction::Direction::Up => "up",
                czsc_core::objects::direction::Direction::Down => "down",
            };
            BiResponse {
                start_date: bi.start_dt().format("%Y%m%d").to_string(),
                end_date: bi.end_dt().format("%Y%m%d").to_string(),
                direction: direction.to_string(),
                price_change: bi.get_high() - bi.get_low(),
                high: bi.get_high(),
                low: bi.get_low(),
            }
        })
        .collect();

    let macd_data = calculate_macd(&kline_response);
    let kdj_data = calculate_kdj(&kline_response);

    let (name, area, industry, list_date, stock_type) =
        fetch_stock_basic_info(&ts_code, &client).await;

    let detail = StockDetail {
        ts_code: ts_code.clone(),
        code: code.clone(),
        name,
        market: market.to_string(),
        current_price,
        change_pct,
        area,
        industry,
        list_date,
        stock_type,
        kline_data: kline_response,
        chanlun_signals: ChanlunSignals {
            buy_signals,
            zs_list: zs_responses,
            fx_list: fx_responses,
            bi_list: bi_responses,
        },
        indicators: TechnicalIndicators {
            macd: macd_data,
            kdj: kdj_data,
        },
    };

    Ok(HttpResponse::Ok().json(detail))
}

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

lazy_static::lazy_static! {
    static ref STOCK_INFO_CACHE: Mutex<HashMap<String, (String, Option<String>, Option<String>, Option<String>, Option<String>)>> = Mutex::new(HashMap::new());
    static ref LAST_STOCK_BASIC_CALL: Mutex<u64> = Mutex::new(0);
}

const STOCK_BASIC_CALL_INTERVAL: u64 = 3600;

fn can_call_stock_basic() -> bool {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let mut last_call = LAST_STOCK_BASIC_CALL.lock().unwrap();
    if now - *last_call >= STOCK_BASIC_CALL_INTERVAL {
        *last_call = now;
        true
    } else {
        let remaining = STOCK_BASIC_CALL_INTERVAL - (now - *last_call);
        info!(
            "[can_call_stock_basic] stock_basic接口调用频率超限，剩余等待时间: {}秒",
            remaining
        );
        false
    }
}

async fn fetch_stock_basic_info(
    ts_code: &str,
    client: &TushareClient,
) -> (
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
) {
    // 先检查缓存
    {
        let cache = STOCK_INFO_CACHE.lock().unwrap();
        if let Some(cached) = cache.get(ts_code) {
            info!("[fetch_stock_basic_info] 命中缓存, ts_code={}", ts_code);
            return cached.clone();
        }
    }

    info!(
        "[fetch_stock_basic_info] 缓存未命中，开始获取股票基本信息, ts_code={}",
        ts_code
    );
    let stock_code = ts_code.split('.').next().unwrap_or("");
    info!("[fetch_stock_basic_info] 解析后的股票代码={}", stock_code);

    if !can_call_stock_basic() {
        info!("[fetch_stock_basic_info] stock_basic接口调用频率超限，无法从Tushare获取股票信息");
        let result = (stock_code.to_string(), None, None, None, None);
        return result;
    }

    let result = match client.search_stocks(stock_code).await {
        Ok(stocks) => {
            info!(
                "[fetch_stock_basic_info] Tushare返回 {} 条股票信息",
                stocks.len()
            );
            if let Some(stock) = stocks.into_iter().find(|s| s.ts_code == ts_code) {
                info!("[fetch_stock_basic_info] 找到匹配股票: name={}", stock.name);
                let stock_type = if ts_code.ends_with(".SH") {
                    Some("沪市A股".to_string())
                } else if ts_code.ends_with(".SZ") {
                    Some("深市A股".to_string())
                } else if ts_code.ends_with(".BJ") {
                    Some("北交所".to_string())
                } else {
                    None
                };
                let result = (
                    stock.name,
                    stock.area,
                    stock.industry,
                    stock.list_date,
                    stock_type,
                );
                // 写入缓存
                {
                    let mut cache = STOCK_INFO_CACHE.lock().unwrap();
                    cache.insert(ts_code.to_string(), result.clone());
                    info!("[fetch_stock_basic_info] 已写入缓存, ts_code={}", ts_code);
                }
                return result;
            } else {
                info!(
                    "[fetch_stock_basic_info] 未找到匹配股票 ts_code={}",
                    ts_code
                );
            }
        }
        Err(e) => {
            info!("[fetch_stock_basic_info] Tushare API 调用失败: {}", e);
        }
    };

    let code_only = ts_code.split('.').next().unwrap_or(ts_code);
    let result = (code_only.to_string(), None, None, None, None);
    info!(
        "[fetch_stock_basic_info] 返回默认信息, code_only={}",
        code_only
    );
    result
}

fn get_stock_name_from_cache(ts_code: &str) -> String {
    let cache = STOCK_INFO_CACHE.lock().unwrap();

    if let Some((name, _, _, _, _)) = cache.get(ts_code) {
        return name.clone();
    }

    let code = ts_code.split('.').next().unwrap_or("");
    format!("{}", code)
}

async fn get_stock_name(ts_code: &str, _kline_data: &[KlineResponse]) -> String {
    let client = TushareClient::new();
    match client
        .search_stocks(ts_code.split('.').next().unwrap_or(""))
        .await
    {
        Ok(stocks) => {
            if let Some(stock) = stocks.into_iter().find(|s| s.ts_code == ts_code) {
                let mut cache = STOCK_INFO_CACHE.lock().unwrap();
                // 更新缓存中的name
                if let Some(existing) = cache.get_mut(ts_code) {
                    existing.0 = stock.name.clone();
                }
                return stock.name;
            }
        }
        Err(_) => {}
    }
    ts_code.to_string()
}

fn calculate_macd(kline_data: &[KlineResponse]) -> Vec<MacdData> {
    let closes: Vec<f64> = kline_data.iter().map(|k| k.close).collect();
    let mut result = Vec::new();

    if closes.len() < 26 {
        return result;
    }

    let ema12 = calculate_ema(&closes, 12);
    let ema26 = calculate_ema(&closes, 26);
    let dif: Vec<f64> = ema12.iter().zip(ema26.iter()).map(|(a, b)| a - b).collect();
    let dea = calculate_ema(&dif, 9);
    let hist: Vec<f64> = dif.iter().zip(dea.iter()).map(|(a, b)| a - b).collect();

    for i in 0..kline_data.len() {
        if i >= dea.len() {
            break;
        }
        result.push(MacdData {
            trade_date: kline_data[i].trade_date.clone(),
            dif: dif[i],
            dea: dea[i],
            hist: hist[i],
        });
    }

    result
}

fn calculate_ema(data: &[f64], period: usize) -> Vec<f64> {
    let mut result = Vec::new();
    if data.is_empty() {
        return result;
    }

    let alpha = 2.0 / (period as f64 + 1.0);
    let mut ema = data[0];
    result.push(ema);

    for &value in data.iter().skip(1) {
        ema = alpha * value + (1.0 - alpha) * ema;
        result.push(ema);
    }

    result
}

fn calculate_kdj(kline_data: &[KlineResponse]) -> Vec<KdjData> {
    let mut result = Vec::new();
    let n = 9;
    let m1 = 3;
    let m2 = 3;

    if kline_data.len() < n + m1 + m2 - 2 {
        return result;
    }

    let mut rsv_values = Vec::new();

    for i in (n - 1)..kline_data.len() {
        let slice = &kline_data[i + 1 - n..=i];
        let high = slice.iter().map(|k| k.high).fold(f64::MIN, f64::max);
        let low = slice.iter().map(|k| k.low).fold(f64::MAX, f64::min);
        let close = kline_data[i].close;

        let rsv = if high != low {
            ((close - low) / (high - low)) * 100.0
        } else {
            50.0
        };
        rsv_values.push(rsv);
    }

    let k_values = calculate_sma(&rsv_values, m1);
    let d_values = calculate_sma(&k_values, m2);

    let count = std::cmp::min(k_values.len(), d_values.len());

    for i in 0..count {
        let j = 3.0 * k_values[i] - 2.0 * d_values[i];
        result.push(KdjData {
            trade_date: kline_data[i + n - 1].trade_date.clone(),
            k: k_values[i],
            d: d_values[i],
            j,
        });
    }

    result
}

fn calculate_sma(data: &[f64], period: usize) -> Vec<f64> {
    let mut result = Vec::new();
    if data.len() < period {
        return result;
    }

    let mut sum: f64 = data[0..period].iter().sum();
    result.push(sum / period as f64);

    for i in period..data.len() {
        sum = sum - data[i - period] + data[i];
        result.push(sum / period as f64);
    }

    result
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
    path: web::Path<i32>,
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
    body: web::Json<NewStock>,
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
    path: web::Path<i32>,
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

async fn sync_stock_basic(pool: web::Data<PgPool>) -> actix_web::Result<HttpResponse> {
    info!("[sync_stock_basic] 开始同步股票基础信息");

    if !can_call_stock_basic() {
        return Err(actix_web::error::ErrorTooManyRequests(
            "stock_basic接口调用频率超限，请稍后再试",
        )
        .into());
    }

    let client = TushareClient::new();
    let stocks_result = client.get_all_stocks().await;

    let stocks = match stocks_result {
        Ok(s) => s,
        Err(e) => {
            return Err(actix_web::error::ErrorInternalServerError(format!(
                "获取股票数据失败: {}",
                e
            )))
            .into();
        }
    };

    let total = stocks.len();
    let mut inserted = 0;
    let mut updated = 0;
    let mut errors = 0;

    for stock in stocks {
        let market = if stock.ts_code.ends_with(".SH") {
            "SH".to_string()
        } else if stock.ts_code.ends_with(".BJ") {
            "BJ".to_string()
        } else {
            "SZ".to_string()
        };

        let list_date = stock
            .list_date
            .as_ref()
            .and_then(|d| NaiveDate::parse_from_str(d, "%Y%m%d").ok());

        let delist_date = stock
            .delist_date
            .as_ref()
            .and_then(|d| NaiveDate::parse_from_str(d, "%Y%m%d").ok());

        let existing_stock =
            sqlx::query_as::<_, Stock>("SELECT id FROM stocks WHERE code = $1 AND market = $2")
                .bind(&stock.symbol)
                .bind(&market)
                .fetch_optional(pool.get_ref())
                .await;

        match existing_stock {
            Ok(Some(existing)) => {
                let result = sqlx::query(
                    "UPDATE stocks SET name = $1, stock_type = $2, list_date = $3, delist_date = $4, is_active = $5, updated_at = NOW() WHERE id = $6"
                )
                .bind(&stock.name)
                .bind("A股")
                .bind(list_date)
                .bind(delist_date)
                .bind(delist_date.is_none())
                .bind(existing.id)
                .execute(pool.get_ref())
                .await;

                if result.is_ok() {
                    updated += 1;
                } else {
                    errors += 1;
                }
            }
            Ok(None) => {
                let result = sqlx::query(
                    "INSERT INTO stocks (code, name, market, stock_type, list_date, delist_date, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())"
                )
                .bind(&stock.symbol)
                .bind(&stock.name)
                .bind(&market)
                .bind("A股")
                .bind(list_date)
                .bind(delist_date)
                .bind(delist_date.is_none())
                .execute(pool.get_ref())
                .await;

                if result.is_ok() {
                    inserted += 1;
                } else {
                    errors += 1;
                }
            }
            Err(_) => {
                errors += 1;
            }
        }
    }

    info!(
        "[sync_stock_basic] 同步完成: 新增={}, 更新={}, 错误={}",
        inserted, updated, errors
    );

    let cache_result = update_stock_info_cache(&pool).await;
    if let Err(e) = cache_result {
        info!("[sync_stock_basic] 更新缓存失败: {}", e);
    }

    Ok(HttpResponse::Ok().json(json!({
        "inserted": inserted,
        "updated": updated,
        "errors": errors,
        "total": total
    })))
}

async fn update_stock_info_cache(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("[update_stock_info_cache] 开始更新股票信息缓存");

    let stocks = sqlx::query_as::<_, (String, String, String, String, Option<NaiveDate>)>(
        "SELECT code, name, market, stock_type, list_date FROM stocks WHERE is_active = true",
    )
    .fetch_all(pool)
    .await?;

    let mut cache = STOCK_INFO_CACHE.lock().unwrap();
    cache.clear();

    for (code, name, market, stock_type, list_date) in stocks {
        let ts_code = if market == "SH" {
            format!("{}.SH", code)
        } else if market == "BJ" {
            format!("{}.BJ", code)
        } else {
            format!("{}.SZ", code)
        };

        let stock_type_display = match market.as_str() {
            "SH" => Some("沪市A股".to_string()),
            "SZ" => Some("深市A股".to_string()),
            "BJ" => Some("北交所".to_string()),
            _ => Some(stock_type),
        };

        let list_date_str = list_date.map(|d| d.format("%Y%m%d").to_string());

        cache.insert(
            ts_code,
            (name, None, None, list_date_str, stock_type_display),
        );
    }

    info!(
        "[update_stock_info_cache] 缓存更新完成，共 {} 条记录",
        cache.len()
    );
    Ok(())
}
