# 股票数据采集器

基于 Python + AKShare 的股票历史数据采集工具，支持 A 股全市场股票日线、周线、月线数据获取，并存储到 PostgreSQL 数据库。

## 特点

- **完全免费**: 使用 AKShare 开源库，无需付费 API
- **全市场覆盖**: 支持沪深京三市所有 A 股股票
- **多周期支持**: 日线、周线、月线数据
- **增量更新**: 智能识别已采集数据，只获取新数据
- **并发采集**: 支持多线程并发，提高采集效率
- **断点续传**: 支持中断后从上次位置继续
- **自动调度**: 支持定时自动更新

## 安装

### 1. 安装依赖

```bash
cd data_collector
pip install -r requirements.txt
```

### 2. 配置数据库

复制环境变量示例文件并修改：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库连接信息：

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chanlun
DB_USER=postgres
DB_PASSWORD=your_password
```

### 3. 初始化数据库

```bash
python main.py init-db
```

## 使用

### 命令行工具

#### 查看帮助

```bash
python main.py --help
```

#### 更新股票列表

```bash
python main.py update-stocks
```

#### 更新 K 线数据

```bash
# 更新日线数据（增量）
python main.py update-klines -p 1d

# 更新所有周期数据
python main.py update-klines -a

# 指定日期范围
python main.py update-klines -p 1d -s 20240101 -e 20241231
```

#### 每日增量更新

```bash
python main.py daily-update
```

#### 全量采集

```bash
# 采集所有历史数据（首次使用）
python main.py run --full

# 只采集近5年数据
python main.py run
```

#### 查看数据状态

```bash
python main.py status
```

### 定时自动更新

```bash
python scheduler.py
```

调度器会：
- 每天 18:00 执行增量更新
- 每周日凌晨 2:00 执行全量更新

## 数据源说明

### AKShare

主要数据源，提供：
- A 股股票列表
- 历史 K 线数据（前复权）
- 实时行情数据

**限制**: 有请求频率限制，默认配置了 0.5 秒间隔

### 新浪财经（备用）

用于实时行情补充

## 数据结构

采集的数据存储在 PostgreSQL 中，表结构详见 `../database/schema.sql`

主要表：
- `stocks`: 股票基础信息
- `klines`: K 线数据（日线/周线/月线）
- `data_update_log`: 数据更新日志

## 性能参考

在默认配置下（并发 5，延迟 0.5 秒）：

- 股票列表：约 30 秒
- 日线数据（5000 只股票）：约 2-3 小时
- 周线数据：约 1 小时
- 月线数据：约 30 分钟

## 常见问题

### 1. 采集过程中断怎么办？

重新运行相同的命令即可，程序会自动识别已采集的数据，只获取缺失部分。

### 2. 如何提高采集速度？

修改 `.env` 文件中的配置：

```env
REQUEST_DELAY=0.3      # 降低请求间隔（注意可能被封）
CONCURRENT_REQUESTS=10  # 增加并发数
```

### 3. 数据不完整怎么办？

可以针对特定股票重新采集：

```python
from collector import StockCollector

collector = StockCollector()
stock = {"id": 1, "code": "000001"}
collector.collect_kline_for_stock(stock, "1d", "20200101", "20241231")
```

### 4. 如何添加其他数据源？

在 `data_source.py` 中继承 `DataSource` 基类，实现相应方法：

```python
class MyDataSource(DataSource):
    def get_kline_data(self, code, period, start_date, end_date):
        # 实现数据获取逻辑
        pass
```

## 注意事项

1. **首次全量采集耗时较长**，建议分阶段执行
2. **避免频繁请求**，遵守数据源的使用限制
3. **定期检查数据完整性**，使用 `status` 命令查看
4. **做好数据备份**，防止意外丢失

## License

MIT
