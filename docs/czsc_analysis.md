# CZSC 项目深度解读

## 1. 项目概述

**CZSC** (缠中说禅技术分析工具) 是一个成熟的缠论量化交易开源项目，由 zengbin93 开发维护。

| 项目信息 | 详情 |
|---------|------|
| GitHub | https://github.com/waditu/czsc |
| Stars | 4.3k+ |
| 语言 | Python + Rust (核心算法) |
| 协议 | MIT |
| Python版本 | ≥ 3.10 |

### 1.1 架构特点

```
czsc (Python 包)
├── czsc._native          ← Rust 扩展（PyO3），缠论核心
│   ├── CZSC / FX / BI / ZS / RawBar / NewBar / BarGenerator
│   ├── Freq / Mark / Direction / Signal / Event / Position / Operate
│   ├── CzscTrader / CzscSignals / generate_czsc_signals
│   ├── signals.{bar,cxt,tas,vol,pressure,obv,cvolp}  ← 30+ 信号函数
│   └── ta.*              ← Rust TA 算子 (ema/sma/boll 等)
├── czsc.traders          ← Python 门面，汇聚 Rust 交易 API
├── czsc.svc              ← Streamlit 量化研究组件库
├── czsc.sensors          ← 事件检测与特征分析
├── czsc.utils            ← 工具函数（绘图/缓存/统计/交易工具）
├── czsc.connectors       ← 数据源连接器（天勤/Tushare/聚宽/CCXT）
├── czsc.eda              ← 探索性数据分析（因子/特征/权重）
├── czsc.strategies       ← 策略门面（CzscStrategyBase/CzscJsonStrategy）
└── czsc.envs             ← 环境变量管理
```

> **重要**：1.0.X 版本开始，缠论核心算法（分型、笔、中枢等）已全部迁移到 Rust 实现，性能大幅提升。

---

## 2. 数据接口分析

### 2.1 支持的数据源

| 模块 | 数据源 | 说明 | 费用 |
|------|--------|------|------|
| `ts_connector.py` | **Tushare** | A股历史数据（主力） | 积分制 |
| `tq_connector.py` | 天勤（TQSdk） | 期货实时/历史行情 | 免费/付费 |
| `jq_connector.py` | 聚宽 | A股/期货数据 | 免费/付费 |
| `ccxt_connector.py` | CCXT | 数字货币交易所 | 免费 |

### 2.2 Tushare 数据接口实现

```python
import czsc
from czsc import Freq, RawBar

# 设置 Tushare Token（首次使用）
czsc.set_url_token(token='your_token', url='http://api.tushare.pro')

# 创建数据客户端
cache_path = os.path.expanduser("~/.ts_data_cache")
dc = czsc.DataClient(url="http://api.tushare.pro", cache_path=cache_path)

# 获取股票列表
stocks = dc.stock_basic(exchange="", list_status="L", 
                        fields="ts_code,symbol,name,area,industry,list_date")

# 获取K线数据
import tushare as ts
bars = ts.pro_bar(ts_code='000001.SZ', start_date='20200101', 
                   end_date='20240101', freq='D', asset='E', adj='qfq')

# 转换为 RawBar 格式
def format_kline(kline: pd.DataFrame, freq: Freq) -> list[RawBar]:
    bars = []
    for i, record in enumerate(kline.to_dict("records")):
        bar = RawBar(
            symbol=record["ts_code"],
            dt=pd.to_datetime(record["trade_date"]),
            id=i,
            freq=freq,
            open=record["open"],
            close=record["close"],
            high=record["high"],
            low=record["low"],
            vol=int(record["vol"] * 100),
            amount=int(record.get("amount", 0) * 1000),
        )
        bars.append(bar)
    return bars
```

### 2.3 数据接口特点

| 特点 | 说明 |
|------|------|
| **缓存机制** | 自动缓存到本地 `~/.ts_data_cache` |
| **复权支持** | 支持前复权(qfq)、后复权(hfq) |
| **多周期** | 日线、周线、月线、分钟线 |
| **资产类型** | 股票(E)、指数(I)、基金(FD)、期货(FT) |

---

## 3. 缠论买点选股能力

### 3.1 核心缠论分析

