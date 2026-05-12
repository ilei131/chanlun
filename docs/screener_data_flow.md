# 缠论选股系统 - 数据流程文档

## 1. 系统架构概述

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              前端层 (React)                                  │
│                          [用户界面 - 选股配置]                                │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ HTTP POST
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                       后端 API 层 (Rust + Actix-web)                         │
│                    [POST /api/v1/screener/run]                              │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                        数据库层 (PostgreSQL)                                 │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  stocks  │  │  klines  │  │  cs_signals     │  │ cs_cross_signals│     │
│  │(股票信息) │  │(K线数据) │  │(缠论买卖点信号) │  │(金叉死叉信号)   │     │
│  └──────────┘  └──────────┘  └─────────────────┘  └─────────────────┘     │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│                      数据采集层 (Python + AKShare)                           │
│              [定时更新 - 股票列表 / K线数据 / 信号计算]                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 完整数据流程

### 2.1 数据采集流程（离线/定时）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  阶段 1: 数据采集初始化                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  1.1 从环境变量加载配置 (DB_HOST, DB_PORT, DB_NAME, 等)                      │
│                                                                              │
│  文件: data_collector/config.py                                              │
│  相关: [DatabaseConfig] [CollectorConfig]                                    │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  阶段 2: 股票列表采集                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  2.1 调用 AKShare API 获取沪深京所有A股股票列表                              │
│      - sh_a_spot_em (上海A股)                                               │
│      - sz_a_spot_em (深圳A股)                                               │
│      - bj_a_spot_em (北京A股)                                               │
│                                                                              │
│  2.2 数据清洗和格式化                                                         │
│      - 提取股票代码、名称、市场                                              │
│      - 标记活跃/退市状态                                                     │
│      - 合并三个市场数据                                                      │
│                                                                              │
│  2.3 批量 upsert 到 PostgreSQL `stocks` 表                                  │
│      - 使用 UNIQUE(code) 约束去重                                           │
│      - 更新已存在股票的信息                                                 │
│      - 新增新股票                                                           │
│                                                                              │
│  文件: data_collector/data_source.py [AKShareDataSource::get_stock_list]    │
│  文件: data_collector/collector.py [StockCollector::collect_stock_list]    │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  阶段 3: K线数据采集                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  3.1 遍历所有活跃股票                                                       │
│      - 按市场分组 (SH, SZ, BJ)                                              │
│      - 按周期处理 (1d, 1w, 1m)                                              │
│                                                                              │
│  3.2 增量获取逻辑                                                           │
│      - 查询该股票在数据库中的最后交易日 (MAX(trade_date))                  │
│      - 如果存在历史数据，从上次日期后一天开始获取                           │
│      - 如果不存在，从默认起始日期 (HISTORY_START_DATE) 开始获取             │
│                                                                              │
│  3.3 调用 AKShare API 获取K线                                               │
│      - stock_zh_a_hist(period='daily'|'weekly'|'monthly', ...)             │
│      - 获取开/高/低/收/量/额/换手率                                         │
│      - 使用前复权 (adjust='qfq')                                            │
│                                                                              │
│  3.4 批量 upsert 到 `klines` 表                                             │
│      - UNIQUE(stock_id, trade_date, period)                               │
│      - 若存在冲突则更新数据                                                 │
│      - 记录更新日志到 `data_update_log`                                    │
│                                                                              │
│  文件: data_collector/collector.py [StockCollector::collect_kline_for_stock]│
│  文件: data_collector/collector.py [StockCollector::collect_klines_batch]  │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  阶段 4: 技术指标计算 (待实现)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  4.1 计算移动平均线 (MA5, MA10, MA20, MA30, MA60, MA120, MA250)            │
│  4.2 计算 MACD (DIF, DEA, HIST)                                            │
│  4.3 计算 KDJ (K, D, J)                                                     │
│  4.4 计算 RSI (RSI6, RSI12, RSI24)                                          │
│  4.5 计算布林带 (BOLL_UPPER, BOLL_MID, BOLL_LOWER)                          │
│  4.6 保存到 `technical_indicators` 表                                      │
│                                                                              │
│  位置: 待实现 (algorithms/ 模块)                                            │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  阶段 5: 缠论结构计算 (待实现)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  5.1 分形识别 (FX) - 顶/底分型                                             │
│  5.2 笔识别 (BI) - 向上/向下笔                                             │
│  5.3 线段识别 (XD) - 向上/向下线段                                         │
│  5.4 中枢识别 (ZS) - 震荡区间                                              │
│  5.5 买卖点检测 (SIGNAL) - 一/二/三买卖点                                  │
│  5.6 保存到对应表 (cs_bi, cs_xd, cs_zs, cs_signals)                        │
│                                                                              │
│  文件: backend/src/algorithms/fractal.rs                                    │
│  文件: backend/src/algorithms/bi.rs                                         │
│  文件: backend/src/algorithms/xd.rs                                         │
│  文件: backend/src/algorithms/zs.rs                                         │
│  文件: backend/src/algorithms/signal.rs                                     │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  阶段 6: 交叉信号计算 (待实现)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  6.1 KDJ金叉/死叉检测 (kdj_gold_cross / kdj_dead_cross)                     │
│  6.2 MACD金叉/死叉检测 (macd_gold_cross / macd_dead_cross)                  │
│  6.3 保存到 `cs_cross_signals` 表                                          │
│                                                                              │
│  文件: backend/src/algorithms/cross.rs                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 选股执行流程（在线/实时）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  步骤 1: 接收选股请求                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  前端 POST 到 /api/v1/screener/run                                         │
│                                                                              │
│  请求示例:                                                                  │
│  {                                                                          │
│    "chanlun_buy": {                                                         │
│      "enabled": true,                                                       │
│      "types": ["1_buy", "2_buy", "3_buy"],                                  │
│      "require_current": true                                                │
│    },                                                                       │
│    "kdj_cross": {                                                           │
│      "enabled": true,                                                       │
│      "periods": ["1d", "1w"],                                               │
│      "days_within": 30                                                      │
│    },                                                                       │
│    "macd_cross": {                                                          │
│      "enabled": true,                                                       │
│      "periods": ["1d"],                                                     │
│      "days_within": 30                                                      │
│    },                                                                       │
│    "page": 1,                                                               │
│    "page_size": 20                                                          │
│  }                                                                          │
│                                                                              │
│  文件: backend/src/api/screener.rs [ScreenerRequest]                        │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  步骤 2: 解析参数并初始化                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  2.1 提取分页参数                                                          │
│      - page: 当前页码 (默认 1)                                             │
│      - page_size: 每页数量 (默认 20)                                       │
│      - offset: 计算偏移量 (page - 1) * page_size                           │
│                                                                              │
│  2.2 初始化计数变量                                                         │
│      - conditions_enabled: 已启用的条件数量                                 │
│      - stock_ids: 收集符合条件的股票ID                                     │
│                                                                              │
│  文件: backend/src/api/screener.rs [run_screener: L109-117]                │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  步骤 3: 条件 1 - 缠论买点筛选 (如果启用)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  3.1 检查条件是否启用且不为空                                               │
│      - if (chanlun_buy.enabled && !chanlun_buy.types.is_empty())           │
│                                                                              │
│  3.2 构建 SQL 查询                                                          │
│      SELECT DISTINCT stock_id FROM cs_signals                               │
│      WHERE signal_type IN (?, ?, ?)                                         │
│        AND is_current = ?                                                  │
│                                                                              │
│  3.3 执行查询                                                               │
│      - 绑定 signal_types 参数                                              │
│      - 绑定 require_current 参数                                           │
│      - 获取符合条件的 stock_ids                                            │
│      - 将股票ID添加到 stock_ids 集合                                       │
│      - conditions_enabled += 1                                             │
│                                                                              │
│  查询表: cs_signals (缠论买卖点信号表)                                      │
│  索引: idx_signals_stock, idx_signals_type, idx_signals_current            │
│                                                                              │
│  文件: backend/src/api/screener.rs [L118-143]                               │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  步骤 4: 条件 2 - KDJ金叉筛选 (如果启用)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  4.1 检查条件是否启用且不为空                                               │
│      - if (kdj_cross.enabled && !kdj_cross.periods.is_empty())            │
│                                                                              │
│  4.2 构建 SQL 查询                                                          │
│      SELECT DISTINCT stock_id FROM cs_cross_signals                        │
│      WHERE signal_type = 'kdj_gold_cross'                                  │
│        AND period IN (?, ?)                                                │
│                                                                              │
│  4.3 执行查询                                                               │
│      - 绑定 periods 参数                                                   │
│      - 获取符合条件的 stock_ids                                            │
│      - 将股票ID添加到 stock_ids 集合                                       │
│      - conditions_enabled += 1                                             │
│                                                                              │
│  查询表: cs_cross_signals (交叉信号表)                                      │
│  索引: idx_cross_signals_stock, idx_cross_signals_type                     │
│                                                                              │
│  文件: backend/src/api/screener.rs [L146-170]                               │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  步骤 5: 条件 3 - MACD金叉筛选 (如果启用)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  5.1 检查条件是否启用且不为空                                               │
│      - if (macd_cross.enabled && !macd_cross.periods.is_empty())          │
│                                                                              │
│  5.2 构建 SQL 查询                                                          │
│      SELECT DISTINCT stock_id FROM cs_cross_signals                        │
│      WHERE signal_type = 'macd_gold_cross'                                 │
│        AND period IN (?, ?)                                                │
│                                                                              │
│  5.3 执行查询                                                               │
│      - 绑定 periods 参数                                                   │
│      - 获取符合条件的 stock_ids                                            │
│      - 将股票ID添加到 stock_ids 集合                                       │
│      - conditions_enabled += 1                                             │
│                                                                              │
│  查询表: cs_cross_signals (交叉信号表)                                      │
│  索引: idx_cross_signals_stock, idx_cross_signals_type                     │
│                                                                              │
│  文件: backend/src/api/screener.rs [L173-197]                               │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  步骤 6: 合并结果并过滤                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  6.1 判断是否有启用的条件且有匹配的股票                                     │
│      - if (conditions_enabled > 0 && !stock_ids.is_empty())               │
│                                                                              │
│  6.2 【AND 逻辑】只选择满足所有条件的股票                                  │
│      - 使用 HashMap 统计每个股票ID出现的次数                               │
│      - 只保留出现次数 == conditions_enabled 的股票                         │
│                                                                              │
│  6.3 如果无启用条件或无匹配结果                                            │
│      - 回退到获取所有活跃股票 (SELECT id FROM stocks WHERE is_active=true) │
│                                                                              │
│  示例:                                                                      │
│  - 条件1筛选出: [1, 2, 3, 4, 5]                                             │
│  - 条件2筛选出: [2, 3, 5, 6, 7]                                             │
│  - 条件3筛选出: [3, 5, 8, 9]                                                │
│  - 最终结果: [3, 5] (3次都匹配)                                            │
│                                                                              │
│  文件: backend/src/api/screener.rs [L200-217]                               │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  步骤 7: 分页处理                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  7.1 计算总数 (total = final_stock_ids.len())                              │
│                                                                              │
│  7.2 从最终结果中截取当前页的数据                                           │
│      - skip(offset)                                                         │
│      - take(page_size)                                                      │
│      - 得到 paginated_ids                                                  │
│                                                                              │
│  文件: backend/src/api/screener.rs [L219-224]                               │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  步骤 8: 查询股票详情                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  8.1 构建 SQL 查询                                                          │
│      SELECT id, code, name, market, ... FROM stocks                        │
│      WHERE id IN (?, ?, ?, ...)                                            │
│                                                                              │
│  8.2 执行查询                                                               │
│      - 绑定 paginated_ids                                                  │
│      - 获取股票完整信息                                                     │
│                                                                              │
│  查询表: stocks (股票基础信息表)                                            │
│  索引: idx_stocks_code, idx_stocks_active                                  │
│                                                                              │
│  文件: backend/src/api/screener.rs [L235-251]                               │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  步骤 9: 构建响应数据                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  9.1 转换为 ScreenerResult 结构                                            │
│      - stock_id, code, name                                                │
│      - current_price: None (待实现)                                         │
│      - change_pct: None (待实现)                                           │
│      - matched_conditions: 默认空 (待实现)                                 │
│      - match_count: conditions_enabled                                    │
│      - match_ratio: 1.0 (全部匹配)                                         │
│                                                                              │
│  9.2 构建完整响应                                                           │
│      {                                                                      │
│        total: 总数量,                                                       │
│        page: 当前页,                                                       │
│        page_size: 每页数量,                                                │
│        data: [ScreenerResult, ...]                                          │
│      }                                                                      │
│                                                                              │
│  文件: backend/src/api/screener.rs [L253-272]                               │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  步骤 10: 返回给前端                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  响应格式:                                                                  │
│  HTTP 200 OK                                                                │
│  Content-Type: application/json                                            │
│                                                                              │
│  {                                                                          │
│    "total": 150,                                                            │
│    "page": 1,                                                               │
│    "page_size": 20,                                                         │
│    "data": [                                                                │
│      {                                                                      │
│        "stock_id": 1,                                                       │
│        "code": "000001",                                                    │
│        "name": "平安银行",                                                  │
│        "current_price": null,                                               │
│        "change_pct": null,                                                 │
│        "matched_conditions": {},                                             │
│        "match_count": 3,                                                   │
│        "match_ratio": 1.0                                                  │
│      }                                                                      │
│    ]                                                                        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 核心数据模型

### 3.1 数据库表关系图

```
┌─────────────────┐
│     stocks      │  股票基础信息表
│  ────────────── │
│  id (PK)        │
│  code (UNIQUE)  │
│  name           │
│  market         │
│  is_active      │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────▼───────────────────────────────────────────────────────┐
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │     klines       │  │cs_signals        │  │cs_cross_signals │ │
│  │K线数据表        │  │缠论买卖点信号表  │  │金叉死叉信号表    │ │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤ │
│  │id (PK)          │  │id (PK)          │  │id (PK)          │ │
│  │stock_id (FK)    │  │stock_id (FK)    │  │stock_id (FK)    │ │
│  │trade_date       │  │signal_type      │  │signal_type      │ │
│  │period           │  │signal_date      │  │signal_date      │ │
│  │open/high/low/   │  │is_current       │  │is_current       │ │
│  │close/volume     │  └─────────────────┘  └─────────────────┘ │
│  └─────────────────┘                                               │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │cs_bi            │  │cs_xd             │  │cs_zs             │ │
│  │笔表             │  │线段表            │  │中枢表            │ │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤ │
│  │id (PK)          │  │id (PK)          │  │id (PK)          │ │
│  │stock_id (FK)    │  │stock_id (FK)    │  │stock_id (FK)    │ │
│  │bi_no            │  │xd_no            │  │zs_no            │ │
│  │bi_type          │  │xd_type          │  │zg/zd            │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### 3.2 关键表结构

| 表名 | 描述 | 主要字段 | 索引 |
|------|------|----------|------|
| `stocks` | 股票基础信息 | id, code, name, market, is_active | idx_stocks_code, idx_stocks_active |
| `klines` | K线数据 | id, stock_id, trade_date, period, OHLCV | idx_klines_stock_date, idx_klines_stock_period |
| `cs_signals` | 缠论买卖点信号 | id, stock_id, signal_type, signal_date, is_current | idx_signals_stock, idx_signals_type, idx_signals_current |
| `cs_cross_signals` | KDJ/MACD金叉死叉信号 | id, stock_id, signal_type, period, is_current | idx_cross_signals_stock, idx_cross_signals_type |
| `data_update_log` | 数据更新日志 | id, data_type, period, status, count | idx_log_type_status, idx_log_created |

---

## 4. 关键技术点

### 4.1 数据库索引设计

**当前索引（已实现）**:
```sql
-- cs_signals 表索引
CREATE INDEX idx_signals_stock ON cs_signals(stock_id, period);
CREATE INDEX idx_signals_type ON cs_signals(signal_type);
CREATE INDEX idx_signals_current ON cs_signals(stock_id, is_current);
CREATE INDEX idx_signals_date ON cs_signals(signal_date DESC);

-- cs_cross_signals 表索引
CREATE INDEX idx_cross_signals_stock ON cs_cross_signals(stock_id, period);
CREATE INDEX idx_cross_signals_type ON cs_cross_signals(signal_type);
CREATE INDEX idx_cross_signals_date ON cs_cross_signals(signal_date DESC);
CREATE INDEX idx_cross_signals_efficient ON cs_cross_signals (stock_id, signal_type, signal_date DESC);
```

**建议优化索引**:
```sql
-- 优化选股查询的复合索引
CREATE INDEX idx_signals_composite ON cs_signals(signal_type, is_current, stock_id);
CREATE INDEX idx_cross_composite ON cs_cross_signals(signal_type, period, stock_id);
```

### 4.2 查询优化策略

1. **使用 UNIQUE 约束实现 Upsert**:
   ```sql
   -- klines 表使用:
   UNIQUE(stock_id, trade_date, period)
   -- 避免重复数据，支持增量更新
   ```

2. **AND 逻辑通过计数实现**:
   ```rust
   // 统计每个股票ID出现的次数
   let mut id_counts: HashMap<i32, usize> = HashMap::new();
   // 只保留匹配所有条件的（count == conditions_enabled）
   ```

3. **分页在内存中实现**:
   - 先得到所有符合条件的ID
   - 在内存中做 skip/take
   - 最后只查询当前页的股票详情

---

## 5. 待实现/改进功能

### 5.1 当前已实现
- ✅ 基础API结构和路由
- ✅ 数据库表设计和初始化
- ✅ Python数据采集器框架（AKShare）
- ✅ 股票列表和K线数据采集
- ✅ 选股API的基础条件筛选（AND逻辑）
- ✅ 数据模型和ORM结构

### 5.2 待实现功能
- ⏳ 技术指标计算模块（MA/MACD/KDJ/RSI/BOLL）
- ⏳ 缠论结构算法实现（分形/笔/线段/中枢）
- ⏳ 买卖点信号识别
- ⏳ KDJ/MACD金叉死叉检测
- ⏳ 分形条件筛选
- ⏳ 价格范围条件筛选
- ⏳ 排序功能（sort_by / sort_order）
- ⏳ 匹配条件详情填充（matched_conditions）
- ⏳ 当前价格和涨跌幅查询
- ⏳ 选股结果缓存（stock_screener_results_ext 表）
- ⏳ 预定义选股策略
- ⏳ 异步任务队列（提高选股性能）

### 5.3 性能优化建议
1. **物化视图**: 为常用筛选条件创建物化视图
2. **数据分区**: 对 klines 表按时间分区
3. **Redis缓存**: 缓存热点股票的信号数据
4. **异步并发**: 选股条件查询改为异步并发执行
5. **分批处理**: 大规模选股时用游标或分批查询

---

## 6. 时序图

```
前端         API层         数据库层
  │             │             │
  ├──POST─────>│             │  请求选股
  │             ├───SELECT──>│  查缠论信号
  │             │<──rows────│  返回股票ID
  │             │             │
  │             ├───SELECT──>│  查KDJ金叉
  │             │<──rows────│  返回股票ID
  │             │             │
  │             ├───SELECT──>│  查MACD金叉
  │             │<──rows────│  返回股票ID
  │             │             │
  │             ├─[过滤]─┐  │  合并结果取交集
  │             │         │  │
  │             ├───SELECT──>│  查股票详情
  │             │<──rows────│  返回股票信息
  │<──JSON──────┤             │  返回选股结果
  │             │             │
```

---

## 7. 文件索引

| 文件路径 | 描述 |
|----------|------|
| `database/schema.sql` | 数据库表结构定义 |
| `backend/src/db/models.rs` | 数据库模型（Stock, Kline, 等） |
| `backend/src/db/mod.rs` | 数据库连接和表初始化 |
| `backend/src/api/screener.rs` | 选股API实现 |
| `backend/src/algorithms/` | 缠论算法模块（待实现） |
| `data_collector/config.py` | 数据采集器配置 |
| `data_collector/database.py` | 数据库操作封装 |
| `data_collector/data_source.py` | AKShare数据源实现 |
| `data_collector/collector.py` | 数据采集器主逻辑 |
| `data_collector/main.py` | 命令行入口 |
| `docs/api_design.md` | API设计文档 |

---

*文档生成时间: 2024-05*
