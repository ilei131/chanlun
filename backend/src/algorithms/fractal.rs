// src/algorithms/fractal.rs
use super::{FXMark, ProcessedBar};

#[derive(Debug, Clone)]
pub struct FX {
    pub mark: FXMark,
    pub dt: chrono::NaiveDate,
    pub fx_price: f64,
    pub high_price: f64,
    pub low_price: f64,
    pub elements: Vec<ProcessedBar>,
    pub confidence: f64,
}

pub struct FractalDetector;

impl FractalDetector {
    pub fn new() -> Self {
        Self
    }

    pub fn detect(&self, bars: &[ProcessedBar]) -> Vec<FX> {
        if bars.len() < 3 {
            return vec![];
        }

        let mut fx_list = Vec::new();
        let mut i = 1;

        while i < bars.len() - 1 {
            let prev = &bars[i - 1];
            let curr = &bars[i];
            let next = &bars[i + 1];

            if curr.high > prev.high && curr.high > next.high {
                let fx = FX {
                    mark: FXMark::Top,
                    dt: curr.dt,
                    fx_price: curr.high,
                    high_price: curr.high,
                    low_price: curr.low,
                    elements: vec![prev.clone(), curr.clone(), next.clone()],
                    confidence: self.calc_confidence(prev, curr, next, FXMark::Top),
                };
                fx_list.push(fx);
                i += 2;
                continue;
            }

            if curr.low < prev.low && curr.low < next.low {
                let fx = FX {
                    mark: FXMark::Bottom,
                    dt: curr.dt,
                    fx_price: curr.low,
                    high_price: curr.high,
                    low_price: curr.low,
                    elements: vec![prev.clone(), curr.clone(), next.clone()],
                    confidence: self.calc_confidence(prev, curr, next, FXMark::Bottom),
                };
                fx_list.push(fx);
                i += 2;
                continue;
            }

            i += 1;
        }

        fx_list
    }

    fn calc_confidence(
        &self,
        prev: &ProcessedBar,
        curr: &ProcessedBar,
        next: &ProcessedBar,
        mark: FXMark,
    ) -> f64 {
        let mut confidence = 50.0;

        match mark {
            FXMark::Top => {
                let height_diff = curr.high - (prev.high + next.high) / 2.0;
                confidence += (height_diff / curr.high * 100.0).min(25.0);

                let avg_volume = (prev.volume + next.volume) as f64 / 2.0;
                if curr.volume as f64 > avg_volume {
                    confidence += 15.0;
                }
            }
            FXMark::Bottom => {
                let depth = (prev.low + next.low) / 2.0 - curr.low;
                confidence += (depth / curr.low * 100.0).min(25.0);

                let avg_volume = (prev.volume + next.volume) as f64 / 2.0;
                if curr.volume as f64 > avg_volume {
                    confidence += 15.0;
                }
            }
        }

        confidence.min(100.0)
    }
}
