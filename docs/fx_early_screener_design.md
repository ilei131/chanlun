# 缠论选股系统 - 分型早期筛选增强设计

## 一、核心优化思路

### 1.1 买点确认的滞后性问题

```
时间线对比：
─────────────────────────────────────────────────────────────────►

[第1天] [第2天] [第3天] [第4天] [第5天] [第6天] [第7天]
   │       │       │       │       │       │       │
   ▼       ▼       ▼       ▼       ▼       ▼       ▼
 底分型  笔形成  笔确认  笔破坏  一买可能  一买确认  已涨5%

   ↑               ↑                       ↑
   │               │                       │
   │               │                       └── 传统一买筛选（滞后）
   │               │
   │               └── 笔筛选（中等）
   │
   └── 分型筛选（最早）✅ 发现机会

结论：分型筛选可以比一买筛选提前 3-7 天发现潜在标的
```

### 1.2 缠论层级与确认时间

| 层级 | 形成速度 | 确认程度 | 筛选价值 |
|------|----------|----------|----------|
| **分型** | 最快（1-3天） | 低（可能破坏） | **最早发现潜力股** |
| **笔** | 中等（5-7天） | 中等 | 确认趋势方向 |
| **线段** | 较慢（15-30天） | 较高 | 确认中级趋势 |
| **中枢** | 慢（20-60天） | 高 | 确认震荡区间 |
| **买卖点** | 最慢（30-90天） | 最高（但滞后） | 精准但滞后 |

---

## 二、分型筛选实战策略

### 2.1 分型类型定义

```sql
-- 分型类型枚举
-- bottom_fx: 底分型
-- top_fx: 顶分型
```

### 2.2 分型质量评估

底分型质量评估指标：

```typescript
interface FXQuality {
  // 基础属性
  fx_type: 'bottom' | 'top';
  fx_date: Date;
  fx_price: number;

  // 质量指标
  left_bar_count: number;      // 左侧K线数
  right_bar_count: number;     // 右侧K线数
  depth_pct: number;           // 分型深度百分比
  volume_ratio: number;        // 量比（是否放量）
  volatility: number;          // 波动率

  // 综合评分
  quality_score: number;      // 0-100分

  // 后续发展预判
  bi_formation_prob: number;  // 成笔概率 0-100%
  trend_reversal_prob: number; // 趋势反转概率 0-100%
}

// 质量评分规则
score_rules:
  - 分型深度 > 5%: +20分
  - 包含3根以上K线: +15分
  - 成交量放大 > 1.5倍: +20分
  - 波动率适中: +15分
  - 处于关键支撑位: +30分
```

### 2.3 分型筛选实战组合

