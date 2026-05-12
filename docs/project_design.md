# 缠论选股系统设计文档

## 1. 项目概述

### 1.1 项目背景

传统的股票分析系统需要存储海量历史K线数据，占用大量存储空间。本项目采用实时数据获取策略，通过Tushare API获取股票数据，使用czsc-core进行缠论分析，实现轻量级股票分析系统。

### 1.2 项目目标

- 提供股票搜索功能（按代码/名称）
- 实时获取股票K线数据
- 使用缠论分析生成信号（分型、笔、中枢、买卖点）
- 显示技术指标（MACD、KDJ）
- 可视化K线图及分析结果

### 1.3 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端 | Rust + Actix-web | 高性能Web服务 |
| 数据分析 | czsc-core | 缠论核心算法 |
| 数据源 | Tushare API | 股票数据获取 |
| 前端 | React + TypeScript | 用户界面 |
| UI框架 | Ant Design | React组件库 |
| 图表 | SVG原生绘制 | K线图、指标图 |

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ StockSearch │  │StockDetail  │  │      Screener       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP API
┌────────────────────────▼────────────────────────────────────┐
│                        Backend                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   API Layer (Actix-web)                 ││
│  │   /stocks/search  /stocks/detail  /screener/run        ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │Tushare Client│  │czsc-core     │  │  MACD/KDJ        │  │
│  │(数据获取)     │  │(缠论分析)     │  │  (指标计算)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    PostgreSQL Database                       │
│  stocks | cs_cross_signals | fractal_signals | ...         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户输入股票代码
       │
       ▼
┌──────────────────┐
│  Frontend Search │
└────────┬─────────┘
         │ GET /api/v1/stocks/search?keyword=600000
         ▼
┌──────────────────┐
│  Backend API     │
└────────┬─────────┘
         │ TushareClient::search_stocks()
         ▼
┌──────────────────┐
│  Tushare API     │
│  stock_basic     │
└────────┬─────────┘
         │ 返回股票列表
         ▼
┌──────────────────┐
│  Frontend Detail │
└────────┬─────────┘
         │ POST /api/v1/stocks/detail
         │ { code: "600000", period: "daily", days: 120 }
         ▼
┌──────────────────┐
│  Backend API     │
└────────┬─────────┘
         │
         ├──► TushareClient::get_kline_data() 获取K线
         │         │
         │         ▼
         │    ┌─────────────────────┐
         │    │ czsc-core 分析      │
         │    │ - 分型 (Fractal)    │
         │    │ - 笔 (Bi)           │
         │    │ - 中枢 (ZhongShu)   │
         │    │ - 买卖点 (BuySignal)│
         │    └──────────┬──────────┘
         │               │
         ├──► calculate_macd() 计算MACD
         │
         ├──► calculate_kdj() 计算KDJ
         │
         ▼
┌──────────────────┐
│  返回完整分析结果 │
└──────────────────┘
```

---

## 3. 后端设计

### 3.1 项目结构

```
backend/src/
├── lib.rs              # 主入口，CORS配置，HTTP服务器
├── main.rs             # 程序入口
├── config.rs           # 配置管理
├── api/
│   ├── mod.rs          # 路由配置
│   ├── stocks.rs       # 股票搜索/详情API
│   ├── screener.rs     # 筛选API
│   └── indicators.rs   # 指标API
├── algorithms/
│   ├── mod.rs
│   ├── czsc_integration.rs  # czsc-core封装
│   ├── fractal.rs       # 分型算法
│   ├── bi.rs           # 笔算法
│   ├── zs.rs           # 中枢算法
│   ├── signal.rs       # 信号检测
│   ├── cross.rs        # 交叉信号
│   └── xd.rs           # 线段算法
├── db/
│   ├── mod.rs          # 数据库连接
│   └── models.rs       # 数据模型
└── tushare/
    ├── mod.rs
    └── client.rs       # Tushare API客户端
```

### 3.2 核心模块

#### 3.2.1 Tushare客户端

```rust
// tushare/client.rs
pub struct TushareClient {
    token: String,
    http_client: reqwest::Client,
}

impl TushareClient {
    // 搜索股票
    pub async fn search_stocks(&self, keyword: &str) -> Result<Vec<StockBasic>, TushareError>

    // 获取K线数据
    pub async fn get_kline_data(
        &self,
        ts_code: &str,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<KlineData>, TushareError>

    // 转换股票代码格式
    pub fn convert_ts_code(code: &str) -> String
}
```

#### 3.2.2 缠论分析模块

```rust
// algorithms/czsc_integration.rs
pub struct ChanlunAnalyzer {
    bars: Vec<RawBar>,
    max_bi_count: usize,
}

impl ChanlunAnalyzer {
    pub fn new(bars: Vec<RawBar>, max_bi_count: usize) -> Self

    // 检测买卖信号
    pub fn detect_buy_signals(&self) -> Vec<BuySignal>
    pub fn detect_sell_signals(&self) -> Vec<SellSignal>

