"""
数据采集器配置
"""
import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()


def _get_env_int(key: str, default: str) -> int:
    """安全获取环境变量整数"""
    try:
        return int(os.getenv(key, default))
    except (ValueError, TypeError):
        return int(default)


def _get_env_float(key: str, default: str) -> float:
    """安全获取环境变量浮点数"""
    try:
        return float(os.getenv(key, default))
    except (ValueError, TypeError):
        return float(default)


def _get_env_bool(key: str, default: str) -> bool:
    """安全获取环境变量布尔值"""
    return os.getenv(key, default).lower() == "true"


@dataclass
class DatabaseConfig:
    """数据库配置"""
    host: str = field(default_factory=lambda: os.getenv("DB_HOST", "localhost"))
    port: int = field(default_factory=lambda: _get_env_int("DB_PORT", "5432"))
    name: str = field(default_factory=lambda: os.getenv("DB_NAME", "chanlun"))
    user: str = field(default_factory=lambda: os.getenv("DB_USER", "postgres"))
    password: str = field(default_factory=lambda: os.getenv("DB_PASSWORD", ""))

    @property
    def connection_string(self) -> str:
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"


@dataclass
class CollectorConfig:
    """采集器配置"""
    request_delay: float = field(default_factory=lambda: _get_env_float("REQUEST_DELAY", "2.0"))
    batch_size: int = field(default_factory=lambda: _get_env_int("BATCH_SIZE", "1000"))
    max_retry: int = field(default_factory=lambda: _get_env_int("MAX_RETRY", "3"))
    concurrent_requests: int = field(default_factory=lambda: _get_env_int("CONCURRENT_REQUESTS", "5"))
    auto_update: bool = field(default_factory=lambda: _get_env_bool("AUTO_UPDATE", "false"))
    update_time: str = field(default_factory=lambda: os.getenv("UPDATE_TIME", "18:00"))


# 市场配置
MARKET_CONFIG = {
    "SH": {"name": "上海", "prefix": ["600", "601", "603", "605", "688", "689"]},
    "SZ": {"name": "深圳", "prefix": ["000", "001", "002", "003", "300", "301"]},
    "BJ": {"name": "北京", "prefix": ["430", "831", "832", "833", "870", "872"]},
}

# 股票类型映射
STOCK_TYPE_MAP = {
    "stock": "A股",
    "index": "指数",
    "fund": "基金",
    "etf": "ETF",
}

# K线周期配置
PERIOD_CONFIG = {
    "1d": {"name": "日线", "ak_period": "daily"},
    "1w": {"name": "周线", "ak_period": "weekly"},
    "1m": {"name": "月线", "ak_period": "monthly"},
}

# 历史数据起始日期
HISTORY_START_DATE = "20000101"