```
┌─────────────────────────────────────────────────────────────────────┐
│  分型筛选组合策略                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  【策略1：底分型早期发现】                                            │
│  日线底分型 + 日线KDJ金叉                                            │
│  → 最早发现可能形成一买的股票                                        │
│                                                                     │
│  【策略2：分型确认加强】                                              │
│  日线底分型 + 周线底分型                                             │
│  → 多周期共振，分型质量更高                                          │
│                                                                     │
│  【策略3：分型+笔破坏】                                              │
│  日线底分型 + 日线笔破坏                                             │
│  → 分型已确认成笔，一买概率大增                                      │
│                                                                     │
│  【策略4：分型+MACD底部】                                            │
│  日线底分型 + 日线MACD底部背离                                       │
│  → 技术面与缠论共振，反转概率更高                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 三、数据库扩展设计

### 3.1 新增分型信号表

```sql
-- 12. 分型信号表
CREATE TABLE cs_fx_signals (
    id BIGSERIAL PRIMARY KEY,
    stock_id INTEGER NOT NULL REFERENCES stocks(id),
    period VARCHAR(10) NOT NULL,                    -- 周期：1d、1w、1m

    fx_type VARCHAR(20) NOT NULL,                   -- 分型类型：
                                                    -- bottom_fx (底分型)
                                                    -- top_fx (顶分型)

    fx_date DATE NOT NULL,                         -- 分型形成日期
    fx_price DECIMAL(12, 3) NOT NULL,               -- 分型价格

    -- 分型结构详情
    high_price DECIMAL(12, 3),                     -- 分型区间最高价（顶分型）
    low_price DECIMAL(12, 3),                      -- 分型区间最低价（底分型）

    -- K线数量
    left_bar_count INTEGER DEFAULT 0,               -- 左侧K线数
    right_bar_count INTEGER DEFAULT 0,              -- 右侧K线数

    -- 质量评估
    depth_pct DECIMAL(8, 4),                        -- 分型深度百分比
    volume_ratio DECIMAL(8, 4),                    -- 量比
    volatility DECIMAL(8, 4),                      -- 波动率

    -- 综合评分
    quality_score DECIMAL(5, 2),                    -- 质量评分 0-100

    -- 成笔概率预测
    bi_formation_prob DECIMAL(5, 2),               -- 成笔概率 0-100%
    trend_reversal_prob DECIMAL(5, 2),              -- 反转概率 0-100%

    -- 后续发展状态
    status VARCHAR(20) DEFAULT 'forming',           -- forming(形成中)
                                                    -- confirmed(已确认成笔)
                                                    -- broken(已破坏)
                                                    -- invalid(无效)

    -- 关联信息
    related_bi_id BIGINT,                          -- 关联笔ID（如已确认成笔）
    related_zs_id BIGINT,                           -- 关联中枢ID

    is_current BOOLEAN DEFAULT false,               -- 是否为当前最新分型
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(stock_id, period, fx_type, fx_date)
);
CREATE INDEX idx_fx_signals_stock ON cs_fx_signals(stock_id, period);
CREATE INDEX idx_fx_signals_type ON cs_fx_signals(fx_type);
CREATE INDEX idx_fx_signals_date ON cs_fx_signals(fx_date DESC);
CREATE INDEX idx_fx_signals_quality ON cs_fx_signals(quality_score DESC);
CREATE INDEX idx_fx_signals_status ON cs_fx_signals(status);
```

### 3.2 更新选股结果扩展表

```sql
-- 在 stock_screener_results_ext 表中增加分型相关字段
ALTER TABLE stock_screener_results_ext ADD COLUMN IF NOT EXISTS
  -- 分型筛选信息（新增）
  fx_filter_enabled BOOLEAN DEFAULT false,
  fx_type VARCHAR(20),                              -- 底分型/顶分型
  fx_date DATE,
  fx_price DECIMAL(12, 3),
  fx_quality_score DECIMAL(5, 2),
  fx_bi_formation_prob DECIMAL(5, 2),
  fx_days_since INTEGER,                            -- 距今天数
  fx_status VARCHAR(20),                            -- forming/confirmed/broken
  fx_bi_confirmed BOOLEAN DEFAULT false;            -- 是否已确认成笔
```

---

## 四、API 接口扩展设计

### 4.1 扩展后的选股请求结构

```typescript
// 完整选股请求（支持分型筛选）
interface ScreenerRequest {
  period: '1d' | '1w' | '1m';

  // ============ 方案A：传统买点筛选 ============
  chanlun_filters?: {
    // 买点类型：1_buy, 2_buy, 3_buy
    // 卖点类型：1_sell, 2_sell, 3_sell
    signal_types: Array<'1_buy' | '2_buy' | '3_buy' |
                     '1_sell' | '2_sell' | '3_sell'>;
    require_current: boolean;
  };

  // ============ 方案B：分型早期筛选 ============
  fx_filters?: {
    enabled: boolean;
    fx_type: 'bottom_fx' | 'top_fx';               // 底分型/顶分型
    min_quality_score?: number;                     // 最低质量评分（0-100）
    min_bi_prob?: number;                           // 最低成笔概率（0-100）
    days_within?: number;                            // 发生在多少天内
    require_confirmed?: boolean;                      // 是否要求已确认成笔
    cross_period?: '1d' | '1w' | '1m';               // 跨周期分型（如周线底分型）
  };

  // ============ 方案C：笔筛选（介于中间） ============
  bi_filters?: {
    enabled: boolean;
    bi_type: 'up' | 'down';
    require_recent?: boolean;
    min_length?: number;                             // 最小笔长度
  };

  // ============ 技术指标筛选 ============
  kdj_cross_filter?: {
    enabled: boolean;
    period: '1d' | '1w' | '1m';
    cross_within_days: number;
  };

