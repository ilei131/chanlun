"""
数据采集器命令行入口
"""
import click
from loguru import logger
import sys

from config import CollectorConfig, DatabaseConfig
from database import Database
from collector import StockCollector

# 配置日志
logger.remove()
logger.add(
    sys.stdout,
    level="INFO",
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
)
logger.add(
    "logs/collector.log",
    rotation="10 MB",
    retention="30 days",
    level="DEBUG",
    encoding="utf-8"
)


@click.group()
def cli():
    """股票数据采集工具"""
    pass


@cli.command()
def init_db():
    """初始化数据库表结构"""
    logger.info("初始化数据库...")
    try:
        with open("../database/schema.sql", "r", encoding="utf-8") as f:
            schema_sql = f.read()

        db = Database()
        statements = [s.strip() for s in schema_sql.split(";") if s.strip()]
        for statement in statements:
            try:
                db.execute(statement)
            except Exception as e:
                logger.warning(f"执行SQL语句失败: {e}")
                continue

        logger.info("数据库初始化完成")
    except Exception as e:
        logger.error(f"数据库初始化失败: {e}")


@cli.command()
def update_stocks():
    """更新股票列表（使用Tushare，需要积分）"""
    logger.info("开始更新股票列表...")
    collector = StockCollector()
    try:
        count = collector.collect_stock_list()
        click.echo(f"成功更新 {count} 只股票")
    except Exception as e:
        click.echo(f"更新失败: {e}", err=True)
    finally:
        collector.close()


@cli.command()
@click.option("--period", "-p", default="1d", help="K线周期: 1d=日线, 1w=周线, 1m=月线")
@click.option("--start-date", "-s", help="开始日期 (YYYYMMDD)")
@click.option("--end-date", "-e", help="结束日期 (YYYYMMDD)")
@click.option("--all-periods", "-a", is_flag=True, help="采集所有周期")
@click.option("--skip-existing", is_flag=True, default=True, help="跳过已有数据的股票（增量更新）")
def update_klines(period, start_date, end_date, all_periods, skip_existing):
    """更新K线数据（直接从数据库读取股票列表）"""
    collector = StockCollector()
    try:
        # 直接从数据库获取股票列表
        stocks = collector.db.get_all_active_stocks()
        if not stocks:
            click.echo("数据库中没有股票数据，请先运行 update-stocks", err=True)
            return

        click.echo(f"从数据库获取到 {len(stocks)} 只股票")

        if all_periods:
            periods = ["1d", "1w", "1m"]
            results = collector.collect_all_klines(periods, start_date, end_date, skip_existing)
            for p, r in results.items():
                click.echo(f"{p}: 成功 {r['success']}/{r['total']}, 记录数 {r['records']}")
        else:
            result = collector.collect_klines_batch(stocks, period, start_date, end_date, skip_existing)
            click.echo(f"成功 {result['success']}/{result['total']}, 记录数 {result['records']}")

    except Exception as e:
        click.echo(f"更新失败: {e}", err=True)
    finally:
        collector.close()


@cli.command()
def daily_update():
    """执行每日增量更新"""
    logger.info("开始每日更新...")
    collector = StockCollector()
    try:
        results = collector.update_daily()
        for period, result in results.items():
            click.echo(f"{period}: 成功 {result['success']}/{result['total']}, 记录数 {result['records']}")
    except Exception as e:
        click.echo(f"更新失败: {e}", err=True)
    finally:
        collector.close()


@cli.command()
@click.option("--full", "-f", is_flag=True, help="全量采集（采集所有历史数据）")
@click.option("--stocks-only", is_flag=True, help="仅采集股票列表")
@click.option("--klines-only", is_flag=True, help="仅采集K线数据")
def run(full, stocks_only, klines_only):
    """运行完整采集流程"""
    collector = StockCollector()
    try:
        # 仅采集股票列表
        if stocks_only:
            click.echo("步骤: 更新股票列表...")
            stock_count = collector.collect_stock_list()
            click.echo(f"成功: {stock_count} 只股票")
            return

        # 仅采集K线
        if klines_only:
            stocks = collector.db.get_all_active_stocks()
            if not stocks:
                click.echo("数据库中没有股票数据", err=True)
                return

            click.echo(f"获取到 {len(stocks)} 只股票")

            periods = ["1d", "1w", "1m"]
            start_date = None if full else "20200101"

            for period in periods:
                click.echo(f"采集 {period} K线数据...")
                result = collector.collect_klines_batch(stocks, period, start_date=start_date, skip_existing=True)
                click.echo(f"  成功 {result['success']}/{result['total']}, 记录数 {result['records']}")

            click.echo("采集完成!")
            return

        # 完整流程
        # 1. 更新股票列表
        click.echo("步骤 1/4: 更新股票列表...")
        stock_count = collector.collect_stock_list()
        click.echo(f"  获取到 {stock_count} 只股票")

        # 2. 获取活跃股票
        stocks = collector.db.get_all_active_stocks()
        click.echo(f"  活跃股票: {len(stocks)} 只")

        # 3. 采集K线数据
        periods = ["1d", "1w", "1m"]
        start_date = None if full else "20200101"

        for i, period in enumerate(periods, 3):
            click.echo(f"步骤 {i}/4: 采集 {period} K线数据...")
            result = collector.collect_klines_batch(stocks, period, start_date=start_date, skip_existing=True)
            click.echo(f"  成功 {result['success']}/{result['total']}, 记录数 {result['records']}")

        click.echo("采集完成!")

    except Exception as e:
        click.echo(f"采集失败: {e}", err=True)
    finally:
        collector.close()


@cli.command()
def status():
    """查看数据状态"""
    db = Database()
    try:
        # 股票数量
        stock_count = db.fetch_one("SELECT COUNT(*) as count FROM stocks WHERE is_active = true")
        click.echo(f"活跃股票数: {stock_count['count']}")

        # K线数据统计
        for period in ["1d", "1w", "1m"]:
            result = db.fetch_one(
                "SELECT COUNT(*) as count, COUNT(DISTINCT stock_id) as stocks FROM klines WHERE period = :period",
                {"period": period}
            )
            click.echo(f"{period} K线: {result['count']} 条记录, 覆盖 {result['stocks']} 只股票")

        # 最近更新
        recent = db.fetch_all(
            "SELECT data_type, period, status, completed_at FROM data_update_log ORDER BY completed_at DESC LIMIT 5"
        )
        click.echo("\n最近更新记录:")
        for log in recent:
            click.echo(f"  {log['data_type']} ({log['period']}): {log['status']} @ {log['completed_at']}")

    except Exception as e:
        click.echo(f"查询失败: {e}", err=True)
    finally:
        db.close()


if __name__ == "__main__":
    cli()
