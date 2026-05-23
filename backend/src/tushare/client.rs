// src/tushare/client.rs
use log::{info, warn};
use reqwest::{Client, Error as ReqwestError};
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Deserialize)]
struct TushareResponse {
    code: i32,
    #[serde(rename = "msg")]
    message: String,
    data: Option<TushareData>,
}

#[derive(Debug, Deserialize)]
struct TushareData {
    fields: Vec<String>,
    items: Vec<Vec<serde_json::Value>>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct StockBasic {
    pub ts_code: String,
    pub symbol: String,
    pub name: String,
    pub area: Option<String>,
    pub industry: Option<String>,
    pub list_date: Option<String>,
    pub delist_date: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct KlineData {
    pub ts_code: String,
    pub trade_date: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub vol: f64,
    pub amount: Option<f64>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct DailyBasic {
    pub ts_code: String,
    pub trade_date: String,
    pub open: Option<f64>,
    pub high: Option<f64>,
    pub low: Option<f64>,
    pub close: Option<f64>,
    pub pre_close: Option<f64>,
    pub change: Option<f64>,
    pub pct_chg: Option<f64>,
}

pub struct TushareClient {
    client: Client,
    token: String,
}

impl TushareClient {
    pub fn new() -> Self {
        let token = env::var("TUSHARE_TOKEN").unwrap_or_default();
        Self {
            client: Client::new(),
            token,
        }
    }

    pub fn with_token(token: &str) -> Self {
        Self {
            client: Client::new(),
            token: token.to_string(),
        }
    }

    async fn call_api<T>(
        &self,
        api_name: &str,
        params: &[(&str, &str)],
    ) -> Result<Vec<T>, TushareError>
    where
        T: FromRow,
    {
        if self.token.is_empty() {
            return Err(TushareError::TokenNotSet);
        }

        let url = "http://api.waditu.com";

        #[derive(serde::Serialize)]
        struct TushareRequest<'a> {
            api_name: &'a str,
            token: &'a str,
            params: std::collections::HashMap<&'a str, &'a str>,
            fields: &'a str,
        }

        let mut params_map = std::collections::HashMap::new();
        for (k, v) in params {
            params_map.insert(*k, *v);
        }

        let request_body = TushareRequest {
            api_name,
            token: &self.token,
            params: params_map,
            fields: self.get_fields(api_name),
        };

        let response = self
            .client
            .post(url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        let status = response.status();
        let body = response.text().await?;

        // 只打印响应的前100个字符，避免日志太多
        let truncated_body = if body.len() > 100 {
            format!("{}...", &body[..100])
        } else {
            body.clone()
        };
        info!("Tushare API response status: {}, body: {}", status, truncated_body);

        let result: TushareResponse = serde_json::from_str(&body)
            .map_err(|e| TushareError::ApiError(format!("JSON parse error: {}", e)))?;

        if result.code != 0 {
            return Err(TushareError::ApiError(result.message));
        }

        let data = result
            .data
            .ok_or(TushareError::ApiError("No data returned".to_string()))?;

        let field_map: std::collections::HashMap<String, usize> = data
            .fields
            .iter()
            .enumerate()
            .map(|(i, f)| (f.clone(), i))
            .collect();

        let parsed: Vec<T> = data
            .items
            .into_iter()
            .filter_map(|item| T::from_row(&item, &field_map))
            .collect();

        Ok(parsed)
    }

    fn get_fields(&self, api_name: &str) -> &str {
        match api_name {
            "stock_basic" => "ts_code,symbol,name,area,industry,list_date,delist_date",
            "daily" => "ts_code,trade_date,open,high,low,close,vol,amount",
            "daily_basic" => "ts_code,trade_date,open,high,low,close,pre_close,change,pct_chg",
            _ => "",
        }
    }

    pub async fn search_stocks(&self, keyword: &str) -> Result<Vec<StockBasic>, TushareError> {
        let params = if keyword.chars().all(|c| c.is_ascii_digit()) {
            vec![("symbol", keyword)]
        } else {
            vec![("name", keyword)]
        };

        let stocks = self.call_api::<StockBasic>("stock_basic", &params).await?;

        let filtered: Vec<StockBasic> = stocks
            .into_iter()
            .filter(|s| s.symbol.contains(keyword) || s.name.contains(keyword))
            .collect();

        Ok(filtered)
    }

    pub async fn get_all_stocks(&self) -> Result<Vec<StockBasic>, TushareError> {
        let params = vec![("list_status", "L")];
        let stocks = self.call_api::<StockBasic>("stock_basic", &params).await?;
        info!("[get_all_stocks] 获取到 {} 条股票数据", stocks.len());
        Ok(stocks)
    }

    pub async fn get_kline_data(
        &self,
        ts_code: &str,
        start_date: &str,
        end_date: &str,
        freq: &str,
    ) -> Result<Vec<KlineData>, TushareError> {
        let params = vec![
            ("ts_code", ts_code),
            ("start_date", start_date),
            ("end_date", end_date),
        ];
        let api_name = match freq {
            "weekly" => "weekly",
            "monthly" => "monthly",
            _ => "daily",
        };
        self.call_api(api_name, &params).await
    }

    pub async fn get_daily_basic(
        &self,
        ts_code: &str,
        trade_date: &str,
    ) -> Result<Vec<DailyBasic>, TushareError> {
        let params = vec![("ts_code", ts_code), ("trade_date", trade_date)];
        self.call_api("daily_basic", &params).await
    }

    /// 将股票代码转换为 Tushare 格式
    /// 
    /// # 参数
    /// - code: 股票代码（如 "600519" 或 "000001.SZ"）
    /// 
    /// # 返回值
    /// - 标准 Tushare 格式代码，如 "600519.SH" 或 "000001.SZ"
    /// 
    /// # 说明
    /// 根据股票代码前缀判断市场：
    /// - 沪市：以 6 或 9 开头
    /// - 深市：其他情况（默认）
    /// - 北交所：以 8 开头
    pub fn convert_ts_code(code: &str) -> String {
        if code.contains('.') {
            code.to_string()
        } else if code.starts_with('6') || code.starts_with('9') {
            format!("{}.SH", code)
        } else if code.starts_with('8') {
            format!("{}.BJ", code)
        } else {
            format!("{}.SZ", code)
        }
    }

    /// 验证股票代码格式是否有效
    /// 
    /// # 参数
    /// - code: 股票代码
    /// 
    /// # 返回值
    /// - Ok(()) 表示格式有效
    /// - Err(String) 包含错误信息
    pub fn validate_stock_code(code: &str) -> Result<(), String> {
        let clean_code = if code.contains('.') {
            code.split('.').next().unwrap_or(code)
        } else {
            code
        };

        // 检查代码长度（通常为 6 位数字）
        if clean_code.len() != 6 {
            return Err(format!("股票代码长度必须为6位数字，当前长度: {}", clean_code.len()));
        }

        // 检查是否全为数字
        if !clean_code.chars().all(|c| c.is_ascii_digit()) {
            return Err(format!("股票代码必须全为数字，当前值: {}", clean_code));
        }

        // 检查股票代码前缀是否常见
        let prefix = &clean_code[0..3];
        let valid_prefixes = ["000", "001", "002", "003", "300", "600", "601", "603", "605", "688", "689", "800", "820", "830", "870", "880"];
        
        if !valid_prefixes.contains(&prefix) {
            warn!("股票代码前缀 {} 不常见，请确认代码是否正确。常见前缀: 沪市(600/601/603/605/688/689), 深市(000/001/002/003/300), 北交所(800/820/830/870/880)", prefix);
        }

        Ok(())
    }
}

pub trait FromRow {
    fn from_row(
        row: &[serde_json::Value],
        field_map: &std::collections::HashMap<String, usize>,
    ) -> Option<Self>
    where
        Self: Sized;
}

fn json_to_string(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        _ => v.to_string(),
    }
}

fn json_to_f64(v: &serde_json::Value) -> Option<f64> {
    match v {
        serde_json::Value::Number(n) => n.as_f64(),
        serde_json::Value::String(s) => s.parse().ok(),
        _ => None,
    }
}

impl FromRow for StockBasic {
    fn from_row(
        row: &[serde_json::Value],
        field_map: &std::collections::HashMap<String, usize>,
    ) -> Option<Self> {
        Some(StockBasic {
            ts_code: json_to_string(row.get(*field_map.get("ts_code")?)?),
            symbol: json_to_string(row.get(*field_map.get("symbol")?)?),
            name: json_to_string(row.get(*field_map.get("name")?)?),
            area: field_map
                .get("area")
                .and_then(|i| row.get(*i))
                .map(|v| json_to_string(v)),
            industry: field_map
                .get("industry")
                .and_then(|i| row.get(*i))
                .map(|v| json_to_string(v)),
            list_date: field_map
                .get("list_date")
                .and_then(|i| row.get(*i))
                .map(|v| json_to_string(v)),
            delist_date: field_map
                .get("delist_date")
                .and_then(|i| row.get(*i))
                .map(|v| json_to_string(v)),
        })
    }
}

impl FromRow for KlineData {
    fn from_row(
        row: &[serde_json::Value],
        field_map: &std::collections::HashMap<String, usize>,
    ) -> Option<Self> {
        Some(KlineData {
            ts_code: json_to_string(row.get(*field_map.get("ts_code")?)?),
            trade_date: json_to_string(row.get(*field_map.get("trade_date")?)?),
            open: json_to_f64(row.get(*field_map.get("open")?)?)?,
            high: json_to_f64(row.get(*field_map.get("high")?)?)?,
            low: json_to_f64(row.get(*field_map.get("low")?)?)?,
            close: json_to_f64(row.get(*field_map.get("close")?)?)?,
            vol: json_to_f64(row.get(*field_map.get("vol")?)?)?,
            amount: field_map
                .get("amount")
                .and_then(|i| row.get(*i))
                .and_then(|v| json_to_f64(v)),
        })
    }
}

impl FromRow for DailyBasic {
    fn from_row(
        row: &[serde_json::Value],
        field_map: &std::collections::HashMap<String, usize>,
    ) -> Option<Self> {
        Some(DailyBasic {
            ts_code: json_to_string(row.get(*field_map.get("ts_code")?)?),
            trade_date: json_to_string(row.get(*field_map.get("trade_date")?)?),
            open: field_map
                .get("open")
                .and_then(|i| row.get(*i))
                .and_then(|v| json_to_f64(v)),
            high: field_map
                .get("high")
                .and_then(|i| row.get(*i))
                .and_then(|v| json_to_f64(v)),
            low: field_map
                .get("low")
                .and_then(|i| row.get(*i))
                .and_then(|v| json_to_f64(v)),
            close: field_map
                .get("close")
                .and_then(|i| row.get(*i))
                .and_then(|v| json_to_f64(v)),
            pre_close: field_map
                .get("pre_close")
                .and_then(|i| row.get(*i))
                .and_then(|v| json_to_f64(v)),
            change: field_map
                .get("change")
                .and_then(|i| row.get(*i))
                .and_then(|v| json_to_f64(v)),
            pct_chg: field_map
                .get("pct_chg")
                .and_then(|i| row.get(*i))
                .and_then(|v| json_to_f64(v)),
        })
    }
}

#[derive(Debug)]
pub enum TushareError {
    TokenNotSet,
    ApiError(String),
    HttpError(ReqwestError),
}

impl From<ReqwestError> for TushareError {
    fn from(e: ReqwestError) -> Self {
        TushareError::HttpError(e)
    }
}

impl std::fmt::Display for TushareError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TushareError::TokenNotSet => write!(f, "TUSHARE_TOKEN not set"),
            TushareError::ApiError(msg) => write!(f, "Tushare API error: {}", msg),
            TushareError::HttpError(e) => write!(f, "HTTP error: {}", e),
        }
    }
}

impl std::error::Error for TushareError {}
