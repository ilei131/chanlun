# 缠论选股系统 - 项目开发规则

## 1. 代码注释规范

### 1.1 后端 (Rust)

#### 结构体/枚举注释
```rust
/// 缠论分析器
/// 封装 czsc_core 库的 CZSC 分析功能，提供股票数据的缠论分析
/// 包括分型识别、笔段划分、中枢检测、买卖点信号生成
pub struct ChanlunAnalyzer {
    /// 内部 czsc 分析器实例
    analyzer: CZSC,
}
```

#### 方法/函数注释
```rust
/// 检测买卖点信号
/// 
/// # 逻辑说明
/// - 一买：下跌笔跌破中枢下沿(ZD)且创新低
/// - 二买：下跌笔在中枢内结束且高于一买位置
/// - 三买：上涨笔突破中枢上沿(ZG)后回踩不破ZG
/// 
/// # 参数
/// - 无（使用内部已分析的笔和中枢数据）
/// 
/// # 返回值
/// - Vec<BuySignal>: 检测到的买卖信号列表，按时间排序
/// 
/// # 注意事项
/// - 需要至少5根笔才能进行有效分析
/// - 信号会去重（同一天同类型信号只保留一个）
pub fn detect_buy_signals(&self) -> Vec<BuySignal> {
    // 实现...
}
```

#### 复杂算法注释
```rust
/// 计算MACD指标
/// 
/// # 算法步骤
/// 1. 计算12日EMA: EMA12 = 前一日EMA12 × 11/13 + 今日收盘 × 2/13
/// 2. 计算26日EMA: EMA26 = 前一日EMA26 × 25/27 + 今日收盘 × 2/27
/// 3. 计算DIF: DIF = EMA12 - EMA26
/// 4. 计算DEA: DEA = 前一日DEA × 8/10 + 今日DIF × 2/10
/// 5. 计算MACD柱: MACD = (DIF - DEA) × 2
fn calculate_macd(&self, prices: &[f64]) -> Vec<MacdPoint> {
    // 实现...
}
```

### 1.2 前端 (TypeScript/React)

#### 组件注释
```typescript
/**
 * 股票详情页组件
 * 
 * 功能：
 * - 展示股票基础信息（名称、代码、价格、涨跌幅）
 * - 展示K线图、MACD图、KDJ图
 * - 展示缠论分析结果（分型、笔、中枢、买卖点信号）
 * - 支持日K/周K/月K切换
 * 
 * 数据来源：
 * - 股票基础信息：Tushare API
 * - K线数据：Tushare API
 * - 缠论分析：后端 czsc 分析引擎
 */
function StockDetail() {
    // 实现...
}
```

#### 钩子函数注释
```typescript
/**
 * 获取当前股票特征
 * 
 * 分析最新的技术指标和缠论信号，生成特征标签
 * 
 * @returns {string[]} 特征列表，如 ['KDJ金叉', 'MACD金叉', '一买', '有中枢']
 * 
 * @example
 * const features = getCurrentFeatures();
 * // 返回: ['KDJ金叉', '一买']
 */
const getCurrentFeatures = (): string[] => {
    // 实现...
}
```

#### API函数注释
```typescript
/**
 * 搜索股票
 * 
 * 根据关键词搜索股票，支持股票代码或名称模糊匹配
 * 
 * @param keyword - 搜索关键词，如 "600519" 或 "茅台"
 * @returns {Promise<SearchResult[]>} 搜索结果列表
 * @throws {Error} 当网络请求失败时抛出
 * 
 * @example
 * const results = await stockApi.search('茅台');
 * console.log(results[0].name); // "贵州茅台"
 */
search: async (keyword: string): Promise<ApiResponse<SearchResult[]>> => {
    // 实现...
}
```

## 2. 缠论核心概念说明

### 2.1 分型 (Fractal)
- **顶分型**：中间K线的高点最高，且低点也最高（至少3根K线）
- **底分型**：中间K线的低点最低，且高点也最低（至少3根K线）
- **实现**：由 czsc_core 库自动识别

### 2.2 笔 (BI)
- **定义**：相邻的顶分型和底分型之间的连接
- **条件**：顶底之间至少有1根独立K线
- **方向**：向上笔（底→顶）或向下笔（顶→底）
- **实现**：由 czsc_core 库自动连接

