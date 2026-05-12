# 缠论选股系统 - 多级别指标金叉筛选扩展设计

## 一、扩展需求概述

### 1.1 新增筛选维度

在原有缠论买点筛选基础上，增加两个技术指标筛选模块：

| 筛选类型 | 可选周期 | 说明 |
|---------|---------|------|
| **KDJ金叉** | 日线 / 周线 / 月线 | K线从下往上穿过D线 |
| **MACD金叉** | 日线 / 周线 / 月线 | DIF线从下往上穿过DEA线 |

### 1.2 组合筛选逻辑

支持多条件组合筛选，例如：
- 日线一买 **+** 月线KDJ金叉
- 周线二买 **+** 周线MACD金叉
- 日线三买 **+** 日线KDJ金叉 **+** 周线MACD金叉

---

## 二、数据库扩展设计

### 2.1 新增表：金叉/死叉信号表

```sql
-- 扩展：新增交叉信号表（替代原来的单一买卖点表）
CREATE TABLE cs_cross_signals (
    id BIGSERIAL PRIMARY KEY,
    stock_id INTEGER NOT NULL REFERENCES stocks(id),
    period VARCHAR(10) NOT NULL,                    -- 周期：1d、1w、1m

    signal_type VARCHAR(30) NOT NULL,                -- 信号类型：
                                                    -- kdj_gold_cross (KDJ金叉)
                                                    -- kdj_dead_cross (KDJ死叉)
                                                    -- macd_gold_cross (MACD金叉)
                                                    -- macd_dead_cross (MACD死叉)

    signal_date DATE NOT NULL,                       -- 信号日期
    signal_price DECIMAL(12, 3),                     -- 信号发生时价格

    -- KDJ特有字段
    kdj_k_before DECIMAL(8, 4),                     -- 交叉前K值
    kdj_k_after DECIMAL(8, 4),                      -- 交叉后K值
    kdj_d_before DECIMAL(8, 4),                     -- 交叉前D值
    kdj_d_after DECIMAL(8, 4),                      -- 交叉后D值

    -- MACD特有字段
    macd_dif_before DECIMAL(12, 4),                 -- 交叉前DIF值
    macd_dif_after DECIMAL(12, 4),                  -- 交叉后DIF值
    macd_dea_before DECIMAL(12, 4),                 -- 交叉前DEA值
    macd_dea_after DECIMAL(12, 4),                  -- 交叉后DEA值

    is_current BOOLEAN DEFAULT false,                -- 是否为当前有效信号
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(stock_id, period, signal_type, signal_date)
);
CREATE INDEX idx_cross_signals_stock ON cs_cross_signals(stock_id, period);
CREATE INDEX idx_cross_signals_type ON cs_cross_signals(signal_type);
CREATE INDEX idx_cross_signals_date ON cs_cross_signals(signal_date DESC);
```

### 2.2 更新选股结果表

```sql
-- 扩展选股结果表，增加金叉筛选结果
ALTER TABLE stock_screener_results ADD COLUMN IF NOT EXISTS kdj_cross_date DATE;
ALTER TABLE stock_screener_results ADD COLUMN IF NOT EXISTS kdj_cross_period VARCHAR(10);
ALTER TABLE stock_screener_results ADD COLUMN IF NOT EXISTS macd_cross_date DATE;
ALTER TABLE stock_screener_results ADD COLUMN IF NOT EXISTS macd_cross_period VARCHAR(10);
```

---

## 三、API 接口扩展设计

### 3.1 选股请求结构

```typescript
// 扩展后的选股请求
interface ScreenerRequest {
  period: '1d' | '1w' | '1m';              // 主周期

  // 缠论买点筛选
  chanlun_filters: {
    signal_types: Array<'1_buy' | '2_buy' | '3_buy'>;  // 买点类型
    require_current: boolean;                         // 是否要求当前买点
  };

  // KDJ金叉筛选（可选）
  kdj_cross_filter?: {
    enabled: boolean;
    period: '1d' | '1w' | '1m';          // KDJ周期
    cross_within_days: number;           // 金叉发生在多少天内，默认30天
  };

  // MACD金叉筛选（可选）
  macd_cross_filter?: {
    enabled: boolean;
    period: '1d' | '1w' | '1m';          // MACD周期
    cross_within_days: number;           // 金叉发生在多少天内，默认30天
  };

  // 其他筛选条件
  filters: {
    min_price?: number;
    max_price?: number;
    min_volume?: number;
    max_volume?: number;
    change_pct_min?: number;
    change_pct_max?: number;
  };

  // 排序和分页
  sort_by: 'signal_date' | 'kdj_cross_date' | 'macd_cross_date' | 'confidence';
  sort_order: 'asc' | 'desc';
  page: number;
  page_size: number;
}
```

