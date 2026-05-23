// src/ai/mod.rs
use log::{error, info};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub enum AiProvider {
    Gemini,
    OpenAI,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockReport {
    pub summary: String,
    pub investment_rating: String,
    pub target_price: Option<f64>,
    pub report_content: String,
}

impl std::fmt::Display for AiProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AiProvider::Gemini => write!(f, "gemini"),
            AiProvider::OpenAI => write!(f, "openai"),
        }
    }
}

#[derive(Debug, Serialize)]
struct GeminiRequest {
    contents: Vec<Content>,
    generation_config: GeminiGenerationConfig,
}

#[derive(Debug, Serialize)]
struct GeminiGenerationConfig {
    temperature: f32,
    max_output_tokens: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Part {
    text: String,
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Vec<Candidate>,
}

#[derive(Debug, Deserialize)]
struct Candidate {
    content: Content,
    #[allow(dead_code)]
    finish_reason: Option<String>,
}

#[derive(Debug, Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<Message>,
    max_tokens: i32,
    temperature: f32,
}

#[derive(Debug, Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Message,
    #[allow(dead_code)]
    finish_reason: Option<String>,
}

pub struct AiService {
    client: Client,
    gemini_token: Option<String>,
    openai_token: Option<String>,
    openai_base_url: Option<String>,
    openai_model: Option<String>,
    preferred_provider: AiProvider,
}

impl AiService {
    pub fn new(
        gemini_token: Option<String>,
        openai_token: Option<String>,
        preferred_provider: Option<String>,
    ) -> Self {
        let provider = match preferred_provider.as_deref() {
            Some("openai") => AiProvider::OpenAI,
            _ => AiProvider::Gemini,
        };

        let proxy_enabled = std::env::var("PROXY_ENABLED")
            .unwrap_or_default()
            .to_lowercase()
            == "true";
        let proxy_url = std::env::var("PROXY_URL").ok();

        let client = if proxy_enabled {
            if let Some(ref url) = proxy_url {
                info!("[AI Service] 使用代理: {}", url);
                match reqwest::Proxy::all(url.as_str()) {
                    Ok(proxy) => Client::builder()
                        .timeout(Duration::from_secs(120))
                        .connect_timeout(Duration::from_secs(10))
                        .proxy(proxy)
                        .build()
                        .unwrap_or_else(|e| {
                            error!("[AI Service] 代理客户端创建失败: {}，回退直连", e);
                            Client::builder()
                                .timeout(Duration::from_secs(120))
                                .connect_timeout(Duration::from_secs(10))
                                .build()
                                .unwrap_or_default()
                        }),
                    Err(e) => {
                        error!("[AI Service] 代理配置无效: {}，使用直连", e);
                        Client::builder()
                            .timeout(Duration::from_secs(120))
                            .connect_timeout(Duration::from_secs(10))
                            .build()
                            .unwrap_or_default()
                    }
                }
            } else {
                info!("[AI Service] 代理已启用但未配置 PROXY_URL，使用直连");
                Client::builder()
                    .timeout(Duration::from_secs(120))
                    .connect_timeout(Duration::from_secs(10))
                    .build()
                    .unwrap_or_default()
            }
        } else {
            info!("[AI Service] 代理未启用，使用直连");
            Client::builder()
                .timeout(Duration::from_secs(120))
                .connect_timeout(Duration::from_secs(10))
                .build()
                .unwrap_or_default()
        };

        Self {
            client,
            gemini_token,
            openai_token,
            openai_base_url: None,
            openai_model: None,
            preferred_provider: provider,
        }
    }

    pub fn with_openai_config(
        mut self,
        base_url: Option<String>,
        model: Option<String>,
    ) -> Self {
        self.openai_base_url = base_url;
        self.openai_model = model;
        self
    }

