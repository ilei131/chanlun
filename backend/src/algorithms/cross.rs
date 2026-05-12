// src/algorithms/cross.rs
use chrono::NaiveDate;

#[derive(Debug, Clone)]
pub struct CrossSignal {
    pub signal_type: CrossSignalType,
    pub period: String,
    pub signal_date: NaiveDate,
    pub signal_price: Option<f64>,
    pub k_before: Option<f64>,
    pub k_after: Option<f64>,
    pub d_before: Option<f64>,
    pub d_after: Option<f64>,
    pub dif_before: Option<f64>,
    pub dif_after: Option<f64>,
    pub dea_before: Option<f64>,
    pub dea_after: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CrossSignalType {
    KDJGoldCross,
    KDJDeadCross,
    MACDGoldCross,
    MACDDeadCross,
}

pub struct CrossDetector;

impl CrossDetector {
    pub fn detect_kdj_cross(
        k_values: &[(NaiveDate, f64)],
        d_values: &[(NaiveDate, f64)],
    ) -> Vec<CrossSignal> {
        let mut signals = Vec::new();

        if k_values.len() < 2 || d_values.len() < 2 {
            return signals;
        }

        for i in 1..k_values.len().min(d_values.len()) {
            let prev_k = k_values[i - 1].1;
            let curr_k = k_values[i].1;
            let prev_d = d_values[i - 1].1;
            let curr_d = d_values[i].1;

            if prev_k < prev_d && curr_k > curr_d {
                signals.push(CrossSignal {
                    signal_type: CrossSignalType::KDJGoldCross,
                    period: "1d".to_string(),
                    signal_date: k_values[i].0,
                    signal_price: None,
                    k_before: Some(prev_k),
                    k_after: Some(curr_k),
                    d_before: Some(prev_d),
                    d_after: Some(curr_d),
                    dif_before: None,
                    dif_after: None,
                    dea_before: None,
                    dea_after: None,
                });
            } else if prev_k > prev_d && curr_k < curr_d {
                signals.push(CrossSignal {
                    signal_type: CrossSignalType::KDJDeadCross,
                    period: "1d".to_string(),
                    signal_date: k_values[i].0,
                    signal_price: None,
                    k_before: Some(prev_k),
                    k_after: Some(curr_k),
                    d_before: Some(prev_d),
                    d_after: Some(curr_d),
                    dif_before: None,
                    dif_after: None,
                    dea_before: None,
                    dea_after: None,
                });
            }
        }

        signals
    }

    pub fn detect_macd_cross(
        dif_values: &[(NaiveDate, f64)],
        dea_values: &[(NaiveDate, f64)],
    ) -> Vec<CrossSignal> {
        let mut signals = Vec::new();

        if dif_values.len() < 2 || dea_values.len() < 2 {
            return signals;
        }

        for i in 1..dif_values.len().min(dea_values.len()) {
            let prev_dif = dif_values[i - 1].1;
            let curr_dif = dif_values[i].1;
            let prev_dea = dea_values[i - 1].1;
            let curr_dea = dea_values[i].1;

            if prev_dif < prev_dea && curr_dif > curr_dea {
                signals.push(CrossSignal {
                    signal_type: CrossSignalType::MACDGoldCross,
                    period: "1d".to_string(),
                    signal_date: dif_values[i].0,
                    signal_price: None,
                    k_before: None,
                    k_after: None,
                    d_before: None,
                    d_after: None,
                    dif_before: Some(prev_dif),
                    dif_after: Some(curr_dif),
                    dea_before: Some(prev_dea),
                    dea_after: Some(curr_dea),
                });
            } else if prev_dif > prev_dea && curr_dif < curr_dea {
                signals.push(CrossSignal {
                    signal_type: CrossSignalType::MACDDeadCross,
                    period: "1d".to_string(),
                    signal_date: dif_values[i].0,
                    signal_price: None,
                    k_before: None,
                    k_after: None,
                    d_before: None,
                    d_after: None,
                    dif_before: Some(prev_dif),
                    dif_after: Some(curr_dif),
                    dea_before: Some(prev_dea),
                    dea_after: Some(curr_dea),
                });
            }
        }

        signals
    }
}