### 3.2 选股响应结构

```typescript
// 扩展后的选股响应
interface ScreenerResponse {
  total: number;
  page: number;
  page_size: number;

  data: Array<{
    // 股票基本信息
    stock_id: number;
    code: string;
    name: string;
    current_price: number;
    change_pct: number;

    // 缠论信号
    chanlun: {
      signal_type: '1_buy' | '2_buy' | '3_buy';
      signal_date: string;
      signal_price: number;
      confidence: number;
      related_zs: { zg: number; zd: number } | null;
    };

    // KDJ金叉信号
    kdj_cross: {
      enabled: boolean;
      cross_date: string | null;
      cross_period: string | null;
      days_since_cross: number | null;   // 距离金叉天数
      kdj_k: number;
      kdj_d: number;
    } | null;

    // MACD金叉信号
    macd_cross: {
      enabled: boolean;
      cross_date: string | null;
      cross_period: string | null;
      days_since_cross: number | null;
      macd_dif: number;
      macd_dea: number;
    } | null;
  }>;
}
```

### 3.3 API 接口示例

```yaml
# 扩展后的选股接口
POST /api/v1/screener/run

请求示例1：日线一买 + 月线KDJ金叉
{
  "period": "1d",
  "chanlun_filters": {
    "signal_types": ["1_buy"],
    "require_current": true
  },
  "kdj_cross_filter": {
    "enabled": true,
    "period": "1m",
    "cross_within_days": 30
  },
  "filters": {
    "min_price": 5,
    "max_price": 100
  },
  "sort_by": "signal_date",
  "sort_order": "desc",
  "page": 1,
  "page_size": 20
}

请求示例2：周线二买 + 周线MACD金叉
{
  "period": "1w",
  "chanlun_filters": {
    "signal_types": ["2_buy"],
    "require_current": true
  },
  "macd_cross_filter": {
    "enabled": true,
    "period": "1w",
    "cross_within_days": 30
  },
  "sort_by": "confidence",
  "sort_order": "desc"
}

请求示例3：日线三买 + 多条件共振（多级别KDJ+MACD）
{
  "period": "1d",
  "chanlun_filters": {
    "signal_types": ["3_buy"],
    "require_current": true
  },
  "kdj_cross_filter": {
    "enabled": true,
    "period": "1d",
    "cross_within_days": 10
  },
  "macd_cross_filter": {
    "enabled": true,
    "period": "1d",
    "cross_within_days": 10
  }
}
```

---

## 四、后端算法设计

### 4.1 金叉检测算法

```rust
// src/algorithms/cross_detector.rs

/// KDJ金叉检测
pub fn detect_kdj_cross(kdj_data: &[KDJData]) -> Vec<CrossSignal> {
    let mut signals = Vec::new();

    for i in 1..kdj_data.len() {
        let prev = &kdj_data[i - 1];
        let curr = &kdj_data[i];

        // K线从下往上穿过D线 = 金叉
        let is_gold_cross = prev.k <= prev.d && curr.k > curr.d;
        // K线从上往下穿过D线 = 死叉
        let is_dead_cross = prev.k >= prev.d && curr.k < curr.d;

        if is_gold_cross {
            signals.push(CrossSignal {
                signal_type: CrossType::KDJGoldCross,
                date: curr.date,
                price: curr.close,
                value_before: prev.k,
                value_after: curr.k,
                reference_before: prev.d,
                reference_after: curr.d,
            });
        } else if is_dead_cross {
            signals.push(CrossSignal {
                signal_type: CrossType::KDJDeadCross,
                date: curr.date,
                price: curr.close,
                value_before: prev.k,
                value_after: curr.k,
                reference_before: prev.d,
                reference_after: curr.d,
            });
        }
    }

    signals
}

/// MACD金叉检测
pub fn detect_macd_cross(macd_data: &[MACDData]) -> Vec<CrossSignal> {
    let mut signals = Vec::new();

    for i in 1..macd_data.len() {
        let prev = &macd_data[i - 1];
        let curr = &macd_data[i];

        // DIF从下往上穿过DEA = 金叉
        let is_gold_cross = prev.dif <= prev.dea && curr.dif > curr.dea;
        // DIF从上往下穿过DEA = 死叉
        let is_dead_cross = prev.dif >= prev.dea && curr.dif < curr.dea;

        if is_gold_cross {
            signals.push(CrossSignal {
                signal_type: CrossType::MACDGoldCross,
                date: curr.date,
                price: curr.close,
                value_before: prev.dif,
                value_after: curr.dif,
                reference_before: prev.dea,
                reference_after: curr.dea,
            });
        } else if is_dead_cross {
            signals.push(CrossSignal {
                signal_type: CrossType::MACDDeadCross,
                date: curr.date,
                price: curr.close,
                value_before: prev.dif,
                value_after: curr.dif,
                reference_before: prev.dea,
                reference_after: curr.dea,
            });
        }
    }

    signals
}
```

