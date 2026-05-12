// src/algorithms/signal.rs
use super::{BI, Direction, SignalType, XD, ZS};

#[derive(Debug, Clone)]
pub struct Signal {
    pub signal_type: SignalType,
    pub signal_date: chrono::NaiveDate,
    pub signal_price: f64,
    pub confidence: f64,
    pub related_zs_id: Option<i64>,
    pub related_bi_id: Option<i64>,
}

pub struct SignalDetector {
    pub min_confidence: f64,
}

impl SignalDetector {
    pub fn new(min_confidence: f64) -> Self {
        Self { min_confidence }
    }

    pub fn detect(
        &self,
        bi_list: &[BI],
        xd_list: &[XD],
        zs_list: &[ZS],
    ) -> Vec<Signal> {
        let mut signals = Vec::new();

        signals.extend(self.detect_1buy(zs_list));
        signals.extend(self.detect_2buy(&signals, bi_list));
        signals.extend(self.detect_3buy(zs_list, bi_list));
        signals.extend(self.detect_sells(zs_list, bi_list));

        signals.into_iter()
            .filter(|s| s.confidence >= self.min_confidence)
            .collect()
    }

    fn detect_1buy(&self, zs_list: &[ZS]) -> Vec<Signal> {
        let mut signals = Vec::new();

        for zs in zs_list {
            if let Some(xd) = zs.xds.first() {
                if let Some(bi) = xd.bis.first() {
                    if bi.direction == Direction::Down && bi.end_price < zs.zd {
                        signals.push(Signal {
                            signal_type: SignalType::FirstBuy,
                            signal_date: bi.end_dt,
                            signal_price: bi.end_price,
                            confidence: self.calc_1buy_confidence(zs, bi),
                            related_zs_id: Some(zs.zs_no as i64),
                            related_bi_id: Some(bi.bi_no as i64),
                        });
                    }
                }
            }
        }

        signals
    }

    fn detect_2buy(&self, signals: &[Signal], bi_list: &[BI]) -> Vec<Signal> {
        let mut result = Vec::new();

        let first_buys: Vec<&Signal> = signals.iter()
            .filter(|s| s.signal_type == SignalType::FirstBuy)
            .collect();

        for fb in first_buys {
            let retests: Vec<&BI> = bi_list.iter()
                .filter(|b| {
                    b.direction == Direction::Down &&
                    b.start_dt > fb.signal_date &&
                    b.end_price > fb.signal_price
                })
                .collect();

            if let Some(retest) = retests.first() {
                result.push(Signal {
                    signal_type: SignalType::SecondBuy,
                    signal_date: retest.end_dt,
                    signal_price: retest.end_price,
                    confidence: fb.confidence * 0.9,
                    related_zs_id: fb.related_zs_id,
                    related_bi_id: Some(retest.bi_no as i64),
                });
            }
        }

        result
    }

    fn detect_3buy(&self, zs_list: &[ZS], bi_list: &[BI]) -> Vec<Signal> {
        let mut signals = Vec::new();

        for zs in zs_list {
            let breakouts: Vec<&BI> = bi_list.iter()
                .filter(|b| {
                    b.direction == Direction::Up &&
                    b.start_price < zs.zg &&
                    b.end_price > zs.zg
                })
                .collect();

            for breakout in breakouts {
                let retests: Vec<&BI> = bi_list.iter()
                    .filter(|b| {
                        b.direction == Direction::Down &&
                        b.start_dt > breakout.end_dt &&
                        b.end_price > zs.zd
                    })
                    .collect();

                if let Some(retest) = retests.first() {
                    signals.push(Signal {
                        signal_type: SignalType::ThirdBuy,
                        signal_date: retest.end_dt,
                        signal_price: retest.end_price,
                        confidence: 75.0,
                        related_zs_id: Some(zs.zs_no as i64),
                        related_bi_id: Some(retest.bi_no as i64),
                    });
                }
            }
        }

        signals
    }

    fn calc_1buy_confidence(&self, zs: &ZS, bi: &BI) -> f64 {
        let mut confidence = 60.0;

        let divergence = (zs.zg - zs.zd) / bi.length;
        confidence += divergence.min(30.0);

        let stability = (zs.gg - zs.dd) / (zs.zg - zs.zd);
        confidence += (stability * 10.0).min(10.0);

        confidence.min(100.0)
    }

    fn detect_sells(&self, zs_list: &[ZS], bi_list: &[BI]) -> Vec<Signal> {
        vec![]
    }
}
