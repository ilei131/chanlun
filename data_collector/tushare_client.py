"""
Tushare API客户端 - 专业的金融数据源
"""
import time
import hashlib
import pandas as pd
import requests
from typing import Dict, List, Optional, Any
from loguru import logger
from datetime import datetime, timedelta


class TushareClient:
    """Tushare API客户端"""

    BASE_URL = "http://api.tushare.pro"

    def __init__(self, token: str, max_requests_per_minute: int = 50):
        self.token = token
        self.max_requests = max_requests_per_minute
        self.requests_in_minute = 0
        self.minute_start_time = time.time()
        self.session = requests.Session()

    def _wait_for_rate_limit(self):
        """等待速率限制"""
        current_time = time.time()
        elapsed = current_time - self.minute_start_time

        # 如果超过一分钟，重置计数器
        if elapsed >= 60:
            self.requests_in_minute = 0
            self.minute_start_time = current_time

        # 如果已经超过限制，等待到下一分钟
        if self.requests_in_minute >= self.max_requests:
            wait_time = 60 - elapsed
            logger.warning(f"Rate limit reached, waiting {wait_time:.1f}s...")
            time.sleep(wait_time)
            self.requests_in_minute = 0
            self.minute_start_time = time.time()

    def _request(self, api_name: str, params: Dict[str, Any]) -> Dict:
        """执行Tushare API请求"""
        self._wait_for_rate_limit()

        payload = {
            "api_name": api_name,
            "token": self.token,
            "params": params,
            "fields": ""
        }

        try:
            response = self.session.post(
                self.BASE_URL,
                json=payload,
                timeout=30
            )
            self.requests_in_minute += 1

            if response.status_code != 200:
                raise Exception(f"HTTP Error: {response.status_code}")

            result = response.json()

            if result.get("code") != 0:
                raise Exception(f"Tushare Error: {result.get('message')}")

            return result

        except Exception as e:
            logger.error(f"Tushare API request failed: {e}")
            raise

    def get_stock_list(self, is_hs: Optional[str] = None, list_status: str = "L") -> pd.DataFrame:
        """
        获取股票列表

        Args:
            is_hs: 是否沪深港通标的，N否 H沪股通 S深股通
            list_status: 上市状态 L上市 D退市 P暂停上市
        """
        params = {
            "list_status": list_status
        }

        if is_hs:
            params["is_hs"] = is_hs

        result = self._request("stock_basic", params)

        if "data" in result and "items" in result["data"]:
            df = pd.DataFrame(
                result["data"]["items"],
                columns=result["data"]["fields"]
            )
            return df

        return pd.DataFrame()

    def get_daily_kline(
        self,
        ts_code: Optional[str] = None,
        trade_date: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        adj: Optional[str] = "qfq"
    ) -> pd.DataFrame:
        """
        获取日线行情（前复权）

        Args:
            ts_code: 股票代码
            trade_date: 交易日期
            start_date: 开始日期
            end_date: 结束日期
            adj: 复权类型，None不复权 qfq前复权 hfq后复权
        """
        params = {}
        if ts_code:
            params["ts_code"] = ts_code
        if trade_date:
            params["trade_date"] = trade_date
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date

        result = self._request("daily", params)

        if "data" in result and "items" in result["data"]:
            df = pd.DataFrame(
                result["data"]["items"],
                columns=result["data"]["fields"]
            )

            # 如果需要复权数据
            if adj and adj != "None":
                df = self._adjust_kline(df, ts_code, start_date, end_date, adj)

            return df

        return pd.DataFrame()

    def get_weekly_kline(
        self,
        ts_code: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> pd.DataFrame:
        """获取周线行情"""
        params = {}
        if ts_code:
            params["ts_code"] = ts_code
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date

        result = self._request("weekly", params)

        if "data" in result and "items" in result["data"]:
            return pd.DataFrame(
                result["data"]["items"],
                columns=result["data"]["fields"]
            )

        return pd.DataFrame()

    def get_monthly_kline(
        self,
        ts_code: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> pd.DataFrame:
        """获取月线行情"""
        params = {}
        if ts_code:
            params["ts_code"] = ts_code
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date

        result = self._request("monthly", params)

        if "data" in result and "items" in result["data"]:
            return pd.DataFrame(
                result["data"]["items"],
                columns=result["data"]["fields"]
            )

        return pd.DataFrame()

    def get_adjust_factor(self, ts_code: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> pd.DataFrame:
        """获取复权因子"""
        params = {"ts_code": ts_code}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date

        result = self._request("adj_factor", params)

        if "data" in result and "items" in result["data"]:
            return pd.DataFrame(
                result["data"]["items"],
                columns=result["data"]["fields"]
            )

        return pd.DataFrame()

    def _adjust_kline(self, kline_df: pd.DataFrame, ts_code: str, start_date: Optional[str], end_date: Optional[str], adj: str = "qfq") -> pd.DataFrame:
        """计算复权价格"""
        if kline_df.empty:
            return kline_df

        try:
            # 获取复权因子
            factor_df = self.get_adjust_factor(ts_code, start_date, end_date)

            if factor_df.empty:
                return kline_df

            # 合并数据
            factor_df = factor_df[["trade_date", "adj_factor"]]
            kline_df = kline_df.merge(factor_df, on="trade_date", how="left")
            kline_df["adj_factor"] = kline_df["adj_factor"].fillna(1.0)

            # 计算复权价格
            for col in ["open", "high", "low", "close"]:
                if col in kline_df.columns:
                    kline_df[col] = kline_df[col] * kline_df["adj_factor"]

            # 只保留需要的列
            cols = [c for c in kline_df.columns if c != "adj_factor"]
            return kline_df[cols]

        except Exception as e:
            logger.warning(f"Failed to adjust kline: {e}")
            return kline_df

    def get_index_list(self, market: Optional[str] = None) -> pd.DataFrame:
        """获取指数列表"""
        params = {}
        if market:
            params["market"] = market

        result = self._request("index_basic", params)

        if "data" in result and "items" in result["data"]:
            return pd.DataFrame(
                result["data"]["items"],
                columns=result["data"]["fields"]
            )

        return pd.DataFrame()

    def get_index_daily(
        self,
        ts_code: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> pd.DataFrame:
        """获取指数日线行情"""
        params = {}
        if ts_code:
            params["ts_code"] = ts_code
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date

        result = self._request("index_daily", params)

        if "data" in result and "items" in result["data"]:
            return pd.DataFrame(
                result["data"]["items"],
                columns