### 4.2 多条件组合筛选算法

```rust
// src/services/screener.rs

/// 多条件组合选股服务
pub struct MultiConditionScreener {
    db_pool: Pool,
    chanlun_analyzer: ChanLunAnalyzer,
}

impl MultiConditionScreener {
    /// 执行多条件筛选
    pub async fn screen(&self, request: &ScreenerRequest) -> Result<ScreenerResponse> {
        // Step 1: 基础筛选 - 获取所有符合缠论条件的股票
        let chanlun_stocks = self.get_chanlun_match_stocks(&request.chanlun_filters).await?;

        let mut results = Vec::new();

        for stock in chanlun_stocks {
            // Step 2: 检查KDJ金叉条件（如果启用）
            let kdj_result = if let Some(ref kdj_filter) = request.kdj_cross_filter {
                if kdj_filter.enabled {
                    self.check_kdj_cross(&stock, kdj_filter).await?
                } else {
                    None
                }
            } else {
                None
            };

            // Step 3: 检查MACD金叉条件（如果启用）
            let macd_result = if let Some(ref macd_filter) = request.macd_cross_filter {
                if macd_filter.enabled {
                    self.check_macd_cross(&stock, macd_filter).await?
                } else {
                    None
                }
            } else {
                None
            };

            // Step 4: 组合判断
            let passes = self.evaluate_combination(
                &kdj_result,
                &macd_result,
                &request.kdj_cross_filter,
                &request.macd_cross_filter,
            );

            if passes {
                results.push(StockResult {
                    stock_id: stock.id,
                    code: stock.code,
                    name: stock.name,
                    current_price: stock.current_price,
                    change_pct: stock.change_pct,
                    chanlun: stock.chanlun_signal,
                    kdj_cross: kdj_result,
                    macd_cross: macd_result,
                });
            }
        }

        // Step 5: 排序和分页
        let sorted = self.sort_results(results, request.sort_by, request.sort_order);
        let paginated = self.paginate(sorted, request.page, request.page_size);

        Ok(ScreenerResponse {
            total: paginated.len(),
            data: paginated,
        })
    }

    /// 检查KDJ金叉条件
    async fn check_kdj_cross(
        &self,
        stock: &Stock,
        filter: &KDJCrossFilter,
    ) -> Result<Option<CrossResult>> {
        // 获取指定周期的KDJ数据
        let kdj_data = self.get_kdj_data(stock.id, &filter.period).await?;

        // 检测金叉信号
        let crosses = detect_kdj_cross(&kdj_data);

        // 筛选当前有效的金叉
        let today = chrono::Utc::now().date_naive();
        let cutoff_date = today - Duration::days(filter.cross_within_days as i64);

        let valid_cross = crosses.iter()
            .filter(|c| {
                c.signal_type == CrossType::KDJGoldCross &&
                c.date >= cutoff_date
            })
            .max_by_key(|c| c.date);

        if let Some(cross) = valid_cross {
            Ok(Some(CrossResult {
                cross_date: cross.date.to_string(),
                cross_period: filter.period.clone(),
                days_since_cross: (today - cross.date).num_days() as i32,
                kdj_k: cross.value_after,
                kdj_d: cross.reference_after,
            }))
        } else {
            Ok(None)
        }
    }

    /// 组合条件判断逻辑
    fn evaluate_combination(
        &self,
        kdj_result: &Option<CrossResult>,
        macd_result: &Option<CrossResult>,
        kdj_filter: &Option<&KDJCrossFilter>,
        macd_filter: &Option<&MACDCrossFilter>,
    ) -> bool {
        // 如果启用KDJ条件，必须满足
        if let Some(filter) = kdj_filter {
            if filter.enabled && kdj_result.is_none() {
                return false;
            }
        }

        // 如果启用MACD条件，必须满足
        if let Some(filter) = macd_filter {
            if filter.enabled && macd_result.is_none() {
                return false;
            }
        }

        true
    }
}
```

