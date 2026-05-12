export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  token_type: string;
  expires_in: number;
}

export interface StockInfo {
  code: string;
  name: string;
  market: string;
}

export interface KlineData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
}

export interface ScanResult {
  code: string;
  name: string;
  period: string;
  point_type: string;
  price: number;
  date: string;
  signals: Record<string, string>;
  // 完整分析数据
  kline: KlineData[];
  fx_list: Array<{ date: string; type: string; price: number; high: number; low: number }>;
  bi_list: Array<{ start_date: string; end_date: string; direction: string; price_change: number; high: number; low: number }>;
  zs_list: Array<{ start_date: string; end_date: string; zg: number; zd: number; height: number; mid: number }>;
  buy_points: Array<{ date: string; type: string; price: number; reason: string }>;
  sell_points: Array<{ date: string; type: string; price: number; reason: string }>;
  indicators: {
    ma: {
      dates: string[];
      ma5: (number | null)[];
      ma10: (number | null)[];
      ma20: (number | null)[];
      ma60: (number | null)[];
    };
    macd: { dif: number[]; dea: number[]; macd: number[] };
    kdj: { k: number[]; d: number[]; j: number[] };
  };
}

export interface AnalysisResult {
  code: string;
  name: string;
  period: string;
  kline: KlineData[];
  fx_list: Array<{ date: string; type: string; price: number; high: number; low: number }>;
  bi_list: Array<{ start_date: string; end_date: string; direction: string; price_change: number; high: number; low: number }>;
  zs_list: Array<{ start_date: string; end_date: string; zg: number; zd: number; height: number; mid: number }>;
  buy_points: Array<{ date: string; type: string; price: number; reason: string }>;
  sell_points: Array<{ date: string; type: string; price: number; reason: string }>;
  signals: Record<string, string>;
  indicators: {
    ma: {
      dates: string[];
      ma5: (number | null)[];
      ma10: (number | null)[];
      ma20: (number | null)[];
      ma60: (number | null)[];
    };
    macd: { dif: number[]; dea: number[]; macd: number[] };
    kdj: { k: number[]; d: number[]; j: number[] };
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}
