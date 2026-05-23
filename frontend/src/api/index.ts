import axios from 'axios'

// 使用相对路径，前端会自动使用当前页面的域名/IP来访问API
// 生产环境可以通过 VITE_API_URL 环境变量配置
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 180000, // 3分钟，适应AI报告生成时间
})

// 请求拦截器：自动添加 Authorization header
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
}, (error) => {
    return Promise.reject(error)
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
    signal_type: string
}

export interface FractalCondition {
    type: string
    count: number
}

export interface CrossCondition {
    type: string
}

export interface PriceRangeCondition {
    min: number
    max: number
}

export interface ScreenerResult {
    code: string
    name: string
    market: string
    close: number
    change: number
    change_percent: number
    volume: number
    features: string[]
}

export interface KlineData {
    time: string
    open: number
    high: number
    low: number
    close: number
    volume: number
}

export interface MaData {
    ma5: number[]
    ma10: number[]
    ma20: number[]
    ma60: number[]
}

export interface MacdData {
    dif: number[]
    dea: number[]
    macd: number[]
}

export interface KdjData {
    k: number[]
    d: number[]
    j: number[]
}

export interface BuySellPoint {
    time: string
    price: number
    type: string
}

export interface ZsItem {
    start: string
    end: string
    zg: number
    zd: number
    gg: number
    dd: number
}

export interface FenXingItem {
    time: string
    type: string
    high: number
    low: number
}

export interface StockDetail {
    code: string
    name: string
    market: string
    industry: string
    list_date: string
    kline: KlineData[]
    ma: MaData
    macd: MacdData
    kdj: KdjData
    buy_points: BuySellPoint[]
    sell_points: BuySellPoint[]
    zs_list: ZsItem[]
    fx_list: FenXingItem[]
    features: string[]
}

export interface UserInfo {
    id: string
    username: string
    email: string
    tushare_token: string | null
    gemini_token: string | null
    openai_token: string | null
    openai_base_url: string | null
    openai_model: string | null
    preferred_ai_provider: string
}

export interface ApiResponse<T> {
    success: boolean
    message: string
    data: T | null
}

export interface StockAnalysisReport {
    id: number
    user_id: number
    stock_code: string
    stock_name: string
    market: string
    analysis_date: string
    ai_provider: string
    report_content: string
    summary?: string
    investment_rating?: string
    target_price?: number
    confidence_score?: number
    status: string
    error_message?: string
    created_at: string
    updated_at: string
}

const stocks = {
    search: async (keyword: string): Promise<ApiResponse<Stock[]>> => {
        const response = await api.get('/stocks/search', { params: { keyword } })
        return response.data
    },

    getDetail: async (code: string, market: string, days?: number): Promise<ApiResponse<StockDetail>> => {
        const response = await api.post('/stocks/detail', { code, period: market, days })
        return response.data
    },

    screener: async (request: ScreenerRequest): Promise<ApiResponse<{ results: ScreenerResult[], total: number }>> => {
        const response = await api.post('/stocks/screener', request)
        return response.data
    },
}

const auth = {
    login: async (params: { username: string; password: string }): Promise<ApiResponse<{ token: string, user: UserInfo }>> => {
        const response = await api.post('/auth/login', params)
        return response.data
    },

    register: async (params: { username: string; password: string; email?: string }): Promise<ApiResponse<UserInfo>> => {
        const response = await api.post('/auth/register', params)
        return response.data
    },

    logout: () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
    },

    getProfile: async (): Promise<ApiResponse<UserInfo>> => {
        const response = await api.get('/auth/profile')
        return response.data
    },

    updateAiToken: async (
        tushare_token: string,
        gemini_token: string,
        openai_token: string,
        openai_base_url: string,
        openai_model: string,
        preferred_ai_provider: string
    ): Promise<ApiResponse<UserInfo>> => {
        const response = await api.put('/auth/update-ai-token', {
            tushare_token,
            gemini_token,
            openai_token,
            openai_base_url,
            openai_model,
            preferred_ai_provider,
        })
        return response.data
    },

    updatePassword: async (old_password: string, new_password: string): Promise<ApiResponse<UserInfo>> => {
        const response = await api.put('/auth/update-password', { old_password, new_password })
        return response.data
    },
}

const analysis = {
    createReport: async (stock_code: string, stock_name: string, market: string): Promise<ApiResponse<{ report_id: number }>> => {
        const response = await api.post('/analysis/create-report', { stock_code, stock_name, market })
        return response.data
    },

    getReport: async (report_id: number): Promise<ApiResponse<StockAnalysisReport>> => {
        const response = await api.get(`/analysis/report/${report_id}`)
        return response.data
    },

    listReports: async (page: number = 1, page_size: number = 10): Promise<ApiResponse<{ reports: StockAnalysisReport[], total: number }>> => {
        const response = await api.get('/analysis/reports', { params: { page, page_size } })
        return response.data
    },

    deleteReport: async (report_id: number): Promise<ApiResponse<null>> => {
        const response = await api.delete(`/analysis/report/${report_id}`)
        return response.data
    },
}

export const apiClient = {
    stocks,
    auth,
    analysis,
}

export const stockApi = stocks
export const screenerApi = {
    run: stocks.screener
}
export const authApi = {
    ...auth,
    isAuthenticated: () => {
        const token = localStorage.getItem('token')
        return !!token
    },
    getUser: () => {
        const userStr = localStorage.getItem('user')
        return userStr ? JSON.parse(userStr) : null
    },
    updateTushareToken: async (tushare_token: string) => {
        const response = await api.put('/auth/update-tushare-token', { tushare_token })
        return response.data
    },
    deleteTushareToken: async () => {
        const response = await api.delete('/auth/tushare-token')
        return response.data
    },
    updateAiToken: async (params: {
        gemini_token?: string
        openai_token?: string
        preferred_ai_provider?: string
        openai_base_url?: string
        openai_model?: string
    }) => {
        const response = await api.put('/auth/update-ai-token', params)
        return response.data
    },
    deleteAiToken: async () => {
        const response = await api.delete('/auth/ai-token')
        return response.data
    },
}
export const analysisApi = {
    createReport: async (params: { stock_code: string; market: string }): Promise<ApiResponse<{ report_id: number }>> => {
        const response = await api.post('/analysis/report', params)
        return response.data
    },
    getReports: async (params: { page: number; page_size: number }): Promise<ApiResponse<{ reports: StockAnalysisReport[], total: number }>> => {
        const response = await api.get('/analysis/reports', { params })
        return response.data
    },
    deleteReport: async (id: number): Promise<ApiResponse<null>> => {
        const response = await api.delete(`/analysis/report/${id}`)
        return response.data
    },
}

export interface CreateReportRequest {
    stock_code: string
    market?: string
}