---

## 五、前端页面设计

### 5.1 选股大厅筛选面板

```
┌────────────────────────────────────────────────────────────────────┐
│  选股条件设置                                                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  【主周期】                                                           │
│  ○ 日线  ○ 周线  ○ 月线                                              │
│                                                                     │
│  【缠论买点】                                                         │
│  ☑ 1买  ☑ 2买  ☐ 3买                                                │
│  ☑ 仅显示当前买点                                                     │
│                                                                     │
│  【KDJ金叉】                                                         │
│  ☐ 启用KDJ金叉筛选                                                   │
│     周期：○ 日线  ○ 周线  ○ 月线                                     │
│     金叉发生在：[30] 天内                                             │
│                                                                     │
│  【MACD金叉】                                                        │
│  ☐ 启用MACD金叉筛选                                                   │
│     周期：○ 日线  ○ 周线  ○ 月线                                     │
│     金叉发生在：[30] 天内                                             │
│                                                                     │
│  【价格区间】  [___] 元 至 [___] 元                                   │
│  【涨跌幅】    [___]% 至 [___]%                                       │
│                                                                     │
│  【排序方式】                                                         │
│  ○ 信号日期  ○ KDJ金叉日期  ○ MACD金叉日期  ○ 置信度                   │
│                                                                     │
│                              [开始筛选]  [重置条件]                    │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 股票列表展示

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  筛选结果：共 23 只符合条件                                                    [导出Excel] │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ 代码    │ 名称     │ 现价  │ 涨跌幅 │ 缠论买点 │ KDJ金叉      │ MACD金叉      │ 操作     │
├─────────┼──────────┼───────┼────────┼─────────┼──────────────┼───────────────┼─────────┤
│ 000001  │ 平安银行 │ 12.50 │ +2.35% │  2买    │ 月线 5天前   │ 日线 3天前    │ [详情]  │
│ 000002  │ 万科A    │  8.20 │ -1.20% │  1买    │ 日线 10天前  │ 周线 8天前    │ [详情]  │
│ 600036  │ 招商银行 │ 35.80 │ +1.50% │  2买    │ 周线 2天前   │ 月线 12天前   │ [详情]  │
│ 601318  │ 中国平安│ 48.90 │ +0.80% │  3买    │ 日线 1天前   │ 日线 1天前    │ [详情]  │
│ ...     │  ...    │  ...  │  ...   │  ...   │  ...        │  ...         │  ...   │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  [分页]  共 23 条  [< 1 2 >]                                                      │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 条件组合可视化

```
┌────────────────────────────────────────────────────────────────┐
│  当前筛选条件                                                    │
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │   日线一买   │  AND │  月线KDJ金叉  │  AND │  日线MACD金叉 │ │
│  │              │      │   (5天内)    │      │   (10天内)   │ │
│  │   ✓ 已满足   │      │   ✓ 已满足   │      │   ✓ 已满足   │ │
│  └──────────────┘      └──────────────┘      └──────────────┘ │
│                                                                 │
│  满足全部条件的股票: 5 只                                        │
└────────────────────────────────────────────────────────────────┘
```

---

## 六、图表标注扩展

### 6.1 KDJ金叉标注

在KDJ指标图中标注金叉/死叉点：

```
KDJ指标
100 ┤
    │                    ▲ 死叉
 80 ┤
    │         ● 金叉
 50 ┤ ────────────────────────────
    │    ↑               ↑
 20 ┤  金叉            死叉
    │
  0 ┤
    └──────────────────────────────────→ 日期
```

### 6.2 MACD金叉标注

在MACD指标图中标注金叉/死叉点：

```
MACD指标
 1.0 ┤                          ▲ 死叉
     │                    ● 金叉
  0  ┼────────────●───────────────→ DIF
     │      ↑  ↑
     │      金叉
-1.0 ┤
     └──────────────────────────────────→ 日期
