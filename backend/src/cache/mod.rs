// src/cache/mod.rs
use crate::tushare::client::KlineData;
use chrono::{Local, Timelike};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

const CACHE_VERSION: &str = "v2";
const PRE_MARKET_EXPIRE_SECONDS: i64 = 3600; // 开盘前缓存过期时间（1小时）
const TRADING_HOUR_EXPIRE_SECONDS: i64 = 1800; // 交易时段缓存过期时间（30分钟）
const AFTER_MARKET_EXPIRE_SECONDS: i64 = 86400; // 收盘后缓存过期时间（24小时）

#[derive(Debug, Serialize, Deserialize)]
struct CacheEntry {
    data: Vec<KlineData>,
    timestamp: i64,
    access_count: u64,
    last_access: i64,
    last_trade_date: String, // 缓存数据中最新的交易日期
}

pub struct KlineCache {
    cache_dir: PathBuf,
    max_size_mb: u64,
    expire_days: i64,
}

impl KlineCache {
    pub fn new(cache_dir: &str, max_size_mb: u64, expire_days: i64) -> Self {
        let cache_path = PathBuf::from(cache_dir).join("kline").join(CACHE_VERSION);

        if !cache_path.exists() {
            fs::create_dir_all(&cache_path).unwrap_or_else(|e| {
                warn!("Failed to create cache directory: {}", e);
            });
        }

        Self {
            cache_dir: cache_path,
            max_size_mb,
            expire_days,
        }
    }

    fn get_cache_key(&self, stock_code: &str, period: &str) -> String {
        format!("{}_{}.json", stock_code, period)
    }

    fn get_cache_file(&self, stock_code: &str, period: &str) -> PathBuf {
        self.cache_dir.join(self.get_cache_key(stock_code, period))
    }

    /// 判断当前是否处于交易时段
    fn is_trading_hours(&self) -> bool {
        let now = Local::now();
        let hour = now.hour();
        let minute = now.minute();

        // 上午交易时段: 9:30 - 11:30
        let morning_trading =
            (hour == 9 && minute >= 30) || (hour == 10) || (hour == 11 && minute < 30);
        // 下午交易时段: 13:00 - 15:00
        let afternoon_trading = hour >= 13 && hour < 15;

        morning_trading || afternoon_trading
    }

    /// 判断当前是否处于开盘前（9:30之前）
    fn is_pre_market(&self) -> bool {
        let now = Local::now();
        let hour = now.hour();
        let minute = now.minute();

        // 开盘前: 9:30之前
        hour < 9 || (hour == 9 && minute < 30)
    }

    /// 获取当前日期（交易日期）
    fn get_current_trade_date(&self) -> String {
        let now = Local::now();
        let hour = now.hour();

        // 如果是凌晨0点到9点，使用前一天的日期
        if hour < 9 {
            let yesterday = now - chrono::Duration::days(1);
            yesterday.format("%Y%m%d").to_string()
        } else {
            now.format("%Y%m%d").to_string()
        }
    }

    /// 根据时间和缓存数据判断是否需要刷新
    fn should_refresh_cache(&self, entry: &CacheEntry) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let time_since_cache = now - entry.timestamp;

        // 判断是否需要根据时间刷新
        let expire_seconds = if self.is_pre_market() {
            PRE_MARKET_EXPIRE_SECONDS
        } else if self.is_trading_hours() {
            TRADING_HOUR_EXPIRE_SECONDS
        } else {
            AFTER_MARKET_EXPIRE_SECONDS
        };

        if time_since_cache > expire_seconds {
            info!(
                "Cache expired due to time: {} seconds since cache",
                time_since_cache
            );
            return true;
        }

        // 如果是新的交易日，需要刷新
        let current_trade_date = self.get_current_trade_date();
        if !entry.last_trade_date.is_empty() && current_trade_date > entry.last_trade_date {
            info!(
                "Cache expired due to new trading day: current={}, cache={}",
                current_trade_date, entry.last_trade_date
            );
            return true;
        }

        // 如果在交易时段且缓存数据不是最新的，需要刷新
        if self.is_trading_hours()
            && !entry.last_trade_date.is_empty()
            && current_trade_date == entry.last_trade_date
        {
            // 在交易时段，如果缓存是在半小时前创建的，且还在交易中，应该刷新
            if time_since_cache > TRADING_HOUR_EXPIRE_SECONDS {
                info!(
                    "Cache expired due to trading hours refresh: {} seconds since cache",
                    time_since_cache
                );
                return true;
            }
        }

