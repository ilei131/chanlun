// src/api/analysis.rs
use actix_web::{web, HttpResponse, Scope};
use chrono::{Local, NaiveDate};
use log::{error, info, warn};
use serde_json::json;
use sqlx::{PgPool, Row};
use std::collections::HashMap;

use crate::ai::AiService;
use crate::algorithms::czsc_integration::{self, ChanlunAnalyzer};
use crate::api::auth::JwtClaims;
use crate::cache::KlineCache;
use crate::db::models::{CreateReportRequest, ReportListResponse, StockAnalysisReport};
use crate::tushare::client::{KlineData, TushareClient};
use czsc_core::objects::bar::RawBar;

pub fn routes() -> Scope {
    web::scope("/analysis")
        .route("/report", web::post().to(create_report))
        .route("/reports", web::get().to(get_reports))
        .route("/reports/{id}", web::get().to(get_report))
        .route("/reports/{id}", web::delete().to(delete_report))
}

async fn get_user_tokens(
    pool: &PgPool,
    user_id: i32,
) -> Result<(Option<String>, Option<String>, Option<String>, Option<String>, Option<String>), String> {
    info!("[get_user_tokens] 查询用户 {} 的Token配置", user_id);
    let result = sqlx::query(
        "SELECT gemini_token, openai_token, preferred_ai_provider, openai_base_url, openai_model FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!("[get_user_tokens] 查询失败: {}", e);
        format!("查询用户Token失败: {}", e)
    })?;

    match result {
        Some(row) => {
            let gemini = row.get::<Option<String>, _>(0);
            let openai = row.get::<Option<String>, _>(1);
            let provider = row.get::<Option<String>, _>(2);
            info!(
                "[get_user_tokens] 用户 {} 查询成功 - Gemini: {}, OpenAI: {}, Provider: {:?}",
                user_id,
                gemini.as_ref().map(|_| "已配置").unwrap_or("未配置"),
                openai.as_ref().map(|_| "已配置").unwrap_or("未配置"),
                provider
            );
            Ok((gemini, openai, provider, row.get(3), row.get(4)))
        }
        None => {
            error!("[get_user_tokens] 用户 {} 不存在", user_id);
            Err("用户不存在".to_string())
        }
    }
}

async fn get_stock_info(
    pool: &PgPool,
    stock_code: &str,
    market: &str,
) -> Result<(String, Option<NaiveDate>), String> {
    let result = sqlx::query(
        "SELECT name, list_date FROM stocks WHERE code = $1 AND market = $2 AND is_active = true",
    )
    .bind(stock_code)
    .bind(market)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("查询股票信息失败: {}", e))?;

    match result {
        Some(row) => Ok((row.get(0), row.get(1))),
        None => {
            info!("[get_stock_info] 本地数据库未找到股票 {} {}，尝试从 Tushare 获取", stock_code, market);
            let tushare_client = TushareClient::new();
            let search_result = tushare_client.search_stocks(stock_code).await;

            match search_result {
                Ok(stocks) => {
                    if let Some(stock) = stocks.into_iter().next() {
                        info!("[get_stock_info] 从 Tushare 找到股票: {}", stock.name);
                        Ok((stock.name, None))
                    } else {
                        Err(format!("未找到股票: {} {}", stock_code, market))
                    }
                }
                Err(e) => {
                    error!("[get_stock_info] 从 Tushare 获取股票信息失败: {}", e);
                    Err(format!("未找到股票: {} {}", stock_code, market))
                }
            }
        }
    }
}

