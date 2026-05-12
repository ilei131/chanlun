// src/algorithms/include.rs
use super::{ProcessedBar, RawBar};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum IncludeDirection {
    Up,
    Down,
}

pub struct IncludeProcessor;

impl IncludeProcessor {
    pub fn process(&self, bars: &[RawBar], direction: IncludeDirection) -> Vec<ProcessedBar> {
        if bars.len() < 3 {
            return bars.iter().map(|b| self.to_processed(b)).collect();
        }

        let mut result = vec![self.to_processed(&bars[0])];

        for bar in bars.iter().skip(1) {
            let last = result.last_mut().unwrap();

            if self.has_include(last, bar) {
                self.merge(last, bar, &direction);
            } else {
                result.push(self.to_processed(bar));
            }
        }

        result
    }

    fn has_include(&self, prev: &ProcessedBar, curr: &RawBar) -> bool {
        curr.high <= prev.high && curr.low >= prev.low
    }

    fn merge(&self, prev: &mut ProcessedBar, curr: &RawBar, direction: &IncludeDirection) {
        match direction {
            IncludeDirection::Up => {
                prev.high = prev.high.max(curr.high);
                prev.low = prev.low.min(curr.low);
            }
            IncludeDirection::Down => {
                prev.high = prev.high.max(curr.high);
                prev.low = prev.low.min(curr.low);
            }
        }
        prev.elements.push(curr.clone());
    }

    fn to_processed(&self, bar: &RawBar) -> ProcessedBar {
        ProcessedBar {
            dt: bar.dt,
            high: bar.high,
            low: bar.low,
            open: bar.open,
            close: bar.close,
            volume: bar.volume,
            elements: vec![bar.clone()],
        }
    }
}