```python
import czsc
from czsc import CZSC, Freq, format_standard_kline
from czsc.mock import generate_symbol_kines

# 生成模拟 K 线数据（实际使用时替换为真实数据）
df = generate_symbol_kines('000001', '30分钟', '20240101', '20240601')

# 转换为 RawBar 对象列表
bars = format_standard_kline(df, freq=Freq.F30)

# 创建 CZSC 分析对象（自动识别分型、笔、中枢）
czsc_obj = CZSC(bars)

# 获取分析结果
print(f"笔数量：{len(czsc_obj.bi_list)}")
print(f"中枢数量：{len(czsc_obj.zs_list)}")

# 获取分型列表
for fx in czsc_obj.fx_list:
    print(f"分型类型: {fx.mark}, 日期: {fx.dt}, 价格: {fx.val}")

# 获取笔列表
for bi in czsc_obj.bi_list:
    print(f"笔方向: {bi.direction}, 起始: {bi.fx_a.dt}, 结束: {bi.fx_b.dt}")

# 获取中枢列表
for zs in czsc_obj.zs_list:
    print(f"中枢: ZG={zs.zg}, ZD={zs.zd}, 起始: {zs.sdt}, 结束: {zs.edt}")
```

### 3.2 信号生成（买点识别）

```python
from czsc import generate_czsc_signals, get_signals_config, get_signals_freqs

# 配置信号序列（使用 Rust 实现的信号函数）
signals_seq = [
    # 缠论笔结束信号
    "czsc._native.signals.cxt.cxt_bi_end_V230104",
    # 缠论笔状态信号
    "czsc._native.signals.cxt.cxt_bi_status_V230101",
    # 缠论买卖点信号
    "czsc._native.signals.cxt.cxt_bi_base_V230228",
    # K线形态信号
    "czsc._native.signals.bar.bar_end_V230331",
]

# 解析信号所需的周期配置
freqs = get_signals_freqs(signals_seq)
config = get_signals_config(signals_seq)

# 生成信号序列
results = generate_czsc_signals(bars, signals_seq)

# 查看信号结果
for r in results[-10:]:  # 最近10个信号
    print(f"日期: {r['dt']}, 信号: {r}")
```

### 3.3 多级别联立决策（CzscTrader）

```python
from czsc import CzscTrader, BarGenerator, Freq

# 创建 K 线合成器
bg = BarGenerator(base_freq='1分钟', freqs=['5分钟', '30分钟', '日线'])

# 填充 K 线数据
for bar in raw_bars:
    bg.update(bar)

# 创建多级别交易器
trader = CzscTrader(
    symbol='000001.SZ',
    bg=bg,
    signals_seq=signals_seq,  # 信号序列
)

# 获取当前状态
print(f"当前持仓: {trader.position}")
print(f"当前信号: {trader.signals}")

# 获取操作建议
operate = trader.get_operate()
print(f"操作建议: {operate}")  # 开多、平多、持有 等
```

### 3.4 内置信号函数列表

| 信号类别 | 函数名 | 说明 |
|---------|--------|------|
| **缠论笔信号** | `cxt_bi_end_V230104` | 笔结束信号 |
| | `cxt_bi_status_V230101` | 笔状态（向上/向下/震荡） |
| | `cxt_bi_base_V230228` | 笔基础买卖点 |
| **分型信号** | `byi_fx_num_V230628` | 分型数量统计 |
| | `byi_second_bs_V230324` | 二类买卖点 |
| **K线信号** | `bar_accelerate_V221110` | K线加速信号 |
| | `bar_break_V240428` | 突破信号 |
| | `bar_trend_V240209` | 趋势信号 |
| **技术指标** | `coo_kdj_V230322` | KDJ交叉信号 |
| | `coo_macd_V230518` | MACD交叉信号 |
| | `coo_cci_V230323` | CCI信号 |

---

## 4. 选股实现方案

### 4.1 方案一：批量信号扫描