async fn create_report(
    pool: web::Data<PgPool>,
    claims: JwtClaims,
    body: web::Json<CreateReportRequest>,
) -> HttpResponse {
    let stock_code = &body.stock_code;
    let market = body.market.as_deref().unwrap_or("SH");

    info!(
        "[create_report] 用户{}请求分析股票: {} {}",
        claims.sub, stock_code, market
    );

    info!("[create_report] 正在获取用户Token...");
    let (gemini_token, openai_token, preferred_provider, openai_base_url, openai_model) =
        match get_user_tokens(pool.get_ref(), claims.sub).await {
            Ok(tokens) => {
                info!("[create_report] 获取用户Token成功");
                tokens
            }
            Err(e) => {
                error!("[create_report] 获取用户Token失败: {}", e);
                return HttpResponse::InternalServerError().json(json!({
                    "success": false,
                    "message": format!("获取用户配置失败: {}", e)
                }));
            }
        };

    if gemini_token.is_none() && openai_token.is_none() {
        warn!("[create_report] 用户{}未配置AI API Token", claims.sub);
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "message": "请先在设置页面配置 AI API Key（Gemini 或 OpenAI）才能使用分析功能"
        }));
    }

    let (stock_name, _) = match get_stock_info(pool.get_ref(), stock_code, market).await {
        Ok(info) => info,
        Err(e) => {
            error!("[create_report] 获取股票信息失败: {}", e);
            return HttpResponse::NotFound().json(json!({
                "success": false,
                "message": e
            }));
        }
    };

    let cache = KlineCache::new("./data_cache", 500, 7);
    let ts_code = format!("{}.{}", stock_code, market);

    let kline_data = match cache.get(stock_code, "D") {
        Some(data) => {
            info!("[create_report] 缓存命中，使用缓存的 {} 条 K 线数据", data.len());
            let mut sorted = data;
            sorted.reverse();
            sorted
        }
        None => {
            info!("[create_report] 缓存未命中，从Tushare获取数据");
            let tushare_client = match claims.tushare_token.clone() {
                Some(token) => TushareClient::with_token(&token),
                None => TushareClient::new(),
            };
            let today = Local::now().format("%Y%m%d").to_string();
            let start_date = (Local::now() - chrono::Duration::days(365))
                .format("%Y%m%d")
                .to_string();
            match tushare_client
                .get_kline_data(&ts_code, &start_date, &today, "D")
                .await
            {
                Ok(data) => {
                    cache.put(stock_code, "D", data.clone());
                    let mut sorted = data;
                    sorted.reverse();
                    sorted
                }
                Err(e) => {
                    error!("[create_report] 获取K线数据失败: {}", e);
                    return HttpResponse::InternalServerError().json(json!({
                        "success": false,
                        "message": format!("获取K线数据失败: {}", e)
                    }));
                }
            }
        }
    };

    if kline_data.is_empty() {
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "message": "未获取到K线数据"
        }));
    }

    let analysis_date = Local::now().date_naive();
    let ai_service = AiService::new(gemini_token, openai_token, preferred_provider)
        .with_openai_config(openai_base_url, openai_model);
    let ai_provider_str = ai_service.get_provider().to_string();

    let existing = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM stock_analysis_reports WHERE user_id = $1 AND stock_code = $2 AND analysis_date = $3 AND status = 'pending'",
    )
    .bind(claims.sub)
    .bind(stock_code)
    .bind(analysis_date)
    .fetch_optional(pool.get_ref())
    .await;

    if let Ok(Some(existing_id)) = existing {
        info!("[create_report] 用户{}请求生成股票{}的报告，但已有pending报告(ID: {})，拒绝重复请求", claims.sub, stock_code, existing_id);
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "message": "该股票的分析报告正在生成中，请稍后再试"
        }));
    }

    let insert_result = sqlx::query(
        "INSERT INTO stock_analysis_reports (user_id, stock_code, stock_name, market, analysis_date, ai_provider, report_content, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(claims.sub)
    .bind(stock_code)
    .bind(&stock_name)
    .bind(market)
    .bind(analysis_date)
    .bind(&ai_provider_str)
    .bind("")
    .bind("pending")
    .execute(pool.get_ref())
    .await;

    if let Err(e) = insert_result {
        error!("[create_report] 创建报告记录失败: {}", e);
        return HttpResponse::InternalServerError().json(json!({
            "success": false,
            "message": format!("创建报告记录失败: {}", e)
        }));
    }

    let kline_summary = summarize_kline_data(&kline_data);
    let tech_summary = summarize_technical_indicators(&kline_data);
    let chanlun_summary = summarize_chanlun_signals(&kline_data);

    let report = match ai_service
        .generate_stock_report(
            stock_code,
            &stock_name,
            market,
            &kline_summary,
            &tech_summary,
            &chanlun_summary,
        )
        .await
    {
        Ok(report) => report,
        Err(e) => {
            error!("[create_report] AI生成报告失败: {}", e);
            let _ = sqlx::query(
                "UPDATE stock_analysis_reports SET status = $1, error_message = $2 WHERE user_id = $3 AND stock_code = $4 AND analysis_date = $5",
            )
            .bind("failed")
            .bind(&e)
            .bind(claims.sub)
            .bind(stock_code)
            .bind(analysis_date)
            .execute(pool.get_ref())
            .await;

            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("AI生成报告失败: {}", e)
            }));
        }
    };

    let result = sqlx::query(
        "UPDATE stock_analysis_reports SET report_content = $1, summary = $2, investment_rating = $3, target_price = $4, status = $5 WHERE user_id = $6 AND stock_code = $7 AND analysis_date = $8 RETURNING id",
    )
    .bind(&report.report_content)
    .bind(&report.summary)
    .bind(&report.investment_rating)
    .bind(report.target_price)
    .bind("completed")
    .bind(claims.sub)
    .bind(stock_code)
    .bind(analysis_date)
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(row) => {
            let report_id: i64 = row.get(0);
            info!("[create_report] 报告生成成功，ID: {}", report_id);
            HttpResponse::Ok().json(json!({
                "success": true,
                "message": "报告生成成功",
                "report_id": report_id
            }))
        }
        Err(e) => {
            error!("[create_report] 保存报告失败: {}", e);
            HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("保存报告失败: {}", e)
            }))
        }
    }
}

