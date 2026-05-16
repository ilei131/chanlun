import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle, TrendingUp, TrendingDown, Target, Zap, Building2, MapPin, Calendar, Briefcase, Activity, Star, BarChart3, Minus } from 'lucide-react'
import { stockApi, StockDetail as StockDetailType, BuySignalResponse } from '@/api'
import KlineChart, { KlineData } from '@/components/KlineChart'
import MacdChart from '@/components/MacdChart'
import KdjChart from '@/components/KdjChart'

const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number) => {
    let timer: ReturnType<typeof setTimeout> | null = null
    return (...args: Parameters<T>) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => fn(...args), delay)
    }
}

const formatDate = (dateStr: string): string => {
    if (dateStr.length === 8) {
        return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    }
    return dateStr
}

type TabKey = 'signals' | 'zs' | 'bi' | 'fx'

interface MaData {
    dates: string[]
    ma5: (number | null)[]
    ma10: (number | null)[]
    ma20: (number | null)[]
    ma60: (number | null)[]
}

interface ZsBiItem {
    start_date: string
    end_date: string
    direction: string
    high: number
    low: number
}

interface ZsItem {
    start_date: string
    end_date: string
    zg: number
    zd: number
    gg: number
    dd: number
    height: number
    mid: number
    bis: ZsBiItem[]
}

