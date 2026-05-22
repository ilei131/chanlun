// src/ai/mod.rs
use log::info;
use reqwest::{header::AUTHORIZATION, Client};
use serde::{Deserialize, Serialize};

pub enum AiProvider {
    Gemini,
    OpenAI,
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
    finish_reason: String,
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
    finish_reason: String,
}

pub struct AiService {
    client: Client,
    gemini_token: Option<String>,
    openai_token: Option<String>,
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

        Self {
            client: Client::new(),
            gemini_token,
            openai_token,
            preferred_provider: provider,
        }
    }

    pub async fn generate_stock_report(
        &self,
        stock_code: &str,
        stock_name: &str,
        market: &str,
        kline_data: &str,
        technical_indicators: &str,
        chanlun_signals: &str,
    ) -> Result<String, String> {
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

        match self.preferred_provider {
            AiProvider::Gemini => self.call_gemini_api(&prompt).await,
            AiProvider::OpenAI => self.call_openai_api(&prompt).await,
        }
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
            r#"
作为一名专业的股票分析师，请基于以下数据对股票进行全面分析：

股票信息：
- 股票代码：{}
- 股票名称：{}
- 市场：{}

K线数据（最近50条）：
{}

技术指标：
{}

缠论信号：
{}

请生成一份详细的股票分析报告，包括以下内容：

一、行情走势分析
1. 近期价格走势概述
2. 关键支撑位和阻力位分析
3. 成交量变化分析

二、技术指标分析
1. MACD指标解读
2. KDJ指标解读
3. RSI指标解读
4. 均线系统分析

三、缠论分析
1. 分型结构分析
2. 笔和线段划分
3. 中枢结构分析
4. 买卖点信号评估

四、综合评估
1. 当前趋势判断
2. 投资建议（买入/持有/卖出）
3. 目标价格预测
4. 风险提示

请用中文回复，报告结构清晰，分析专业严谨。
"#,
            stock_code, stock_name, market, kline_data, technical_indicators, chanlun_signals
        )
    }

    async fn call_gemini_api(&self, prompt: &str) -> Result<String, String> {
        let token = self
            .gemini_token
            .clone()
            .ok_or_else(|| "Gemini API token 未配置".to_string())?;

        let api_url =
            "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";

        let request = GeminiRequest {
            contents: vec![Content {
                parts: vec![Part {
                    text: prompt.to_string(),
                }],
            }],
        };

        info!("[Gemini API] 调用Gemini API...");

        let response = self
            .client
            .post(api_url)
            .header(AUTHORIZATION, format!("Bearer {}", token))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Gemini API 请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!(
                "Gemini API 返回错误状态: {}, 响应: {}",
                status, body
            ));
        }

        let gemini_response: GeminiResponse = response
            .json()
            .await
            .map_err(|e| format!("Gemini API 响应解析失败: {}", e))?;

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

        info!("[Gemini API] 成功获取分析报告");
        Ok(content)
    }

    async fn call_openai_api(&self, prompt: &str) -> Result<String, String> {
        let token = self
            .openai_token
            .clone()
            .ok_or_else(|| "OpenAI API token 未配置".to_string())?;

        let api_url = "https://api.openai.com/v1/chat/completions";

        let request = OpenAIRequest {
            model: "gpt-3.5-turbo".to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
            max_tokens: 3000,
            temperature: 0.7,
        };

        info!("[OpenAI API] 调用OpenAI API...");

        let response = self
            .client
            .post(api_url)
            .header(AUTHORIZATION, format!("Bearer {}", token))
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("OpenAI API 请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!(
                "OpenAI API 返回错误状态: {}, 响应: {}",
                status, body
            ));
        }

        let openai_response: OpenAIResponse = response
            .json()
            .await
            .map_err(|e| format!("OpenAI API 响应解析失败: {}", e))?;

        let content = openai_response
            .choices
            .first()
            .ok_or_else(|| "OpenAI API 未返回候选结果".to_string())?
            .message
            .content
            .clone();

        info!("[OpenAI API] 成功获取分析报告");
        Ok(content)
    }

    pub fn get_provider(&self) -> &AiProvider {
        &self.preferred_provider
    }
}
