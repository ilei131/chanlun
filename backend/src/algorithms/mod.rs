// src/algorithms/mod.rs
pub mod include;
pub mod fractal;
pub mod bi;
pub mod xd;
pub mod zs;
pub mod signal;
pub mod cross;
pub mod czsc_integration;

pub use include::*;
pub use fractal::*;
pub use bi::*;
pub use xd::*;
pub use zs::*;
pub use signal::*;
pub use cross::*;
pub use czsc_integration::*;

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawBar {
    pub dt: NaiveDate,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessedBar {
    pub dt: NaiveDate,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: i64,
    pub elements: Vec<RawBar>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    Up,
    Down,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FXMark {
    Top,
    Bottom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SignalType {
    FirstBuy,
    SecondBuy,
    ThirdBuy,
    FirstSell,
    SecondSell,
    ThirdSell,
}

#[derive(Debug, Clone)]
pub struct AnalysisResult {
    pub bars: Vec<ProcessedBar>,
    pub fx_list: Vec<FX>,
    pub bi_list: Vec<BI>,
    pub xd_list: Vec<XD>,
    pub zs_list: Vec<ZS>,
    pub signals: Vec<Signal>,
}