fn summarize_kline_data(data: &[KlineData]) -> String {
    if data.is_empty() {
        return "无K线数据".to_string();
    }

    let latest = data.last().unwrap();
    let first = &data[0];

    let mut summary = format!(
        "最新行情：\n- 收盘价: {:.2}\n- 最高价: {:.2}\n- 最低价: {:.2}\n- 开盘价: {:.2}\n- 成交量: {}\n",
        latest.close, latest.high, latest.low, latest.open, latest.vol
    );

    let price_change = latest.close - first.close;
    let change_percent = (price_change / first.close) * 100.0;
    summary.push_str(&format!(
        "区间变化：\n- 价格变化: {:.2}\n- 涨跌幅: {:.2}%\n",
        price_change, change_percent
    ));

    let recent_count = data.len().min(20);
    let recent_data = &data[data.len() - recent_count..];
    summary.push_str(&format!("\n最近{}日行情：\n", recent_count));
    for k in recent_data.iter().rev() {
        let change = k.close - k.open;
        let change_pct = (change / k.open) * 100.0;
        summary.push_str(&format!(
            "- {}: 收盘{:.2} 涨跌{:.2}%\n",
            k.trade_date, k.close, change_pct
        ));
    }

    summary
}

fn summarize_chanlun_signals(data: &[KlineData]) -> String {
    if data.len() < 10 {
        return "数据不足，无法进行缠论分析".to_string();
    }

    let bars: Vec<RawBar> = data
        .iter()
        .enumerate()
        .map(|(i, k)| {
            let date = match NaiveDate::parse_from_str(&k.trade_date, "%Y%m%d") {
                Ok(d) => d,
                Err(_) => return czsc_integration::convert_to_raw_bar(
                    &k.ts_code,
                    chrono::NaiveDateTime::new(
                        Local::now().date_naive(),
                        chrono::NaiveTime::default(),
                    ),
                    k.open, k.high, k.low, k.close, k.vol, i as i32,
                ),
            };
            let datetime = chrono::NaiveDateTime::new(date, chrono::NaiveTime::default());
            czsc_integration::convert_to_raw_bar(
                &k.ts_code, datetime, k.open, k.high, k.low, k.close, k.vol, i as i32,
            )
        })
        .collect();

    let analyzer = ChanlunAnalyzer::new(bars, 50);
    let signals = analyzer.detect_buy_signals();
    let bi_list = analyzer.get_bi_list();
    let zs_list = analyzer.get_zs_list();
    let fx_list = analyzer.get_fx_list();

    let mut summary = String::new();

    summary.push_str(&format!("分型数量: {}\n", fx_list.len()));
    let top_count = fx_list.iter().filter(|fx| fx.mark == czsc_core::objects::mark::Mark::G).count();
    let bottom_count = fx_list.iter().filter(|fx| fx.mark == czsc_core::objects::mark::Mark::D).count();
    summary.push_str(&format!("- 顶分型: {}, 底分型: {}\n", top_count, bottom_count));

    if let Some(last_fx) = fx_list.last() {
        let direction = match last_fx.mark {
            czsc_core::objects::mark::Mark::G => "顶分型",
            czsc_core::objects::mark::Mark::D => "底分型",
        };
        summary.push_str(&format!(
            "- 最新分型: {} 日期:{} 价格:{:.2}\n",
            direction,
            last_fx.dt.format("%Y%m%d"),
            last_fx.fx
        ));
    }

    summary.push_str(&format!("\n笔数量: {}\n", bi_list.len()));
    for bi in bi_list.iter().rev().take(5) {
        let direction = match bi.direction {
            czsc_core::objects::direction::Direction::Up => "向上",
            czsc_core::objects::direction::Direction::Down => "向下",
        };
        summary.push_str(&format!(
            "- {}笔: {} ~ {} ({:.2} ~ {:.2})\n",
            direction,
            bi.start_dt().format("%Y%m%d"),
            bi.end_dt().format("%Y%m%d"),
            bi.get_low(),
            bi.get_high()
        ));
    }

    summary.push_str(&format!("\n中枢数量: {}\n", zs_list.len()));
    for (i, zs) in zs_list.iter().enumerate() {
        summary.push_str(&format!(
            "- 中枢{}: {} ~ {} ZD:{:.2} ZG:{:.2} GG:{:.2} DD:{:.2} ({}笔)\n",
            i + 1,
            zs.bis[0].start_dt().format("%Y%m%d"),
            zs.bis.last().unwrap().end_dt().format("%Y%m%d"),
            zs.zd, zs.zg, zs.gg, zs.dd, zs.bis.len()
        ));
    }

    if !signals.is_empty() {
        summary.push_str("\n买卖点信号:\n");
        for s in signals.iter().rev().take(10) {
            let signal_name = match s.signal_type {
                czsc_integration::BuySignalType::FirstBuy => "一买",
                czsc_integration::BuySignalType::SecondBuy => "二买",
                czsc_integration::BuySignalType::ThirdBuy => "三买",
                czsc_integration::BuySignalType::FirstSell => "一卖",
                czsc_integration::BuySignalType::SecondSell => "二卖",
                czsc_integration::BuySignalType::ThirdSell => "三卖",
            };
            summary.push_str(&format!(
                "- {} 日期:{} 价格:{:.2}\n",
                signal_name,
                s.date.format("%Y%m%d"),
                s.price
            ));
        }
    } else {
        summary.push_str("\n当前无买卖点信号\n");
    }

    summary
}

