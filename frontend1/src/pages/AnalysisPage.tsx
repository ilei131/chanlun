import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { AnalysisResult, ScanResult } from '../types';
import KlineChart from '../components/KlineChart';
import MacdChart from '../components/MacdChart';
import KdjChart from '../components/KdjChart';
import { Search, Loader2, AlertCircle, TrendingUp, TrendingDown, Target, Zap, ArrowLeft } from 'lucide-react';

const SCAN_RESULTS_KEY = 'chanlun_scan_results';

const periodOptions = [
  { value: 'daily', label: '日线' },
  { value: 'weekly', label: '周线' },
  { value: 'monthly', label: '月线' },
];

type TabKey = 'signals' | 'zs' | 'bi' | 'fx';

export default function AnalysisPage() {
  const navigate = useNavigate();
  const { code: urlCode } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const [stockCode, setStockCode] = useState(urlCode || '');
  const [period, setPeriod] = useState(searchParams.get('period') || 'daily');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('signals');

  // 从扫描结果中查找数据
  const findFromScanResults = useCallback((code: string): AnalysisResult | null => {
    try {
      const stored = localStorage.getItem(SCAN_RESULTS_KEY);
      if (!stored) return null;
      const scanData = JSON.parse(stored) as { results: ScanResult[]; period: string; timestamp: number };
      
      // 检查时间戳，超过1小时的数据过期
      if (Date.now() - scanData.timestamp > 3600000) {
        return null;
      }

      const result = scanData.results.find(r => r.code === code);
      if (result) {
        return {
          code: result.code,
          name: result.name,
          period: result.period,
          kline: result.kline,
          fx_list: result.fx_list,
          bi_list: result.bi_list,
          zs_list: result.zs_list,
          buy_points: result.buy_points,
          sell_points: result.sell_points,
          signals: result.signals,
          indicators: result.indicators,
        };
      }
    } catch {
      // localStorage读取失败
    }
    return null;
  }, []);

  const fetchAnalysis = useCallback(async (code: string, per: string) => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setData(null);

    try {
      // 优先从扫描结果中获取数据
      const cachedData = findFromScanResults(code);
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
        return;
      }

      // 如果没有缓存数据，调用接口
      const response = await fetch(`http://localhost:8080/api/analyze/${code}?period=${per}`);
      const resp = await response.json();
      
      if (resp.success) {
        setData(resp.data);
      } else {
        setError(resp.error?.message || '分析失败');
      }
    } catch (err: unknown) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [findFromScanResults]);

  useEffect(() => {
    if (urlCode) {
      fetchAnalysis(urlCode, period);
    }
  }, [urlCode, period, fetchAnalysis]);

  const handleSearch = () => {
    if (stockCode.trim()) {
      window.history.replaceState(null, '', `/analysis/${stockCode.trim()}?period=${period}`);
      fetchAnalysis(stockCode.trim(), period);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'signals', label: '买卖信号' },
    { key: 'zs', label: '中枢分析' },
    { key: 'bi', label: '笔线段' },
    { key: 'fx', label: '分型' },
  ];

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
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            value={stockCode}
            onChange={(e) => setStockCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入股票代码，如 000001"
            className="flex-1 px-4 py-2 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            分析
          </button>
        </div>

        {/* Period selector */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {periodOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: period === opt.value ? 'var(--accent)' : 'var(--bg-secondary)',
                color: period === opt.value ? 'white' : 'var(--text-secondary)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Stock name */}
        {data && (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {data.name}
            </span>
            <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
              {data.code}
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg text-sm"
          style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            正在分析中...
          </span>
        </div>
      )}

      {/* Analysis Content */}
      {data && !loading && (
        <>
          {/* Signal Summary Cards */}
          {data.signals && Object.keys(data.signals).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(data.signals).slice(0, 4).map(([key, value]) => {
                const isBuy = value.includes('买') || key.includes('buy');
                return (
                  <div
                    key={key}
                    className="rounded-xl p-4"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {isBuy ? (
                        <TrendingUp className="w-4 h-4" style={{ color: 'var(--danger)' }} />
                      ) : (
                        <TrendingDown className="w-4 h-4" style={{ color: 'var(--success)' }} />
                      )}
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {key}
                      </span>
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {value}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* K-line Chart */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                K线图
              </h3>
            </div>
            <KlineChart
              kline={data.kline}
              ma={data.indicators.ma}
              buyPoints={data.buy_points}
              sellPoints={data.sell_points}
              zsList={data.zs_list}
            />
          </div>

          {/* MACD Chart */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                MACD
              </h3>
            </div>
            <MacdChart macd={data.indicators.macd} />
          </div>

          {/* KDJ Chart */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                KDJ
              </h3>
            </div>
            <KdjChart dates={data.indicators.ma.dates} kdj={data.indicators.kdj} />
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
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--danger)' }}>
                      <Target className="w-4 h-4" />
                      买点信号 ({data.buy_points.length})
                    </h4>
                    {data.buy_points.length === 0 ? (
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
                            {data.buy_points.map((pt, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{pt.date}</td>
                                <td className="px-4 py-2">
                                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}>
                                    {pt.type}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--danger)' }}>{pt.price.toFixed(2)}</td>
                                <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{pt.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Sell points */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--success)' }}>
                      <Zap className="w-4 h-4" />
                      卖点信号 ({data.sell_points.length})
                    </h4>
                    {data.sell_points.length === 0 ? (
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
                            {data.sell_points.map((pt, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{pt.date}</td>
                                <td className="px-4 py-2">
                                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)' }}>
                                    {pt.type}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--success)' }}>{pt.price.toFixed(2)}</td>
                                <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{pt.reason}</td>
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
                    中枢列表 ({data.zs_list.length})
                  </h4>
                  {data.zs_list.length === 0 ? (
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
                          {data.zs_list.map((zs, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{zs.start_date}</td>
                              <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{zs.end_date}</td>
                              <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--danger)' }}>{zs.zg.toFixed(2)}</td>
                              <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--success)' }}>{zs.zd.toFixed(2)}</td>
                              <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--warning)' }}>{zs.height.toFixed(2)}</td>
                              <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--accent)' }}>{zs.mid.toFixed(2)}</td>
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
                    笔列表 ({data.bi_list.length})
                  </h4>
                  {data.bi_list.length === 0 ? (
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
                          {data.bi_list.map((bi, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{bi.start_date}</td>
                              <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{bi.end_date}</td>
                              <td className="px-4 py-2">
                                <span
                                  className="text-xs px-2 py-0.5 rounded"
                                  style={{
                                    background: bi.direction === 'up' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                                    color: bi.direction === 'up' ? 'var(--danger)' : 'var(--success)',
                                  }}
                                >
                                  {bi.direction === 'up' ? '上升' : '下降'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm font-mono" style={{ color: bi.price_change >= 0 ? 'var(--danger)' : 'var(--success)' }}>
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
                    分型列表 ({data.fx_list.length})
                  </h4>
                  {data.fx_list.length === 0 ? (
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
                          {data.fx_list.map((fx, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{fx.date}</td>
                              <td className="px-4 py-2">
                                <span
                                  className="text-xs px-2 py-0.5 rounded"
                                  style={{
                                    background: fx.type === 'top' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                                    color: fx.type === 'top' ? 'var(--danger)' : 'var(--success)',
                                  }}
                                >
                                  {fx.type === 'top' ? '顶分型' : '底分型'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{fx.price.toFixed(2)}</td>
                              <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{fx.high.toFixed(2)}</td>
                              <td className="px-4 py-2 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{fx.low.toFixed(2)}</td>
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
        </>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Search className="w-12 h-12" style={{ color: 'var(--border)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            输入股票代码开始分析
          </p>
        </div>
      )}
    </div>
  );
}