    // 获取分析结果
    pub fn get_bi_list(&self) -> Vec<Bi>
    pub fn get_zs_list(&self) -> Vec<ZhongShu>
    pub fn get_fx_list(&self) -> Vec<FenXing>
}
```

#### 3.2.3 技术指标计算

```rust
// 算法：MACD
fn calculate_macd(kline_data: &[KlineResponse]) -> Vec<MacdData>
// EMA12/EMA26 -> DIF -> DEA(EMA of DIF, 9) -> HIST(DIF - DEA)

// 算法：KDJ
fn calculate_kdj(kline_data: &[KlineResponse]) -> Vec<KdjData>
// RSV -> K(SMA of RSV, 3) -> D(SMA of K, 3) -> J(3*K - 2*D)
```

### 3.3 API设计

#### 3.3.1 股票搜索

```
GET /api/v1/stocks/search?keyword={keyword}

Response:
[
  {
    "ts_code": "600000.SH",
    "code": "600000",
    "name": "浦发银行",
    "market": "SH",
    "industry": "银行",
    "area": "上海",
    "list_date": "19991110"
  }
]
```

#### 3.3.2 股票详情

```
POST /api/v1/stocks/detail
Content-Type: application/json

{
  "code": "600000",
  "period": "daily",
  "days": 120
}

Response:
{
  "ts_code": "600000.SH",
  "code": "600000",
  "name": "浦发银行",
  "market": "SH",
  "current_price": 10.50,
  "change_pct": 1.23,
  "kline_data": [...],
  "chanlun_signals": {
    "buy_signals": [
      { "signal_type": "second_buy", "date": "2024-01-15", "price": 9.80 }
    ],
    "zs_list": [
      { "start_date": "2024-01-01", "end_date": "2024-01-10", "zd": 9.5, "zg": 10.0, "bi_count": 3 }
    ],
    "fx_list": [...]
  },
  "indicators": {
    "macd": [...],
    "kdj": [...]
  }
}
```

#### 3.3.3 K线数据格式

```rust
struct KlineResponse {
    trade_date: String,    // 交易日期 "20240115"
    open: f64,            // 开盘价
    high: f64,            // 最高价
    low: f64,             // 最低价
    close: f64,           // 收盘价
    volume: f64,          // 成交量
    amount: Option<f64>, // 成交额
    bi_points: Vec<BiPoint>, // 笔特征点
}
```

---

## 4. 前端设计

### 4.1 项目结构

```
frontend/src/
├── main.tsx
├── App.tsx              # 路由配置
├── index.css            # 全局样式
├── api/
│   └── index.ts         # API调用封装
└── pages/
    ├── StockSearch.tsx  # 股票搜索页
    ├── StockDetail.tsx  # 股票详情页
    ├── Screener.tsx     # 选股大厅
    ├── Signals.tsx      # 信号列表
    └── Settings.tsx     # 系统设置
```

### 4.2 页面设计

#### 4.2.1 股票搜索页 (/)

入口页面，提供股票搜索功能。

```
┌────────────────────────────────────────────┐
│  [🔍 输入股票代码或名称搜索...]              │
├────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  │
│  │ 浦发银行                    600000.SH │  │
│  │ 600000.SH          行业: 银行         │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ 工商银行                    601398.SH │  │
│  │ 601398.SH          行业: 银行         │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

#### 4.2.2 股票详情页 (/stock/:code)

显示股票的完整分析结果。

```
┌─────────────────────────────────────────────────────────────┐
│ [← 返回]  浦发银行 600000.SH              ¥10.50  +1.23%   │
├─────────────────────────────────────────────────────────────┤
│ [日K ▼] [120天 ▼]                    实时分析中...           │
├─────────────────────────────────────────────────────────────┤
│ 股票特征: [二买] [MACD金叉] [有中枢]                         │
├─────────────────────────────────────────────────────────────┤
│ K线图                                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │            ┌────┐                                       │ │
│ │            │中枢│                                       │ │
│ │    ▼       └────┘                                       │ │
│ │  ┌─┐    ●一买                                            │ │
│ │  │ │       ┌─┐  ┌─┐                                     │ │
│ │  │ │       │ │  │ │                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ MACD                                        KDJ            │
│ ┌────────────────────────┐  ┌────────────────────────┐    │
│ │ ~~   ~~                │  │       /\               │    │
│ │   ~~   ~~              │  │  /\  /  \              │    │
│ │    ████                │  │ /  \/    \             │    │
│ └────────────────────────┘  └────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│ 缠论信号                                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [二买]  2024-01-15                    ¥9.80           │ │
│ │ [一买]  2024-01-10                    ¥9.50           │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ 中枢列表                                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 2024-01-01 ~ 2024-01-10        ZG: 10.0  ZD: 9.5     │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 组件设计

| 组件 | 功能 |
|------|------|
| StockSearch | 股票搜索页面，包含搜索框和结果列表 |
| StockDetail | 股票详情页面，包含所有分析展示 |
| KLineChart | K线图组件，使用SVG绘制，支持中枢和买卖点标注 |
| MACDChart | MACD指标图，DIF/DEA曲线和柱状图 |
| KDJChart | KDJ指标图，K/D/J三条曲线 |
| FeatureTags | 股票特征标签组件 |

### 4.4 图表实现

#### K线图 (SVG)

```tsx
const renderKlineChart = () => {
  return (
    <svg viewBox={`0 0 ${width} ${height + padding * 2}`}>
      {/* 渐变定义 */}
      <defs>
        <linearGradient id="greenGradient">...</linearGradient>
        <linearGradient id="redGradient">...</linearGradient>
      </defs>

      {/* K线蜡烛图 */}
      {data.map((kline, index) => {
        const x = padding + (index * (width - padding * 2)) / (data.length - 1)
        return (
          <g key={index}>
            <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} />
            <rect x={x - barWidth/2} y={Math.min(openY, closeY)}
                  width={barWidth} height={Math.abs(closeY - openY)}
                  fill={isGreen ? 'url(#greenGradient)' : 'url(#redGradient)'} />
          </g>
        )
      })}

      {/* 中枢标注 */}
      {detail.chanlun_signals.zs_list.slice(-1).map(zs => (
        <rect fill="rgba(99,102,241,0.3)" stroke="#818cf8" />
      ))}

      {/* 买卖点标注 */}
      {detail.chanlun_signals.buy_signals.map(signal => (
        <circle r={6} fill="#f59e0b" />
      ))}
    </svg>
  )
}
```

---

## 5. 数据库设计

### 5.1 核心表结构

```sql
-- 股票基础信息
CREATE TABLE stocks (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    market VARCHAR(5),
    stock_type VARCHAR(20),
    list_date DATE,
    delist_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CS交叉信号（KDJ金叉/MACD金叉）
CREATE TABLE cs_cross_signals (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id),
    signal_type VARCHAR(50) NOT NULL,  -- 'kdj_gold_cross', 'macd_gold_cross'
    period VARCHAR(20) NOT NULL,        -- 'daily', 'weekly', 'monthly'
    signal_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 分型信号
CREATE TABLE fractal_signals (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id),
    fractal_type VARCHAR(20) NOT NULL,  -- 'top', 'bottom'
    period VARCHAR(20) NOT NULL,
    fractal_date DATE NOT NULL,
    quality_score DECIMAL(3,2),
    is_confirmed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 缠论信号（买卖点）
CREATE TABLE chanlun_signals (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id),
    signal_type VARCHAR(50) NOT NULL,  -- 'first_buy', 'second_buy', 'third_buy'
    signal_date DATE NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    period VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 中枢
CREATE TABLE zhongshu (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER REFERENCES stocks(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    zd DECIMAL(10,2) NOT NULL,  -- 底
    zg DECIMAL(10,2) NOT NULL,  -- 顶
    bi_count INTEGER,
    period VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. 核心算法

### 6.1 缠论分析流程

```
K线数据
    │
    ▼
┌─────────────────┐
│ 1. 分型检测      │
│ 识别顶分型/底分型 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. 笔的构建      │
│ 至少5根K线      │
│ 分型之间不重叠   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. 中枢构建      │
│ 重叠的笔构成中枢  │
│ 计算ZD/ZG      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. 买卖点检测     │
│ 一买: 底分型+笔终 │
│ 二买: 中枢后下   │
│ 三买: 中枢后上   │
└─────────────────┘
```

### 6.2 MACD计算

```
EMA12 = EMA(close, 12)
EMA26 = EMA(close, 26)
DIF = EMA12 - EMA26
DEA = EMA(DIF, 9)
HIST = DIF - DEA

金叉: DIF从下往上穿过DEA
死叉: DIF从上往下穿过DEA
```

### 6.3 KDJ计算

```
RSV = (close - low_n) / (high_n - low_n) * 100
K = SMA(RSV, 3)  // 平滑移动平均
D = SMA(K, 3)
J = 3*K - 2*D

金叉: K从下往上穿过D，且K < 30（超卖区）
死叉: K从上往下穿过D，且K > 70（超买区）
```

---

## 7. 部署架构

### 7.1 环境要求

- Rust 1.70+
- Node.js 18+
- PostgreSQL 14+
- Tushare Token

### 7.2 环境变量

```bash
# .env - 后端配置
DATABASE_URL=postgres://user:password@localhost/chanlun
TUSHARE_TOKEN=your_tushare_token_here
HOST=0.0.0.0
PORT=8080

# .env - 前端配置
VITE_API_URL=http://localhost:8080/api/v1
```

### 7.3 启动流程

```bash
# 后端
cd backend
cargo build --release
cargo run

# 前端
cd frontend
npm install
npm run dev
```

---

## 8. 未来扩展

### 8.1 短期扩展

- [ ] 增加更多技术指标（布林带、RSI等）
- [ ] 支持自选股功能
- [ ] 添加信号提醒功能

### 8.2 长期扩展

- [ ] 回测功能
- [ ] 模拟交易
- [ ] 实盘对接

---

## 9. 参考资料

- [czsc-core](https://github.com/gushiwen/czsc) - 缠论核心算法库
- [Tushare](http://tushare.cn/) - 股票数据接口
- [Ant Design](https://ant.design/) - UI组件库