fn summarize_technical_indicators(data: &[KlineData]) -> String {
    let closes: Vec<f64> = data.iter().map(|k| k.close).collect();

    if closes.len() < 60 {
        return "数据不足，无法计算技术指标".to_string();
    }

    let ma5 = calculate_ma(&closes, 5);
    let ma10 = calculate_ma(&closes, 10);
    let ma20 = calculate_ma(&closes, 20);
    let ma60 = calculate_ma(&closes, 60);

    let (macd_dif, macd_dea, _) = calculate_macd(&closes);
    let (kdj_k, kdj_d, kdj_j) = calculate_kdj(&closes);
    let rsi = calculate_rsi(&closes);

    format!(
        "均线指标:\n- MA5: {:.2}\n- MA10: {:.2}\n- MA20: {:.2}\n- MA60: {:.2}\n\nMACD指标:\n- DIF: {:.4}\n- DEA: {:.4}\n\nKDJ指标:\n- K: {:.2}\n- D: {:.2}\n- J: {:.2}\n\nRSI指标:\n- RSI6: {:.2}\n- RSI12: {:.2}\n- RSI24: {:.2}",
        ma5.last().copied().unwrap_or(0.0),
        ma10.last().copied().unwrap_or(0.0),
        ma20.last().copied().unwrap_or(0.0),
        ma60.last().copied().unwrap_or(0.0),
        macd_dif.last().copied().unwrap_or(0.0),
        macd_dea.last().copied().unwrap_or(0.0),
        kdj_k.last().copied().unwrap_or(0.0),
        kdj_d.last().copied().unwrap_or(0.0),
        kdj_j.last().copied().unwrap_or(0.0),
        rsi.0.last().copied().unwrap_or(0.0),
        rsi.1.last().copied().unwrap_or(0.0),
        rsi.2.last().copied().unwrap_or(0.0)
    )
}

