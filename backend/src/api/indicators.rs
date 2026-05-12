// src/api/indicators.rs
use actix_web::{web, HttpResponse, Scope};
use chrono::{NaiveDate};
use sqlx::PgPool;
use std::collections::VecDeque;

use crate::db::models::Kline;

#[derive(Debug, Clone, serde::Serialize)]
pub struct TechnicalIndicator {
    pub trade_date: NaiveDate,
    pub close: f64,
    pub kdj_k: Option<f64>,
    pub kdj_d: Option<f64>,
    pub kdj_j: Option<f64>,
    pub macd_dif: Option<f64>,
    pub macd_dea: Option<f64>,
    pub macd_hist: Option<f64>,
    pub ma5: Option<f64>,
    pub ma10: Option<f64>,
    pub ma20: Option<f64>,
    pub ma30: Option<f64>,
    pub boll_upper: Option<f64>,
    pub boll_mid: Option<f64>,
    pub boll_lower: Option<f64>,
}

pub fn indicators_scope() -> Scope {
    web::scope("/indicators")
        .route("/{stock_id}/{period}", web::get().to(get_stock_indicators))
}

async fn get_stock_indicators(
    pool: web::Data<PgPool>,
    path: web::Path<(i32, String)>,
) -> actix_web::Result<HttpResponse> {
    let (stock_id, period) = path.into_inner();

    let klines = sqlx::query_as::<_, Kline>(
        "SELECT id, stock_id, trade_date, period, open, high, low, close, volume, amount, turnover_rate, created_at 
         FROM klines 
         WHERE stock_id = $1 AND period = $2 
         ORDER BY trade_date ASC"
    )
    .bind(stock_id)
    .bind(&period)
    .fetch_all(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Query error: {}", e)))?;

    if klines.is_empty() {
        return Ok(HttpResponse::Ok().json(Vec::<TechnicalIndicator>::new()));
    }

    let indicators = calculate_indicators(&klines);

    Ok(HttpResponse::Ok().json(indicators))
}

fn calculate_indicators(klines: &[Kline]) -> Vec<TechnicalIndicator> {
    let mut indicators = Vec::with_capacity(klines.len());

    let kdj = calculate_kdj(klines, 9, 3, 3);
    let macd = calculate_macd(klines, 12, 26, 9);
    let ma5 = calculate_ma(klines, 5);
    let ma10 = calculate_ma(klines, 10);
    let ma20 = calculate_ma(klines, 20);
    let ma30 = calculate_ma(klines, 30);
    let boll = calculate_bollinger(klines, 20);

    for (i, kline) in klines.iter().enumerate() {
        indicators.push(TechnicalIndicator {
            trade_date: kline.trade_date,
            close: kline.close as f64,
            kdj_k: kdj.0[i],
            kdj_d: kdj.1[i],
            kdj_j: kdj.2[i],
            macd_dif: macd.0[i],
            macd_dea: macd.1[i],
            macd_hist: macd.2[i],
            ma5: ma5[i],
            ma10: ma10[i],
            ma20: ma20[i],
            ma30: ma30[i],
            boll_upper: boll.0[i],
            boll_mid: boll.1[i],
            boll_lower: boll.2[i],
        });
    }

    indicators
}

fn calculate_kdj(klines: &[Kline], n: usize, m1: usize, m2: usize) -> (Vec<Option<f64>>, Vec<Option<f64>>, Vec<Option<f64>>) {
    let mut k_values = Vec::with_capacity(klines.len());
    let mut d_values = Vec::with_capacity(klines.len());
    let mut j_values = Vec::with_capacity(klines.len());

    if klines.len() < n {
        for _ in klines {
            k_values.push(None);
            d_values.push(None);
            j_values.push(None);
        }
        return (k_values, d_values, j_values);
    }

    let mut k_prev: f64 = 50.0;
    let mut d_prev: f64 = 50.0;

    for i in 0..klines.len() {
        if i < n - 1 {
            k_values.push(None);
            d_values.push(None);
            j_values.push(None);
            continue;
        }

        let start = i + 1 - n;
        let end = i + 1;

        let lowest_low = klines[start..end].iter().map(|k| k.low as f64).fold(f64::INFINITY, f64::min);
        let highest_high = klines[start..end].iter().map(|k| k.high as f64).fold(f64::NEG_INFINITY, f64::max);
        
        let close = klines[i].close as f64;
        let rsv = if highest_high == lowest_low { 0.0 } else { (close - lowest_low) / (highest_high - lowest_low) * 100.0 };
        
        let k = (2.0 / (m1 + 1) as f64) * k_prev + (m1 as f64 / (m1 + 1) as f64) * rsv;
        let d = (2.0 / (m2 + 1) as f64) * d_prev + (m2 as f64 / (m2 + 1) as f64) * k;
        let j = 3.0 * k - 2.0 * d;

        k_values.push(Some(k));
        d_values.push(Some(d));
        j_values.push(Some(j));

        k_prev = k;
        d_prev = d;
    }

    (k_values, d_values, j_values)
}

fn calculate_macd(klines: &[Kline], fast: usize, slow: usize, signal: usize) -> (Vec<Option<f64>>, Vec<Option<f64>>, Vec<Option<f64>>) {
    let mut dif_values = Vec::with_capacity(klines.len());
    let mut dea_values = Vec::with_capacity(klines.len());
    let mut hist_values = Vec::with_capacity(klines.len());

    if klines.len() < slow {
        for _ in klines {
            dif_values.push(None);
            dea_values.push(None);
            hist_values.push(None);
        }
        return (dif_values, dea_values, hist_values);
    }

    let ema_fast = calculate_ema(klines, fast);
    let ema_slow = calculate_ema(klines, slow);

    let mut dea_prev: f64 = 0.0;

    for i in 0..klines.len() {
        let e_fast = ema_fast[i];
        let e_slow = ema_slow[i];
        
        if e_fast.is_none() || e_slow.is_none() {
            dif_values.push(None);
            dea_values.push(None);
            hist_values.push(None);
            continue;
        }

        let dif = e_fast.unwrap() - e_slow.unwrap();
        
        if i < slow + signal - 1 {
            dif_values.push(Some(dif));
            dea_values.push(None);
            hist_values.push(None);
            dea_prev = dif;
        } else {
            let dea = (signal as f64 - 1.0) / signal as f64 * dea_prev + 1.0 / signal as f64 * dif;
            let hist = dif - dea;
            
            dif_values.push(Some(dif));
            dea_values.push(Some(dea));
            hist_values.push(Some(hist));
            
            dea_prev = dea;
        }
    }

    (dif_values, dea_values, hist_values)
}

fn calculate_ema(klines: &[Kline], period: usize) -> Vec<Option<f64>> {
    let mut ema_values = Vec::with_capacity(klines.len());
    
    if klines.is_empty() {
        return ema_values;
    }

    let alpha = 2.0 / (period + 1) as f64;
    let mut prev_ema: Option<f64> = None;

    for (i, kline) in klines.iter().enumerate() {
        let close = kline.close as f64;
        
        if i < period - 1 {
            ema_values.push(None);
        } else if i == period - 1 {
            let sum: f64 = klines[0..=i].iter().map(|k| k.close as f64).sum();
            let ema = sum / period as f64;
            ema_values.push(Some(ema));
            prev_ema = Some(ema);
        } else {
            if let Some(p) = prev_ema {
                let ema = alpha * close + (1.0 - alpha) * p;
                ema_values.push(Some(ema));
                prev_ema = Some(ema);
            } else {
                ema_values.push(None);
            }
        }
    }

    ema_values
}

fn calculate_ma(klines: &[Kline], period: usize) -> Vec<Option<f64>> {
    let mut ma_values = Vec::with_capacity(klines.len());
    let mut window = VecDeque::with_capacity(period);

    for kline in klines {
        window.push_back(kline.close as f64);
        
        if window.len() >= period {
            let sum: f64 = window.iter().sum();
            ma_values.push(Some(sum / period as f64));
            window.pop_front();
        } else {
            ma_values.push(None);
        }
    }

    ma_values
}

fn calculate_bollinger(klines: &[Kline], period: usize) -> (Vec<Option<f64>>, Vec<Option<f64>>, Vec<Option<f64>>) {
    let mut upper_values = Vec::with_capacity(klines.len());
    let mut mid_values = Vec::with_capacity(klines.len());
    let mut lower_values = Vec::with_capacity(klines.len());

    let ma = calculate_ma(klines, period);

    for i in 0..klines.len() {
        if i < period - 1 {
            upper_values.push(None);
            mid_values.push(None);
            lower_values.push(None);
            continue;
        }

        if let Some(mid) = ma[i] {
            let start = i + 1 - period;
            let sum_sq: f64 = klines[start..=i]
                .iter()
                .map(|k| {
                    let diff = k.close as f64 - mid;
                    diff * diff
                })
                .sum();
            let std_dev = (sum_sq / period as f64).sqrt();
            
            upper_values.push(Some(mid + 2.0 * std_dev));
            mid_values.push(Some(mid));
            lower_values.push(Some(mid - 2.0 * std_dev));
        } else {
            upper_values.push(None);
            mid_values.push(None);
            lower_values.push(None);
        }
    }

    (upper_values, mid_values, lower_values)
}