```python
import pandas as pd
from tqdm import tqdm
import czsc
from czsc import CZSC, Freq, format_standard_kline

def scan_buy_signals(symbols, sdt, edt, signals_config):
    """批量扫描买点信号
    
    Args:
        symbols: 股票代码列表 ['000001.SZ', '000002.SZ', ...]
        sdt: 开始日期 '20230101'
        edt: 结束日期 '20240101'
        signals_config: 信号配置
        
    Returns:
        符合条件的股票列表
    """
    results = []
    
    for symbol in tqdm(symbols, desc="扫描买点"):
        try:
            # 1. 获取K线数据
            bars = get_raw_bars(symbol, '日线', sdt, edt)
            
            # 2. 创建缠论分析对象
            czsc_obj = CZSC(bars)
            
            # 3. 检查买点条件
            # 检查是否有当前有效的买点
            has_buy_signal = False
            signal_info = {}
            
            # 检查最后一笔
            if czsc_obj.bi_list:
                last_bi = czsc_obj.bi_list[-1]
                
                # 条件1：向下笔结束（可能是一买）
                if last_bi.direction.name == 'Down':
                    # 检查是否在中枢下方
                    if czsc_obj.zs_list:
                        last_zs = czsc_obj.zs_list[-1]
                        if last_bi.fx_b.val < last_zs.zd:  # 笔结束点低于中枢下沿
                            has_buy_signal = True
                            signal_info['type'] = '一买'
                            signal_info['price'] = last_bi.fx_b.val
                            signal_info['date'] = last_bi.fx_b.dt
                    
                # 条件2：向上笔开始（二买）
                elif last_bi.direction.name == 'Up':
                    if len(czsc_obj.bi_list) >= 2:
                        prev_bi = czsc_obj.bi_list[-2]
                        # 前一笔向下，当前笔向上，且在中枢内
                        if prev_bi.direction.name == 'Down' and czsc_obj.zs_list:
                            last_zs = czsc_obj.zs_list[-1]
                            if last_zs.zd < last_bi.fx_a.val < last_zs.zg:
                                has_buy_signal = True
                                signal_info['type'] = '二买'
                                signal_info['price'] = last_bi.fx_a.val
                                signal_info['date'] = last_bi.fx_a.dt
            
            if has_buy_signal:
                results.append({
                    'symbol': symbol,
                    'signal_type': signal_info.get('type'),
                    'signal_price': signal_info.get('price'),
                    'signal_date': signal_info.get('date'),
                })
                
        except Exception as e:
            print(f"处理 {symbol} 时出错: {e}")
            continue
    
    return pd.DataFrame(results)

# 使用示例
symbols = ['000001.SZ', '000002.SZ', '600000.SH', ...]  # 股票列表
results = scan_buy_signals(symbols, '20230101', '20240101', {})
print(f"发现 {len(results)} 个买点信号")
```

### 4.2 方案二：使用信号函数

```python
from czsc import generate_czsc_signals

def scan_with_signals(symbols, sdt, edt):
    """使用信号函数进行选股"""
    
    # 定义买点信号序列
    buy_signals = [
        "czsc._native.signals.cxt.cxt_bi_base_V230228",  # 笔基础买卖点
    ]
    
    results = []
    for symbol in tqdm(symbols):
        try:
            bars = get_raw_bars(symbol, '日线', sdt, edt)
            signals = generate_czsc_signals(bars, buy_signals)
            
            # 检查最新信号
            if signals:
                last_signal = signals[-1]
                # 检查是否有买点信号
                for key, value in last_signal.items():
                    if '买点' in str(value) or 'buy' in str(value).lower():
                        results.append({
                            'symbol': symbol,
                            'signal': value,
                            'date': last_signal['dt']
                        })
                        break
        except Exception as e:
            continue
    
    return results
```

### 4.3 方案三：使用 CzscTrader

```python
from czsc import CzscTrader, BarGenerator

def scan_with_trader(symbols, sdt, edt):
    """使用 CzscTrader 进行选股"""
    
    results = []
    for symbol in tqdm(symbols):
        try:
            # 获取多周期数据
            bars_d = get_raw_bars(symbol, '日线', sdt, edt)
            bars_30m = get_raw_bars(symbol, '30分钟', sdt, edt)
            
            # 创建 K 线合成器
            bg = BarGenerator(base_freq='30分钟', freqs=['日线'])
            for bar in bars_30m:
                bg.update(bar)
            
            # 创建交易器
            trader = CzscTrader(
                symbol=symbol,
                bg=bg,
                signals_seq=[
                    "czsc._native.signals.cxt.cxt_bi_base_V230228",
                ]
            )
            
            # 检查操作建议
            operate = trader.get_operate()
            if operate and '开多' in str(operate):
                results.append({
                    'symbol': symbol,
                    'operate': operate,
                    'position': trader.position,
                })
                
        except Exception as e:
            continue
    
    return results
```

