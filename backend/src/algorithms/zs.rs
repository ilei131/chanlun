// src/algorithms/zs.rs
use super::{Direction, XD};

#[derive(Debug, Clone, Copy)]
pub enum ZSStatus {
    Building,
    Complete,
}

#[derive(Debug, Clone)]
pub struct ZS {
    pub zs_no: i32,
    pub start_dt: chrono::NaiveDate,
    pub end_dt: chrono::NaiveDate,
    pub zg: f64,
    pub zd: f64,
    pub gg: f64,
    pub dd: f64,
    pub xds: Vec<XD>,
    pub status: ZSStatus,
}

pub struct ZSDetector {
    pub min_overlap_ratio: f64,
}

impl ZSDetector {
    pub fn new(min_overlap_ratio: f64) -> Self {
        Self { min_overlap_ratio }
    }

    pub fn detect(&self, xd_list: &[XD]) -> Vec<ZS> {
        if xd_list.len() < 3 {
            return vec![];
        }

        let mut zs_list = Vec::new();
        let mut i = 0;
        let mut zs_no = 1;

        while i <= xd_list.len() - 3 {
            let overlap = self.find_overlap(&xd_list[i..i + 3]);

            if let Some(zone) = overlap {
                let zs = ZS {
                    zs_no,
                    start_dt: xd_list[i].start_dt,
                    end_dt: xd_list[i + 2].end_dt,
                    zg: zone.zg,
                    zd: zone.zd,
                    gg: zone.gg,
                    dd: zone.dd,
                    xds: xd_list[i..i + 3].to_vec(),
                    status: ZSStatus::Complete,
                };
                zs_list.push(zs);
                zs_no += 1;
                i += 3;
                continue;
            }

            i += 1;
        }

        zs_list
    }

    fn find_overlap(&self, xds: &[XD]) -> Option<OverlapZone> {
        let ranges: Vec<(f64, f64)> = xds.iter()
            .map(|xd| {
                if xd.direction == Direction::Up {
                    (xd.start_price, xd.end_price)
                } else {
                    (xd.end_price, xd.start_price)
                }
            })
            .collect();

        let zg = ranges.iter().map(|(l, _)| l).cloned().fold(f64::MIN, f64::max);
        let zd = ranges.iter().map(|(_, h)| h).cloned().fold(f64::MAX, f64::min);

        let overlap_height = zg - zd;

        let total_range = ranges.iter()
            .map(|(l, h)| h - l)
            .fold(0.0, f64::max);

        let ratio = if total_range > 0.0 {
            overlap_height / total_range
        } else {
            0.0
        };

        if ratio >= self.min_overlap_ratio {
            Some(OverlapZone {
                zg,
                zd,
                gg: xds.iter().map(|xd| xd.end_price).fold(f64::MIN, f64::max),
                dd: xds.iter().map(|xd| xd.start_price).fold(f64::MAX, f64::min),
            })
        } else {
            None
        }
    }
}

struct OverlapZone {
    zg: f64,
    zd: f64,
    gg: f64,
    dd: f64,
}
