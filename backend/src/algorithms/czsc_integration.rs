//! czsc 库集成模块
//!
//! 本模块封装 czsc_core 库的缠论分析功能，提供：
//! - 股票K线数据到 czsc RawBar 的转换
//! - 分型、笔、线段的自动识别（由 czsc_core 完成）
//! - 中枢检测（本项目实现）
//! - 买卖点信号检测（本项目实现）
//!
//! # 缠论核心概念
//!
//! ## 分型（Fractal）
//! - 顶分型：中间K线高点最高，低点也最高（至少3根K线）
//! - 底分型：中间K线低点最低，高点也最低（至少3根K线）
//! - **由 czsc_core 自动识别，无需手动实现**
//!
//! ## 笔（BI - Bi）
//! - 相邻顶分型和底分型的连接
//! - 方向：向上笔（底→顶）或向下笔（顶→底）
//! - **由 czsc_core 自动连接，无需手动实现**
//!
//! ## 线段（XD - XianDuan）
//! - 由至少三笔组成的走势结构
//! - **由 czsc_core 自动构建，无需手动实现**
//!
//! ## 中枢（ZS - ZhongShu）
//! - 三个连续次级别走势的重叠区间
//! - ZG：中枢上沿（重叠区间最高点）
//! - ZD：中枢下沿（重叠区间最低点）
//! - **由本模块 `detect_zs` 函数实现**
//!
//! ## 买卖点信号
//! - 一买：下跌笔跌破中枢下沿且创新低（背驰）
//! - 二买：下跌笔在中枢内结束，高于一买位置
//! - 三买：上涨笔突破中枢上沿后回踩不破ZG
//! - **由本模块 `detect_buy_signals` 函数实现**

use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};
use czsc_core::{
    analyze::CZSC,
    objects::{bar::RawBar, bi::BI, direction::Direction, freq::Freq, fx::FX, zs::ZS},
};
use std::sync::Arc;

/// 缠论分析器
///
/// 封装 czsc_core 的 CZSC 分析器，提供股票数据的缠论分析功能。
/// 包括分型识别、笔段划分、中枢检测、买卖点信号生成。
pub struct ChanlunAnalyzer {
    /// 内部 czsc 分析器实例
    /// 负责分型、笔、线段的自动识别
    analyzer: CZSC,
}

impl ChanlunAnalyzer {
    /// 创建新的缠论分析器
    ///
    /// # 参数
    /// - `bars`: 历史K线数据，转换为 RawBar 格式
    /// - `max_bi_num`: 最大笔数量限制，用于控制分析深度
    ///
    /// # 示例
    /// ```rust
    /// let bars = vec![bar1, bar2, bar3, ...];
    /// let analyzer = ChanlunAnalyzer::new(bars, 50);
    /// ```
    pub fn new(bars: Vec<RawBar>, max_bi_num: usize) -> Self {
        Self {
            analyzer: CZSC::new(bars, max_bi_num),
        }
    }

    /// 更新最新K线数据
    ///
    /// 用于实时分析场景，当有新K线时更新分析器状态
    ///
    /// # 参数
    /// - `bar`: 最新的K线数据
    pub fn update_bar(&mut self, bar: RawBar) {
        self.analyzer.update_bar(bar);
    }

    /// 获取笔列表
    ///
    /// 返回 czsc 分析器识别出的所有笔。
    /// 笔是相邻顶分型和底分型的连接，有方向性（向上/向下）。
    ///
    /// # 返回值
    /// - `Vec<BI>`: 笔列表，按时间顺序排列
    pub fn get_bi_list(&self) -> Vec<BI> {
        self.analyzer.bi_list.clone()
    }

    /// 获取分型列表
    ///
    /// 返回 czsc 分析器识别出的所有分型（顶分型/底分型）。
    /// 分型是缠论分析的基础，至少由3根K线组成。
    ///
    /// # 返回值
    /// - `Vec<FX>`: 分型列表，按时间顺序排列
    pub fn get_fx_list(&self) -> Vec<FX> {
        self.analyzer.get_fx_list()
    }

    /// 获取中枢列表
    ///
    /// 基于笔列表检测中枢结构。
    /// 中枢是三个连续次级别走势的重叠区间。
    ///
    /// # 返回值
    /// - `Vec<ZS>`: 中枢列表
    ///
    /// # 实现说明
    /// 调用本模块的 `detect_zs` 函数，滑动窗口检测三笔重叠
    pub fn get_zs_list(&self) -> Vec<ZS> {
        detect_zs(&self.analyzer.bi_list)
    }