---

## 5. 与当前项目对比

### 5.1 架构对比

| 对比项 | 当前项目 (chanlun) | CZSC |
|--------|-------------------|------|
| **后端语言** | Rust + Actix-web | Python + Rust(PyO3) |
| **数据存储** | PostgreSQL | 本地缓存/无 |
| **数据源** | AKShare | Tushare (主力) |
| **缠论实现** | 自研 (待完成) | 成熟完善 |
| **选股方式** | 数据库查询 | 实时计算 |
| **前端** | React | Streamlit |
| **API设计** | RESTful | 无 |

### 5.2 功能对比

| 功能 | 当前项目 | CZSC |
|------|---------|------|
| 分型识别 | ⏳ 待实现 | ✅ Rust实现 |
| 笔识别 | ⏳ 待实现 | ✅ Rust实现 |
| 线段识别 | ⏳ 待实现 | ✅ 支持 |
| 中枢识别 | ⏳ 待实现 | ✅ Rust实现 |
| 买卖点识别 | ⏳ 待实现 | ✅ 30+信号函数 |
| 多级别联立 | ⏳ 待实现 | ✅ CzscTrader |
| 回测框架 | ❌ 无 | ✅ WeightBacktest |
| 选股功能 | ⏳ 基础框架 | ✅ 多种方式 |

### 5.3 数据接口对比

| 对比项 | 当前项目 (AKShare) | CZSC (Tushare) |
|--------|-------------------|----------------|
| **费用** | 免费 | 积分制（基础免费） |
| **限制** | 频率限制 | 每分钟500次（高积分） |
| **数据质量** | 中等 | 高 |
| **数据完整性** | 较好 | 很好 |
| **历史数据** | 支持 | 支持 |
| **实时数据** | 延迟 | 延迟 |

---

## 6. 借鉴建议

### 6.1 直接使用 CZSC 库

**推荐方案**：在当前项目的 Python 数据采集层直接集成 CZSC 库。

```python
# data_collector/czsc_analyzer.py

import czsc
from czsc import CZSC, Freq, RawBar

class CzscAnalyzer:
    """缠论分析器 - 基于 CZSC 库"""
    
    def __init__(self):
        pass
    
    def analyze_stock(self, bars: list[RawBar]) -> dict:
        """分析单只股票
        
        Returns:
            {
                'bi_list': [...],      # 笔列表
                'zs_list': [...],      # 中枢列表
                'signals': [...],      # 信号列表
                'current_signal': {...} # 当前信号
            }
        """
        czsc_obj = CZSC(bars)
        
        return {
            'bi_list': [{'direction': bi.direction.name, 
                         'start': bi.fx_a.dt, 'end': bi.fx_b.dt,
                         'start_price': bi.fx_a.val, 'end_price': bi.fx_b.val}
                        for bi in czsc_obj.bi_list],
            'zs_list': [{'zg': zs.zg, 'zd': zs.zd,
                         'start': zs.sdt, 'end': zs.edt}
                        for zs in czsc_obj.zs_list],
            'fx_list': [{'mark': fx.mark.name, 'dt': fx.dt, 'val': fx.val}
                        for fx in czsc_obj.fx_list],
        }
    
    def detect_buy_signals(self, bars: list[RawBar]) -> list[dict]:
        """检测买点信号"""
        czsc_obj = CZSC(bars)
        signals = []
        
        # 一买检测：向下笔结束
        if czsc_obj.bi_list:
            last_bi = czsc_obj.bi_list[-1]
            if last_bi.direction.name == 'Down':
                signals.append({
                    'type': '一买',
                    'date': last_bi.fx_b.dt,
                    'price': last_bi.fx_b.val,
                })
        
        return signals
```

### 6.2 数据接口借鉴

**建议**：保持 AKShare 作为主力数据源，同时支持 Tushare 作为备选。

