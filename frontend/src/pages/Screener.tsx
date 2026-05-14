import { useState } from 'react'
import {
    Card,
    Button,
    Checkbox,
    InputNumber,
    Select,
    Table,
    Tag,
    Alert,
    Spin,
} from 'antd'
import { screenerApi, type ScreenerRequest, type ScreenerResult } from '@/api'
import { useNavigate } from 'react-router-dom'
import { PlayCircleOutlined, ReloadOutlined, SlidersOutlined, TagOutlined, ArrowUpOutlined, ApiOutlined } from '@ant-design/icons'

function Screener() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<ScreenerResult[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)

    const [formValues, setFormValues] = useState({
        chanlunBuy: {
            enabled: false,
            types: [] as string[],
            requireCurrent: true,
        },
        fractal: {
            enabled: false,
            types: [] as string[],
            periods: ['1d'],
            requireConfirmed: false,
            minQualityScore: 70,
        },
        kdjCross: {
            enabled: false,
            periods: [] as string[],
            daysWithin: 30,
        },
        macdCross: {
            enabled: false,
            periods: [] as string[],
            daysWithin: 30,
        },
        priceRange: {
            enabled: false,
            min: 0,
            max: 100,
        },
        sortBy: 'match_count',
        sortOrder: 'desc',
    })

    const handleRunScreener = async () => {
        setLoading(true)
        try {
            const request: ScreenerRequest = {}

            if (formValues.chanlunBuy.enabled && formValues.chanlunBuy.types.length > 0) {
                request.chanlun_buy = {
                    enabled: true,
                    types: formValues.chanlunBuy.types,
                    require_current: formValues.chanlunBuy.requireCurrent,
                }
            }

            if (formValues.fractal.enabled && formValues.fractal.types.length > 0) {
                request.fractal = {
                    enabled: true,
                    types: formValues.fractal.types,
                    periods: formValues.fractal.periods,
                    require_confirmed: formValues.fractal.requireConfirmed,
                    min_quality_score: formValues.fractal.minQualityScore,
                }
            }

            if (formValues.kdjCross.enabled && formValues.kdjCross.periods.length > 0) {
                request.kdj_cross = {
                    enabled: true,
                    periods: formValues.kdjCross.periods,
                    days_within: formValues.kdjCross.daysWithin,
                }
            }

            if (formValues.macdCross.enabled && formValues.macdCross.periods.length > 0) {
                request.macd_cross = {
                    enabled: true,
                    periods: formValues.macdCross.periods,
                    days_within: formValues.macdCross.daysWithin,
                }
            }

            if (formValues.priceRange.enabled) {
                request.price_range = {
                    enabled: true,
                    min: formValues.priceRange.min,
                    max: formValues.priceRange.max,
                }
            }

            request.sort_by = formValues.sortBy
            request.sort_order = formValues.sortOrder
            request.page = page
            request.page_size = pageSize

            const response = await screenerApi.run(request)
            setResults(response.data.data)
            setTotal(response.data.total)
        } catch (error) {
            console.error('筛选失败:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleReset = () => {
        setFormValues({
            chanlunBuy: {
                enabled: false,
                types: [],
                requireCurrent: true,
            },
            fractal: {
                enabled: false,
                types: [],
                periods: ['1d'],
                requireConfirmed: false,
                minQualityScore: 70,
            },
            kdjCross: {
                enabled: false,
                periods: [],
                daysWithin: 30,
            },
            macdCross: {
                enabled: false,
                periods: [],
                daysWithin: 30,
            },
            priceRange: {
                enabled: false,
                min: 0,
                max: 100,
            },
            sortBy: 'match_count',
            sortOrder: 'desc',
        })
        setResults([])
        setTotal(0)
    }

    const columns = [
        {
            title: '代码',
            dataIndex: 'code',
            key: 'code',
            width: 100,
            render: (code: string) => (
                <button
                    onClick={() => navigate(`/stock/${code}`)}
                    className="text-indigo-400 hover:text-indigo-300 font-mono transition-colors"
                >
                    {code}
                </button>
            ),
        },
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            width: 120,
            render: (name: string) => <span className="text-white font-medium">{name}</span>,
        },
        {
            title: '现价',
            dataIndex: 'current_price',
            key: 'current_price',
            width: 100,
            render: (price: number) => <span className="text-white font-mono">{price?.toFixed(2) || '--'}</span>,
        },
        {
            title: '涨跌幅',
            dataIndex: 'change_pct',
            key: 'change_pct',
            width: 100,
            render: (pct: number) => {
                if (pct === undefined || pct === null) return '--'
                const color = pct >= 0 ? '#10b981' : '#ef4444'
                return <span style={{ color }} className="font-mono">{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>
            },
        },
        {
            title: '满足条件',
            dataIndex: 'matched_conditions',
            key: 'matched_conditions',
            render: (conditions: any) => {
                const tags: React.ReactNode[] = []
                if (conditions.chanlun_buy?.types?.length) {
                    conditions.chanlun_buy.types.forEach((t: string) => {
                        tags.push(<Tag key={t} color="blue">{t}</Tag>)
                    })
                }
                if (conditions.fractal?.types?.length) {
                    conditions.fractal.types.forEach((t: string) => {
                        tags.push(<Tag key={t} color="green">{t}</Tag>)
                    })
                }
                if (conditions.kdj_cross?.periods?.length) {
                    conditions.kdj_cross.periods.forEach((p: string) => {
                        tags.push(<Tag key={p} color="orange">KDJ-{p}</Tag>)
                    })
                }
                if (conditions.macd_cross?.periods?.length) {
                    conditions.macd_cross.periods.forEach((p: string) => {
                        tags.push(<Tag key={p} color="purple">MACD-{p}</Tag>)
                    })
                }
                return tags.length ? tags : '--'
            },
        },
        {
            title: '满足度',
            dataIndex: 'match_ratio',
            key: 'match_ratio',
            width: 120,
            render: (ratio: number) => (
                <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${ratio * 100}%`,
                                background: `linear-gradient(90deg, #6366f1, #8b5cf6)`
                            }}
                        />
                    </div>
                    <span className="text-sm text-indigo-400 font-medium">{(ratio * 100).toFixed(0)}%</span>
                </div>
            ),
        },
    ]

    const hasConditions =
        formValues.chanlunBuy.enabled ||
        formValues.fractal.enabled ||
        formValues.kdjCross.enabled ||
        formValues.macdCross.enabled ||
        formValues.priceRange.enabled

    return (
        <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                        border: '1px solid rgba(99, 102, 241, 0.15)',
                        borderRadius: '16px',
                    }}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">筛选条件</p>
                            <p className="text-2xl font-bold text-indigo-400">
                                {[formValues.chanlunBuy.enabled, formValues.fractal.enabled, formValues.kdjCross.enabled, formValues.macdCross.enabled, formValues.priceRange.enabled].filter(Boolean).length}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                            <SlidersOutlined className="w-6 h-6 text-indigo-400" />
                        </div>
                    </div>
                </Card>
                <Card
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                        border: '1px solid rgba(99, 102, 241, 0.15)',
                        borderRadius: '16px',
                    }}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">筛选结果</p>
                            <p className="text-2xl font-bold text-green-400">{total}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                            <TagOutlined className="w-6 h-6 text-green-400" />
                        </div>
                    </div>
                </Card>
                <Card
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                        border: '1px solid rgba(99, 102, 241, 0.15)',
                        borderRadius: '16px',
                    }}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">选股策略</p>
                            <p className="text-2xl font-bold text-yellow-400">综合</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(234, 179, 8, 0.15)' }}>
                            <ArrowUpOutlined className="w-6 h-6 text-yellow-400" />
                        </div>
                    </div>
                </Card>
                <Card
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                        border: '1px solid rgba(99, 102, 241, 0.15)',
                        borderRadius: '16px',
                    }}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">执行状态</p>
                            <p className="text-2xl font-bold text-purple-400">{loading ? '运行中' : '就绪'}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
                            <ApiOutlined className="w-6 h-6 text-purple-400" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Settings card */}
            <Card
                style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    borderRadius: '16px',
                }}
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <SlidersOutlined className="w-6 h-6 text-indigo-400" />
                        <h2 className="text-xl font-bold text-white">选股条件设置</h2>
                    </div>
                    <span className="text-sm text-gray-400">配置您的量化选股策略</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Chanlun Buy */}
                    <div
                        className="rounded-xl p-4 transition-all duration-300"
                        style={{
                            background: formValues.chanlunBuy.enabled
                                ? 'linear-gradient(145deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)'
                                : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${formValues.chanlunBuy.enabled ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                        }}
                    >
                        <h4 className="font-semibold mb-3 text-indigo-300">缠论买点</h4>
                        <Checkbox
                            checked={formValues.chanlunBuy.enabled}
                            onChange={(e) =>
                                setFormValues((prev) => ({
                                    ...prev,
                                    chanlunBuy: { ...prev.chanlunBuy, enabled: e.target.checked },
                                }))
                            }
                        >
                            <span className="text-gray-300">启用筛选</span>
                        </Checkbox>
                        <div className="mt-3 space-y-2">
                            <Checkbox.Group
                                options={[
                                    { label: '第一类买点（1买）', value: '1_buy' },
                                    { label: '第二类买点（2买）', value: '2_buy' },
                                    { label: '第三类买点（3买）', value: '3_buy' },
                                ]}
                                value={formValues.chanlunBuy.types}
                                onChange={(values) =>
                                    setFormValues((prev) => ({
                                        ...prev,
                                        chanlunBuy: { ...prev.chanlunBuy, types: values as string[] },
                                    }))
                                }
                                disabled={!formValues.chanlunBuy.enabled}
                            />
                        </div>
                        <div className="mt-3">
                            <Checkbox
                                checked={formValues.chanlunBuy.requireCurrent}
                                onChange={(e) =>
                                    setFormValues((prev) => ({
                                        ...prev,
                                        chanlunBuy: { ...prev.chanlunBuy, requireCurrent: e.target.checked },
                                    }))
                                }
                                disabled={!formValues.chanlunBuy.enabled}
                            >
                                <span className="text-gray-400">仅显示当前买点</span>
                            </Checkbox>
                        </div>
                    </div>

                    {/* Fractal */}
                    <div
                        className="rounded-xl p-4 transition-all duration-300"
                        style={{
                            background: formValues.fractal.enabled
                                ? 'linear-gradient(145deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.1) 100%)'
                                : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${formValues.fractal.enabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                        }}
                    >
                        <h4 className="font-semibold mb-3 text-green-300">分型筛选</h4>
                        <Checkbox
                            checked={formValues.fractal.enabled}
                            onChange={(e) =>
                                setFormValues((prev) => ({
                                    ...prev,
                                    fractal: { ...prev.fractal, enabled: e.target.checked },
                                }))
                            }
                        >
                            <span className="text-gray-300">启用筛选</span>
                        </Checkbox>
                        <div className="mt-3 space-y-2">
                            <Checkbox.Group
                                options={[
                                    { label: '底分型（选买）', value: 'bottom_fx' },
                                    { label: '顶分型（选卖）', value: 'top_fx' },
                                ]}
                                value={formValues.fractal.types}
                                onChange={(values) =>
                                    setFormValues((prev) => ({
                                        ...prev,
                                        fractal: { ...prev.fractal, types: values as string[] },
                                    }))
                                }
                                disabled={!formValues.fractal.enabled}
                            />
                        </div>
                        <div className="mt-3">
                            <Select
                                mode="multiple"
                                placeholder="选择周期"
                                options={[
                                    { value: '1d', label: '日线' },
                                    { value: '1w', label: '周线' },
                                    { value: '1m', label: '月线' },
                                ]}
                                value={formValues.fractal.periods}
                                onChange={(values) =>
                                    setFormValues((prev) => ({
                                        ...prev,
                                        fractal: { ...prev.fractal, periods: values as string[] },
                                    }))
                                }
                                disabled={!formValues.fractal.enabled}
                                style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                            />
                        </div>
                        <div className="mt-3">
                            <Checkbox
                                checked={formValues.fractal.requireConfirmed}
                                onChange={(e) =>
                                    setFormValues((prev) => ({
                                        ...prev,
                                        fractal: { ...prev.fractal, requireConfirmed: e.target.checked },
                                    }))
                                }
                                disabled={!formValues.fractal.enabled}
                            >
                                <span className="text-gray-400">要求已确认成笔</span>
                            </Checkbox>
                        </div>
                        <div className="mt-3">
                            <span className="text-sm text-gray-400">最低质量评分：</span>
                            <InputNumber
                                min={0}
                                max={100}
                                value={formValues.fractal.minQualityScore}
                                onChange={(value) =>
                                    setFormValues((prev) => ({
                                        ...prev,
                                        fractal: { ...prev.fractal, minQualityScore: value || 70 },
                                    }))
                                }
                                disabled={!formValues.fractal.enabled}
                                style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                            />
                        </div>
                    </div>

                    {/* KDJ Cross */}
                    <div
                        className="rounded-xl p-4 transition-all duration-300"
                        style={{
                            background: formValues.kdjCross.enabled
                                ? 'linear-gradient(145deg, rgba(234, 179, 8, 0.15) 0%, rgba(251, 191, 36, 0.1) 100%)'
                                : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${formValues.kdjCross.enabled ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                        }}
                    >
                        <h4 className="font-semibold mb-3 text-yellow-300">KDJ金叉</h4>
                        <Checkbox
                            checked={formValues.kdjCross.enabled}
                            onChange={(e) =>
                                setFormValues((prev) => ({
                                    ...prev,
                                    kdjCross: { ...prev.kdjCross, enabled: e.target.checked },
                                }))
                            }
                        >
                            <span className="text-gray-300">启用筛选</span>
                        </Checkbox>
                        <div className="mt-3">
                            <Checkbox.Group
                                options={[
                                    { label: '日线KDJ金叉', value: '1d' },
                                    { label: '周线KDJ金叉', value: '1w' },
                                    { label: '月线KDJ金叉', value: '1m' },
                                ]}
                                value={formValues.kdjCross.periods}
                                onChange={(values) =>
                                    setFormValues((prev) => ({
                                        ...prev,
                                        kdjCross: { ...prev.kdjCross, periods: values as string[] },
                                    }))
                                }
                                disabled={!formValues.kdjCross.enabled}
                            />
                        </div>
                        <div className="mt-3">
                            <span className="text-sm text-gray-400">金叉发生在最近</span>
                            <InputNumber
                                min={1}
                                max={365}
                                value={formValues.kdjCross.daysWithin}
                                onChange={(value) =>
                                    setFormValues((prev) => ({
                                        ...prev,
                                        kdjCross: { ...prev.kdjCross, daysWithin: value || 30 },
                                    }))
                                }
                                disabled={!formValues.kdjCross.enabled}
                                style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', margin: '0 8px' }}
                            />
                            <span className="text-sm text-gray-400">天内</span>
                        </div>
                    </div>

                    {/* MACD Cross */}
                    <div
                        className="rounded-xl p-4 transition-all duration-300"
                        style={{
                            background: formValues.macdCross.enabled
                                ? 'linear-gradient(145deg, rgba(168, 85, 247, 0.15) 0%, rgba(192, 132, 252, 0.1) 100%)'
                                : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${formValues.macdCross.enabled ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                        }}
                    >
                        <h4 className="font-semibold mb-3 text-purple-300">MACD金叉</h4>
                        <Checkbox
                            checked={formValues.macdCross.enabled}
                            onChange={(e) =>
                                setFormValues((prev) => ({
                                    ...prev,
                                    macdCross: { ...prev.macdCross, enabled: e.target.checked },
                                }))
                            }
                        >
                            <span className="text-gray-300">启用筛选</span>
                        </Checkbox>
                        <div className="mt-3">
                            <Checkbox.Group
                                options={[
                                    { label: '日线MACD金叉', value: '1d' },
                                    { label: '周线MACD金叉', value: '1w' },
                                    { label: '月线MACD金叉', value: '1m' },
                                ]}
                                value={formValues.macdCross.periods}
                                onChange={(values) =>
                                    setFormValues((prev) => ({
                                        ...prev,
                                        macdCross: { ...prev.macdCross, periods: values as string[] },
                                    }))
                                }
                                disabled={!formValues.macdCross.enabled}
                            />
                        </div>
                        <div className="mt-3">
                            <span className="text-sm text-gray-400">金叉发生在最近</span>
                            <InputNumber
                                min={1}
                                max={365}
                                value={formValues.macdCross.daysWithin}
                                onChange={(value) =>
                                    setFormValues((prev) => ({
                                        ...prev,
                                        macdCross: { ...prev.macdCross, daysWithin: value || 30 },
                                    }))
                                }
                                disabled={!formValues.macdCross.enabled}
                                style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', margin: '0 8px' }}
                            />
                            <span className="text-sm text-gray-400">天内</span>
                        </div>
                    </div>

                    {/* Price Range */}
                    <div
                        className="rounded-xl p-4 transition-all duration-300"
                        style={{
                            background: formValues.priceRange.enabled
                                ? 'linear-gradient(145deg, rgba(34, 211, 238, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)'
                                : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${formValues.priceRange.enabled ? 'rgba(34, 211, 238, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                        }}
                    >
                        <h4 className="font-semibold mb-3 text-cyan-300">价格区间</h4>
                        <Checkbox
                            checked={formValues.priceRange.enabled}
                            onChange={(e) =>
                                setFormValues((prev) => ({
                                    ...prev,
                                    priceRange: { ...prev.priceRange, enabled: e.target.checked },
                                }))
                            }
                        >
                            <span className="text-gray-300">启用筛选</span>
                        </Checkbox>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-sm text-gray-400">最低价：</span>
                            <InputNumber
                                min={0}
                                max={10000}
                                value={formValues.priceRange.min}
                                onChange={(value) =>
                                    setFormValues((prev) => ({
                                        ...prev,
                                        priceRange: { ...prev.priceRange, min: value || 0 },
                                    }))
                                }
                                disabled={!formValues.priceRange.enabled}
                                style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                            />
                            <span className="text-sm text-gray-400">元</span>
                            <span className="text-gray-500">-</span>
                            <span className="text-sm text-gray-400">最高价：</span>
                            <InputNumber
                                min={0}
                                max={10000}
                                value={formValues.priceRange.max}
                                onChange={(value) =>
                                    setFormValues((prev) => ({
                                        ...prev,
                                        priceRange: { ...prev.priceRange, max: value || 100 },
                                    }))
                                }
                                disabled={!formValues.priceRange.enabled}
                                style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                            />
                            <span className="text-sm text-gray-400">元</span>
                        </div>
                    </div>

                    {/* Sort Settings */}
                    <div
                        className="rounded-xl p-4"
                        style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                    >
                        <h4 className="font-semibold mb-3 text-gray-300">排序设置</h4>
                        <div className="mt-3">
                            <span className="text-sm text-gray-400">排序字段：</span>
                            <Select
                                value={formValues.sortBy}
                                onChange={(value) =>
                                    setFormValues((prev) => ({ ...prev, sortBy: value }))
                                }
                                options={[
                                    { value: 'match_count', label: '满足条件数' },
                                    { value: 'change_pct', label: '涨跌幅' },
                                    { value: 'code', label: '代码' },
                                ]}
                                style={{ width: 150, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', marginLeft: '8px' }}
                            />
                        </div>
                        <div className="mt-3">
                            <span className="text-sm text-gray-400">排序方向：</span>
                            <Select
                                value={formValues.sortOrder}
                                onChange={(value) =>
                                    setFormValues((prev) => ({ ...prev, sortOrder: value }))
                                }
                                options={[
                                    { value: 'desc', label: '降序' },
                                    { value: 'asc', label: '升序' },
                                ]}
                                style={{ width: 100, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', marginLeft: '8px' }}
                            />
                        </div>
                        <div className="mt-3">
                            <span className="text-sm text-gray-400">每页数量：</span>
                            <Select
                                value={pageSize}
                                onChange={(value) => {
                                    setPageSize(value)
                                    setPage(1)
                                }}
                                options={[
                                    { value: 10, label: '10' },
                                    { value: 20, label: '20' },
                                    { value: 50, label: '50' },
                                    { value: 100, label: '100' },
                                ]}
                                style={{ width: 80, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', marginLeft: '8px' }}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <Button
                        onClick={handleReset}
                        icon={<ReloadOutlined />}
                        style={{
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderColor: 'rgba(255,255,255,0.1)',
                            color: '#fff',
                        }}
                        className="hover:bg-white/10"
                    >
                        重置条件
                    </Button>
                    <Button
                        type="primary"
                        onClick={handleRunScreener}
                        loading={loading}
                        icon={<PlayCircleOutlined />}
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            borderColor: 'transparent',
                            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
                        }}
                    >
                        {loading ? '筛选中...' : '开始筛选'}
                    </Button>
                </div>
            </Card>

            {!hasConditions && (
                <Alert
                    message="提示"
                    description="请至少选择一个筛选条件"
                    type="info"
                    showIcon
                    style={{
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderColor: 'rgba(99, 102, 241, 0.2)',
                        color: '#94a3b8',
                    }}
                />
            )
            }

            {
                results.length > 0 && (
                    <Card
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                            border: '1px solid rgba(99, 102, 241, 0.15)',
                            borderRadius: '16px',
                        }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-white">筛选结果</h2>
                            <span className="text-gray-400">共 {total} 只股票</span>
                        </div>
                        <Spin spinning={loading}>
                            <Table
                                columns={columns}
                                dataSource={results}
                                rowKey="stock_id"
                                pagination={{
                                    current: page,
                                    pageSize,
                                    total,
                                    onChange: (newPage, newPageSize) => {
                                        setPage(newPage)
                                        setPageSize(newPageSize)
                                    },
                                }}
                                style={{ color: '#fff' }}
                            />
                        </Spin>
                    </Card>
                )
            }
        </div >
    )
}

export default Screener
