// src/algorithms/bi.rs
use super::{Direction, FX, FXMark};

#[derive(Debug, Clone)]
pub struct BI {
    pub bi_no: i32,
    pub fx_a: FX,
    pub fx_b: FX,
    pub fx_c: FX,
    pub direction: Direction,
    pub length: f64,
    pub start_dt: chrono::NaiveDate,
    pub end_dt: chrono::NaiveDate,
    pub start_price: f64,
    pub end_price: f64,
    pub power_price: f64,
    pub power_volume: f64,
    pub rsq: f64,
    pub quality_score: f64,
}

pub struct BIDetector {
    pub min_length: f64,
    pub min_quality: f64,
}

impl BIDetector {
    pub fn new(min_length: f64, min_quality: f64) -> Self {
        Self { min_length, min_quality }
    }

    pub fn detect(&self, fx_list: &[FX]) -> Vec<BI> {
        if fx_list.len() < 3 {
            return vec![];
        }

        let mut bi_list = Vec::new();
        let mut i = 0;
        let mut bi_no = 1;

        while i < fx_list.len() - 2 {
            let fx_a = &fx_list[i];
            let fx_b = &fx_list[i + 1];
            let fx_c = &fx_list[i + 2];

            if let Some(bi) = self.check_bi_valid(fx_a, fx_b, fx_c, bi_no) {
                bi_list.push(bi);
                i += 2;
                bi_no += 1;
                continue;
            }

            i += 1;
        }

        bi_list
    }

    fn check_bi_valid(&self, fx_a: &FX, fx_b: &FX, fx_c: &FX, bi_no: i32) -> Option<BI> {
        let (direction, length) = match (fx_a.mark, fx_c.mark) {
            (FXMark::Bottom, FXMark::Top) => (Direction::Up, fx_c.fx_price - fx_a.fx_price),
            (FXMark::Top, FXMark::Bottom) => (Direction::Down, fx_a.fx_price - fx_c.fx_price),
            _ => return None,
        };

        if length < self.min_length {
            return None;
        }

        let quality = self.calc_quality(fx_a, fx_b, fx_c, length);

        if quality < self.min_quality {
            return None;
        }

        Some(BI {
            bi_no,
            fx_a: fx_a.clone(),
            fx_b: fx_b.clone(),
            fx_c: fx_c.clone(),
            direction,
            length,
            start_dt: fx_a.dt,
            end_dt: fx_c.dt,
            start_price: fx_a.fx_price,
            end_price: fx_c.fx_price,
            power_price: length / fx_a.fx_price,
            power_volume: 0.0,
            rsq: 0.0,
            quality_score: quality,
        })
    }

    fn calc_quality(&self, fx_a: &FX, fx_b: &FX, fx_c: &FX, length: f64) -> f64 {
        let mut score = 50.0;

        let length_score = (length / length.max(1.0) * 10.0).min(40.0);
        score += length_score;

        let fx_confidence = (fx_a.confidence + fx_b.confidence + fx_c.confidence) / 3.0;
        score += fx_confidence * 0.3;

        let power_factor = match fx_b.mark {
            FXMark::Top => fx_b.high_price - fx_a.high_price.min(fx_c.high_price),
            FXMark::Bottom => fx_a.low_price.max(fx_c.low_price) - fx_b.low_price,
        };
        score += (power_factor / length * 30.0).min(30.0);

        score.min(100.0)
    }
}
