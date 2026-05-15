import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import { Loader2, AlertCircle, TrendingUp, TrendingDown, Target, Zap, ArrowLeft, Building2, MapPin, Calendar, Briefcase, Activity } from 'lucide-react'
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
            console.log(`[debouncedFetchStockDetail] 触发请求: code=${code}, period=${period}, days=${days}`)
            setLoading(true)
            setError('')
            stockApi.getDetail(code, period, days)
                .then(response => {
                    console.log(`[debouncedFetchStockDetail] 请求成功: 数据长度=${response.data?.kline_data?.length}`)
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
            console.log(`[useEffect] 触发请求: code=${code}, period=${period}`)
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

    const tabs: { key: TabKey; label: string }[] = [
        { key: 'signals', label: '买卖信号' },
        { key: 'zs', label: '中枢分析' },
        { key: 'bi', label: '笔线段' },
        { key: 'fx', label: '分型' },
    ]

    const { kline, ma, zsList } = prepareKlineData()
    const macdData = prepareMacdData()
    const kdjData = prepareKdjData()

    console.log('=== StockDetail 数据调试 ===')
    console.log('detail:', detail)
    console.log('kline长度:', kline.length)
    if (kline.length > 0) {
        console.log('最后一条K线:', kline[kline.length - 1])
    }
    console.log('current_price:', detail?.current_price)
    console.log('change_pct:', detail?.change_pct)
    console.log('zsList:', zsList)
    console.log('buy_signals:', detail?.chanlun_signals.buy_signals)
    console.log('fx_list:', detail?.chanlun_signals.fx_list)
    console.log('=== StockDetail 数据调试结束 ===')

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
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    正在分析中...
                </span>
            </div>
        )
    }

    if (error) {
        return (
            <div
                className="flex items-center gap-3 p-4 rounded-lg text-sm"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
            >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
            </div>
        )
    }

    if (!detail) {
        return (
            <div className="text-center py-20">
                <p style={{ color: 'var(--text-secondary)' }}>无法获取股票数据</p>
                <button
                    onClick={() => navigate('/')}
                    className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: 'var(--accent)', color: 'white' }}
                >
                    返回搜索
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        个股分析
                    </h1>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        基于缠论理论对个股进行深度技术分析
                    </p>
                </div>
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                    style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--accent)';
                        e.currentTarget.style.color = 'white';
                        e.currentTarget.style.borderColor = 'var(--accent)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回
                </button>
            </div>

            {/* Main Stock Card */}
            <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
                {/* Stock Header - Name, Code, Price */}
                <div className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                {detail.name}
                            </span>
                            <span
                                className="px-2 py-0.5 rounded text-xs font-mono"
                                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                            >
                                {detail.code}.{detail.market}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Price Display */}
                        <div className="text-right">
                            <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                {detail.current_price?.toFixed(2) || '--'}
                            </p>
                            <p className="text-sm flex items-center justify-end gap-1" style={{ color: detail.change_pct !== undefined && detail.change_pct >= 0 ? '#ef4444' : '#22c55e' }}>
                                {detail.change_pct !== undefined ? (
                                    <>
                                        {detail.change_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {detail.change_pct >= 0 ? '+' : ''}{detail.change_pct.toFixed(2)}%
                                    </>
                                ) : '--'}
                            </p>
                        </div>

                        {/* Period selector */}
                        <div className="flex rounded-lg p-1" style={{ background: 'var(--bg-secondary)' }}>
                            {['daily', 'weekly', 'monthly'].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className="px-3.5 py-1.5 text-sm font-medium rounded-md transition-all duration-200"
                                    style={{
                                        background: period === p ? 'var(--accent)' : 'transparent',
                                        color: period === p ? 'white' : 'var(--text-secondary)',
                                    }}
                                >
                                    {p === 'daily' ? '日K' : p === 'weekly' ? '周K' : '月K'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div style={{ borderBottom: '1px solid var(--border)' }} />

                {/* Stock Info Row */}
                <div className="px-6 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-3">
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: 'rgba(59,130,246,0.1)' }}
                            >
                                <Briefcase className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                            </div>
                            <div>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>市场类型</p>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {detail.stock_type || '--'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: 'rgba(16,185,129,0.1)' }}
                            >
                                <Building2 className="w-4 h-4" style={{ color: '#10b981' }} />
                            </div>
                            <div>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>所属行业</p>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {detail.industry || '--'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: 'rgba(245,158,11,0.1)' }}
                            >
                                <MapPin className="w-4 h-4" style={{ color: '#f59e0b' }} />
                            </div>
                            <div>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>地区</p>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {detail.area || '--'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: 'rgba(139,92,246,0.1)' }}
                            >
                                <Calendar className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                            </div>
                            <div>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>上市日期</p>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {detail.list_date ? formatDate(detail.list_date) : '--'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div style={{ borderBottom: '1px solid var(--border)' }} />

                {/* Current Features Section */}
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: 'rgba(236,72,153,0.1)' }}
                            >
                                <Activity className="w-3.5 h-3.5" style={{ color: '#ec4899' }} />
                            </div>
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>当前特征</span>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                            {getCurrentFeatures().length > 0 && getCurrentFeatures()[0] !== '暂无特征' ? (
                                getCurrentFeatures().map((feature, index) => {
                                    const isBuy = feature.includes('买') || feature.includes('金叉')
                                    return (
                                        <span
                                            key={index}
                                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-transform hover:scale-105"
                                            style={{
                                                background: isBuy ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                                                color: isBuy ? '#ef4444' : '#22c55e',
                                            }}
                                        >
                                            {feature}
                                        </span>
                                    )
                                })
                            ) : (
                                <span
                                    className="px-3 py-1.5 rounded-full text-xs font-medium"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-secondary)',
                                    }}
                                >
                                    暂无特征
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* K-line Chart */}
            <div
                className="rounded-xl overflow-hidden"
                style={{ background: '#1e2130', border: '1px solid var(--border)' }}
            >
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #2a2d3e' }}>
                    <h3 className="text-sm font-semibold text-white">K线图</h3>
                </div>
                <KlineChart kline={kline} ma={ma} buyPoints={buyPoints} sellPoints={sellPoints} zsList={zsList} fxList={fxList} />
            </div>

            {/* MACD Chart */}
            <div
                className="rounded-xl overflow-hidden"
                style={{ background: '#1e2130', border: '1px solid var(--border)' }}
            >
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #2a2d3e' }}>
                    <h3 className="text-sm font-semibold text-white">MACD</h3>
                </div>
                {macdData && <MacdChart macd={macdData} />}
            </div>

            {/* KDJ Chart */}
            <div
                className="rounded-xl overflow-hidden"
                style={{ background: '#1e2130', border: '1px solid var(--border)' }}
            >
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #2a2d3e' }}>
                    <h3 className="text-sm font-semibold text-white">KDJ</h3>
                </div>
                {kdjData && <KdjChart dates={kdjData.dates} kdj={kdjData.kdj} />}
            </div>

            {/* Tabs Section */}
            <div
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
                {/* Tab Headers */}
                <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className="px-6 py-3 text-sm font-medium transition-colors relative"
                            style={{
                                color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
                            }}
                        >
                            {tab.label}
                            {activeTab === tab.key && (
                                <div
                                    className="absolute bottom-0 left-0 right-0 h-0.5"
                                    style={{ background: 'var(--accent)' }}
                                />
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="p-4">
                    {activeTab === 'signals' && (
                        <div className="space-y-4">
                            {/* Buy points */}
                            <div>
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#ef4444' }}>
                                    <Target className="w-4 h-4" />
                                    买点信号 ({detail.chanlun_signals.buy_signals.filter(s => s.signal_type.includes('buy')).length})
                                </h4>
                                {detail.chanlun_signals.buy_signals.filter(s => s.signal_type.includes('buy')).length === 0 ? (
                                    <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                                        暂无买点信号
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                    {['日期', '类型', '价格', '原因'].map((h) => (
                                                        <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.chanlun_signals.buy_signals.filter(s => s.signal_type.includes('buy')).map((signal: BuySignalResponse, index) => (
                                                    <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{signal.date}</td>
                                                        <td className="px-4 py-2">
                                                            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                                                                {getSignalTypeName(signal.signal_type)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 text-sm font-mono" style={{ color: '#ef4444' }}>{signal.price.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Sell points */}
                            <div>
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#22c55e' }}>
                                    <Zap className="w-4 h-4" />
                                    卖点信号 ({detail.chanlun_signals.buy_signals.filter(s => s.signal_type.includes('sell')).length})
                                </h4>
                                {detail.chanlun_signals.buy_signals.filter(s => s.signal_type.includes('sell')).length === 0 ? (
                                    <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                                        暂无卖点信号
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                    {['日期', '类型', '价格', '原因'].map((h) => (
                                                        <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.chanlun_signals.buy_signals.filter(s => s.signal_type.includes('sell')).map((signal: BuySignalResponse, index) => (
                                                    <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{signal.date}</td>
                                                        <td className="px-4 py-2">
                                                            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                                                                {getSignalTypeName(signal.signal_type)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 text-sm font-mono" style={{ color: '#22c55e' }}>{signal.price.toFixed(2)}</td>
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
                            <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                                中枢列表 ({detail.chanlun_signals.zs_list.length})
                            </h4>
                            {detail.chanlun_signals.zs_list.length === 0 ? (
                                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                                    暂无中枢数据
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                {['开始日期', '结束日期', '中枢上沿(ZG)', '中枢下沿(ZD)', '中枢高度', '中枢中轴'].map((h) => (
                                                    <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detail.chanlun_signals.zs_list.map((zs, index) => (
                                                <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{zs.start_date}</td>
                                                    <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{zs.end_date}</td>
                                                    <td className="px-4 py-2 text-sm font-mono" style={{ color: '#ef4444' }}>{zs.zg.toFixed(2)}</td>
                                                    <td className="px-4 py-2 text-sm font-mono" style={{ color: '#22c55e' }}>{zs.zd.toFixed(2)}</td>
                                                    <td className="px-4 py-2 text-sm font-mono" style={{ color: '#f59e0b' }}>{(zs.zg - zs.zd).toFixed(2)}</td>
                                                    <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--accent)' }}>{((zs.zg + zs.zd) / 2).toFixed(2)}</td>
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
                            <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                                笔列表 ({detail.chanlun_signals.bi_list.length})
                            </h4>
                            {detail.chanlun_signals.bi_list.length === 0 ? (
                                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                                    暂无笔数据
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                {['开始日期', '结束日期', '方向', '价格变动', '最高', '最低'].map((h) => (
                                                    <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detail.chanlun_signals.bi_list.map((bi, index) => (
                                                <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{bi.start_date}</td>
                                                    <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{bi.end_date}</td>
                                                    <td className="px-4 py-2">
                                                        <span
                                                            className="text-xs px-2 py-0.5 rounded"
                                                            style={{
                                                                background: bi.direction === 'up' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                                                                color: bi.direction === 'up' ? '#ef4444' : '#22c55e',
                                                            }}
                                                        >
                                                            {bi.direction === 'up' ? '上升' : '下降'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-sm font-mono" style={{ color: bi.price_change >= 0 ? '#ef4444' : '#22c55e' }}>
                                                        {bi.price_change >= 0 ? '+' : ''}{bi.price_change.toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{bi.high.toFixed(2)}</td>
                                                    <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{bi.low.toFixed(2)}</td>
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
                            <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                                分型列表 ({detail.chanlun_signals.fx_list.length})
                            </h4>
                            {detail.chanlun_signals.fx_list.length === 0 ? (
                                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                                    暂无分型数据
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                {['日期', '类型', '价格', '最高', '最低'].map((h) => (
                                                    <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detail.chanlun_signals.fx_list.map((fx, index) => (
                                                <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{fx.date}</td>
                                                    <td className="px-4 py-2">
                                                        <span
                                                            className="text-xs px-2 py-0.5 rounded"
                                                            style={{
                                                                background: fx.direction === 'top' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                                                                color: fx.direction === 'top' ? '#ef4444' : '#22c55e',
                                                            }}
                                                        >
                                                            {fx.direction === 'top' ? '顶分型' : '底分型'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{fx.price.toFixed(2)}</td>
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
        </div>
    )
}

export default StockDetail