    pub async fn generate_stock_report(
        &self,
        stock_code: &str,
        stock_name: &str,
        market: &str,
        kline_data: &str,
        technical_indicators: &str,
        chanlun_signals: &str,
    ) -> Result<StockReport, String> {
        let prompt = self.build_stock_report_prompt(
            stock_code,
            stock_name,
            market,
            kline_data,
            technical_indicators,
            chanlun_signals,
        );

        info!(
            "[AI Service] 开始生成股票分析报告: {} {}",
            stock_code, stock_name
        );
        info!("[AI Service] 使用AI提供商: {}", self.preferred_provider);
        info!("[AI Service] Prompt长度: {} 字符", prompt.len());

        let result = match self.preferred_provider {
            AiProvider::Gemini => self.call_gemini_api(&prompt).await,
            AiProvider::OpenAI => self.call_openai_api(&prompt).await,
        };

        match &result {
            Ok(report) => info!(
                "[AI Service] 报告生成成功，评级: {}, 目标价: {:?}",
                report.investment_rating, report.target_price
            ),
            Err(e) => error!("[AI Service] 报告生成失败: {}", e),
        }

        result
    }

    fn build_stock_report_prompt(
        &self,
        stock_code: &str,
        stock_name: &str,
        market: &str,
        kline_data: &str,
        technical_indicators: &str,
        chanlun_signals: &str,
    ) -> String {
        format!(
            r#"你是一名专业的A股分析师，擅长缠论分析和技术分析。请基于以下数据对股票进行全面分析：

## 股票信息
- 股票代码：{}
- 股票名称：{}
- 市场：{}

## K线数据（最近交易日的行情）
{}

## 技术指标
{}

## 缠论信号
{}

请生成一份详细的股票分析报告，并以JSON格式输出，包含以下字段：
1. summary: 核心观点摘要（不超过200字）
2. investment_rating: 投资评级（买入/持有/卖出）
3. target_price: 目标价格（数值，单位：元）
4. report_content: 详细分析报告内容（Markdown格式）

报告内容请严格按照以下结构：

## 一、核心结论
给出明确的趋势判断和操作建议，用1-2句话概括。

## 二、行情走势分析
### 1. 近期价格走势概述
### 2. 关键支撑位和阻力位
### 3. 成交量变化分析

## 三、技术指标分析
### 1. MACD指标解读
### 2. KDJ指标解读
### 3. 均线系统分析

## 四、缠论分析
### 1. 分型结构分析
### 2. 笔和线段划分
### 3. 中枢结构分析
### 4. 买卖点信号评估

## 五、综合评估
### 1. 当前趋势判断
### 2. 操作建议
### 3. 目标价格区间
### 4. 风险提示

请用中文回复，分析专业严谨，数据引用准确。输出格式为纯JSON，不要有其他任何前缀或后缀。"#,
            stock_code, stock_name, market, kline_data, technical_indicators, chanlun_signals
        )
    }

