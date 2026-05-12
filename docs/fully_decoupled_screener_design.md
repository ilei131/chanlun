# 缠论选股系统 - 完全解耦筛选条件设计

> 本文档说明如何实现完全解耦的筛选条件，允许用户任意组合任意数量的筛选条件

---

## 一、核心理念

### 1.1 旧方案问题

```
旧方案（树状依赖）：
│
├── 选股模式
│   ├── 买点模式
│   │   └── 缠论买点筛选（1买/2买/3买）
│   │       └── [必须选择一个买点]
│   │
│   └── 分型模式
│       └── 分型筛选（底分型/顶分型）
│           └── [必须选择一个分型]
│
问题：
- 每个模式必须选一个主条件
- 条件之间有依赖关系
- 不够灵活
```

### 1.2 新方案：完全解耦

```
新方案（平面组合）：
┌─────────────────────────────────────────────────────┐
│                                                     │
│   所有筛选条件都是【可选的】                          │
│                                                     │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│   │  缠论买点   │  │ KDJ金叉     │  │ MACD金叉    ││
│   │  ☐ 1买     │  │ ☐ 日线     │  │ ☐ 日线     ││
│   │  ☐ 2买     │  │ ☐ 周线     │  │ ☐ 周线     ││
│   │  ☐ 3买     │  │ ☐ 月线     │  │ ☐ 月线     ││
│   └─────────────┘  └─────────────┘  └─────────────┘│
│                                                     │
│   ┌─────────────┐  ┌─────────────┐                 │
│   │  分型筛选   │  │ 价格区间    │                 │
│   │  ☐ 底分型  │  │ [5] - [100] │                 │
│   │  ☐ 顶分型  │  └─────────────┘                 │
│   └─────────────┘                                  │
│                                                     │
│   【逻辑关系】：所有启用条件 AND 组合                 │
│                                                     │
└─────────────────────────────────────────────────────┘

优势：
✓ 完全解耦，无依赖关系
✓ 任意组合，数量不限
✓ 满足任意组合的股票都被筛选出来
```

---

## 二、筛选条件类型

### 2.1 条件分类

| 分类 | 条件类型 | 可选值 | 说明 |
|------|----------|--------|------|
| **缠论结构** | 缠论买点 | 1买/2买/3买 | 三选一或多选 |
| | 分型 | 底分型/顶分型 | 三选一或多选 |
| | 笔方向 | 向上笔/向下笔 | 二选一 |
| **技术指标** | KDJ金叉 | 日线/周线/月线 | 多选 |
| | MACD金叉 | 日线/周线/月线 | 多选 |
| **价格条件** | 价格区间 | min-max | 范围 |
| | 涨跌幅 | min-max | 范围 |

### 2.2 组合示例

```
示例1：纯KDJ金叉筛选
{
  "kdj_cross": {
    "enabled": true,
    "periods": ["1d", "1w", "1m"]  // 日、周、月都要满足
  }
}
结果：同时满足日线、周线、月线KDJ金叉的股票

示例2：买点 + 单周期KDJ
{
  "chanlun_buy": {
    "enabled": true,
    "types": ["1_buy"]
  },
  "kdj_cross": {
    "enabled": true,
    "periods": ["1d"]
  }
}
结果：日线一买 且 日线KDJ金叉的股票

示例3：纯分型筛选
{
  "fractal": {
    "enabled": true,
    "types": ["bottom_fx"],
    "require_confirmed": false
  }
}
结果：出现底分型的股票（不管成不成笔）

示例4：买点 + 多级别MACD
{
  "chanlun_buy": {
    "enabled": true,
    "types": ["2_buy"]
  },
  "macd_cross": {
    "enabled": true,
    "periods": ["1w", "1m"]
  }
}
结果：二买 且 周线和月线都MACD金叉的股票

示例5：无缠论条件，只有价格
{
  "price_range": {
    "enabled": true,
    "min": 5,
    "max": 20
  }
}
结果：价格在5-20元之间的所有股票
```

---

## 三、API 设计

### 3.1 完全解耦的选股请求