```python
# data_collector/data_source.py

class DataSourceFactory:
    @staticmethod
    def create(source: str):
        if source == 'akshare':
            return AKShareDataSource()
        elif source == 'tushare':
            return TushareDataSource()
        else:
            raise ValueError(f"Unknown data source: {source}")

class TushareDataSource:
    """Tushare 数据源（借鉴 CZSC 实现）"""
    
    def __init__(self, token: str):
        self.token = token
        import tushare as ts
        ts.set_token(token)
        self.pro = ts.pro_api()
    
    def get_stock_list(self) -> pd.DataFrame:
        return self.pro.stock_basic(exchange='', list_status='L')
    
    def get_klines(self, ts_code: str, start_date: str, end_date: str, 
                   freq: str = 'D', adj: str = 'qfq') -> pd.DataFrame:
        return ts.pro_bar(ts_code=ts_code, start_date=start_date, 
                          end_date=end_date, freq=freq, adj=adj)
```

### 6.3 算法借鉴

**建议**：直接使用 CZSC 的 Rust 实现，通过 Python 调用。

```python
# 在数据采集完成后，调用 CZSC 进行缠论分析

import czsc
from czsc import CZSC, Freq

def calculate_chanlun_signals(stock_id: int, klines_df: pd.DataFrame):
    """计算缠论信号并保存到数据库"""
    
    # 转换为 RawBar 格式
    bars = []
    for i, row in klines_df.iterrows():
        bar = czsc.RawBar(
            symbol=row['code'],
            dt=pd.to_datetime(row['trade_date']),
            id=i,
            freq=Freq.D,
            open=row['open'],
            close=row['close'],
            high=row['high'],
            low=row['low'],
            vol=row['volume'],
            amount=row.get('amount', 0),
        )
        bars.append(bar)
    
    # 创建 CZSC 分析对象
    czsc_obj = CZSC(bars)
    
    # 提取信号并保存
    signals = []
    
    # 提取笔
    for bi in czsc_obj.bi_list:
        signals.append({
            'stock_id': stock_id,
            'period': '1d',
            'signal_type': 'bi',
            'direction': bi.direction.name,
            'start_date': bi.fx_a.dt.date(),
            'end_date': bi.fx_b.dt.date(),
            'start_price': bi.fx_a.val,
            'end_price': bi.fx_b.val,
        })
    
    # 提取中枢
    for zs in czsc_obj.zs_list:
        signals.append({
            'stock_id': stock_id,
            'period': '1d',
            'signal_type': 'zs',
            'zg': zs.zg,
            'zd': zs.zd,
            'start_date': zs.sdt.date(),
            'end_date': zs.edt.date(),
        })
    
    return signals
```

---

## 7. 总结

### 7.1 CZSC 项目优势

1. **成熟完善**：缠论算法实现完整，经过大量用户验证
2. **高性能**：核心算法 Rust 实现，性能优异
3. **功能丰富**：30+ 信号函数，支持多级别联立
4. **社区活跃**：4.3k stars，持续更新维护
5. **文档完善**：飞书文档、B站视频教程

### 7.2 对当前项目的建议

| 建议 | 说明 |
|------|------|
| **直接集成 CZSC** | 在 Python 层使用 `pip install czsc`，直接调用其缠论分析功能 |
| **保持现有架构** | Rust 后端 + PostgreSQL + React 前端架构不变 |
| **数据源双轨** | AKShare 为主，Tushare 为辅 |
| **信号存储** | 将 CZSC 分析结果存入 PostgreSQL，供后端查询 |
| **渐进式迁移** | 先用 CZSC 验证算法，后续可考虑自研 Rust 实现 |

### 7.3 实施路径

```
阶段1: 集成 CZSC 库
├── pip install czsc
├── 在 data_collector 中添加 czsc_analyzer.py
└── 调用 CZSC 进行缠论分析，结果存入数据库

阶段2: 完善选股功能
├── 基于数据库信号实现选股 API
├── 添加更多信号类型
└── 优化查询性能

阶段3: 可选自研
├── 参考 CZSC 的 Rust 实现
├── 开发独立的缠论算法模块
└── 与后端 Rust 代码集成
```

---

## 8. 参考资源

- [CZSC GitHub](https://github.com/waditu/czsc)
- [CZSC 文档](https://czsc.readthedocs.io/en/latest/)
- [飞书文档](https://s0cqcxuy3p.feishu.cn/wiki/wikcn3gB1MKl3ClpLnboHM1QgKf)
- [B站视频教程](https://space.bilibili.com/243682308/channel/series)
- [Tushare Pro](https://tushare.pro/)

---

*文档生成时间: 2024-05*
