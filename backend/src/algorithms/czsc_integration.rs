use czsc_core::{
    analyze::CZSC,
    objects::{
        bar::RawBar,
        bi::BI,
        direction::Direction,
        freq::Freq,
        fx::FX,
        zs::ZS,
    },
};
use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};
use std::sync::Arc;

pub struct ChanlunAnalyzer {
    analyzer: CZSC,
}

impl ChanlunAnalyzer {
    pub fn new(bars: Vec<RawBar>, max_bi_num: usize) -> Self {
        Self {
            analyzer: CZSC::new(bars, max_bi_num),
        }
    }

    pub fn update_bar(&mut self, bar: RawBar) {
        self.analyzer.update_bar(bar);
    }

    pub fn get_bi_list(&self) -> Vec<BI> {
        self.analyzer.bi_list.clone()
    }

    pub fn get_fx_list(&self) -> Vec<FX> {
        self.analyzer.get_fx_list()
    }

    pub fn get_zs_list(&self) -> Vec<ZS> {
        detect_zs(&self.analyzer.bi_list)
    }

    pub fn analyze(&self) -> ChanlunResult {
        ChanlunResult {
            bi_list: self.get_bi_list(),
            fx_list: self.get_fx_list(),
            zs_list: self.get_zs_list(),
        }
    }

    pub fn detect_buy_signals(&self) -> Vec<BuySignal> {
        let mut signals = Vec::new();
        let bi_list = &self.analyzer.bi_list;
        let zs_list = self.get_zs_list();

        if bi_list.is_empty() {
            return signals;
        }

        for i in 0..bi_list.len() {
            let bi = &bi_list[i];

            if bi.direction == Direction::Down {
                let prev_bi = if i > 0 { Some(&bi_list[i - 1]) } else { None };
                
                if let Some(pb) = prev_bi {
                    if pb.direction == Direction::Up {
                        if let Some(last_zs) = zs_list.last() {
                            let bi_low = bi.get_low();
                            let zd = last_zs.zd;
                            let zg = last_zs.zg;
                            
                            if bi_low < zd {
                                signals.push(BuySignal {
                                    signal_type: BuySignalType::FirstBuy,
                                    date: bi.end_dt().naive_utc(),
                                    price: bi_low,
                                });
                            } else if zd < bi_low && bi_low < zg {
                                signals.push(BuySignal {
                                    signal_type: BuySignalType::SecondBuy,
                                    date: bi.end_dt().naive_utc(),
                                    price: bi_low,
                                });
                            }
                        }
                    }
                }
            }

            if bi.direction == Direction::Up {
                let prev_bi = if i > 0 { Some(&bi_list[i - 1]) } else { None };
                
                if let Some(pb) = prev_bi {
                    if pb.direction == Direction::Down {
                        if let Some(last_zs) = zs_list.last() {
                            let bi_high = bi.get_high();
                            let zd = last_zs.zd;
                            let zg = last_zs.zg;
                            
                            if bi_high > zg {
                                signals.push(BuySignal {
                                    signal_type: BuySignalType::FirstSell,
                                    date: bi.end_dt().naive_utc(),
                                    price: bi_high,
                                });
                            } else if zd < bi_high && bi_high < zg {
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
        }

        signals
    }
}

fn detect_zs(bis: &[BI]) -> Vec<ZS> {
    let mut zs_list = Vec::new();
    if bis.len() < 3 {
        return zs_list;
    }

    let mut i = 0;
    while i + 2 < bis.len() {
        let candidate = &bis[i..=i + 2];
        if candidate.len() == 3 {
            let zs = ZS::new(candidate.to_vec());
            if zs.is_valid() {
                zs_list.push(zs);
            }
        }
        i += 1;
    }
    zs_list
}

pub struct ChanlunResult {
    pub bi_list: Vec<BI>,
    pub fx_list: Vec<FX>,
    pub zs_list: Vec<ZS>,
}

#[derive(Debug, Clone)]
pub enum BuySignalType {
    FirstBuy,
    SecondBuy,
    ThirdBuy,
    FirstSell,
    SecondSell,
    ThirdSell,
}

#[derive(Debug, Clone)]
pub struct BuySignal {
    pub signal_type: BuySignalType,
    pub date: NaiveDateTime,
    pub price: f64,
}

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