```typescript
// 选股请求 - 完全解耦版本
interface ScreenerRequest {
  // ========== 缠论买点条件（可选）==========
  chanlun_buy?: {
    enabled: boolean;
    types: Array<'1_buy' | '2_buy' | '3_buy'>;  // 可多选
    require_current: boolean;                     // 是否要求当前买点
  };

  // ========== 分型筛选条件（可选）==========
  fractal?: {
    enabled: boolean;
    types: Array<'bottom_fx' | 'top_fx'>;         // 可多选
    periods: Array<'1d' | '1w' | '1m'>;         // 分型周期
    require_confirmed: boolean;                     // 是否要求成笔
    min_quality_score?: number;                   // 最低质量评分
    days_within?: number;                          // 发生在多少天内
  };

  // ========== KDJ金叉条件（可选）==========
  kdj_cross?: {
    enabled: boolean;
    periods: Array<'1d' | '1w' | '1m'>;         // 可多选
    days_within: number;                           // 金叉发生在多少天内
  };

  // ========== MACD金叉条件（可选）==========
  macd_cross?: {
    enabled: boolean;
    periods: Array<'1d' | '1w' | '1m'>;         // 可多选
    days_within: number;                           // 金叉发生在多少天内
  };

  // ========== 笔筛选条件（可选）==========
  bi_direction?: {
    enabled: boolean;
    direction: 'up' | 'down';
    min_length?: number;
    periods: Array<'1d' | '1w' | '1m'>;
  };

  // ========== 价格条件（可选）==========
  price_range?: {
    enabled: boolean;
    min: number;
    max: number;
  };

  // ========== 涨跌幅条件（可选）==========
  change_range?: {
    enabled: boolean;
    min: number;    // 百分比
    max: number;
  };

  // ========== 排序和分页 ==========
  sort_by: 'code' | 'change_pct' | 'match_count';
  sort_order: 'asc' | 'desc';
  page: number;
  page_size: number;
}
```

### 3.2 选股响应

```typescript
// 选股响应
interface ScreenerResponse {
  total: number;
  page: number;
  page_size: number;

  data: Array<{
    stock_id: number;
    code: string;
    name: string;
    current_price: number;
    change_pct: number;

    // ========== 满足的条件详情 ==========
    matched_conditions: {
      chanlun_buy?: {
        types: string[];
        signal_date: string;
      };
      fractal?: {
        types: string[];
        fx_date: string;
        quality_score: number;
      };
      kdj_cross?: {
        periods: string[];
        latest_cross_date: string;
      };
      macd_cross?: {
        periods: string[];
        latest_cross_date: string;
      };
    };

    // ========== 综合评分 ==========
    match_count: number;  // 满足几个条件
    match_ratio: number;  // 满足比例
  }>;
}
```

### 3.3 API 接口

```yaml
POST /api/v1/screener/run

# 示例请求1：纯KDJ多周期金叉
{
  "kdj_cross": {
    "enabled": true,
    "periods": ["1d", "1w", "1m"],
    "days_within": 30
  },
  "sort_by": "change_pct",
  "sort_order": "desc",
  "page": 1,
  "page_size": 20
}

# 示例请求2：买点 + 双MACD
{
  "chanlun_buy": {
    "enabled": true,
    "types": ["1_buy", "2_buy"],
    "require_current": true
  },
  "macd_cross": {
    "enabled": true,
    "periods": ["1w", "1m"],
    "days_within": 30
  },
  "sort_by": "match_count",
  "sort_order": "desc"
}

# 示例请求3：底分型 + KDJ + 价格
{
  "fractal": {
    "enabled": true,
    "types": ["bottom_fx"],
    "periods": ["1d"],
    "require_confirmed": false,
    "min_quality_score": 70
  },
  "kdj_cross": {
    "enabled": true,
    "periods": ["1m"],
    "days_within": 30
  },
  "price_range": {
    "enabled": true,
    "min": 10,
    "max": 50
  }
}
```

---

## 四、后端算法设计

### 4.1 条件检查器设计