  macd_cross_filter?: {
    enabled: boolean;
    period: '1d' | '1w' | '1m';
    cross_within_days: number;
  };

  // 其他筛选
  filters: {
    min_price?: number;
    max_price?: number;
    min_quality_score?: number;                    // 通用质量评分
  };

  sort_by: 'fx_date' | 'fx_quality_score' | 'bi_prob' |
           'kdj_cross_date' | 'macd_cross_date' | 'confidence';
  sort_order: 'asc' | 'desc';
  page: number;
  page_size: number;
}
```

### 4.2 选股响应结构

```typescript
interface ScreenerResponse {
  total: number;
  page: number;
  page_size: number;

  data: Array<{
    // 股票信息
    stock_id: number;
    code: string;
    name: string;
    current_price: number;
    change_pct: number;

    // ============ 缠论分型信息 ============
    fx_signal: {
      enabled: boolean;
      fx_type: 'bottom_fx' | 'top_fx' | null;
      fx_date: string | null;
      fx_price: number | null;
      quality_score: number | null;
      bi_formation_prob: number | null;
      days_since_fx: number | null;
      status: 'forming' | 'confirmed' | 'broken' | null;
      bi_confirmed: boolean;
    };

    // ============ 缠论买点信息（可选） ============
    chanlun_signal?: {
      signal_type: string;
      signal_date: string;
      confidence: number;
      zs_zg: number;
      zs_zd: number;
    };

    // ============ 技术指标 ============
    kdj_cross?: CrossResult;
    macd_cross?: CrossResult;
  }>;
}
```

---

## 五、后端算法设计

### 5.1 分型识别与质量评估算法

```rust
// src/algorithms/fx_detector.rs

#[derive(Debug, Clone)]
pub struct FXSignal {
    pub fx_type: FXType,           // 底分型/顶分型
    pub fx_date: Date,
    pub fx_price: f64,

    pub high_price: f64,            // 区间最高价
    pub low_price: f64,             // 区间最低价

    pub left_bar_count: i32,
    pub right_bar_count: i32,

    pub depth_pct: f64,             // 深度百分比
    pub volume_ratio: f64,           // 量比
    pub volatility: f64,            // 波动率

    pub quality_score: f64,          // 质量评分 0-100
    pub bi_formation_prob: f64,     // 成笔概率

    pub status: FXStatus,           // 状态
}

/// 分型检测器
pub struct FXDetector {
    min_bars: i32,                  // 最小K线数
    min_depth_pct: f64,             // 最小深度
    quality_weights: QualityWeights,
}

impl FXDetector {
    /// 检测分型并评估质量
    pub fn detect(&self, bars: &[NewBar]) -> Vec<FXSignal> {
        let mut signals = Vec::new();

        // 1. 基础分型识别
        let basic_fx = self.identify_fx(bars);

        // 2. 质量评估
        for fx in basic_fx {
            let quality = self.evaluate_quality(&fx, bars);

            signals.push(FXSignal {
                quality_score: quality.total_score,
                bi_formation_prob: quality.bi_prob,
                ..fx
            });
        }

        // 3. 过滤低质量分型
        signals.into_iter()
            .filter(|fx| fx.quality_score >= self.min_quality_score)
            .collect()
    }

    /// 质量评估
    fn evaluate_quality(&self, fx: &FXSignal, bars: &[NewBar]) -> QualityResult {
        let mut score = 0.0;

        // 1. 深度评估（占比20%）
        let depth_score = if fx.depth_pct >= 5.0 {
            20.0
        } else if fx.depth_pct >= 3.0 {
            15.0
        } else if fx.depth_pct >= 1.0 {
            10.0
        } else {
            5.0
        };
        score += depth_score;

        // 2. K线数量评估（占比15%）
        let bar_count = fx.left_bar_count + fx.right_bar_count;
        let bar_score = if bar_count >= 5 {
            15.0
        } else if bar_count >= 3 {
            10.0
        } else {
            5.0
        };
        score += bar_score;

        // 3. 成交量评估（占比25%）
        let volume_score = if fx.volume_ratio >= 2.0 {
            25.0
        } else if fx.volume_ratio >= 1.5 {
            20.0
        } else if fx.volume_ratio >= 1.2 {
            15.0
        } else {
            10.0
        };
        score += volume_score;

        // 4. 波动率评估（占比15%）
        let volatility_score = if fx.volatility >= 0.5 && fx.volatility <= 3.0 {
            15.0
        } else if fx.volatility >= 0.3 && fx.volatility <= 5.0 {
            10.0
        } else {
            5.0
        };
        score += volatility_score;

        // 5. 结构完整性评估（占比25%）
        let structure_score = self.evaluate_structure(fx, bars);
        score += structure_score;

        // 成笔概率计算
        let bi_prob = self.calc_bi_prob(score, fx, bars);

        QualityResult {
            total_score: score.min(100.0),
            bi_prob,
        }
    }

