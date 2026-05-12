# 缠论选股系统 API 设计

## 技术栈
- **后端**: Rust + Actix-web + Diesel ORM + PostgreSQL
- **前端**: React + TypeScript + Ant Design / Material UI
- **实时数据**: WebSocket (可选)

---

## 核心模块

### 1. 数据管理模块

#### 1.1 K线数据
```
POST   /api/v1/klines/import          - 批量导入K线数据
GET    /api/v1/klines/:stock_id       - 获取K线数据
       ?period=1d|1w|1m
       &start_date=2024-01-01
       &end_date=2024-12-31

DELETE /api/v1/klines/:stock_id       - 删除股票K线数据
```

#### 1.2 技术指标计算
```
POST   /api/v1/indicators/calculate   - 计算技术指标（MA、MACD、KDJ）
       Body: { stock_ids: number[], period: string }
```

#### 1.3 缠论结构计算
```
POST   /api/v1/cs/calculate           - 计算缠论结构（笔、线段、中枢）
       Body: {
         stock_ids: number[],
         period: string,
         bi_config: { min_bi_length: 5 },     // 笔的最小K线数
         xd_config: { min_xd_bi_count: 3 }    // 线段最小笔数
       }

GET    /api/v1/cs/bi/:stock_id        - 获取笔
GET    /api/v1/cs/xd/:stock_id        - 获取线段
GET    /api/v1/cs/zs/:stock_id        - 获取中枢
```

#### 1.4 买卖点识别
```
POST   /api/v1/cs/signals/detect       - 检测买卖点
       Body: {
         stock_ids: number[],
         period: string,
         signal_types: ['1_buy', '2_buy', '3_buy']
       }

GET    /api/v1/cs/signals/:stock_id    - 获取股票买卖点历史
```

---

### 2. 选股模块

#### 2.1 选股接口（扩展版：支持多级别金叉筛选）
```
POST   /api/v1/screener/run            - 执行选股（支持缠论买点 + KDJ金叉 + MACD金叉组合筛选）
       Body: {
         period: '1d' | '1w' | '1m',
         
         // 缠论买点筛选
         chanlun_filters: {
           signal_types: ['1_buy', '2_buy', '3_buy'],
           require_current: true
         },
         
         // KDJ金叉筛选（可选）
         kdj_cross_filter?: {
           enabled: boolean,
           period: '1d' | '1w' | '1m',
           cross_within_days: number  // 默认30天
         },
         
         // MACD金叉筛选（可选）
         macd_cross_filter?: {
           enabled: boolean,
           period: '1d' | '1w' | '1m',
           cross_within_days: number  // 默认30天
         },
         
         // 其他筛选条件
         filters: {
           min_price: 0,
           max_price: 100
         },
         
         sort_by: 'signal_date' | 'kdj_cross_date' | 'macd_cross_date' | 'confidence',
         sort_order: 'asc' | 'desc',
         page: 1,
         page_size: 20
       }

Response:
{
  "total": 150,
  "page": 1,
  "page_size": 20,
  "data": [
    {
      "stock_id": 1,
      "code": "000001",
      "name": "平安银行",
      "current_price": 12.50,
      "change_pct": 2.35,
      
      "chanlun": {
        "signal_type": "2_buy",
        "signal_date": "2024-01-15",
        "confidence": 85.5,
        "zs_zg": 13.20,
        "zs_zd": 12.00
      },
      
      "kdj_cross": {
        "enabled": true,
        "cross_date": "2024-01-10",
        "cross_period": "1m",
        "days_since_cross": 5,
        "kdj_k": 65.5,
        "kdj_d": 60.2
      },
      
      "macd_cross": {
        "enabled": false,
        "cross_date": null,
        "cross_period": null,
        "days_since_cross": null,
        "macd_dif": null,
        "macd_dea": null
      }
    }
  ]
}
```

#### 2.2 预定义选股策略
```
GET    /api/v1/screener/strategies    - 获取预定义选股策略
POST   /api/v1/screener/save           - 保存自定义选股策略
```

---

### 3. 股票详情模块

#### 3.1 股票基础信息
```
GET    /api/v1/stocks/:code            - 获取股票基本信息
GET    /api/v1/stocks/list             - 股票列表
       ?market=SH|SZ|BJ
       &type=stock|index|fund
       &keyword=平安
       &page=1&page_size=20
```

#### 3.2 缠论图表数据
```
GET    /api/v1/chart/:stock_id         - 获取图表所需全部数据
       ?period=1d

Response:
{
  "stock_info": {
    "code": "000001",
    "name": "平安银行",
    "current_price": 12.50
  },

  "klines": [
    { "date": "2024-01-01", "open": 12.0, "high": 12.5, "low": 11.8, "close": 12.3, "volume": 1000000 }
  ],

  "indicators": {
    "ma": { "ma5": 12.2, "ma10": 12.0, "ma20": 11.8 },
    "macd": { "dif": 0.15, "dea": 0.10, "hist": 0.05 },
    "kdj": { "k": 75.5, "d": 70.2, "j": 86.1 }
  },

  "chanlun": {
    "bi": [
      { "no": 1, "start_date": "2024-01-01", "end_date": "2024-01-15", "type": "up", "start_price": 11.5, "end_price": 13.0 }
    ],
    "xd": [...],
    "zs": [
      {
        "no": 1,
        "zg": 13.20,
        "zd": 12.00,
        "gg": 13.50,
        "dd": 11.80,
        "start_date": "2024-01-05",
        "end_date": "2024-01-20"
      }
    ],
    "signals": [
      {
        "type": "1_buy",
        "date": "2024-01-15",
        "price": 12.00,
        "is_current": true
      },
      {
        "type": "1_sell",
        "date": "2024-02-01",
        "price": 14.00,
        "is_current": false
      }
    ],
    "current_signal": {
      "type": "2_buy",
      "date": "2024-03-01",
      "price": 12.50,
      "related_zs": { "zg": 13.20, "zd": 12.00 }
    }
  }
}
```

---

### 4. 数据同步模块

#### 4.1 爬虫任务管理
```
POST   /api/v1/sync/task               - 创建同步任务
GET    /api/v1/sync/task/:id           - 获取任务状态
GET    /api/v1/sync/logs              - 获取同步日志
```

---

## API 返回格式

### 成功响应
```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

### 错误响应
```json
{
  "code": 1001,
  "message": "股票不存在",
  "data": null
}
```

---

## 核心数据结构

### 1. 笔 (Bi)
```typescript
interface Bi {
  no: number;              // 笔序号
  start_date: string;
  end_date: string;
  start_price: number;
  end_price: number;
  type: 'up' | 'down';
}
```

### 2. 线段 (Xd)
```typescript
interface Xd {
  no: number;
  start_date: string;
  end_date: string;
  start_price: number;
  end_price: number;
  type: 'up' | 'down';
  bi_count: number;        // 包含笔数
}
```

### 3. 中枢 (Zs)
```typescript
interface Zs {
  no: number;
  zg: number;              // 中枢最高点
  zd: number;              // 中枢最低点
  gg: number;              // 高高点
  dd: number;              // 低低点
  start_date: string;
  end_date: string;
  is_current: boolean;      // 是否为当前中枢
}
```

### 4. 买卖点信号
```typescript
interface Signal {
  type: '1_buy' | '2_buy' | '3_buy' | '1_sell' | '2_sell' | '3_sell';
  date: string;
  price: number;
  confidence: number;       // 置信度
  related_zs?: {            // 相关中枢
    no: number;
    zg: number;
    zd: number;
  };
  is_current: boolean;
}
```
