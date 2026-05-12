"""
定时任务调度器 - 用于自动更新数据
"""
import time
import schedule
from datetime import datetime
from loguru import logger

from config import CollectorConfig
from collector import StockCollector


class DataUpdateScheduler:
    """数据更新调度器"""

    def __init__(self, config: CollectorConfig = None):
        self.config = config or CollectorConfig()
        self.collector = None
        self._running = False

    def _init_collector(self):
        """初始化采集器"""
        if self.collector is None:
            self.collector = StockCollector(self.config)

    def daily_update_job(self):
        """每日更新任务"""
        logger.info("执行定时每日更新任务...")
        try:
            self._init_collector()
            results = self.collector.update_daily()
            logger.info(f"每日更新完成: {results}")
        except Exception as e:
            logger.error(f"每日更新失败: {e}")

    def weekly_update_job(self):
        """每周全量更新任务"""
        logger.info("执行定时每周全量更新任务...")
        try:
            self._init_collector()
            # 更新股票列表
            self.collector.collect_stock_list()
            # 全量更新K线
            self.collector.collect_all_klines()
            logger.info("每周全量更新完成")
        except Exception as e:
            logger.error(f"每周更新失败: {e}")

    def start(self):
        """启动调度器"""
        logger.info(f"启动数据更新调度器，每日更新时间: {self.config.update_time}")
        self._running = True

        # 设置定时任务
        schedule.every().day.at(self.config.update_time).do(self.daily_update_job)
        schedule.every().sunday.at("02:00").do(self.weekly_update_job)

        # 立即执行一次
        logger.info("立即执行一次更新...")
        self.daily_update_job()

        # 保持运行
        while self._running:
            schedule.run_pending()
            time.sleep(60)

    def stop(self):
        """停止调度器"""
        logger.info("停止数据更新调度器")
        self._running = False
        if self.collector:
            self.collector.close()


def run_scheduler():
    """运行调度器"""
    scheduler = DataUpdateScheduler()
    try:
        scheduler.start()
    except KeyboardInterrupt:
        logger.info("收到中断信号，正在停止...")
        scheduler.stop()


if __name__ == "__main__":
    run_scheduler()
