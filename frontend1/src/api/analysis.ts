import api from './client';
import { ScanResult, AnalysisResult, ApiResponse } from '../types';

export const analysisApi = {
  scan: (params: { period: string; point_type: string; direction?: string; max?: number }) =>
    api.get<ApiResponse<{ total: number; results: ScanResult[] }>>('/analysis/scan', { params }),
  analyze: (code: string, period?: string) =>
    api.get<ApiResponse<AnalysisResult>>(`/analyze/${code}`, { params: { period } }),
};