```rust
// 条件检查器 Trait
pub trait ConditionChecker {
    fn check(&self, stock_id: i64, db: &Database) -> ConditionResult;
}

// 缠论买点检查器
pub struct ChanlunBuyChecker {
    types: Vec<SignalType>,
    require_current: bool,
}

impl ConditionChecker for ChanlunBuyChecker {
    fn check(&self, stock_id: i64, db: &Database) -> ConditionResult {
        // 检查是否有符合条件的买点
        // ...
    }
}

// KDJ金叉检查器
pub struct KDJCrossChecker {
    periods: Vec<Period>,
    days_within: i32,
}

impl ConditionChecker for KDJCrossChecker {
    fn check(&self, stock_id: i64, db: &Database) -> ConditionResult {
        // 检查每个周期是否有KDJ金叉
        // ...
    }
}

// MACD金叉检查器
pub struct MACDCrossChecker {
    periods: Vec<Period>,
    days_within: i32,
}

impl ConditionChecker for MACDCrossChecker {
    fn check(&self, stock_id: i64, db: &Database) -> ConditionResult {
        // ...
    }
}

// 分型检查器
pub struct FractalChecker {
    types: Vec<FXType>,
    periods: Vec<Period>,
    require_confirmed: bool,
    min_quality_score: f64,
    days_within: Option<i32>,
}

impl ConditionChecker for FractalChecker {
    fn check(&self, stock_id: i64, db: &Database) -> ConditionResult {
        // ...
    }
}
```

### 4.2 选股引擎

```rust
// 选股引擎
pub struct ScreenerEngine {
    db_pool: Pool,
    checkers: Vec<Box<dyn ConditionChecker>>,
}

impl ScreenerEngine {
    /// 执行选股
    pub async fn screen(&self, request: &ScreenerRequest) -> Result<ScreenerResponse> {
        // 1. 构建检查器列表
        let checkers = self.build_checkers(request);

        // 2. 获取所有股票（或根据价格条件预过滤）
        let mut stocks = self.get_all_stocks(request).await?;

        // 3. 逐个检查每只股票
        let mut results = Vec::new();

        for stock in stocks {
            let matched = self.check_stock(&stock, &checkers).await?;

            if matched.condition_count > 0 {
                results.push(matched);
            }
        }

        // 4. 排序和分页
        let sorted = self.sort_results(results, request);
        let paginated = self.paginate(sorted, request);

        Ok(ScreenerResponse {
            total: paginated.len(),
            page: request.page,
            page_size: request.page_size,
            data: paginated,
        })
    }

    /// 构建检查器
    fn build_checkers(&self, request: &ScreenerRequest) -> Vec<Box<dyn ConditionChecker>> {
        let mut checkers: Vec<Box<dyn ConditionChecker>> = Vec::new();

        // 缠论买点检查器
        if let Some(ref cond) = request.chanlun_buy {
            if cond.enabled {
                checkers.push(Box::new(ChanlunBuyChecker {
                    types: cond.types.clone(),
                    require_current: cond.require_current,
                }));
            }
        }

        // KDJ金叉检查器
        if let Some(ref cond) = request.kdj_cross {
            if cond.enabled {
                checkers.push(Box::new(KDJCrossChecker {
                    periods: cond.periods.clone(),
                    days_within: cond.days_within,
                }));
            }
        }

        // MACD金叉检查器
        if let Some(ref cond) = request.macd_cross {
            if cond.enabled {
                checkers.push(Box::new(MACDCrossChecker {
                    periods: cond.periods.clone(),
                    days_within: cond.days_within,
                }));
            }
        }

        // 分型检查器
        if let Some(ref cond) = request.fractal {
            if cond.enabled {
                checkers.push(Box::new(FractalChecker {
                    types: cond.types.clone(),
                    periods: cond.periods.clone(),
                    require_confirmed: cond.require_confirmed,
                    min_quality_score: cond.min_quality_score.unwrap_or(0.0),
                    days_within: cond.days_within,
                }));
            }
        }

        // 笔方向检查器
        if let Some(ref cond) = request.bi_direction {
            if cond.enabled {
                checkers.push(Box::new(BiDirectionChecker {
                    direction: cond.direction.clone(),
                    periods: cond.periods.clone(),
                    min_length: cond.min_length,
                }));
            }
        }

        checkers
    }

    /// 检查单只股票
    async fn check_stock(
        &self,
        stock: &Stock,
        checkers: &[Box<dyn ConditionChecker>],
    ) -> Result<StockResult> {
        let mut matched_conditions = MatchedConditions::default();
        let mut condition_count = 0;

        for checker in checkers {
            let result = checker.check(stock.id, &self.db).await?;

            if result.matched {
                condition_count += 1;
                matched_conditions.merge(result.details);
            }
        }

        Ok(StockResult {
            stock_id: stock.id,
            code: stock.code.clone(),
            name: stock.name.clone(),
            current_price: stock.current_price,
            change_pct: stock.change_pct,
            matched_conditions,
            match_count: condition_count,
            match_ratio: condition_count as f64 / checkers.len() as f64,
        })
    }
}
```

