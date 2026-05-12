"""
数据采集器主模块
"""
import asyncio
import time
import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd
from tqdm import tqdm
from loguru import logger
from dotenv import load_dotenv

# 确保从正确路径加载 .env 文件
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

from config import CollectorConfig, HISTORY_START_DATE, PERIOD_CONFIG
from database import Database
from data_source import DataSourceManager


class StockCollector:
    """股票数据采集器"""

    def __init__(self, config: CollectorConfig = None, db: Database = None):
        self.config = config if config is not None else CollectorConfig()

        tushare_token = os.getenv("TUSHARE_TOKEN", "")
        if not tushare_token:
            logger.warning("TUSHARE_TOKEN not set in environment, will use AKShare as fallback")

        self.db = db if db is not None else Database()
        self.data_source = DataSourceManager(self.config, tushare_token)
        self.executor = ThreadPoolExecutor(max_workers=self.config.concurrent_requests)

        logger.info(f"DataCollector initialized, request_delay={self.config.request_delay}s")

    def _clean_date(self, value) -> Optional[str]:
        """清理日期值，将 NaN/NaT 转换为 None"""
        import math
        if value is None:
            return None
        if isinstance(value, float) and math.isnan(value):
            return None
        if isinstance(value, str) and value in ['nan', 'NaN', 'NaT', '']:
            return None
        if pd.isna(value):
            return None
        return str(value)

    def collect_stock_list(self) -> int:
        """采集股票基础信息列表"""
        logger.info("开始采集股票列表...")
        log_id = None

        try:
            log_id = self.db.log_update("stock_list", "running")

            # 获取股票列表
            stocks_df = self.data_source.get_stock_list()
            if stocks_df.empty:
                raise Exception("获取股票列表失败")

            # 转换为数据库格式
            stocks_data = []
            for _, row in stocks_df.iterrows():
                stocks_data.append({
                    "code": str(row["code"]),
                    "name": str(row["name"]),
                    "market": str(row["market"]),
                    "stock_type": str(row.get("stock_type", "stock")),
                    "list_date": self._clean_date(row.get("list_date")),
                    "is_active": bool(row.get("is_active", True))
                })

            # 批量插入
            count = self.db.upsert_stocks(stocks_data)

            # 获取指数列表
            indices_df = self.data_source.get_index_list()
            if not indices_df.empty:
                indices_data = []
                for _, row in indices_df.iterrows():
                    indices_data.append({
                        "code": str(row["code"]),
                        "name": str(row["name"]),
                        "market": str(row["market"]),
                        "stock_type": str(row["stock_type"]),
                        "list_date": self._clean_date(row.get("list_date")),
                        "is_active": True
                    })
                self.db.upsert_stocks(indices_data)
                count += len(indices_data)

            self.db.log_update("stock_list", "success", total_count=len(stocks_data), success_count=count)
            logger.info(f"股票列表采集完成，共 {count} 只")
            return count

        except Exception as e:
            logger.error(f"采集股票列表失败: {e}")
            if log_id:
                self.db.log_update("stock_list", "failed", error_message=str(e))
            raise

    def collect_kline_for_stock(self, stock: Dict, period: str = "1d",
                                 start_date: str = None, end_date: str = None) -> int:
        """
        采集单只股票的K线数据

        Args:
            stock: 股票信息字典 {id, code, name, ...}
            period: 周期
            start_date: 开始日期
            end_date: 结束日期
        """
        code = stock["code"]
        stock_id = stock["id"]

        try:
            # 如果没有指定日期，获取增量数据
            if start_date is None:
                last_date = self.db.get_last_trade_date(stock_id, period)
                if last_date:
                    # 从最后日期后一天开始
                    start_date = (datetime.strptime(last_date, "%Y%m%d") + timedelta(days=1)).strftime("%Y%m%d")
                else:
                    start_date = HISTORY_START_DATE

            if end_date is None:
                end_date = datetime.now().strftime("%Y%m%d")

            # 如果开始日期大于结束日期，说明数据已是最新
            if start_date > end_date:
                return 0

            # 获取K线数据
            df = self.data_source.get_kline_data(code, period, start_date, end_date)
            if df.empty:
                return 0

            # 转换为数据库格式
            kline_data = []
            for _, row in df.iterrows():
                kline_data.append({
                    "stock_id": stock_id,
                    "trade_date": row["trade_date"],
                    "period": period,
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": int(row["volume"]),
                    "amount": float(row.get("amount", 0)) if pd.notna(row.get("amount")) else None,
                    "turnover_rate": float(row.get("turnover_rate", 0)) if pd.notna(row.get("turnover_rate")) else None
                })

            # 批量插入
            count = self.db.upsert_klines(kline_data)
            return count

        except Exception as e:
            logger.warning(f"采集 {code} {period} K线数据失败: {e}")
            return 0

    def collect_klines_batch(self, stocks: List[Dict], period: str = "1d",
                              start_date: str = None, end_date: str = None,
                              skip_existing: bool = True) -> Dict:
        """
        批量采集K线数据

        Args:
            stocks: 股票列表
            period: K线周期
            start_date: 开始日期
            end_date: 结束日期
            skip_existing: 是否跳过已有数据的股票（增量更新）

        Returns:
            {"total": 总股票数, "success": 成功数, "failed": 失败数, "records": 总记录数}
        """
        logger.info(f"开始采集 {len(stocks)} 只股票 {period} K线数据...")

        # 增量模式：检查每只股票的最后更新日期
        if skip_existing:
            stocks_to_fetch = []
            for stock in stocks:
                last_date = self.db.get_last_trade_date(stock["id"], period)
                if last_date:
                    logger.debug(f"跳过 {stock['code']}，已有数据到 {last_date}")
                else:
                    stocks_to_fetch.append(stock)

            skipped = len(stocks) - len(stocks_to_fetch)
            if skipped > 0:
                logger.info(f"增量模式: 跳过 {skipped} 只已有数据的股票，剩余 {len(stocks_to_fetch)} 只待采集")
            stocks = stocks_to_fetch

        if not stocks:
            logger.info("所有股票数据已是最新，无需采集")
            return {"total": 0, "success": 0, "failed": 0, "records": 0}

        log_id = self.db.log_update(f"kline_{period}", "running", period=period)
        results = {"total": len(stocks), "success": 0, "failed": 0, "records": 0}

        try:
            with tqdm(total=len(stocks), desc=f"采集 {period} K线") as pbar:
                futures = []

                # 提交任务
                for stock in stocks:
                    future = self.executor.submit(
                        self.collect_kline_for_stock,
                        stock, period, start_date, end_date
                    )
                    futures.append((stock, future))

                # 收集结果
                for stock, future in futures:
                    try:
                        count = future.result(timeout=60)  # 60秒超时
                        if count > 0:
                            results["success"] += 1
                            results["records"] += count
                        else:
                            results["failed"] += 1
                    except Exception as e:
                        logger.warning(f"处理 {stock['code']} 失败: {e}")
                        results["failed"] += 1
                    finally:
                        pbar.update(1)

            self.db.log_update(
                f"kline_{period}", "success", period=period,
                total_count=results["total"],
                success_count=results["success"]
            )

            logger.info(f"K线数据采集完成: {results}")
            return results

        except Exception as e:
            logger.error(f"批量采集K线数据失败: {e}")
            self.db.log_update(
                f"kline_{period}", "failed", period=period,
                error_message=str(e)
            )
            raise

    def collect_all_klines(self, periods: List[str] = None,
                            start_date: str = None, end_date: str = None) -> Dict:
        """
        采集所有股票的所有周期K线数据

        Args:
            periods: 周期列表，默认 ["1d", "1w", "1m"]
            start_date: 开始日期
            end_date: 结束日期
        """
        if periods is None:
            periods = ["1d", "1w", "1m"]

        # 获取所有活跃股票
        stocks = self.db.get_all_active_stocks()
        if not stocks:
            logger.warning("数据库中没有股票列表，请先执行 collect_stock_list")
            return {}

        logger.info(f"开始采集 {len(stocks)} 只股票的K线数据，周期: {periods}")

        all_results = {}
        for period in periods:
            results = self.collect_klines_batch(stocks, period, start_date, end_date)
            all_results[period] = results

            # 每个周期之间暂停一下，避免请求过于频繁
            if period != periods[-1]:
                time.sleep(5)

        return all_results

    def update_daily(self) -> Dict:
        """每日增量更新"""
        logger.info("开始每日增量更新...")

        # 1. 更新股票列表（检查新股、退市股）
        self.collect_stock_list()

        # 2. 获取所有活跃股票
        stocks = self.db.get_all_active_stocks()

        # 3. 更新日线数据（只获取最近的数据）
        today = datetime.now().strftime("%Y%m%d")
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y%m%d")

        results = {}
        for period in ["1d", "1w", "1m"]:
            period_results = self.collect_klines_batch(stocks, period, start_date=yesterday, end_date=today)
            results[period] = period_results
            time.sleep(2)

        logger.info(f"每日更新完成: {results}")
        return results

    def close(self):
        """关闭资源"""
        self.executor.shutdown(wait=True)
        self.db.close()


class AsyncStockCollector(StockCollector):
    """异步股票数据采集器 - 用于更高并发"""

    async def collect_klines_async(self, stocks: List[Dict], period: str = "1d") -> Dict:
        """异步采集K线数据"""
        import aiohttp
        import asyncio

        semaphore = asyncio.Semaphore(self.config.concurrent_requests)

        async def fetch_one(stock: Dict) -> int:
            async with semaphore:
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(
                    None,
                    self.collect_kline_for_stock,
                    stock, period
                )

        tasks = [fetch_one(stock) for stock in stocks]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        success = sum(1 for r in results if isinstance(r, int) and r > 0)
        failed = sum(1 for r in results if isinstance(r, Exception) or r == 0)
        records = sum(r for r in results if isinstance(r, int))

        return {"total": len(stocks), "success": success, "failed": failed, "records": records}