    /// 执行完整分析
    ///
    /// 获取分型、笔、中枢的完整分析结果。
    ///
    /// # 返回值
    /// - `ChanlunResult`: 包含分型列表、笔列表、中枢列表
    pub fn analyze(&self) -> ChanlunResult {
        ChanlunResult {
            bi_list: self.get_bi_list(),
            fx_list: self.get_fx_list(),
            zs_list: self.get_zs_list(),
        }
    }

    /// 检测买卖点信号
    ///
    /// 基于缠论理论检测买卖信号，包括一买、二买、三买、一卖、二卖、三卖。
    ///
    /// # 信号逻辑
    ///
    /// ## 一买（FirstBuy）
    /// - 条件：下跌笔跌破中枢下沿(ZD)且创新低
    /// - 逻辑：背驰点，趋势可能反转
    ///
    /// ## 二买（SecondBuy）
    /// - 条件：下跌笔在中枢内结束，且高于前低
    /// - 逻辑：一买后的回踩确认
    ///
    /// ## 一卖（FirstSell）
    /// - 条件：上涨笔突破中枢上沿(ZG)且创新高
    /// - 逻辑：背驰点，趋势可能反转
    ///
    /// ## 二卖（SecondSell）
    /// - 条件：上涨笔在中枢内结束，且低于前高
    /// - 逻辑：一卖后的回抽确认
    ///
    /// # 返回值
    /// - `Vec<BuySignal>`: 信号列表，按时间排序，已去重
    ///
    /// # 注意事项
    /// - 需要至少5根笔才能进行有效分析
    /// - 信号会去重（同一天同类型信号只保留一个）
    /// - 只检测与最后一个中枢相关的信号
    pub fn detect_buy_signals(&self) -> Vec<BuySignal> {
        let mut signals = Vec::new();
        let bi_list = &self.analyzer.bi_list;
        let zs_list = self.get_zs_list();

        // 需要至少5根笔才能进行有效分析
        if bi_list.len() < 5 {
            return signals;
        }

        // 从第3根笔开始遍历，确保有前两根笔作为参考
        for i in 2..bi_list.len() {
            let bi = &bi_list[i];
            let prev_bi = &bi_list[i - 1];
            let prev_prev_bi = &bi_list[i - 2];

            // 检测一买和二买（下跌笔）
            if bi.direction == Direction::Down {
                // 确认笔的方向序列：下-上-下
                if prev_bi.direction == Direction::Up && prev_prev_bi.direction == Direction::Down {
                    if let Some(last_zs) = zs_list.last() {
                        let bi_low = bi.get_low();
                        let zd = last_zs.zd;
                        let zg = last_zs.zg;

                        let _prev_bi_high = prev_bi.get_high();
                        let prev_prev_bi_low = prev_prev_bi.get_low();

                        // 一买：跌破中枢下沿且创新低
                        if bi_low < zd && bi_low < prev_prev_bi_low {
                            signals.push(BuySignal {
                                signal_type: BuySignalType::FirstBuy,
                                date: bi.end_dt().naive_utc(),
                                price: bi_low,
                            });
                        }
                        // 二买：在中枢内结束，高于前低
                        else if zd < bi_low && bi_low < zg && bi_low > prev_prev_bi_low {
                            signals.push(BuySignal {
                                signal_type: BuySignalType::SecondBuy,
                                date: bi.end_dt().naive_utc(),
                                price: bi_low,
                            });
                        }
                    }
                }
            }

            // 检测一卖和二卖（上涨笔）
            if bi.direction == Direction::Up {
                // 确认笔的方向序列：上-下-上
                if prev_bi.direction == Direction::Down && prev_prev_bi.direction == Direction::Up {
                    if let Some(last_zs) = zs_list.last() {
                        let bi_high = bi.get_high();
                        let zd = last_zs.zd;
                        let zg = last_zs.zg;

                        let _prev_bi_low = prev_bi.get_low();
                        let prev_prev_bi_high = prev_prev_bi.get_high();

                        // 一卖：突破中枢上沿且创新高
                        if bi_high > zg && bi_high > prev_prev_bi_high {
                            signals.push(BuySignal {
                                signal_type: BuySignalType::FirstSell,
                                date: bi.end_dt().naive_utc(),
                                price: bi_high,
                            });
                        }
                        // 二卖：在中枢内结束，低于前高
                        else if zd < bi_high && bi_high < zg && bi_high < prev_prev_bi_high {
                            signals.push(BuySignal {
                                signal_type: BuySignalType::SecondSell,
                                date: bi.end_dt().naive_utc(),
                                price: bi_high,
                            });
                        }
                    }
                }
            }
        }

        // 按时间排序
        signals.sort_by(|a, b| a.date.cmp(&b.date));
        // 去重：同一天同类型信号只保留一个
        signals.dedup_by(|a, b| a.date == b.date && a.signal_type == b.signal_type);

        signals
    }
}