---

## 五、前端设计

### 5.1 筛选面板（完全解耦卡片式）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  选股条件设置                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  【缠论买点】（可选）                                                         │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │  ☐ 第一类买点（1买）   ☐ 第二类买点（2买）   ☐ 第三类买点（3买）         │
│  │  ☐ 仅显示当前买点                                                   │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                             │
│  【分型筛选】（可选）                                                         │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │  ☐ 底分型（选买）   ☐ 顶分型（选卖）                                   │
│  │  周期: ☐日线  ☐周线  ☐月线                                            │
│  │  ☐ 要求已确认成笔   最低质量评分: [70]                                 │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                             │
│  【KDJ金叉】（可选）                                                         │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │  ☐ 日线KDJ金叉   ☐ 周线KDJ金叉   ☐ 月线KDJ金叉                        │
│  │  金叉发生在最近: [30] 天内                                                  │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                             │
│  【MACD金叉】（可选）                                                        │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │  ☐ 日线MACD金叉   ☐ 周线MACD金叉   ☐ 月线MACD金叉                       │
│  │  金叉发生在最近: [30] 天内                                                  │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                             │
│  【价格区间】（可选）                                                         │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │  最低价: [___] 元   最高价: [___] 元                                      │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                             │
│  【涨跌幅】（可选）                                                           │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │  最低: [___]%   最高: [___]%                                            │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                             │
│                              [开始筛选]   [重置条件]                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 条件卡片交互

```
当用户勾选某个条件时：
┌─────────────────────────────────────────────────────────┐
│  【KDJ金叉】 ✓ 已启用                                    │
│  ☐ 日线KDJ金叉   ● 周线KDJ金叉   ☐ 月线KDJ金叉          │
│  金叉发生在最近: [30] 天内                              │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│  提示：已添加 KDJ周线金叉 筛选条件                       │
│  当前满足条件数：1 / 6                                  │
└─────────────────────────────────────────────────────────┘

视觉效果：
- 已启用的卡片边框变蓝色
- 未启用的卡片变灰色
```

### 5.3 股票列表展示

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  筛选结果                                              共 12 只                          │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ 代码    │ 名称     │ 现价  │ 涨跌幅 │ 满足条件                              │ 满足度 │     │
├─────────┼──────────┼───────┼────────┼──────────────────────────────────────┼────────┼─────│
│ 000001  │ 平安银行 │ 12.50 │ +2.35% │ 周线KDJ金叉 + 月线KDJ金叉            │ 2/2   │[详情]│
│ 000002  │ 万科A    │  8.20 │ +1.20% │ 周线KDJ金叉                          │ 1/2   │[详情]│
│ 600036  │ 招商银行 │ 35.80 │ -0.50% │ 周线KDJ金叉 + 月线KDJ金叉 + 底分型  │ 3/2   │[详情]│
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ 说明：满足度 = 满足条件数 / 要求的条件数                                        │
│       "2/2" 表示同时满足周线和月线KDJ金叉                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 条件组合可视化

```
┌────────────────────────────────────────────────────────────────┐
│  当前筛选条件                                                    │
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐                        │
│  │ 周线KDJ金叉  │  AND │ 月线KDJ金叉  │                        │
│  │ ✓ 5天前     │      │ ✓ 12天前     │                        │
│  └──────────────┘      └──────────────┘                        │
│                                                                 │
│  逻辑关系：所有启用条件 AND                                      │
│  当前：同时满足 2 个条件                                         │
└────────────────────────────────────────────────────────────────┘
```

---

## 六、常见组合策略预设

### 6.1 预设策略库

