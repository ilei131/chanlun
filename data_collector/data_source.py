"""
股票数据源模块 - 支持AKShare和Tushare
"""
import time
from typing import List, Dict, Optional
from datetime import datetime
import pandas as pd
import akshare as ak
import tushare as ts
from loguru import logger

from config import HISTORY_START_DATE, PERIOD_CONFIG, CollectorConfig


class DataSource:
    """数据源基类"""

    def __init__(self, config: CollectorConfig = None):
        self.config = config or CollectorConfig()
        self._request_count = 0
        self._last_request_time = 0

    def _rate_limit(self):
        """请求频率限制"""
        current_time = time.time()
        time_since_last = current_time - self._last_request_time
        if time_since_last < self.config.request_delay:
            time.sleep(self.config.request_delay - time_since_last)
        self._last_request_time = time.time()
        self._request_count += 1

    def _retry_on_error(self, func, *args, **kwargs):
        """带重试机制的函数调用"""
        for attempt in range(self.config.max_retry):
            try:
                self._rate_limit()
                return func(*args, **kwargs)
            except Exception as e:
                logger.warning(f"请求失败(尝试 {attempt + 1}/{self.config.max_retry}): {e}")
                if attempt < self.config.max_retry - 1:
                    time.sleep(2 ** attempt)
                else:
                    raise
        return None


class AKShareDataSource(DataSource):
    """AKShare数据源"""

    def get_stock_list(self) -> pd.DataFrame:
        """获取A股股票列表"""
        logger.info("正在获取A股股票列表...")

        try:
            sh_stocks = self._retry_on_error(ak.stock_sh_a_spot_em)
            sh_stocks = sh_stocks[["代码", "名称"]].copy()
            sh_stocks["market"] = "SH"

            sz_stocks = self._retry_on_error(ak.stock_sz_a_spot_em)
            sz_stocks = sz_stocks[["代码", "名称"]].copy()
            sz_stocks["market"] = "SZ"

            bj_stocks = self._retry_on_error(ak.stock_bj_a_spot_em)
            bj_stocks = bj_stocks[["代码", "名称"]].copy()
            bj_stocks["market"] = "BJ"

            all_stocks = pd.concat([sh_stocks, sz_stocks, bj_stocks], ignore_index=True)
            all_stocks.columns = ["code", "name", "market"]
            all_stocks["stock_type"] = "stock"
            all_stocks["is_active"] = ~all_stocks["name"].str.contains("退", na=False)
            all_stocks["list_date"] = None

            logger.info(f"获取到 {len(all_stocks)} 只股票")
            return all_stocks

        except Exception as e:
            logger.error(f"获取股票列表失败: {e}")
            raise

    def get_kline_data(self, code: str, period: str = "1d",
                       start_date: str = None, end_date: str = None) -> pd.DataFrame:
        if end_date is None:
            end_date = datetime.now().strftime("%Y%m%d")
        if start_date is None:
            start_date = HISTORY_START_DATE

        period_map = {"1d": "daily", "1w": "weekly", "1m": "monthly"}
        ak_period = period_map.get(period, "daily")

        try:
            df = self._retry_on_error(
                ak.stock_zh_a_hist,
                symbol=code,
                period=ak_period,
                start_date=start_date,
                end_date=end_date,
                adjust="qfq"
            )

            if df is None or df.empty:
                return pd.DataFrame()

            df = df.rename(columns={
                "日期": "trade_date",
                "开盘": "open",
                "收盘": "close",
                "最高": "high",
                "最低": "low",
                "成交量": "volume",
                "成交额": "amount",
                "换手率": "turnover_rate"
            })

            df["trade_date"] = pd.to_datetime(df["trade_date"]).dt.date
            df["period"] = period

            columns = ["trade_date", "open", "high", "low", "close", "volume", "amount", "turnover_rate", "period"]
            df = df[[col for col in columns if col in df.columns]]

            return df

        except Exception as e:
            logger.warning(f"获取 {code} {period} K线数据失败: {e}")
            return pd.DataFrame()

    def get_index_list(self) -> pd.DataFrame:
        """获取指数列表"""
        indices = [
            {"code": "000001", "name": "上证指数", "market": "SH", "stock_type": "index"},
            {"code": "399001", "name": "深证成指", "market": "SZ", "stock_type": "index"},
            {"code": "399006", "name": "创业板指", "market": "SZ", "stock_type": "index"},
            {"code": "000688", "name": "科创50", "market": "SH", "stock_type": "index"},
            {"code": "000300", "name": "沪深300", "market": "SH", "stock_type": "index"},
        ]

        df = pd.DataFrame(indices)
        df["is_active"] = True
        df["list_date"] = None

        return df