fn calculate_ma(data: &[f64], period: usize) -> Vec<f64> {
    let mut result = Vec::new();
    for i in period..=data.len() {
        let sum: f64 = data[i - period..i].iter().sum();
        result.push(sum / period as f64);
    }
    result
}

fn calculate_macd(data: &[f64]) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    let ema12 = calculate_ema(data, 12);
    let ema26 = calculate_ema(data, 26);

    let dif: Vec<f64> = ema12
        .iter()
        .zip(ema26.iter())
        .map(|(e12, e26)| e12 - e26)
        .collect();
    let dea = calculate_ema(&dif, 9);

    let macd: Vec<f64> = dif
        .iter()
        .zip(dea.iter())
        .map(|(d, de)| (d - de) * 2.0)
        .collect();

    (dif, dea, macd)
}

fn calculate_ema(data: &[f64], period: usize) -> Vec<f64> {
    let mut result = Vec::new();
    if data.is_empty() {
        return result;
    }

    let alpha = 2.0 / (period as f64 + 1.0);
    let mut ema = data[0];
    result.push(ema);

    for &val in data.iter().skip(1) {
        ema = alpha * val + (1.0 - alpha) * ema;
        result.push(ema);
    }

    result
}

fn calculate_kdj(data: &[f64]) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    let period = 9;
    let mut k_values = Vec::new();
    let mut d_values = Vec::new();
    let mut j_values = Vec::new();

    for i in period..=data.len() {
        let slice = &data[i - period..i];
        let high = slice.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let low = slice.iter().cloned().fold(f64::INFINITY, f64::min);
        let close = data[i - 1];

        let rsv = ((close - low) / (high - low + 1e-10)) * 100.0;

        let k = if k_values.is_empty() {
            50.0
        } else {
            (2.0 / 3.0) * k_values.last().unwrap() + (1.0 / 3.0) * rsv
        };

        let d = if d_values.is_empty() {
            50.0
        } else {
            (2.0 / 3.0) * d_values.last().unwrap() + (1.0 / 3.0) * k
        };

        let j = 3.0 * k - 2.0 * d;

        k_values.push(k);
        d_values.push(d);
        j_values.push(j);
    }

    (k_values, d_values, j_values)
}

fn calculate_rsi(data: &[f64]) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    (
        calculate_rsi_period(data, 6),
        calculate_rsi_period(data, 12),
        calculate_rsi_period(data, 24),
    )
}

fn calculate_rsi_period(data: &[f64], period: usize) -> Vec<f64> {
    let mut result = Vec::new();

    for i in period..=data.len() {
        let mut gains = 0.0;
        let mut losses = 0.0;

        for j in 1..period {
            let change = data[i - j] - data[i - j - 1];
            if change > 0.0 {
                gains += change;
            } else {
                losses += change.abs();
            }
        }

        let avg_gain = gains / period as f64;
        let avg_loss = losses / period as f64;

        let rsi = if avg_loss == 0.0 {
            100.0
        } else {
            100.0 - (100.0 / (1.0 + avg_gain / avg_loss))
        };

        result.push(rsi);
    }

    result
}