function StockDetail() {
    const { code } = useParams<{ code: string }>()
    const navigate = useNavigate()
    const [detail, setDetail] = useState<StockDetailType | null>(null)
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState('daily')
    const days = 365
    const [error, setError] = useState('')
    const [activeTab, setActiveTab] = useState<TabKey>('signals')

    const debouncedFetchStockDetail = useCallback(
        (code: string, period: string, days: number) => {
            setLoading(true)
            setError('')
            stockApi.getDetail(code, period, days)
                .then(response => {
                    setDetail(response.data)
                })
                .catch((error: any) => {
                    console.error('获取股票详情失败:', error)
                    setError(error.message || '获取股票详情失败')
                })
                .finally(() => {
                    setLoading(false)
                })
        },
        []
    )

    const debouncedFetchStockDetailRef = useRef(debounce(debouncedFetchStockDetail, 500))

    useEffect(() => {
        if (code) {
            debouncedFetchStockDetailRef.current(code, period, days)
        }
    }, [code, period, days])

    const getSignalTypeName = (type: string) => {
        const types: Record<string, string> = {
            'first_buy': '一买',
            'second_buy': '二买',
            'third_buy': '三买',
            'first_sell': '一卖',
            'second_sell': '二卖',
            'third_sell': '三卖',
        }
        return types[type] || type
    }

    const calculateMA = (klineData: KlineData[], period: number): (number | null)[] => {
        const result: (number | null)[] = []
        for (let i = 0; i < klineData.length; i++) {
            if (i < period - 1) {
                result.push(null)
            } else {
                let sum = 0
                for (let j = i - period + 1; j <= i; j++) {
                    sum += klineData[j].close
                }
                result.push(sum / period)
            }
        }
        return result
    }

    const prepareKlineData = () => {
        if (!detail?.kline_data.length) return { kline: [], ma: { dates: [], ma5: [], ma10: [], ma20: [], ma60: [] }, zsList: [] }

        let kline: KlineData[] = detail.kline_data.map(k => ({
            date: k.trade_date,
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
            volume: k.volume,
        }))

        kline = kline.sort((a, b) => a.date.localeCompare(b.date))

        const ma5 = calculateMA(kline, 5)
        const ma10 = calculateMA(kline, 10)
        const ma20 = calculateMA(kline, 20)
        const ma60 = calculateMA(kline, 60)

        const ma: MaData = {
            dates: kline.map(k => k.date),
            ma5,
            ma10,
            ma20,
            ma60,
        }

        const zsList: ZsItem[] = (detail.chanlun_signals.zs_list || []).map(zs => ({
            start_date: zs.start_date,
            end_date: zs.end_date,
            zg: zs.zg,
            zd: zs.zd,
            gg: zs.gg,
            dd: zs.dd,
            height: zs.zg - zs.zd,
            mid: (zs.zg + zs.zd) / 2,
            bis: (zs.bis || []).map(bi => ({
                start_date: bi.start_date,
                end_date: bi.end_date,
                direction: bi.direction,
                high: bi.high,
                low: bi.low,
            })),
        }))

        return { kline, ma, zsList }
    }

    const prepareMacdData = () => {
        if (!detail?.indicators.macd.length) return null
        return {
            dates: detail.indicators.macd.map(m => m.trade_date),
            dif: detail.indicators.macd.map(m => m.dif),
            dea: detail.indicators.macd.map(m => m.dea),
            macd: detail.indicators.macd.map(m => m.hist),
        }
    }

    const prepareKdjData = () => {
        if (!detail?.indicators.kdj.length) return null
        return {
            dates: detail.indicators.kdj.map(k => k.trade_date),
            kdj: {
                k: detail.indicators.kdj.map(k => k.k),
                d: detail.indicators.kdj.map(k => k.d),
                j: detail.indicators.kdj.map(k => k.j),
            },
        }
    }

    const getCurrentFeatures = (): string[] => {
        const features: string[] = []
        if (!detail) return features

        const lastKdj = detail.indicators.kdj[detail.indicators.kdj.length - 1]
        if (lastKdj && lastKdj.k > lastKdj.d && lastKdj.k < 30) {
            features.push('KDJ金叉')
        }

        const lastMacd = detail.indicators.macd[detail.indicators.macd.length - 1]
        if (lastMacd && lastMacd.dif > lastMacd.dea && lastMacd.hist > 0) {
            features.push('MACD金叉')
        }

        if (detail.chanlun_signals.zs_list.length > 0) {
            features.push('有中枢')
        }

        const latestSignals = detail.chanlun_signals.buy_signals.slice(-3)
        if (latestSignals.length > 0) {
            const signalTypes = latestSignals.map(s => getSignalTypeName(s.signal_type))
            features.push(...signalTypes)
        }

        return features.length > 0 ? features : ['暂无特征']
    }

    const tabs: { key: TabKey; label: string; icon: typeof Target }[] = [
        { key: 'signals', label: '买卖信号', icon: Target },
        { key: 'zs', label: '中枢分析', icon: Minus },
        { key: 'bi', label: '笔线段', icon: TrendingUp },
        { key: 'fx', label: '分型', icon: Star },
    ]

    const { kline, ma, zsList } = prepareKlineData()
    const macdData = prepareMacdData()
    const kdjData = prepareKdjData()

    const buyPoints = detail?.chanlun_signals.buy_signals
        .filter(s => s.signal_type.includes('buy'))
        .map(s => ({
            date: s.date,
            type: getSignalTypeName(s.signal_type),
            price: s.price,
        })) || []

    const sellPoints = detail?.chanlun_signals.buy_signals
        .filter(s => s.signal_type.includes('sell'))
        .map(s => ({
            date: s.date,
            type: getSignalTypeName(s.signal_type),
            price: s.price,
        })) || []

    const fxList = detail?.chanlun_signals.fx_list.map(fx => ({
        date: fx.date,
        price: fx.price,
        direction: fx.direction,
    })) || []

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
                <div className="relative">
                    <Loader2 className="w-12 h-12 animate-spin text-purple-500" />
                    <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl animate-pulse" />
                </div>
                <span className="mt-6 text-slate-400 text-sm">正在分析股票数据...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
                <div className="w-full max-w-md mx-4">
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                        <div className="flex items-start gap-4">
                            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">获取数据失败</h3>
                                <p className="text-slate-400 text-sm">{error}</p>
                                <button
                                    onClick={() => navigate('/')}
                                    className="mt-4 w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                                >
                                    返回首页
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!detail) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
                <div className="w-full max-w-md mx-4">
                    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 text-center">
                        <BarChart3 className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                        <p className="text-slate-400 mb-4">无法获取股票数据</p>
                        <button
                            onClick={() => navigate('/')}
                            className="py-2.5 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                        >
                            返回搜索
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div>
                            <h1 className="text-lg font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                缠论分析
                            </h1>
                            <p className="text-xs text-slate-400">深度技术分析平台</p>
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            返回首页
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Hero Card - Stock Info */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/80 to-purple-900/30 backdrop-blur-xl border border-slate-700/50">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-pink-600/10" />
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
                    <div className="relative p-6 sm:p-8">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                            {/* Stock Name & Code */}
                            <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <h2 className="text-2xl sm:text-3xl font-bold text-white">
                                        {detail.name}
                                    </h2>
                                    <span className="px-3 py-1 bg-slate-700/80 backdrop-blur text-slate-300 text-sm font-mono rounded-full">
                                        {detail.code}.{detail.market}
                                    </span>
                                </div>
                                <p className="text-slate-400 text-sm">
                                    基于缠论理论的专业技术分析
                                </p>
                            </div>

                            {/* Price Display */}
                            <div className="text-right">
                                <p className="text-4xl sm:text-5xl font-bold text-white mb-2">
                                    {detail.current_price?.toFixed(2) || '--'}
                                </p>
                                <p className={`text-lg font-semibold flex items-center justify-end gap-2 ${detail.change_pct !== undefined && detail.change_pct >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    {detail.change_pct !== undefined ? (
                                        <>
                                            {detail.change_pct >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                            {detail.change_pct >= 0 ? '+' : ''}{detail.change_pct.toFixed(2)}%
                                        </>
                                    ) : '--'}
                                </p>
                            </div>
                        </div>

                        {/* Period Selector */}
                        <div className="flex items-center gap-4 mt-6 pt-6 border-t border-slate-700/50">
                            <span className="text-sm text-slate-400">周期:</span>
                            <div className="flex bg-slate-800/60 backdrop-blur rounded-full p-1">
                                {['daily', 'weekly', 'monthly'].map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPeriod(p)}
                                        className="px-4 py-2 text-sm font-medium rounded-full transition-all duration-300"
                                        style={{
                                            background: period === p ? 'linear-gradient(135deg, #a855f7, #ec4899)' : 'transparent',
                                            color: period === p ? 'white' : 'var(--text-secondary)',
                                        }}
                                    >
                                        {p === 'daily' ? '日K' : p === 'weekly' ? '周K' : '月K'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Market Type */}
                    <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl p-4 border border-slate-700/50 hover:border-purple-500/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <Briefcase className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">市场类型</p>
                                <p className="text-sm font-semibold text-white">{detail.stock_type || '--'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Industry */}
                    <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl p-4 border border-slate-700/50 hover:border-green-500/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-green-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">所属行业</p>
                                <p className="text-sm font-semibold text-white">{detail.industry || '--'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Area */}
                    <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl p-4 border border-slate-700/50 hover:border-yellow-500/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                                <MapPin className="w-5 h-5 text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">地区</p>
                                <p className="text-sm font-semibold text-white">{detail.area || '--'}</p>
                            </div>
                        </div>
                    </div>

                    {/* List Date */}
                    <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl p-4 border border-slate-700/50 hover:border-purple-500/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">上市日期</p>
                                <p className="text-sm font-semibold text-white">{detail.list_date ? formatDate(detail.list_date) : '--'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Current Features Banner */}
                <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 backdrop-blur-xl rounded-2xl p-4 border border-purple-500/20">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-pink-400" />
                            <span className="text-sm font-semibold text-white">当前特征</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {getCurrentFeatures().length > 0 && getCurrentFeatures()[0] !== '暂无特征' ? (
                                getCurrentFeatures().map((feature, index) => {
                                    const isBuy = feature.includes('买') || feature.includes('金叉')
                                    return (
                                        <span
                                            key={index}
                                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 hover:scale-105"
                                            style={{
                                                background: isBuy ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                                                color: isBuy ? '#ef4444' : '#22c55e',
                                                border: `1px solid ${isBuy ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                                            }}
                                        >
                                            {feature}
                                        </span>
                                    )
                                })
                            ) : (
                                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-700/50 text-slate-400">
                                    暂无特征
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* K-line Chart */}
                    <div className="lg:col-span-2 bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-700/50">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-purple-400" />
                                    K线图
                                </h3>
                                <div className="flex items-center gap-4 text-xs text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                                        MA5
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                                        MA10
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                        MA20
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                        MA60
                                    </span>
                                </div>
                            </div>
                        </div>
                        <KlineChart kline={kline} ma={ma} buyPoints={buyPoints} sellPoints={sellPoints} zsList={zsList} fxList={fxList} />
                    </div>

                    {/* MACD Chart */}
                    <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-700/50">
                            <h3 className="text-base font-semibold text-white flex items-center gap-2">
                                <Zap className="w-5 h-5 text-blue-400" />
                                MACD
                            </h3>
                        </div>
                        {macdData && <MacdChart macd={macdData} />}
                    </div>

                    {/* KDJ Chart */}
                    <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-700/50">
                            <h3 className="text-base font-semibold text-white flex items-center gap-2">
                                <Target className="w-5 h-5 text-green-400" />
                                KDJ
                            </h3>
                        </div>
                        {kdjData && <KdjChart dates={kdjData.dates} kdj={kdjData.kdj} />}
                    </div>
                </div>

                {/* Analysis Tabs */}
                <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
                    {/* Tab Headers */}
                    <div className="flex border-b border-slate-700/50">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-all duration-300 relative"
                                style={{
                                    color: activeTab === tab.key ? '#c084fc' : '#9ca3af',
                                    background: activeTab === tab.key ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                                }}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                                {activeTab === tab.key && (
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {activeTab === 'signals' && (
                            <div className="space-y-6">
                                {/* Buy signals */}
                                <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/10">
                                    <h4 className="text-sm font-semibold text-red-400 mb-4 flex items-center gap-2">
                                        <Target className="w-4 h-4" />
                                        买点信号 ({detail.chanlun_signals.buy_signals.filter(s => s.signal_type.includes('buy')).length})
                                    </h4>
                                    {detail.chanlun_signals.buy_signals.filter(s => s.signal_type.includes('buy')).length === 0 ? (
                                        <p className="text-sm text-slate-400 text-center py-4">暂无买点信号</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-slate-700/50">
                                                        {['日期', '类型', '价格'].map((h) => (
                                                            <th key={h} className="px-4 py-2 text-left text-xs font-medium text-slate-400">
                                                                {h}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {detail.chanlun_signals.buy_signals.filter(s => s.signal_type.includes('buy')).map((signal: BuySignalResponse, index) => (
                                                        <tr key={index} className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors">
                                                            <td className="px-4 py-3 text-sm font-mono text-white">{signal.date}</td>
                                                            <td className="px-4 py-3">
                                                                <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/20 text-red-400">
                                                                    {getSignalTypeName(signal.signal_type)}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm font-mono text-red-400">{signal.price.toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Sell signals */}
                                <div className="bg-green-500/5 rounded-xl p-4 border border-green-500/10">
                                    <h4 className="text-sm font-semibold text-green-400 mb-4 flex items-center gap-2">
                                        <Zap className="w-4 h-4" />
                                        卖点信号 ({detail.chanlun_signals.buy_signals.filter(s => s.signal_type.includes('sell')).length})
                                    </h4>
                                    {detail.chanlun_signals.buy_signals.filter(s => s.signal_type.includes('sell')).length === 0 ? (
                                        <p className="text-sm text-slate-400 text-center py-4">暂无卖点信号</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-slate-700/50">
                                                        {['日期', '类型', '价格'].map((h) => (
                                                            <th key={h} className="px-4 py-2 text-left text-xs font-medium text-slate-400">
                                                                {h}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {detail.chanlun_signals.buy_signals.filter(s => s.signal_type.includes('sell')).map((signal: BuySignalResponse, index) => (
                                                        <tr key={index} className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors">
                                                            <td className="px-4 py-3 text-sm font-mono text-white">{signal.date}</td>
                                                            <td className="px-4 py-3">
                                                                <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/20 text-green-400">
                                                                    {getSignalTypeName(signal.signal_type)}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-sm font-mono text-green-400">{signal.price.toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'zs' && (
                            <div>
                                <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                                    <Minus className="w-4 h-4 text-purple-400" />
                                    中枢列表 ({detail.chanlun_signals.zs_list.length})
                                </h4>
                                {detail.chanlun_signals.zs_list.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-8">暂无中枢数据</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-slate-700/50">
                                                    {['开始日期', '结束日期', '中枢上沿(ZG)', '中枢下沿(ZD)', '中枢高度', '中枢中轴'].map((h) => (
                                                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-slate-400">
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.chanlun_signals.zs_list.map((zs, index) => (
                                                    <tr key={index} className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-mono text-white">{zs.start_date}</td>
                                                        <td className="px-4 py-3 text-sm font-mono text-white">{zs.end_date}</td>
                                                        <td className="px-4 py-3 text-sm font-mono text-red-400">{zs.zg.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-sm font-mono text-green-400">{zs.zd.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-sm font-mono text-yellow-400">{(zs.zg - zs.zd).toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-sm font-mono text-purple-400">{((zs.zg + zs.zd) / 2).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'bi' && (
                            <div>
                                <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-blue-400" />
                                    笔列表 ({detail.chanlun_signals.bi_list.length})
                                </h4>
                                {detail.chanlun_signals.bi_list.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-8">暂无笔数据</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-slate-700/50">
                                                    {['开始日期', '结束日期', '方向', '价格变动', '最高', '最低'].map((h) => (
                                                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-slate-400">
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.chanlun_signals.bi_list.map((bi, index) => (
                                                    <tr key={index} className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-mono text-white">{bi.start_date}</td>
                                                        <td className="px-4 py-3 text-sm font-mono text-white">{bi.end_date}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`text-xs px-2.5 py-1 rounded-full ${bi.direction === 'up' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                                                {bi.direction === 'up' ? '上升' : '下降'}
                                                            </span>
                                                        </td>
                                                        <td className={`px-4 py-3 text-sm font-mono ${bi.price_change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                            {bi.price_change >= 0 ? '+' : ''}{bi.price_change.toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-mono text-white">{bi.high.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-sm font-mono text-white">{bi.low.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'fx' && (
                            <div>
                                <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                                    <Star className="w-4 h-4 text-yellow-400" />
                                    分型列表 ({detail.chanlun_signals.fx_list.length})
                                </h4>
                                {detail.chanlun_signals.fx_list.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-8">暂无分型数据</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-slate-700/50">
                                                    {['日期', '类型', '价格'].map((h) => (
                                                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-slate-400">
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.chanlun_signals.fx_list.map((fx, index) => (
                                                    <tr key={index} className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-mono text-white">{fx.date}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`text-xs px-2.5 py-1 rounded-full ${fx.direction === 'top' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                                                {fx.direction === 'top' ? '顶分型' : '底分型'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-mono text-white">{fx.price.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800 mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="text-center text-sm text-slate-500">
                        <p>缠论分析平台 - 基于缠论理论的专业股票技术分析工具</p>
                        <p className="mt-1">数据仅供参考，不构成投资建议</p>
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default StockDetail