```yaml
presets:
  - name: "多周期KDJ共振"
    description: "日周月三周期KDJ同时金叉"
    conditions:
      kdj_cross:
        enabled: true
        periods: ["1d", "1w", "1m"]
        days_within: 30

  - name: "一买+KDJ"
    description: "第一类买点配合日线KDJ金叉"
    conditions:
      chanlun_buy:
        enabled: true
        types: ["1_buy"]
        require_current: true
      kdj_cross:
        enabled: true
        periods: ["1d"]
        days_within: 30

  - name: "底分型早期发现"
    description: "高质量底分型，不要求成笔"
    conditions:
      fractal:
        enabled: true
        types: ["bottom_fx"]
        periods: ["1d"]
        require_confirmed: false
        min_quality_score: 75

  - name: "二买+双MACD"
    description: "第二类买点配合周线和月线MACD金叉"
    conditions:
      chanlun_buy:
        enabled: true
        types: ["2_buy"]
        require_current: true
      macd_cross:
        enabled: true
        periods: ["1w", "1m"]
        days_within: 30

  - name: "三周期底分型共振"
    description: "日周月同时出现底分型"
    conditions:
      fractal:
        enabled: true
        types: ["bottom_fx"]
        periods: ["1d", "1w", "1m"]
        require_confirmed: false
        min_quality_score: 70
```

---

## 七、数据处理流程

```
选股请求
    │
    ▼
┌─────────────────────────────────────────┐
│  1. 构建检查器列表                        │
│     ├── 缠论买点检查器（如果启用）          │
│     ├── KDJ金叉检查器（如果启用）          │
│     ├── MACD金叉检查器（如果启用）         │
│     ├── 分型检查器（如果启用）             │
│     └── 价格/涨跌幅检查器（如果启用）       │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  2. 预过滤（可选）                        │
│     └── 根据价格/涨跌幅快速过滤           │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  3. 逐股票检查                            │
│     ┌─────────────────────────────────┐ │
│     │  股票A                           │ │
│     │  ├── 缠论买点检查 → ✓ 匹配      │ │
│     │  ├── KDJ金叉检查 → ✓ 匹配      │ │
│     │  └── MACD检查 → ✗ 不匹配        │ │
│     │                                   │ │
│     │  结果：满足2/3条件 → 保留        │ │
│     └─────────────────────────────────┘ │
│     ┌─────────────────────────────────┐ │
│     │  股票B                           │ │
│     │  └── ...                         │ │
│     └─────────────────────────────────┘ │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  4. 排序和分页                          │
│     ├── 按满足条件数排序                 │
│     ├── 按涨跌幅排序                     │
│     └── 分页返回                         │
└─────────────────────────────────────────┘
    │
    ▼
选股结果
```

---

## 八、性能优化

### 8.1 索引优化

```sql
-- 为各类信号创建复合索引
CREATE INDEX idx_signals_buy_current
ON cs_signals (signal_type, is_current, signal_date DESC)
WHERE signal_type IN ('1_buy', '2_buy', '3_buy');

CREATE INDEX idx_fx_bottom_current
ON cs_fx_signals (fx_type, is_current, fx_date DESC)
WHERE fx_type = 'bottom_fx';

CREATE INDEX idx_cross_kdj_gold
ON cs_cross_signals (stock_id, signal_type, signal_date DESC)
WHERE signal_type = 'kdj_gold_cross';

CREATE INDEX idx_cross_macd_gold
ON cs_cross_signals (stock_id, signal_type, signal_date DESC)
WHERE signal_type = 'macd_gold_cross';
```

### 8.2 缓存策略

```rust
// 热门条件组合结果缓存
pub struct ScreenerCache {
    cache: Cache<String, CachedResult>,
}

impl ScreenerCache {
    pub fn get_cache_key(request: &ScreenerRequest) -> String {
        // 根据启用的条件生成缓存key
        let mut parts = Vec::new();

        if let Some(ref c) = request.chanlun_buy {
            if c.enabled {
                parts.push(format!("cb:{:?}", c.types));
            }
        }
        if let Some(ref c) = request.kdj_cross {
            if c.enabled {
                parts.push(format!("kdj:{:?}:{}", c.periods, c.days_within));
            }
        }
        // ...

        parts.join("|")
    }
}
```

---

## 九、错误处理

### 9.1 空条件处理

```rust
// 如果没有任何启用条件，返回错误
if request.no_conditions_enabled() {
    return Err(ScreenerError::NoConditions);
}

// 如果只有价格条件，允许返回全市场股票
if request.only_price_conditions() {
    // 返回符合价格条件的所有股票
}

// 如果启用多个条件，要求必须全部满足（AND逻辑）
```