    /// 计算成笔概率
    fn calc_bi_prob(&self, score: f64, fx: &FXSignal, bars: &[NewBar]) -> f64 {
        // 基础概率 = 质量评分 * 0.6
        let base_prob = score * 0.6;

        // 修正因素
        let mut factors = 1.0;

        // 深度越大，成笔概率越高
        if fx.depth_pct >= 5.0 { factors += 0.2; }
        else if fx.depth_pct >= 3.0 { factors += 0.1; }

        // 成交量放大，成笔概率提高
        if fx.volume_ratio >= 1.5 { factors += 0.1; }

        // 处于关键支撑位（可结合均线判断）
        // ...

        (base_prob * factors).min(100.0)
    }
}
```

### 5.2 分型状态追踪算法

```rust
/// 分型状态追踪
pub struct FXTracker {
    // 追踪每个股票的最新分型状态
    stock_fx: HashMap<i32, Vec<FXSignal>>,
}

impl FXTracker {
    /// 更新分型状态
    pub fn update_status(&mut self, stock_id: i32, new_bar: &NewBar) -> FXSignal {
        let signals = self.stock_fx.entry(stock_id).or_default();

        // 找到当前的分型
        if let Some(current_fx) = signals.iter_mut().find(|fx| fx.status == FXStatus::Forming) {
            // 检查是否能确认成笔
            if self.check_bi_formation(current_fx, new_bar) {
                current_fx.status = FXStatus::Confirmed;
                current_fx.bi_formation_prob = 100.0;
            }
            // 检查是否被破坏
            else if self.check_fx_broken(current_fx, new_bar) {
                current_fx.status = FXStatus::Broken;
            }
        }

        signals.last().unwrap().clone()
    }

    /// 检查是否成笔
    fn check_bi_formation(&self, fx: &FXSignal, new_bar: &NewBar) -> bool {
        match fx.fx_type {
            FXType::Bottom => {
                // 底分型：后续走出向上笔
                // 需要突破底分型区间最高点
                new_bar.high > fx.high_price
            },
            FXType::Top => {
                // 顶分型：后续走出向下笔
                // 需要跌破顶分型区间最低点
                new_bar.low < fx.low_price
            },
        }
    }

    /// 检查分型是否被破坏
    fn check_fx_broken(&self, fx: &FXSignal, new_bar: &NewBar) -> bool {
        match fx.fx_type {
            FXType::Bottom => {
                // 底分型：被新低破坏
                new_bar.low < fx.fx_price
            },
            FXType::Top => {
                // 顶分型：被新高破坏
                new_bar.high > fx.fx_price
            },
        }
    }
}
```

### 5.3 多条件组合筛选算法

```rust
/// 分型优先选股服务
pub struct FXFirstScreener {
    db_pool: Pool,
    fx_detector: FXDetector,
    chanlun_analyzer: ChanLunAnalyzer,
}

