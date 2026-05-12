# CZSC 源码集成方案

## 目录

1. [CZSC 源码结构分析](#czsc-源码结构分析)
2. [集成方案](#集成方案)
3. [方案一：Git Submodule 集成](#方案一git-submodule-集成)
4. [方案二：直接复制源码](#方案二直接复制源码)
5. [方案三：Cargo Workspace 集成](#方案三cargo-workspace-集成)
6. [修改和定制示例](#修改和定制示例)
7. [编译和使用](#编译和使用)

---

## CZSC 源码结构分析

### 整体架构

CZSC 采用 Rust + Python 混合架构，核心算法用 Rust 实现，通过 PyO3 提供 Python 绑定：

```
czsc/
├── Cargo.toml              # Rust workspace 配置
├── pyproject.toml          # Python 包配置
├── czsc/                   # Python 封装层
│   ├── __init__.py
│   ├── traders/
│   ├── signals/
│   └── connectors/
└── crates/                 # Rust 核心层
    ├── czsc-core/          # 核心缠论算法（分型、笔、线段、中枢）
    ├── czsc-utils/         # 工具函数
    ├── czsc-ta/            # 技术指标
    ├── czsc-signals/       # 信号生成
    ├── czsc-trader/        # 交易器
    ├── czsc-signal-macros/ # 信号宏
    └── czsc-python/        # Python FFI 绑定
```

### 核心 Crate 说明

| Crate | 功能 |
|-------|------|
| `czsc-core` | 核心缠论算法：分型、笔、线段、中枢、信号 |
| `czsc-utils` | 通用工具、时间处理、数据结构 |
| `czsc-ta` | 技术指标库：MA、MACD、KDJ、RSI 等 |
| `czsc-signals` | 信号生成器、信号配置 |
| `czsc-trader` | 多级别交易器、仓位管理 |
| `czsc-python` | PyO3 绑定，暴露 Rust 接口给 Python |

---

## 集成方案

### 推荐方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **Git Submodule** | 保持上游更新、代码隔离、易于维护 | 需要 git 知识、更新管理 | ⭐⭐⭐⭐⭐ |
| **直接复制源码** | 简单直接、完全控制 | 无法自动更新、需手动同步 | ⭐⭐⭐ |
| **Cargo Workspace** | 统一构建、依赖共享 | 配置较复杂 | ⭐⭐⭐⭐ |

---

## 方案一：Git Submodule 集成

### 步骤 1：添加 CZSC 为 Git Submodule

```bash
# 在项目根目录执行
cd e:\Learn\chanlun
git submodule add https://github.com/waditu/czsc.git vendor/czsc
git submodule update --init --recursive
```

### 步骤 2：修改 Cargo.toml

编辑 `e:\Learn\chanlun\backend\Cargo.toml`：

```toml
[package]
name = "chanlun-backend"
version = "0.1.0"
edition = "2021"

[dependencies]
# 原有依赖...
actix-web = "4.0"
diesel = { version = "2.0", features = ["postgres"] }
# ...

# 集成 CZSC crates（使用 path 引用本地源码）
[dependencies.czsc-core]
path = "../vendor/czsc/crates/czsc-core"
version = "1.0.0"

[dependencies.czsc-utils]
path = "../vendor/czsc/crates/czsc-utils"
version = "1.0.0"

[dependencies.czsc-ta]
path = "../vendor/czsc/crates/czsc-ta"
version = "1.0.0"

[dependencies.czsc-signals]
path = "../vendor/czsc/crates/czsc-signals"
version = "1.0.0"

[dependencies.czsc-trader]
path = "../vendor/czsc/crates/czsc-trader"
version = "1.0.0"

# 也可以直接引用 workspace
#[workspace]
#members = [".", "../vendor/czsc/crates/*"]
```

### 步骤 3：创建示例代码

在 `backend/src/algorithms/czsc_integration.rs`：

```rust
//! CZSC 集成示例模块

use czsc_core::{
    fractal::FractalDetector,
    bi::BiDetector,
    zs::ZhongshuDetector,
    bar::{Bar, RawBar},
    freq::Freq,
};
use chrono::{NaiveDateTime, TimeZone, Utc};
use std::collections::VecDeque;

/// 使用 CZSC 核心库进行缠论分析
pub struct CzscAnalyzer {
    /// K线数据缓存
    bars: VecDeque<RawBar>,
}

impl CzscAnalyzer {
    pub fn new() -> Self {
        Self {
            bars: VecDeque::new(),
        }
    }

    /// 添加单根K线
    pub fn add_bar(&mut self, bar: RawBar) {
        self.bars.push_back(bar);
    }

    /// 批量添加K线
    pub fn add_bars(&mut self, bars: Vec<RawBar>) {
        for bar in bars {
            self.bars.push_back(bar);
        }
    }

    /// 检测分型
    pub fn detect_fractals(&self) -> Vec<(NaiveDateTime, String)> {
        let detector = FractalDetector::new();
        let bars_ref: Vec<&RawBar> = self.bars.iter().collect();
        let fractals = detector.detect(&bars_ref);

        fractals
            .iter()
            .map(|f| (f.dt, format!("{:?}", f.mark)))
            .collect()
    }

    /// 检测笔
    pub fn detect_bis(&self) -> Vec<(NaiveDateTime, NaiveDateTime, String)> {
        let fractal_detector = FractalDetector::new();
        let bi_detector = BiDetector::new();

        let bars_ref: Vec<&RawBar> = self.bars.iter().collect();
        let fractals = fractal_detector.detect(&bars_ref);
        let bis = bi_detector.detect(&fractals);

        bis.iter()
            .map(|bi| (bi.fx_a.dt, bi.fx_b.dt, format!("{:?}", bi.direction)))
            .collect()
    }

    /// 检测中枢
    pub fn detect_zhongshu(&self) -> Vec<(NaiveDateTime, NaiveDateTime, f64, f64)> {
        let fractal_detector = FractalDetector::new();
        let bi_detector = BiDetector::new();
        let zs_detector = ZhongshuDetector::new();

        let bars_ref: Vec<&RawBar> = self.bars.iter().collect();
        let fractals = fractal_detector.detect(&bars_ref);
        let bis = bi_detector.detect(&fractals);
        let zss = zs_detector.detect(&bis);

        zss.iter()
            .map(|zs| (zs.sdt, zs.edt, zs.zg, zs.zd))
            .collect()
    }

    /// 完整分析并返回所有结果
    pub fn analyze(&self) -> CzscAnalysisResult {
        let fractals = self.detect_fractals();
        let bis = self.detect_bis();
        let zss = self.detect_zhongshu();

        CzscAnalysisResult {
            fractals,
            bis,
            zss,
        }
    }
}

impl Default for CzscAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

/// 缠论分析结果
#[derive(Debug, Clone)]
pub struct CzscAnalysisResult {
    /// 分型列表：(时间, 类型)
    pub fractals: Vec<(NaiveDateTime, String)>,
    /// 笔列表：(开始时间, 结束时间, 方向)
    pub bis: Vec<(NaiveDateTime, NaiveDateTime, String)>,
    /// 中枢列表：(开始时间, 结束时间, 高点, 低点)
    pub zss: Vec<(NaiveDateTime, NaiveDateTime, f64, f64)>,
}

/// 将数据库的 K 线转换为 CZSC 的 RawBar
pub fn convert_kline_to_raw_bar(
    code: &str,
    date: NaiveDateTime,
    open: f64,
    high: f64,
    low: f64,
    close: f64,
    volume: i64,
) -> RawBar {
    RawBar {
        symbol: code.to_string(),
        dt: date,
        open,
        high,
        low,
        close,
        vol: volume,
        amount: volume as f64 * close, // 估算成交额
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_czsc_analyzer() {
        let mut analyzer = CzscAnalyzer::new();

        // 生成一些测试数据
        for i in 0..100 {
            let bar = RawBar {
                symbol: "000001".to_string(),
                dt: Utc.timestamp_opt(1700000000 + i * 86400, 0)
                    .unwrap()
                    .naive_utc(),
                open: 10.0 + i as f64 * 0.1,
                high: 11.0 + i as f64 * 0.1,
                low: 9.0 + i as f64 * 0.1,
                close: 10.5 + i as f64 * 0.1,
                vol: 1000000,
                amount: 10500000.0,
            };
            analyzer.add_bar(bar);
        }

        let result = analyzer.analyze();
        println!("分型数量: {}", result.fractals.len());
        println!("笔数量: {}", result.bis.len());
        println!("中枢数量: {}", result.zss.len());
    }
}
```

### 步骤 4：在模块中引用

编辑 `backend/src/algorithms/mod.rs`：

```rust
//! 算法模块

pub mod fractal;
pub mod bi;
pub mod zs;
pub mod cross;
pub mod signal;
pub mod xd;
// 添加 CZSC 集成模块
pub mod czsc_integration;
```

### 更新和同步上游

```bash
# 更新 CZSC 子模块
cd e:\Learn\chanlun
git submodule update --remote vendor/czsc
git add vendor/czsc
git commit -m "Update CZSC submodule"
```

---

## 方案二：直接复制源码

适用于想完全控制代码，不需要跟踪上游更新的场景。

### 步骤 1：复制 CZSC 源码

```bash
# 克隆 CZSC 仓库
cd e:\Learn\chanlun
git clone https://github.com/waditu/czsc.git temp_czsc

# 复制需要的 crates 到项目中
xcopy temp_czsc\crates\czsc-core backend\czsc\czsc-core\ /E /I
xcopy temp_czsc\crates\czsc-utils backend\czsc\czsc-utils\ /E /I
xcopy temp_czsc\crates\czsc-ta backend\czsc\czsc-ta\ /E /I
xcopy temp_czsc\crates\czsc-signals backend\czsc\czsc-signals\ /E /I
xcopy temp_czsc\crates\czsc-trader backend\czsc\czsc-trader\ /E /I

# 清理临时目录
rmdir /s /q temp_czsc
```

### 步骤 2：修改 Cargo.toml

编辑 `e:\Learn\chanlun\backend\Cargo.toml`：

```toml
[dependencies.czsc-core]
path = "./czsc/czsc-core"
version = "1.0.0"

[dependencies.czsc-utils]
path = "./czsc/czsc-utils"
version = "1.0.0"

[dependencies.czsc-ta]
path = "./czsc/czsc-ta"
version = "1.0.0"

[dependencies.czsc-signals]
path = "./czsc/czsc-signals"
version = "1.0.0"

[dependencies.czsc-trader]
path = "./czsc/czsc-trader"
version = "1.0.0"
```

---

## 方案三：Cargo Workspace 集成

创建统一的 workspace 管理多个项目。

### 步骤 1：创建根 Workspace

在 `e:\Learn\chanlun\Cargo.toml`：

```toml
[workspace]
members = [
    "backend",
    "vendor/czsc/crates/*",
]
resolver = "2"

[workspace.dependencies]
# 共享依赖版本
chrono = "0.4"
actix-web = "4.0"
diesel = { version = "2.0", features = ["postgres"] }
# ... 其他共享依赖
```

### 步骤 2：修改 backend/Cargo.toml

移除重复的依赖声明，使用 workspace 版本：

```toml
[package]
name = "chanlun-backend"
version = "0.1.0"
edition = "2021"

[dependencies]
# 使用 workspace 中的依赖
chrono = { workspace = true }
actix-web = { workspace = true }
diesel = { workspace = true }

# CZSC crates
czsc-core = { workspace = true }
czsc-utils = { workspace = true }
czsc-ta = { workspace = true }
czsc-signals = { workspace = true }
czsc-trader = { workspace = true }
```

---

## 修改和定制示例

### 示例 1：修改分型检测逻辑

编辑 `vendor/czsc/crates/czsc-core/src/fractal.rs`（或你复制的路径）：

```rust
//! 自定义分型检测逻辑

// ... 原有代码 ...

impl FractalDetector {
    /// 自定义分型检测（添加你自己的逻辑）
    pub fn detect_custom(&self, bars: &[&RawBar]) -> Vec<Fractal> {
        let mut fractals = Vec::new();

        for i in 2..bars.len() - 2 {
            let bar1 = bars[i - 2];
            let bar2 = bars[i - 1];
            let bar3 = bars[i];
            let bar4 = bars[i + 1];
            let bar5 = bars[i + 2];

            // 你的自定义顶分型逻辑
            if self.is_custom_top_fractal(bar1, bar2, bar3, bar4, bar5) {
                fractals.push(Fractal::new_top(bar3.dt, bar3.high));
            }

            // 你的自定义底分型逻辑
            if self.is_custom_bottom_fractal(bar1, bar2, bar3, bar4, bar5) {
                fractals.push(Fractal::new_bottom(bar3.dt, bar3.low));
            }
        }

        fractals
    }

    /// 自定义顶分型判断
    fn is_custom_top_fractal(
        &self,
        b1: &RawBar,
        b2: &RawBar,
        b3: &RawBar,
        b4: &RawBar,
        b5: &RawBar,
    ) -> bool {
        // 在这里实现你的逻辑
        // 例如：添加额外的验证条件
        let basic_top = b3.high > b2.high && b3.high > b4.high && b2.high > b1.high && b4.high > b5.high;

        // 添加成交量确认
        let volume_confirm = b3.vol > b2.vol * 1.1 || b3.vol > b4.vol * 1.1;

        basic_top && volume_confirm
    }

    /// 自定义底分型判断
    fn is_custom_bottom_fractal(
        &self,
        b1: &RawBar,
        b2: &RawBar,
        b3: &RawBar,
        b4: &RawBar,
        b5: &RawBar,
    ) -> bool {
        let basic_bottom = b3.low < b2.low && b3.low < b4.low && b2.low < b1.low && b4.low < b5.low;

        // 添加成交量确认
        let volume_confirm = b3.vol > b2.vol * 1.1 || b3.vol > b4.vol * 1.1;

        basic_bottom && volume_confirm
    }
}
```

### 示例 2：添加自定义信号

创建新的信号模块 `vendor/czsc/crates/czsc-signals/src/custom_signals.rs`：

```rust
//! 自定义信号模块

use czsc_core::{
    bi::Bi,
    zs::Zhongshu,
    bar::RawBar,
    signal::{Signal, SignalType},
};
use serde::{Serialize, Deserialize};

/// 自定义买入信号
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomBuySignal {
    /// 信号名称
    pub name: String,
    /// 信号权重
    pub weight: f64,
}

impl CustomBuySignal {
    pub fn new() -> Self {
        Self {
            name: "custom_buy".to_string(),
            weight: 1.0,
        }
    }

    /// 检测信号：底分型 + 突破中枢下沿 + 放量
    pub fn detect(&self, bis: &[Bi], zss: &[Zhongshu], bars: &[&RawBar]) -> Option<Signal> {
        if bis.is_empty() || zss.is_empty() {
            return None;
        }

        let last_bi = bis.last()?;
        let last_zs = zss.last()?;
        let last_bar = bars.last()?;

        // 条件1：最后一笔是向下笔
        if last_bi.direction.is_up() {
            return None;
        }

        // 条件2：当前价格突破中枢下沿
        if last_bar.close > last_zs.zd && last_bar.low < last_zs.zd {
            // 条件3：放量（比前5根的平均成交量大50%）
            let avg_vol = bars.iter().rev().take(6).skip(1)
                .map(|b| b.vol)
                .sum::<i64>() as f64 / 5.0;

            if last_bar.vol as f64 > avg_vol * 1.5 {
                return Some(Signal {
                    signal_type: SignalType::Buy,
                    name: self.name.clone(),
                    dt: last_bar.dt,
                    price: last_bar.close,
                    weight: self.weight,
                });
            }
        }

        None
    }
}

impl Default for CustomBuySignal {
    fn default() -> Self {
        Self::new()
    }
}
```

---

## 编译和使用

### 1. 编译 Rust 项目

```bash
cd e:\Learn\chanlun\backend
cargo build --release
```

### 2. 在后端 API 中使用

编辑 `backend/src/api/screener.rs`，集成 CZSC：

```rust
use crate::algorithms::czsc_integration::{CzscAnalyzer, convert_kline_to_raw_bar};
use crate::db::models::Kline;

// ... 其他导入 ...

/// 使用 CZSC 进行缠论选股
pub async fn czsc_screener(
    pool: web::Data<DbPool>,
    req: web::Json<CzscScreenerRequest>,
) -> Result<HttpResponse, Error> {
    let conn = pool.get()?;

    // 1. 获取股票列表
    let stocks = get_active_stocks(&conn)?;

    // 2. 准备结果
    let mut results = Vec::new();

    // 3. 遍历每只股票分析
    for stock in stocks {
        let klines = Kline::find_by_stock_id(stock.id, "1d", 200, &conn)?;

        if klines.len() < 100 {
            continue;
        }

        // 4. 转换数据格式
        let raw_bars: Vec<_> = klines
            .into_iter()
            .map(|k| {
                convert_kline_to_raw_bar(
                    &stock.code,
                    k.trade_date.naive_utc(),
                    k.open,
                    k.high,
                    k.low,
                    k.close,
                    k.volume,
                )
            })
            .collect();

        // 5. 使用 CZSC 分析
        let mut analyzer = CzscAnalyzer::new();
        analyzer.add_bars(raw_bars);
        let analysis = analyzer.analyze();

        // 6. 检查是否符合选股条件
        let has_buy_signal = !analysis.bis.is_empty()
            && analysis.zss.len() >= 1;

        if has_buy_signal || req.show_all {
            results.push(ScreenerResult {
                stock_id: stock.id,
                code: stock.code.clone(),
                name: stock.name.clone(),
                current_price: None,
                change_pct: None,
                matched_conditions: std::collections::HashMap::new(),
                match_count: 1,
                match_ratio: 1.0,
            });
        }
    }

    Ok(HttpResponse::Ok().json(ScreenerResponse {
        total: results.len(),
        page: req.page,
        page_size: req.page_size,
        data: results,
    }))
}

/// CZSC 选股请求
#[derive(Debug, Deserialize)]
pub struct CzscScreenerRequest {
    pub page: i64,
    pub page_size: i64,
    pub show_all: bool,
}
```

### 3. 启动后端服务

```bash
cd e:\Learn\chanlun\backend
cargo run
```

---

## 总结

### 选择建议

- **想跟踪上游更新、保持代码隔离** → 使用 **Git Submodule**（方案一）
- **想完全控制代码、不需要上游更新** → 使用 **直接复制**（方案二）
- **想统一构建和依赖管理** → 使用 **Cargo Workspace**（方案三）

### 下一步

1. 选择适合你的集成方案并实施
2. 根据需要修改和定制 CZSC 的算法逻辑
3. 在后端 API 中集成 CZSC 分析功能
4. 测试和性能优化

---

## 参考资料

- [CZSC GitHub](https://github.com/waditu/czsc)
- [CZSC 文档](https://czsc.readthedocs.io/)
- [PyO3 文档](https://pyo3.rs/)
- [Rust 官方文档](https://doc.rust-lang.org/)