```

---

## 七、预定义选股策略

### 7.1 系统预设策略

```yaml
strategies:
  - name: "日线一买 + 月线KDJ金叉"
    description: "寻找日线第一类买点，且月线KDJ刚形成金叉的股票"
    config:
      period: "1d"
      chanlun_filters:
        signal_types: ["1_buy"]
        require_current: true
      kdj_cross_filter:
        enabled: true
        period: "1m"
        cross_within_days: 30

  - name: "周线二买 + 周线MACD金叉"
    description: "寻找周线第二类买点，且周线MACD形成金叉共振"
    config:
      period: "1w"
      chanlun_filters:
        signal_types: ["2_buy"]
        require_current: true
      macd_cross_filter:
        enabled: true
        period: "1w"
        cross_within_days: 30

  - name: "日线三买多周期共振"
    description: "日线第三类买点，同时日线KDJ和MACD金叉，三周期共振"
    config:
      period: "1d"
      chanlun_filters:
        signal_types: ["3_buy"]
        require_current: true
      kdj_cross_filter:
        enabled: true
        period: "1d"
        cross_within_days: 10
      macd_cross_filter:
        enabled: true
        period: "1d"
        cross_within_days: 10
```

---

## 八、数据处理流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         数据处理完整流程                                      │
└─────────────────────────────────────────────────────────────────────────────┘

1. K线数据导入
   ↓
2. 计算各周期技术指标（1d/1w/1m）
   ├── MA（5/10/20/30/60/120/250）
   ├── MACD（12/26/9）
   └── KDJ（9/3/3）
   ↓
3. 检测交叉信号
   ├── KDJ金叉/死叉检测（存储到 cs_cross_signals 表）
   └── MACD金叉/死叉检测（存储到 cs_cross_signals 表）
   ↓
4. 缠论结构计算
   ├── 分型识别
   ├── 笔识别
   ├── 线段划分
   ├── 中枢识别
   └── 买卖点检测（存储到 cs_signals 表）
   ↓
5. 选股筛选
   ├── 缠论买点过滤
   ├── KDJ金叉过滤（跨周期）
   └── MACD金叉过滤（跨周期）
   ↓
6. 结果展示
```

---

## 九、性能优化建议

### 9.1 数据库优化

```sql
-- 创建交叉信号的复合索引，加速筛选查询
CREATE INDEX idx_cross_signals_efficient
ON cs_cross_signals (stock_id, signal_type, signal_date DESC)
WHERE signal_type IN ('kdj_gold_cross', 'macd_gold_cross');

-- 创建缠论信号的复合索引
CREATE INDEX idx_chanlun_signals_efficient
ON cs_signals (signal_type, signal_date DESC, is_current)
WHERE signal_type LIKE '%_buy' AND is_current = true;
```

### 9.2 缓存策略

```rust
// 热门策略结果缓存 5 分钟
pub struct ScreenerCache {
    cache: Cache<String, ScreenerResponse>,
}

impl ScreenerCache {
    pub fn new() -> Self {
        Self {
            cache: Cache::builder()
                .max_capacity(1000)
                .time_to_live(Duration::from_secs(300))
                .build(),
        }
    }

    pub fn get(&self, key: &str) -> Option<ScreenerResponse> {
        self.cache.get(key).cloned()
    }

    pub fn set(&self, key: String, value: ScreenerResponse) {
        self.cache.insert(key, value);
    }
}
```

---

## 十、完整筛选条件组合示例

| 场景 | 主周期 | 缠论买点 | KDJ条件 | MACD条件 | 逻辑 |
|------|--------|----------|---------|----------|------|
| 1 | 日线 | 一买 | 月线金叉 | 无 | 日线一买 AND 月线KDJ金叉 |
| 2 | 日线 | 二买 | 无 | 周线金叉 | 日线二买 AND 周线MACD金叉 |
| 3 | 周线 | 三买 | 日线金叉 | 日线金叉 | 周线三买 AND 日线KDJ金叉 AND 日线MACD金叉 |
| 4 | 日线 | 一买/二买 | 周线金叉 | 周线金叉 | 日线一二买 AND 周线KDJ金叉 AND 周线MACD金叉 |
| 5 | 月线 | 一买 | 月线金叉 | 月线金叉 | 月线一买 AND 月线KDJ金叉 AND 月线MACD金叉 |

---

这个扩展设计完整支持了你提出的多级别指标金叉筛选需求，支持任意条件组合，实现"缠论买点 + 多级别KDJ + 多级别MACD"的灵活筛选。
