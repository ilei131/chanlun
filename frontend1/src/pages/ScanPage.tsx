import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analysisApi } from '../api/analysis';
import { ScanResult } from '../types';
import { Search, Loader2, ChevronRight } from 'lucide-react';

const SCAN_RESULTS_KEY = 'chanlun_scan_results';

const periodOptions = [
  { value: 'daily', label: '日线' },
  { value: 'weekly', label: '周线' },
  { value: 'monthly', label: '月线' },
];

const directionOptions = [
  { value: 'buy', label: '买入' },
  { value: 'sell', label: '卖出' },
];

const pointTypeOptions: Record<string, { value: string; label: string }[]> = {
  buy: [
    { value: 'buy1', label: '一买' },
    { value: 'buy2', label: '二买' },
    { value: 'buy3', label: '三买' },
  ],
  sell: [
    { value: 'sell1', label: '一卖' },
    { value: 'sell2', label: '二卖' },
    { value: 'sell3', label: '三卖' },
  ],
};

export default function ScanPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('daily');
  const [direction, setDirection] = useState('buy');
  const [pointType, setPointType] = useState('buy1');
  const [maxResults, setMaxResults] = useState(50);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [scanned, setScanned] = useState(false);

  const handleDirectionChange = (dir: string) => {
    setDirection(dir);
    const types = pointTypeOptions[dir];
    if (types && types.length > 0) {
      setPointType(types[0].value);
    }
  };

  const handleScan = async () => {
    setLoading(true);
    setError('');
    setResults([]);
    setScanned(false);

    try {
      const { data } = await analysisApi.scan({
        period,
        point_type: pointType,
        direction,
        max: maxResults,
      });

      if (data.success) {
        setResults(data.data.results);
        setTotal(data.data.total);
        // 保存扫描结果到localStorage，供详情页使用
        localStorage.setItem(SCAN_RESULTS_KEY, JSON.stringify({
          results: data.data.results,
          period,
          timestamp: Date.now(),
        }));
      } else {
        setError(data.error?.message || '扫描失败');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || '网络错误，请稍后重试');
    } finally {
      setLoading(false);
      setScanned(true);
    }
  };

  const handleRowClick = (code: string) => {
    window.open(`/analysis/${code}?period=${period}`, '_blank');
  };

  const getPointTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      buy1: '一买', buy2: '二买', buy3: '三买',
      sell1: '一卖', sell2: '二卖', sell3: '三卖',
    };
    return map[type] || type;
  };

  const getPointTypeColor = (type: string) => {
    if (type.startsWith('buy')) return 'var(--danger)';
    return 'var(--success)';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          批量选股
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          基于缠论买卖点信号进行全市场扫描筛选
        </p>
      </div>

      {/* Controls */}
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Period */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              周期
            </label>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {periodOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className="flex-1 py-2 text-sm font-medium transition-colors"
                  style={{
                    background: period === opt.value ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: period === opt.value ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Direction */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              方向
            </label>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {directionOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleDirectionChange(opt.value)}
                  className="flex-1 py-2 text-sm font-medium transition-colors"
                  style={{
                    background: direction === opt.value ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: direction === opt.value ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Point Type */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              买卖点类型
            </label>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {(pointTypeOptions[direction] || []).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPointType(opt.value)}
                  className="flex-1 py-2 text-sm font-medium transition-colors"
                  style={{
                    background: pointType === opt.value ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: pointType === opt.value ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max Results */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              最大结果数
            </label>
            <input
              type="number"
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              min={1}
              max={500}
              className="w-full px-4 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Scan Button */}
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleScan}
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 rounded-lg text-white font-medium text-sm transition-colors disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {loading ? '扫描中...' : '开始扫描'}
          </button>

          {loading && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                正在全市场扫描中，请稍候...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-4 rounded-lg text-sm"
          style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      {scanned && !loading && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              扫描结果
            </h2>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              共 {total} 只股票
            </span>
          </div>

          {results.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                未找到符合条件的股票
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['股票代码', '股票名称', '周期', '买卖点类型', '触发价格', '触发日期', ''].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((item, idx) => (
                    <tr
                      key={`${item.code}-${idx}`}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onClick={() => handleRowClick(item.code)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-6 py-4 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                        {item.code}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {item.name}
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {periodOptions.find((p) => p.value === item.period)?.label || item.period}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex px-2 py-1 rounded text-xs font-medium"
                          style={{
                            background: getPointTypeColor(item.point_type) + '20',
                            color: getPointTypeColor(item.point_type),
                          }}
                        >
                          {getPointTypeLabel(item.point_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                        {item.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {item.date}
                      </td>
                      <td className="px-6 py-4">
                        <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
