"""
数据库连接和操作模块
"""
from contextlib import contextmanager
from typing import List, Dict, Any, Optional
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from loguru import logger

from config import DatabaseConfig


class Database:
    """数据库操作类"""

    def __init__(self, config: DatabaseConfig = None):
        self.config = config or DatabaseConfig()
        self.engine = create_engine(
            self.config.connection_string,
            poolclass=QueuePool,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            echo=False
        )
        self.Session = sessionmaker(bind=self.engine)

    @contextmanager
    def session_scope(self):
        """提供事务范围的session上下文管理器"""
        session = self.Session()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def execute(self, sql: str, params: Dict = None) -> None:
        """执行SQL语句"""
        with self.engine.connect() as conn:
            conn.execute(text(sql), params or {})
            conn.commit()

    def fetch_one(self, sql: str, params: Dict = None) -> Optional[Dict]:
        """查询单条记录"""
        with self.engine.connect() as conn:
            result = conn.execute(text(sql), params or {})
            row = result.fetchone()
            if row:
                return dict(row._mapping)
            return None

    def fetch_all(self, sql: str, params: Dict = None) -> List[Dict]:
        """查询多条记录"""
        with self.engine.connect() as conn:
            result = conn.execute(text(sql), params or {})
            return [dict(row._mapping) for row in result]

    def insert_dataframe(self, df: pd.DataFrame, table_name: str, if_exists: str = "append") -> int:
        """插入DataFrame到数据库"""
        if df.empty:
            return 0

        try:
            df.to_sql(
                table_name,
                self.engine,
                if_exists=if_exists,
                index=False,
                method="multi",
                chunksize=1000
            )
            return len(df)
        except Exception as e:
            logger.error(f"插入数据失败 {table_name}: {e}")
            raise

    def bulk_insert(self, table_name: str, data: List[Dict[str, Any]]) -> int:
        """批量插入数据"""
        if not data:
            return 0

        df = pd.DataFrame(data)
        return self.insert_dataframe(df, table_name)

    def upsert_klines(self, data: List[Dict]) -> int:
        """K线数据upsert操作"""
        if not data:
            return 0

        # 使用INSERT ON CONFLICT DO UPDATE
        sql = """
        INSERT INTO klines (stock_id, trade_date, period, open, high, low, close, volume, amount, turnover_rate)
        VALUES (:stock_id, :trade_date, :period, :open, :high, :low, :close, :volume, :amount, :turnover_rate)
        ON CONFLICT (stock_id, trade_date, period) DO UPDATE SET
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close,
            volume = EXCLUDED.volume,
            amount = EXCLUDED.amount,
            turnover_rate = EXCLUDED.turnover_rate,
            created_at = CURRENT_TIMESTAMP
        """

        with self.engine.connect() as conn:
            conn.execute(text(sql), data)
            conn.commit()
            return len(data)

    def upsert_stocks(self, data: List[Dict]) -> int:
        """股票基础信息upsert操作"""
        if not data:
            return 0

        sql = """
        INSERT INTO stocks (code, name, market, stock_type, list_date, is_active)
        VALUES (:code, :name, :market, :stock_type, :list_date, :is_active)
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            market = EXCLUDED.market,
            stock_type = EXCLUDED.stock_type,
            list_date = EXCLUDED.list_date,
            is_active = EXCLUDED.is_active,
            updated_at = CURRENT_TIMESTAMP
        """

        with self.engine.connect() as conn:
            conn.execute(text(sql), data)
            conn.commit()
            return len(data)

    def get_stock_id_by_code(self, code: str) -> Optional[int]:
        """根据股票代码获取ID"""
        sql = "SELECT id FROM stocks WHERE code = :code"
        result = self.fetch_one(sql, {"code": code})
        return result["id"] if result else None

    def get_all_active_stocks(self) -> List[Dict]:
        """获取所有活跃股票"""
        sql = """
        SELECT id, code, name, market, stock_type, list_date
        FROM stocks
        WHERE is_active = true
        ORDER BY code
        """
        return self.fetch_all(sql)

    def get_last_trade_date(self, stock_id: int, period: str = "1d") -> Optional[str]:
        """获取某只股票某周期的最后交易日期"""
        sql = """
        SELECT MAX(trade_date) as last_date
        FROM klines
        WHERE stock_id = :stock_id AND period = :period
        """
        result = self.fetch_one(sql, {"stock_id": stock_id, "period": period})
        return result["last_date"].strftime("%Y%m%d") if result and result["last_date"] else None

    def log_update(self, data_type: str, status: str, period: str = None,
                   total_count: int = None, success_count: int = None,
                   error_message: str = None) -> int:
        """记录数据更新日志"""
        sql = """
        INSERT INTO data_update_log (data_type, period, status, total_count, success_count, error_message, started_at, completed_at)
        VALUES (:data_type, :period, :status, :total_count, :success_count, :error_message, NOW(), NOW())
        RETURNING id
        """
        with self.engine.connect() as conn:
            result = conn.execute(text(sql), {
                "data_type": data_type,
                "period": period,
                "status": status,
                "total_count": total_count,
                "success_count": success_count,
                "error_message": error_message
            })
            conn.commit()
            return result.fetchone()[0]

    def close(self):
        """关闭数据库连接"""
        self.engine.dispose()
