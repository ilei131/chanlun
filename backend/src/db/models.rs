// src/db/models.rs
use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Stock {
    pub id: i32,
    pub code: String,
    pub name: String,
    pub market: String,
    pub stock_type: String,
    pub list_date: Option<NaiveDate>,
    pub delist_date: Option<NaiveDate>,
    pub is_active: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Kline {
    pub id: i64,
    pub stock_id: i32,
    pub trade_date: NaiveDate,
    pub period: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: i64,
    pub amount: Option<f64>,
    pub turnover_rate: Option<f64>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct TechnicalIndicator {
    pub id: i64,
    pub stock_id: i32,
    pub trade_date: NaiveDate,
    pub period: String,
    pub ma5: Option<f64>,
    pub ma10: Option<f64>,
    pub ma20: Option<f64>,
    pub ma30: Option<f64>,
    pub ma60: Option<f64>,
    pub ma120: Option<f64>,
    pub ma250: Option<f64>,
    pub macd_dif: Option<f64>,
    pub macd_dea: Option<f64>,
    pub macd_hist: Option<f64>,
    pub kdj_k: Option<f64>,
    pub kdj_d: Option<f64>,
    pub kdj_j: Option<f64>,
    pub rsi_6: Option<f64>,
    pub rsi_12: Option<f64>,
    pub rsi_24: Option<f64>,
    pub boll_upper: Option<f64>,
    pub boll_mid: Option<f64>,
    pub boll_lower: Option<f64>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct CsSignal {
    pub id: i64,
    pub stock_id: i32,
    pub period: String,
    pub signal_type: String,
    pub signal_date: NaiveDate,
    pub signal_price: f64,
    pub bi_no: Option<i32>,
    pub xd_no: Option<i32>,
    pub zs_id: Option<i64>,
    pub is_current: bool,
    pub is_valid: bool,
    pub confidence: Option<f64>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct CsFxSignal {
    pub id: i64,
    pub stock_id: i32,
    pub period: String,
    pub fx_type: String,
    pub fx_date: NaiveDate,
    pub fx_price: f64,
    pub high_price: Option<f64>,
    pub low_price: Option<f64>,
    pub left_bar_count: Option<i32>,
    pub right_bar_count: Option<i32>,
    pub depth_pct: Option<f64>,
    pub volume_ratio: Option<f64>,
    pub volatility: Option<f64>,
    pub quality_score: Option<f64>,
    pub bi_formation_prob: Option<f64>,
    pub trend_reversal_prob: Option<f64>,
    pub status: String,
    pub related_bi_id: Option<i64>,
    pub related_zs_id: Option<i64>,
    pub is_current: bool,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct CsCrossSignal {
    pub id: i64,
    pub stock_id: i32,
    pub period: String,
    pub signal_type: String,
    pub signal_date: NaiveDate,
    pub signal_price: Option<f64>,
    pub kdj_k_before: Option<f64>,
    pub kdj_k_after: Option<f64>,
    pub kdj_d_before: Option<f64>,
    pub kdj_d_after: Option<f64>,
    pub macd_dif_before: Option<f64>,
    pub macd_dif_after: Option<f64>,
    pub macd_dea_before: Option<f64>,
    pub macd_dea_after: Option<f64>,
    pub is_current: bool,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct NewStock {
    pub code: String,
    pub name: String,
    pub market: String,
    pub stock_type: String,
}

/// 用户模型
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct User {
    pub id: i32,
    pub username: String,
    pub password_hash: String,
    pub email: Option<String>,
    pub role: String,
    pub is_active: bool,
    pub tushare_token: Option<String>,
    pub gemini_token: Option<String>,
    pub openai_token: Option<String>,
    pub preferred_ai_provider: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

/// 注册请求
#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub email: Option<String>,
}

/// 登录请求
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// 登录响应
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
}

/// 用户信息（不含密码）
#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: i32,
    pub username: String,
    pub email: Option<String>,
    pub role: String,
    pub tushare_token: Option<String>,
    pub gemini_token: Option<String>,
    pub openai_token: Option<String>,
    pub preferred_ai_provider: Option<String>,
}

/// 分析报告模型
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct StockAnalysisReport {
    pub id: i64,
    pub user_id: i32,
    pub stock_code: String,
    pub stock_name: String,
    pub market: String,
    pub analysis_date: NaiveDate,
    pub ai_provider: String,
    pub report_content: String,
    pub summary: Option<String>,
    pub investment_rating: Option<String>,
    pub target_price: Option<f64>,
    pub confidence_score: Option<f64>,
    pub status: String,
    pub error_message: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

/// 创建分析报告请求
#[derive(Debug, Deserialize)]
pub struct CreateReportRequest {
    pub stock_code: String,
    pub market: Option<String>,
}

/// 分析报告列表响应
#[derive(Debug, Serialize)]
pub struct ReportListResponse {
    pub reports: Vec<StockAnalysisReport>,
    pub total: i64,
    pub page: i32,
    pub page_size: i32,
}