async fn get_reports(
    pool: web::Data<PgPool>,
    claims: JwtClaims,
    query: web::Query<HashMap<String, String>>,
) -> HttpResponse {
    let page: i32 = query.get("page").and_then(|p| p.parse().ok()).unwrap_or(1);
    let page_size: i32 = query
        .get("page_size")
        .and_then(|p| p.parse().ok())
        .unwrap_or(10);
    let stock_code = query.get("stock_code");

    info!(
        "[get_reports] 用户{}查询报告列表, 页码: {}, 每页: {}",
        claims.sub, page, page_size
    );

    let offset = (page - 1) * page_size;

    let reports = if let Some(code) = stock_code {
        sqlx::query_as::<_, StockAnalysisReport>(
            "SELECT id, user_id, stock_code, stock_name, market, analysis_date,
                    ai_provider, report_content, summary, investment_rating,
                    target_price::double precision as target_price,
                    confidence_score::double precision as confidence_score,
                    status, error_message, created_at, updated_at
             FROM stock_analysis_reports WHERE user_id = $1 AND stock_code = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4"
        )
        .bind(claims.sub)
        .bind(code)
        .bind(page_size)
        .bind(offset)
        .fetch_all(pool.get_ref())
        .await
    } else {
        sqlx::query_as::<_, StockAnalysisReport>(
            "SELECT id, user_id, stock_code, stock_name, market, analysis_date,
                    ai_provider, report_content, summary, investment_rating,
                    target_price::double precision as target_price,
                    confidence_score::double precision as confidence_score,
                    status, error_message, created_at, updated_at
             FROM stock_analysis_reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
        )
        .bind(claims.sub)
        .bind(page_size)
        .bind(offset)
        .fetch_all(pool.get_ref())
        .await
    };

    let total = if let Some(code) = stock_code {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM stock_analysis_reports WHERE user_id = $1 AND stock_code = $2",
        )
        .bind(claims.sub)
        .bind(code)
        .fetch_one(pool.get_ref())
        .await
        .unwrap_or(0)
    } else {
        sqlx::query_scalar("SELECT COUNT(*) FROM stock_analysis_reports WHERE user_id = $1")
            .bind(claims.sub)
            .fetch_one(pool.get_ref())
            .await
            .unwrap_or(0)
    };

    match reports {
        Ok(reports) => HttpResponse::Ok().json(ReportListResponse {
            reports,
            total,
            page,
            page_size,
        }),
        Err(e) => {
            error!("[get_reports] 查询报告失败: {}", e);
            HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("查询报告失败: {}", e)
            }))
        }
    }
}

async fn get_report(
    pool: web::Data<PgPool>,
    claims: JwtClaims,
    path: web::Path<i64>,
) -> HttpResponse {
    let report_id = path.into_inner();

    info!("[get_report] 用户{}查询报告详情: {}", claims.sub, report_id);

    let report = sqlx::query_as::<_, StockAnalysisReport>(
        "SELECT * FROM stock_analysis_reports WHERE id = $1 AND user_id = $2",
    )
    .bind(report_id)
    .bind(claims.sub)
    .fetch_optional(pool.get_ref())
    .await;

    match report {
        Ok(Some(report)) => HttpResponse::Ok().json(report),
        Ok(None) => {
            warn!("[get_report] 报告不存在: {}", report_id);
            HttpResponse::NotFound().json(json!({
                "success": false,
                "message": "报告不存在"
            }))
        }
        Err(e) => {
            error!("[get_report] 查询报告失败: {}", e);
            HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("查询报告失败: {}", e)
            }))
        }
    }
}

async fn delete_report(
    pool: web::Data<PgPool>,
    claims: JwtClaims,
    path: web::Path<i64>,
) -> HttpResponse {
    let report_id = path.into_inner();

    info!("[delete_report] 用户{}删除报告: {}", claims.sub, report_id);

    let result = sqlx::query("DELETE FROM stock_analysis_reports WHERE id = $1 AND user_id = $2")
        .bind(report_id)
        .bind(claims.sub)
        .execute(pool.get_ref())
        .await;

    match result {
        Ok(res) => {
            if res.rows_affected() > 0 {
                info!("[delete_report] 报告删除成功: {}", report_id);
                HttpResponse::Ok().json(json!({
                    "success": true,
                    "message": "删除成功"
                }))
            } else {
                warn!("[delete_report] 报告不存在: {}", report_id);
                HttpResponse::NotFound().json(json!({
                    "success": false,
                    "message": "报告不存在"
                }))
            }
        }
        Err(e) => {
            error!("[delete_report] 删除报告失败: {}", e);
            HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": format!("删除报告失败: {}", e)
            }))
        }
    }
}