/// 检测中枢
///
/// 基于笔列表检测中枢结构。中枢是三个连续次级别走势的重叠区间。
///
/// # 算法逻辑
/// 1. 使用滑动窗口遍历笔列表
/// 2. 每3根笔为一组，检查是否形成中枢
/// 3. 调用 ZS::new() 创建中枢，验证是否有效
///
/// # 参数
/// - `bis`: 笔列表
///
/// # 返回值
/// - `Vec<ZS>`: 检测到的中枢列表
///
/// # 中枢要素
/// - ZG（中枢上沿）：重叠区间的最高点
/// - ZD（中枢下沿）：重叠区间的最低点
/// - GG（高点）：构成中枢的所有笔的最高点
/// - DD（低点）：构成中枢的所有笔的最低点
fn detect_zs(bis: &[BI]) -> Vec<ZS> {
    let mut zs_list = Vec::new();
    // 至少需要3根笔才能形成中枢
    if bis.len() < 3 {
        return zs_list;
    }

    let mut i = 0;
    // 滑动窗口检测
    while i + 2 < bis.len() {
        let candidate = &bis[i..=i + 2];
        if candidate.len() == 3 {
            // 尝试创建中枢
            let zs = ZS::new(candidate.to_vec());
            // 验证中枢有效性
            if zs.is_valid() {
                zs_list.push(zs);
            }
        }
        i += 1;
    }
    zs_list
}

/// 缠论分析结果
///
/// 包含分型、笔、中枢的完整分析结果
pub struct ChanlunResult {
    /// 笔列表
    pub bi_list: Vec<BI>,
    /// 分型列表
    pub fx_list: Vec<FX>,
    /// 中枢列表
    pub zs_list: Vec<ZS>,
}

/// 买卖信号类型
///
/// 缠论中的三类买卖点
#[derive(Debug, Clone, PartialEq)]
pub enum BuySignalType {
    /// 一买：下跌背驰点
    FirstBuy,
    /// 二买：一买后的回踩确认
    SecondBuy,
    /// 三买：突破中枢后回踩不破ZG
    ThirdBuy,
    /// 一卖：上涨背驰点
    FirstSell,
    /// 二卖：一卖后的回抽确认
    SecondSell,
    /// 三卖：跌破中枢后回抽不过ZD
    ThirdSell,
}

/// 买卖信号
///
/// 包含信号类型、发生日期、价格
#[derive(Debug, Clone)]
pub struct BuySignal {
    /// 信号类型
    pub signal_type: BuySignalType,
    /// 信号发生日期
    pub date: NaiveDateTime,
    /// 信号价格
    pub price: f64,
}

/// 将股票K线数据转换为 czsc RawBar
///
/// # 参数
/// - `code`: 股票代码
/// - `date`: 交易日期时间
/// - `open`: 开盘价
/// - `high`: 最高价
/// - `low`: 最低价
/// - `close`: 收盘价
/// - `volume`: 成交量
/// - `id`: K线序号
///
/// # 返回值
/// - `RawBar`: czsc 库需要的 RawBar 格式
///
/// # 说明
/// 金额(Amount) = 成交量 × 收盘价
pub fn convert_to_raw_bar(
    code: &str,
    date: NaiveDateTime,
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    volume: f64,
    id: i32,
) -> RawBar {
    let date_utc: DateTime<Utc> = Utc.from_utc_datetime(&date);
    czsc_core::objects::bar::RawBarBuilder::default()
        .symbol(Arc::from(code))
        .dt(date_utc)
        .freq(Freq::D)
        .id(id)
        .open(open)
        .high(high)
        .low(low)
        .close(close)
        .vol(volume)
        .amount(volume * close)
        .build()
        .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_chanlun_analyzer() {
        let mut bars = Vec::new();

        for i in 0..100 {
            let bar = czsc_core::objects::bar::RawBarBuilder::default()
                .symbol(Arc::from("000001"))
                .dt(Utc.timestamp_opt(1700000000 + i * 86400, 0).unwrap())
                .freq(Freq::D)
                .id(i as i32)
                .open(10.0 + i as f64 * 0.1)
                .high(11.0 + i as f64 * 0.1)
                .low(9.0 + i as f64 * 0.1)
                .close(10.5 + i as f64 * 0.1)
                .vol(1000000.0)
                .amount(10500000.0)
                .build()
                .unwrap();
            bars.push(bar);
        }

        let analyzer = ChanlunAnalyzer::new(bars, 50);
        let result = analyzer.analyze();
        println!("分型数量: {}", result.fx_list.len());
        println!("笔数量: {}", result.bi_list.len());
        println!("中枢数量: {}", result.zs_list.len());
    }
}