class TushareDataSource(DataSource):
    """Tushare数据源 - 专业金融数据接口"""

    def __init__(self, config: CollectorConfig = None, token: str = None):
        super().__init__(config)
        self.token = token
        if token:
            self.pro = ts.pro_api(token)
            logger.info("Tushare API initialized with token")
        else:
            self.pro = None
            logger.warning("Tushare token not configured")

    def _convert_code(self, code: str) -> str:
        """将股票代码转换为tushare格式"""
        if "." in code:
            return code
        if code.startswith("6") or code.startswith("9"):
            return f"{code}.SH"
        else:
            return f"{code}.SZ"

    def get_stock_list(self) -> pd.DataFrame:
        """获取A股股票列表"""
        if not self.pro:
            logger.error("Tushare not initialized")
            return pd.DataFrame()

        logger.info("正在通过Tushare获取A股股票列表...")

        try:
            df = self.pro.stock_basic(
                exchange='',
                list_status='L',
                fields='ts_code,symbol,name,area,industry,list_date,delist_date,is_hs'
            )

            if df is None or df.empty:
                logger.error("Tushare返回空数据")
                return pd.DataFrame()

            df = df.rename(columns={
                "symbol": "code",
                "name": "name",
                "list_date": "list_date",
                "delist_date": "delist_date"
            })

            def get_market(code):
                if code.startswith("6") or code.startswith("9"):
                    return "SH"
                elif code.startswith("4") or code.startswith("8"):
                    return "BJ"
                else:
                    return "SZ"

            df["market"] = df["code"].apply(get_market)
            df["stock_type"] = "stock"
            df["is_active"] = df["delist_date"].isna()

            logger.info(f"获取到 {len(df)} 只股票")
            return df

        except Exception as e:
            logger.error(f"获取股票列表失败: {e}")
            return pd.DataFrame()

    def get_index_list(self) -> pd.DataFrame:
        """获取指数列表"""
        logger.info("正在通过Tushare获取指数列表...")

        indices = [
            {"code": "000001.SH", "name": "上证指数", "market": "SH", "stock_type": "index"},
            {"code": "399001.SZ", "name": "深证成指", "market": "SZ", "stock_type": "index"},
            {"code": "399006.SZ", "name": "创业板指", "market": "SZ", "stock_type": "index"},
            {"code": "000688.SH", "name": "科创50", "market": "SH", "stock_type": "index"},
            {"code": "000300.SH", "name": "沪深300", "market": "SH", "stock_type": "index"},
            {"code": "000016.SH", "name": "上证50", "market": "SH", "stock_type": "index"},
            {"code": "000905.SH", "name": "中证500", "market": "SH", "stock_type": "index"},
            {"code": "000852.SH", "name": "中证1000", "market": "SH", "stock_type": "index"},
        ]

        df = pd.DataFrame(indices)
        df["is_active"] = True
        df["list_date"] = None

        logger.info(f"获取到 {len(df)} 个指数")
        return df

    def get_kline_data(self, code: str, period: str = "1d",
                       start_date: str = None, end_date: str = None) -> pd.DataFrame:
        """获取K线数据"""
        if not self.pro:
            logger.error("Tushare not initialized")
            return pd.DataFrame()

        if end_date is None:
            end_date = datetime.now().strftime("%Y%m%d")
        if start_date is None:
            start_date = HISTORY_START_DATE

        ts_code = self._convert_code(code)
        logger.info(f"正在获取K线数据: {ts_code} {period} ({start_date} - {end_date})")

        # 应用频率限制
        self._rate_limit()

        try:
            if period == "1d":
                df = self.pro.daily(ts_code=ts_code, start_date=start_date, end_date=end_date)
            elif period == "1w":
                df = self.pro.weekly(ts_code=ts_code, start_date=start_date, end_date=end_date)
            elif period == "1m":
                df = self.pro.monthly(ts_code=ts_code, start_date=start_date, end_date=end_date)
            else:
                df = self.pro.daily(ts_code=ts_code, start_date=start_date, end_date=end_date)

            if df is None or df.empty:
                logger.warning(f"Tushare返回空数据: {ts_code} {period}")
                return pd.DataFrame()

            df = df.rename(columns={
                "trade_date": "trade_date",
                "open": "open",
                "high": "high",
                "low": "low",
                "close": "close",
                "vol": "volume",
                "amount": "amount"
            })

            df["trade_date"] = pd.to_datetime(df["trade_date"]).dt.date
            df["period"] = period

            logger.info(f"获取到 {len(df)} 条K线数据: {ts_code} {period}")
            return df

        except Exception as e:
            error_msg = str(e)

            # 检测频率限制 - 等待5秒重试，最多重试2次
            if "频率超限" in error_msg or "frequency limit" in error_msg.lower():
                for attempt in range(2):
                    logger.warning(f"触发频率限制，等待5秒后重试 ({attempt + 1}/2)...")
                    time.sleep(5)
                    try:
                        if period == "1d":
                            df = self.pro.daily(ts_code=ts_code, start_date=start_date, end_date=end_date)
                        elif period == "1w":
                            df = self.pro.weekly(ts_code=ts_code, start_date=start_date, end_date=end_date)
                        elif period == "1m":
                            df = self.pro.monthly(ts_code=ts_code, start_date=start_date, end_date=end_date)
                        else:
                            df = self.pro.daily(ts_code=ts_code, start_date=start_date, end_date=end_date)

                        if df is not None and not df.empty:
                            df = df.rename(columns={
                                "trade_date": "trade_date",
                                "open": "open",
                                "high": "high",
                                "low": "low",
                                "close": "close",
                                "vol": "volume",
                                "amount": "amount"
                            })
                            df["trade_date"] = pd.to_datetime(df["trade_date"]).dt.date
                            df["period"] = period
                            logger.info(f"重试成功: {ts_code} {period}")
                            return df
                    except:
                        continue

                logger.warning(f"频率限制重试失败: {ts_code} {period}，稍后补采")
                return pd.DataFrame()

            logger.error(f"获取K线数据失败 {ts_code} {period}: {error_msg}")
            return pd.DataFrame()