### 2.3 线段 (XD)
- **定义**：由至少三笔组成的走势结构
- **特征**：线段有方向，可被更大级别中枢包含
- **实现**：由 czsc_core 库自动构建

### 2.4 中枢 (ZS)
- **定义**：三个连续次级别走势类型的重叠区间
- **要素**：
  - ZG（中枢上沿）：重叠区间的最高点
  - ZD（中枢下沿）：重叠区间的最低点
  - GG（高点）：构成中枢的所有笔的最高点
  - DD（低点）：构成中枢的所有笔的最低点
- **实现**：本项目 `detect_zs` 函数实现

### 2.5 买卖点信号
- **一买**：下跌笔跌破中枢下沿且创新低（背驰点）
- **二买**：下跌笔在中枢内结束，高于一买位置
- **三买**：上涨笔突破中枢上沿后回踩不破ZG
- **一卖/二卖/三卖**：与买点对称的卖出信号

## 3. 项目架构说明

### 3.1 后端架构
```
backend/src/
├── api/                    # API路由层
│   ├── stocks.rs          # 股票相关API
│   ├── screener.rs        # 选股条件API
│   └── indicators.rs      # 技术指标API
├── algorithms/            # 算法核心层
│   ├── czsc_integration.rs # czsc库集成（缠论分析）
│   ├── signal.rs          # 信号检测算法
│   ├── fractal.rs         # 分型检测（备用实现）
│   ├── bi.rs              # 笔划分算法（备用实现）
│   ├── zs.rs              # 中枢检测算法（备用实现）
│   └── cross.rs           # 均线交叉检测
├── db/                    # 数据访问层
│   ├── models.rs          # 数据模型定义
│   └── mod.rs             # 数据库连接管理
├── tushare/               # Tushare API客户端
│   ├── client.rs          # HTTP客户端
│   └── mod.rs             # 接口定义
└── main.rs                # 应用入口
```

### 3.2 前端架构
```
frontend/src/
├── pages/                 # 页面组件
│   ├── StockSearch.tsx   # 选股大厅
│   ├── StockDetail.tsx   # 股票详情
│   ├── Screener.tsx      # 选股条件设置
│   ├── Signals.tsx       # 信号列表
│   └── Settings.tsx      # 系统设置
├── components/           # 通用组件
│   ├── KlineChart.tsx   # K线图组件
│   ├── MacdChart.tsx    # MACD图组件
│   └── KdjChart.tsx     # KDJ图组件
├── api/                  # API接口层
│   └── index.ts         # API函数定义
├── hooks/                # 自定义Hooks
├── utils/                # 工具函数
└── App.tsx              # 应用入口
```

## 4. 开发注意事项

### 4.1 czsc库使用规范
- **不要重复实现**：分型、笔、线段由czsc库自动处理
- **正确使用**：只需调用 `CZSC::new()` 和 `update_bar()`
- **获取结果**：通过 `bi_list`、`fx_list` 获取分析结果
- **信号检测**：基于czsc分析结果进行买卖点信号计算

### 4.2 数据流规范
```
Tushare API → 后端RawBar转换 → czsc分析 → 信号检测 → API响应 → 前端展示
```

### 4.3 错误处理
- 后端：使用 `Result<T, E>` 返回错误
- 前端：使用 try-catch 捕获API错误，展示友好提示

### 4.4 性能优化
- 后端：对频繁查询的数据添加缓存
- 前端：使用 useMemo/useCallback 优化渲染

## 5. 命名规范

### 5.1 后端 (Rust)
- 结构体：PascalCase，如 `ChanlunAnalyzer`
- 函数：snake_case，如 `detect_buy_signals`
- 常量：UPPER_SNAKE_CASE，如 `MAX_BI_NUM`
- 模块：snake_case，如 `czsc_integration`

### 5.2 前端 (TypeScript)
- 组件：PascalCase，如 `StockDetail`
- 函数/变量：camelCase，如 `getCurrentFeatures`
- 接口：PascalCase + I前缀（可选），如 `IStockDetail`
- 类型：PascalCase，如 `SearchResult`

## 6. 提交规范

### 6.1 提交信息格式
```
<type>(<scope>): <subject>

<body>

<footer>
```

### 6.2 类型说明
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

### 6.3 示例
```
feat(stock): 添加股票搜索功能

- 实现根据代码和名称模糊搜索
- 添加搜索结果列表展示
- 支持点击跳转详情页

Closes #123
```