        false
    }

    pub fn get(&self, stock_code: &str, period: &str) -> Option<Vec<KlineData>> {
        let cache_file = self.get_cache_file(stock_code, period);

        if !cache_file.exists() {
            info!("Cache miss: {} {}", stock_code, period);
            return None;
        }

        let content = match fs::read_to_string(&cache_file) {
            Ok(c) => c,
            Err(e) => {
                warn!("Failed to read cache file: {}", e);
                return None;
            }
        };

        let mut entry: CacheEntry = match serde_json::from_str(&content) {
            Ok(e) => e,
            Err(e) => {
                warn!("Failed to parse cache file: {}", e);
                return None;
            }
        };

        // 判断是否需要刷新缓存
        if self.should_refresh_cache(&entry) {
            info!(
                "Cache needs refresh: {} {} (time={}, last_trade_date={})",
                stock_code, period, entry.timestamp, entry.last_trade_date
            );
            return None;
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        entry.access_count += 1;
        entry.last_access = now;

        if let Err(e) = fs::write(&cache_file, serde_json::to_string(&entry).unwrap()) {
            warn!("Failed to update cache metadata: {}", e);
        }

        info!(
            "Cache hit: {} {} (access count: {})",
            stock_code, period, entry.access_count
        );
        Some(entry.data)
    }

    pub fn put(&self, stock_code: &str, period: &str, data: Vec<KlineData>) {
        if data.is_empty() {
            return;
        }

        let cache_file = self.get_cache_file(stock_code, period);
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        // 获取最新的交易日期（数据是倒序存储的，最新的在前面）
        let last_trade_date = data
            .first()
            .map(|k| k.trade_date.clone())
            .unwrap_or_default();

        let entry = CacheEntry {
            data,
            timestamp: now,
            access_count: 0,
            last_access: now,
            last_trade_date,
        };

        match serde_json::to_string(&entry) {
            Ok(json) => {
                if let Err(e) = fs::write(&cache_file, json) {
                    warn!("Failed to write cache file: {}", e);
                } else {
                    info!(
                        "Cache saved: {} {} ({} records, last_trade_date={})",
                        stock_code,
                        period,
                        entry.data.len(),
                        entry.last_trade_date
                    );
                }
            }
            Err(e) => {
                warn!("Failed to serialize cache data: {}", e);
            }
        }

        self.cleanup_if_needed();
    }

    fn cleanup_if_needed(&self) {
        let current_size = self.get_cache_size_mb();
        if current_size <= self.max_size_mb {
            return;
        }

        info!(
            "Cache size {}MB exceeds limit {}MB, starting cleanup...",
            current_size, self.max_size_mb
        );
        self.cleanup_lru();
    }

    fn get_cache_size_mb(&self) -> u64 {
        let mut total_size = 0u64;

        if let Ok(entries) = fs::read_dir(&self.cache_dir) {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_file() {
                        total_size += metadata.len();
                    }
                }
            }
        }

        total_size / (1024 * 1024)
    }

    fn cleanup_lru(&self) {
        let mut entries: Vec<(PathBuf, CacheEntry)> = Vec::new();

        if let Ok(dir_entries) = fs::read_dir(&self.cache_dir) {
            for entry in dir_entries.flatten() {
                let path = entry.path();
                if path.extension().map_or(false, |e| e == "json") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(cache_entry) = serde_json::from_str::<CacheEntry>(&content) {
                            entries.push((path, cache_entry));
                        }
                    }
                }
            }
        }

        entries.sort_by(|a, b| {
            let score_a =
                a.1.access_count as f64 / (a.1.last_access - a.1.timestamp + 1).max(1) as f64;
            let score_b =
                b.1.access_count as f64 / (b.1.last_access - b.1.timestamp + 1).max(1) as f64;
            score_a.partial_cmp(&score_b).unwrap()
        });

        let target_size = (self.max_size_mb * 80) / 100;
        let mut removed_count = 0;

        for (path, _) in entries {
            let current_size = self.get_cache_size_mb();
            if current_size <= target_size {
                break;
            }

            if let Err(e) = fs::remove_file(&path) {
                warn!("Failed to remove cache file: {}", e);
            } else {
                removed_count += 1;
            }
        }

        info!(
            "Cache cleanup completed: removed {} files, current size: {}MB",
            removed_count,
            self.get_cache_size_mb()
        );
    }

    pub fn clear(&self) {
        if let Ok(entries) = fs::read_dir(&self.cache_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let _ = fs::remove_file(&path);
                }
            }
        }
        info!("Cache cleared");
    }

    pub fn get_stats(&self) -> CacheStats {
        let mut file_count = 0;
        let mut total_records = 0;
        let mut total_size = 0u64;
        let mut oldest_timestamp = i64::MAX;
        let mut newest_timestamp = i64::MIN;

        if let Ok(entries) = fs::read_dir(&self.cache_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Ok(metadata) = entry.metadata() {
                        total_size += metadata.len();
                        file_count += 1;
                    }

                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(cache_entry) = serde_json::from_str::<CacheEntry>(&content) {
                            total_records += cache_entry.data.len();
                            oldest_timestamp = oldest_timestamp.min(cache_entry.timestamp);
                            newest_timestamp = newest_timestamp.max(cache_entry.timestamp);
                        }
                    }
                }
            }
        }

        CacheStats {
            file_count,
            total_records,
            total_size_mb: total_size / (1024 * 1024),
            max_size_mb: self.max_size_mb,
            expire_days: self.expire_days,
            oldest_timestamp: if oldest_timestamp == i64::MAX {
                None
            } else {
                Some(oldest_timestamp)
            },
            newest_timestamp: if newest_timestamp == i64::MIN {
                None
            } else {
                Some(newest_timestamp)
            },
        }
    }
}

#[derive(Debug, Serialize)]
pub struct CacheStats {
    pub file_count: usize,
    pub total_records: usize,
    pub total_size_mb: u64,
    pub max_size_mb: u64,
    pub expire_days: i64,
    pub oldest_timestamp: Option<i64>,
    pub newest_timestamp: Option<i64>,
}