class DataSourceManager:
    """数据源管理器"""

    def __init__(self, config: CollectorConfig = None, tushare_token: str = None):
        self.config = config or CollectorConfig()
        self.akshare = AKShareDataSource(config)
        self.sina = AKShareDataSource(config)
        self.tushare = TushareDataSource(config, tushare_token)
        self.use_tushare = tushare_token is not None

    def get_stock_list(self) -> pd.DataFrame:
        """获取股票列表"""
        if self.use_tushare:
            result = self.tushare.get_stock_list()
            if not result.empty:
                return result
            logger.warning("Tushare获取失败，尝试使用AKShare")
        return self.akshare.get_stock_list()

    def get_index_list(self) -> pd.DataFrame:
        """获取指数列表"""
        if self.use_tushare:
            result = self.tushare.get_index_list()
            if not result.empty:
                return result
            logger.warning("Tushare获取失败，尝试使用AKShare")
        return self.akshare.get_index_list()

    def get_kline_data(self, code: str, period: str = "1d",
                       start_date: str = None, end_date: str = None) -> pd.DataFrame:
        """获取K线数据"""
        if self.use_tushare:
            result = self.tushare.get_kline_data(code, period, start_date, end_date)
            if not result.empty:
                return result
            logger.warning("Tushare获取失败，尝试使用AKShare")
        return self.akshare.get_kline_data(code, period, start_date, end_date)

    def get_realtime_quotes(self, codes: List[str]) -> pd.DataFrame:
        """获取实时行情"""
        return self.sina.get_stock_list()
