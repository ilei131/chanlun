import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Tag, Spin, Button, Space, Divider } from 'antd'
import { Loader2, AlertCircle, TrendingUp, TrendingDown, Target, Zap, ArrowLeft } from 'lucide-react'
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

type TabKey = 'signals' | 'zs' | 'bi' | 'fx'

interface MaData {
  dates: string[]
  ma5: (number | null)[]
  ma10: (number | null)[]
  ma20: (number | null)[]
  ma60: (number | null)[]
}

interface ZsItem {
  start_date: string
  end_date: string
  zg: number
  zd: number
  height: number
  mid: number
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

  const fetchStockDetail = useCallback(async (code: string, period: string, days: number) => {
    console.log(`[fetchStockDetail] 开始请求: code=${code}, period=${period}, days=${days}`)
    setLoading(true)
    setError('')
    try {
      const response = await stockApi.getDetail(code, period, days)
      console.log(`[fetchStockDetail] 请求成功: 数据长度=${response.data?.kline_data?.length}`)
      setDetail(response.data)
    } catch (error: any) {
      console.error('获取股票详情失败:', error)
      setError(error.message || '获取股票详情失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const debouncedFetchStockDetailRef = useRef(debounce(fetchStockDetail, 500))

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

    const kline: KlineData[] = detail.kline_data.map(k => ({
      date: k.trade_date,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
    }))

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

    const zsList: ZsItem[] = detail.chanlun_signals.zs_list.map(zs => ({
      start_date: zs.start_date,
      end_date: zs.end_date,
      zg: zs.zg,
      zd: zs.zd,
      height: zs.zg - zs.zd,
      mid: (zs.zg + zs.zd) / 2,
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

    if (detail.chanlun_signals.buy_signals.length > 0) {
      features.push(...detail.chanlun_signals.buy_signals.map(s => getSignalTypeName(s.signal_type)))
    }

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          个股分析
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          基于缠论理论对个股进行深度技术分析
        </p>
      </div>

      {/* Search Controls */}
      <div
        className="rounded-xl p-4 flex flex-wrap items-center gap-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>

        {/* Stock name and price */}
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {detail.name}
            </span>
            <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
              {detail.code}.{detail.market}
            </span>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {detail.current_price?.toFixed(2) || '--'}
            </p>
            <p className="text-sm" style={{ color: detail.change_pct !== undefined && detail.change_pct >= 0 ? '#ef4444' : '#22c55e' }}>
              {detail.change_pct !== undefined ? (
                <>
                  {detail.change_pct >= 0 ? <TrendingUp className="inline w-3 h-3" /> : <TrendingDown className="inline w-3 h-3" />}
                  {detail.change_pct >= 0 ? '+' : ''}{detail.change_pct.toFixed(2)}%
                </>
              ) : '--'}
            </p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {['daily', 'weekly', 'monthly'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: period === p ? 'var(--accent)' : 'var(--bg-secondary)',
                color: period === p ? 'white' : 'var(--text-secondary)',
              }}
            >
              {p === 'daily' ? '日K' : p === 'weekly' ? '周K' : '月K'}
            </button>
          ))}
        </div>
      </div>

      {/* Signal Summary Cards */}
      {getCurrentFeatures().length > 0 && getCurrentFeatures()[0] !== '暂无特征' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {getCurrentFeatures().map((feature, index) => {
            const isBuy = feature.includes('买') || feature.includes('金叉')
            return (
              <div
                key={index}
                className="rounded-xl p-4"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  {isBuy ? (
                    <TrendingUp className="w-4 h-4" style={{ color: '#ef4444' }} />
                  ) : (
                    <TrendingDown className="w-4 h-4" style={{ color: '#22c55e' }} />
                  )}
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    当前特征
                  </span>
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {feature}
                </p>
              </div>
            )
          })}
        </div>
      )}

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