impl FXFirstScreener {
    /// 执行分型优先筛选
    pub async fn screen(&self, request: &ScreenerRequest) -> Result<ScreenerResponse> {
        // Step 1: 基础筛选 - 获取所有有分型信号的股票
        let fx_stocks = if let Some(ref fx_filters) = request.fx_filters {
            if fx_filters.enabled {
                self.get_fx_match_stocks(fx_filters).await?
            } else {
                self.get_all_stocks().await?
            }
        } else {
            self.get_all_stocks().await?
        };

        let mut results = Vec::new();

        for stock in fx_stocks {
            // Step 2: 获取分型信号详情
            let fx_result = self.get_fx_detail(&stock, &request.fx_filters).await?;

            // Step 3: 检查技术指标条件
            let kdj_result = self.check_kdj(&stock, &request.kdj_cross_filter).await?;
            let macd_result = self.check_macd(&stock, &request.macd_cross_filter).await?;

            // Step 4: 检查买点条件（如启用）
            let chanlun_result = self.check_chanlun(&stock, &request.chanlun_filters).await?;

            // Step 5: 组合条件判断
            if self.evaluate_all_conditions(&fx_result, &kdj_result, &macd_result, &chanlun_result, request) {
                results.push(StockResult {
                    stock_id: stock.id,
                    code: stock.code,
                    name: stock.name,
                    fx_signal: fx_result,
                    kdj_cross: kdj_result,
                    macd_cross: macd_result,
                    chanlun_signal: chanlun_result,
                    ..Default::default()
                });
            }
        }

        // Step 6: 排序和分页
        let sorted = self.sort_by_criteria(results, request.sort_by, request.sort_order);
        let paginated = self.paginate(sorted, request.page, request.page_size);

        Ok(ScreenerResponse {
            total: paginated.len(),
            data: paginated,
        })
    }
}
```

---

## 六、前端设计

### 6.1 选股策略选择界面

```
┌─────────────────────────────────────────────────────────────────────────┐
│  选择选股策略                                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  【策略模式】                                                            │
│  ○ 传统买点模式                                                         │
│    └─ 基于缠论买卖点筛选（已确认的买点）                                  │
│                                                                         │
│  ● 分型早期模式 ⭐ 推荐                                                  │
│    └─ 基于分型筛选（更早发现潜在标的）                                    │
│                                                                         │
│  ○ 笔筛选模式                                                           │
│    └─ 基于笔的筛选（介于中间）                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 分型筛选面板

```
┌─────────────────────────────────────────────────────────────────────────┐
│  【分型筛选条件】⭐                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  分型类型:  ●底分型（选买）  ○顶分型（选卖）                             │
│                                                                         │
│  质量要求:                                                               │
│    最低质量评分: [60]  (滑块 0 ────────●──── 100)                        │
│    最低成笔概率: [70]  (滑块 0 ──────●────── 100)                        │
│                                                                         │
│  时间条件:                                                               │
│    ● 分型发生在最近 [15] 天内                                            │
│    ○ 不限制                                                              │
│                                                                         │
│  确认状态:                                                               │
│    ○ 不要求已确认成笔（发现早期潜力股）✅                                 │
│    ● 要求已确认成笔（分型已验证）                                         │
│    ○ 都可以                                                              │
│                                                                         │
│  跨周期共振（可选）:                                                     │
│    ☐ 同时满足周线底分型                                                   │
│    ☐ 同时满足月线底分型                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 股票列表展示（分型模式）

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  筛选结果：底分型早期发现                          共 45 只                      [导出]     │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ 代码    │ 名称     │ 现价  │ 涨跌幅 │ 分型质量 │ 成笔概率 │ 状态    │ KDJ金叉 │ 操作     │
├─────────┼──────────┼───────┼────────┼──────────┼──────────┼─────────┼─────────┼─────────│
│ 000001  │ 平安银行 │ 12.50 │ +2.35% │   85分   │   80%   │ 已成笔  │ 5天前   │ [详情]  │
│ 000002  │ 万科A    │  8.20 │ +1.20% │   75分   │   65%   │ 形成中  │ 3天前   │ [详情]  │
│ 600036  │ 招商银行 │ 35.80 │ -0.50% │   90分   │   85%   │ 已成笔  │ 10天前  │ [详情]  │
│ 601318  │ 中国平安│ 48.90 │ +0.80% │   70分   │   55%   │ 形成中  │ 1天前   │ [详情]  │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  说明：                                                                        │
│  • "已成笔"表示底分型已确认成笔，一买概率较高                                  │
│  • "形成中"表示底分型尚未确认，可能被破坏                                      │
│  • 建议优先关注质量评分>80且成笔概率>70%的标的                                 │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 分型详情标注

```
┌────────────────────────────────────────────────────────────────────────┐
│  000001 平安银行  K线图                                                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  14.0 ┤                          ▲ 顶分型                               │
│       │                    ▲     │                                       │
│  13.0 ┤              ▲           │                                       │
│       │         ▲     ● 底分型    │                                       │
│  12.0 ┤    ●─────●───────────────● 成笔确认点                           │
│       │   ↑           │                                                      │
│  11.0 ┤  底分型形成    │                                                      │
│       │               ▼                                                      │
│  10.0 ┤          一买可能                                                   │
│       │                                                                   │
│  11.5 ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ZG（中枢上沿）              │
│  12.0 ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ZD（中枢下沿）              │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  分型详情:                                                                │
│  • 分型类型: 底分型                                                       │
│  • 形成日期: 2024-01-08                                                  │
│  • 质量评分: 85分 (优秀)                                                  │
│  • 成笔概率: 80%                                                         │
│  • 当前状态: 已成笔（笔破坏确认）                                           │
│  • 距今天数: 5天                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 七、预定义分型筛选策略

