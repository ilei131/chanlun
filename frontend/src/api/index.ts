import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
})

export interface Stock {
    id: number
    code: string
    name: string
    market: string
    stock_type: string
    is_active: boolean
}

export interface ScreenerRequest {
    chanlun_buy?: ChanlunBuyCondition
    fractal?: FractalCondition
    kdj_cross?: CrossCondition
    macd_cross?: CrossCondition
    price_range?: PriceRangeCondition
    sort_by?: string
    sort_order?: string
    page?: number
    page_size?: number
}

export interface ChanlunBuyCondition {
    enabled: boolean
    types: string[]
    require_current: boolean
}

export interface FractalCondition {
    enabled: boolean
    types: string[]
    periods: string[]
    require_confirmed: boolean
    min_quality_score?: number
    days_within?: number
}

export interface CrossCondition {
    enabled: boolean
    periods: string[]
    days_within: number
}

export interface PriceRangeCondition {
    enabled: boolean
    min: number
    max: number
}

export interface ScreenerResponse {
    total: number
    page: number
    page_size: number
    data: ScreenerResult[]
}

export interface ScreenerResult {
    stock_id: number
    code: string
    name: string
    current_price?: number
    change_pct?: number
    matched_conditions: MatchedConditions
    match_count: number
    match_ratio: number
}

export interface MatchedConditions {
    chanlun_buy?: ChanlunBuyMatch
    fractal?: FractalMatch
    kdj_cross?: CrossMatch
    macd_cross?: CrossMatch
}

export interface ChanlunBuyMatch {
    types: string[]
    signal_date: string
}

export interface FractalMatch {
    types: string[]
    fx_date: string
    quality_score?: number
}

export interface CrossMatch {
    periods: string[]
    latest_cross_date: string
}

export interface TechnicalIndicator {
    trade_date: string
    close: number
    kdj_k: number | null
    kdj_d: number | null
    kdj_j: number | null
    macd_dif: number | null
    macd_dea: number | null
    macd_hist: number | null
    ma5: number | null
    ma10: number | null
    ma20: number | null
    ma30: number | null
    boll_upper: number | null
    boll_mid: number | null
    boll_lower: number | null
}

export interface KlineData {
    id: number
    stock_id: number
    trade_date: string
    period: string
    open: number
    high: number
    low: number
    close: number
    volume: number
    amount: number
}

export interface SearchResult {
    stock_id?: number
    ts_code: string
    code: string
    name: string
    market: string
    area?: string
    industry?: string
    list_date?: string
}

export interface StockDetailInfo {
    id: number
    code: string
    name: string
    market: string
    stock_type: string
    list_date?: string
    is_active: boolean
}

export interface StockDetail {
    ts_code: string
    code: string
    name: string
    market: string
    current_price?: number
    change_pct?: number
    area?: string
    industry?: string
    list_date?: string
    stock_type?: string
    kline_data: KlineResponse[]
    chanlun_signals: ChanlunSignals
    indicators: TechnicalIndicators
}

export interface KlineResponse {
    trade_date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
    amount?: number
    bi_points: BiPoint[]
}

export interface BiPoint {
    position: number
    direction: string
    price: number
    date: string
}

export interface ChanlunSignals {
    buy_signals: BuySignalResponse[]
    zs_list: ZhongShuResponse[]
    fx_list: FenXingResponse[]
    bi_list: BiResponse[]
}

export interface BiResponse {
    start_date: string
    end_date: string
    direction: string
    price_change: number
    high: number
    low: number
}

export interface BuySignalResponse {
    signal_type: string
    date: string
    price: number
}

export interface ZhongShuResponse {
    start_date: string
    end_date: string
    zd: number
    zg: number
    gg: number
    dd: number
    bi_count: number
    bis: BiResponse[]
}

export interface FenXingResponse {
    date: string
    price: number
    direction: string
}

export interface TechnicalIndicators {
    macd: MacdData[]
    kdj: KdjData[]
}

export interface MacdData {
    trade_date: string
    dif: number
    dea: number
    hist: number
}

export interface KdjData {
    trade_date: string
    k: number
    d: number
    j: number
}

export const stockApi = {
    getAll: () => api.get<Stock[]>('/stocks'),
    getById: (id: number) => api.get<StockDetailInfo>(`/stocks/${id}`),
    getKlines: (id: number, period: string) => api.get<KlineData[]>(`/stocks/${id}/klines/${period}`),
    search: (keyword: string) => api.get<SearchResult[]>('/stocks/search', { params: { keyword } }),
    getDetail: (code: string, period?: string, days?: number) => api.post<StockDetail>('/stocks/detail', { code, period, days }),
}

export const indicatorsApi = {
    getByStock: (stockId: number, period: string) => api.get<TechnicalIndicator[]>(`/indicators/${stockId}/${period}`),
}

export const screenerApi = {
    run: (params: ScreenerRequest) => api.post<ScreenerResponse>('/screener/run', params),
}