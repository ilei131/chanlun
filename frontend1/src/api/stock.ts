import api from './client';
import { StockInfo, KlineData, ApiResponse } from '../types';

export const stockApi = {
  list: (params?: { market?: string; keyword?: string; page?: number; page_size?: number }) =>
    api.get<ApiResponse<{ total: number; page: number; page_size: number; stocks: StockInfo[] }>>('/stock/list', { params }),
  kline: (code: string, period?: string, start?: string, end?: string) =>
    api.get<ApiResponse<KlineData[]>>(`/stock/${code}/kline`, { params: { period, start, end } }),
};
