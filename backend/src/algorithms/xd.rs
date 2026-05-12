// src/algorithms/xd.rs
use super::{BI, Direction};

#[derive(Debug, Clone)]
pub struct XD {
    pub xd_no: i32,
    pub bis: Vec<BI>,
    pub start_dt: chrono::NaiveDate,
    pub end_dt: chrono::NaiveDate,
    pub direction: Direction,
    pub start_price: f64,
    pub end_price: f64,
}

pub struct XDDetector {
    pub min_bi_count: usize,
}

impl XDDetector {
    pub fn new(min_bi_count: usize) -> Self {
        Self { min_bi_count }
    }

    pub fn detect(&self, bi_list: &[BI]) -> Vec<XD> {
        if bi_list.len() < self.min_bi_count {
            return vec![];
        }

        let mut xd_list = Vec::new();
        let mut i = 0;
        let mut xd_no = 1;

        while i <= bi_list.len() - self.min_bi_count {
            let bis = &bi_list[i..i + self.min_bi_count];

            let direction = bis[0].direction;
            let all_same = bis.iter().all(|b| b.direction == direction);

            if all_same {
                let xd = XD {
                    xd_no,
                    bis: bis.to_vec(),
                    start_dt: bis[0].start_dt,
                    end_dt: bis.last().unwrap().end_dt,
                    direction,
                    start_price: bis[0].start_price,
                    end_price: bis.last().unwrap().end_price,
                };
                xd_list.push(xd);
                xd_no += 1;
                i += self.min_bi_count;
                continue;
            }

            i += 1;
        }

        xd_list
    }
}