### 7.1 策略库

```yaml
strategies:
  # ============ 分型早期发现策略 ============

  - name: "底分型早期发现"
    description: "发现日线底分型，质量较高但未必要求成笔，提前布局"
    config:
      period: "1d"
      fx_filters:
        enabled: true
        fx_type: "bottom_fx"
        min_quality_score: 70
        min_bi_prob: 60
        days_within: 15
        require_confirmed: false

  - name: "底分型+KDJ金叉共振"
    description: "分型出现配合KDJ金叉，双重信号共振"
    config:
      period: "1d"
      fx_filters:
        enabled: true
        fx_type: "bottom_fx"
        min_quality_score: 75
        require_confirmed: false
      kdj_cross_filter:
        enabled: true
        period: "1d"
        cross_within_days: 10

  - name: "周线底分型+成笔"
    description: "周线级别底分型且已确认成笔，信号更强"
    config:
      period: "1w"
      fx_filters:
        enabled: true
        fx_type: "bottom_fx"
        min_quality_score: 80
        require_confirmed: true

  - name: "多周期分型共振"
    description: "日周月三周期同时出现底分型，多周期共振"
    config:
      period: "1d"
      fx_filters:
        enabled: true
        fx_type: "bottom_fx"
        min_quality_score: 85
        require_confirmed: false
        # 注意：跨周期筛选在实现时需要特殊处理
```

---

## 八、分型筛选 vs 买点筛选对比

| 维度 | 分型筛选 | 买点筛选 |
|------|----------|----------|
| **发现时机** | 最早（1-3天） | 较晚（5-7天） |
| **确认程度** | 较低（可能破坏） | 较高（已确认） |
| **信号数量** | 多（潜在机会多） | 少（精准但少） |
| **筛选难度** | 需要质量评估 | 直接可用 |
| **风险程度** | 较高（分型可能破坏） | 较低（已验证） |
| **适合人群** | 激进型投资者 | 稳健型投资者 |

### 组合推荐

```
激进策略：分型筛选 + 低质量要求 + 不要求成笔
├── 优点：最早发现，最大化机会
└── 风险：假信号多，需要更多人工筛选

平衡策略：分型筛选 + 高质量要求 + 成笔概率>70%
├── 优点：早发现且信号质量较高
└── 风险：可能错过部分机会

稳健策略：买点筛选 + 分型过滤
├── 优点：信号最可靠
└── 风险：发现较晚，可能已涨
```

---

## 九、图表标注设计

### 9.1 分型标注样式

```
K线图标注：

底分型标记:
• 左侧绿色三角形 ▼
• 标注质量评分
• 标注成笔概率

顶分型标记:
• 左侧红色三角形 ▲
• 标注质量评分
• 标注反转概率

分型区间:
• 虚线连接左右端点
• 半透明填充区间
```

### 9.2 分型状态标注

```
分型状态颜色编码：

形成中（灰色）: ⬜ 底分型/顶分型
    └── 分型刚形成，尚未确认

已确认（绿色/红色）: 🟢 底分型  🔴 顶分型
    └── 已确认成笔，可靠性高

已破坏（灰色+删除线）: ㊖ 底分型/顶分型
    └── 分型被破坏，不再关注
```