    async fn call_gemini_api(&self, prompt: &str) -> Result<StockReport, String> {
        let token = self
            .gemini_token
            .clone()
            .ok_or_else(|| "Gemini API token 未配置，请在设置页面配置 Gemini API Key".to_string())?;

        let api_url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}",
            token
        );

        let request = GeminiRequest {
            contents: vec![Content {
                parts: vec![Part {
                    text: prompt.to_string(),
                }],
            }],
            generation_config: GeminiGenerationConfig {
                temperature: 0.7,
                max_output_tokens: 8192,
            },
        };

        info!("[Gemini API] 调用Gemini API (gemini-2.0-flash)...");

        let response = self
            .client
            .post(&api_url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    "Gemini API 请求超时(120秒)，请检查网络连接".to_string()
                } else if e.is_connect() {
                    "Gemini API 连接失败，请检查网络连接或代理设置".to_string()
                } else {
                    format!("Gemini API 请求失败: {}", e)
                }
            })?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            error!("[Gemini API] 请求失败，状态码: {}, 响应: {}", status, body);
            return Err(format!(
                "Gemini API 返回错误状态: {}，请检查 API Key 是否正确。响应: {}",
                status, body
            ));
        }

        let response_text = response.text().await.map_err(|e| {
            format!("Gemini API 读取响应体失败: {}", e)
        })?;

        let gemini_response: GeminiResponse = serde_json::from_str(&response_text).map_err(|e| {
            error!("[Gemini API] 响应解析失败: {}, 原始响应: {}", e, response_text);
            format!("Gemini API 响应解析失败: {}，原始响应: {}", e, response_text)
        })?;

        let content = gemini_response
            .candidates
            .first()
            .ok_or_else(|| "Gemini API 未返回候选结果".to_string())?
            .content
            .parts
            .first()
            .ok_or_else(|| "Gemini API 返回内容为空".to_string())?
            .text
            .clone();

        info!("[Gemini API] 成功获取分析报告，长度: {} 字符", content.len());
        
        let report: StockReport = serde_json::from_str(&content).map_err(|e| {
            error!("[Gemini API] 报告解析失败: {}, 原始内容: {}", e, content);
            format!("报告格式解析失败: {}", e)
        })?;
        
        Ok(report)
    }

    async fn call_openai_api(&self, prompt: &str) -> Result<StockReport, String> {
        let token = self
            .openai_token
            .clone()
            .ok_or_else(|| "OpenAI API token 未配置，请在设置页面配置 OpenAI API Key".to_string())?;

        let base_url = self
            .openai_base_url
            .clone()
            .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
        let model = self
            .openai_model
            .clone()
            .unwrap_or_else(|| "gpt-4o-mini".to_string());
        let api_url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

        let request = OpenAIRequest {
            model: model.clone(),
            messages: vec![
                Message {
                    role: "system".to_string(),
                    content: "你是一名专业的A股分析师，擅长缠论分析和技术分析。请用中文回复，并严格按照JSON格式输出。".to_string(),
                },
                Message {
                    role: "user".to_string(),
                    content: prompt.to_string(),
                },
            ],
            max_tokens: 4096,
            temperature: 0.7,
        };

        info!("[OpenAI API] 调用OpenAI API (model: {})...", model);

        let response = self
            .client
            .post(&api_url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", token))
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    "OpenAI API 请求超时(120秒)，请检查网络连接".to_string()
                } else if e.is_connect() {
                    format!("OpenAI API 连接失败，请检查网络连接或 Base URL({})是否正确", base_url)
                } else {
                    format!("OpenAI API 请求失败: {}", e)
                }
            })?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            error!("[OpenAI API] 请求失败，状态码: {}, 响应: {}", status, body);
            return Err(format!(
                "OpenAI API 返回错误状态: {}，请检查 API Key 和 Base URL 是否正确。响应: {}",
                status, body
            ));
        }

        let response_text = response.text().await.map_err(|e| {
            format!("OpenAI API 读取响应体失败: {}", e)
        })?;

        let openai_response: OpenAIResponse = serde_json::from_str(&response_text).map_err(|e| {
            error!("[OpenAI API] 响应解析失败: {}, 原始响应: {}", e, response_text);
            format!("OpenAI API 响应解析失败: {}，原始响应: {}", e, response_text)
        })?;

        let content = openai_response
            .choices
            .first()
            .ok_or_else(|| "OpenAI API 未返回候选结果".to_string())?
            .message
            .content
            .clone();
        
        info!("[OpenAI API] 成功获取分析报告，长度: {} 字符", content.len());
        
        let report: StockReport = serde_json::from_str(&content).map_err(|e| {
            error!("[OpenAI API] 报告解析失败: {}, 原始内容: {}", e, content);
            format!("报告格式解析失败: {}", e)
        })?;
        
        Ok(report)
    }

    pub fn get_provider(&self) -> &AiProvider {
        &self.preferred_provider
    }
}
