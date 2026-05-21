import { useState } from 'react'
import { Card, Table, Tag, Select, DatePicker, Statistic } from 'antd'
import { useNavigate } from 'react-router-dom'
import { BellOutlined, ArrowUpOutlined, ArrowDownOutlined, TagOutlined, BarChartOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'

function Signals() {
    const navigate = useNavigate()
    const [filters, setFilters] = useState({
        signalType: '',
        period: '',
        dateRange: [null, null] as [Dayjs | null, Dayjs | null],
    })

    const mockSignals = [
        { id: 1, code: '000001', name: '平安银行', signalType: '1_buy', period: '1d', date: '2024-01-03', price: 10.9, confidence: 85 },
        { id: 2, code: '000002', name: '万科A', signalType: '2_buy', period: '1d', date: '2024-01-05', price: 8.2, confidence: 78 },
        { id: 3, code: '600036', name: '招商银行', signalType: '3_buy', period: '1w', date: '2024-01-08', price: 35.8, confidence: 90 },
        { id: 4, code: '000858', name: '五粮液', signalType: '1_buy', period: '1m', date: '2024-01-10', price: 145.5, confidence: 88 },
        { id: 5, code: '601318', name: '中国平安', signalType: '2_buy', period: '1d', date: '2024-01-12', price: 48.6, confidence: 75 },
    ]

    const getSignalColor = (type: string) => {
        const colors: Record<string, string> = {
            '1_buy': '#10b981',
            '2_buy': '#3b82f6',
            '3_buy': '#8b5cf6',
            '1_sell': '#ef4444',
            '2_sell': '#f97316',
            '3_sell': '#92400e',
        }
        return colors[type] || '#6b7280'
    }

    const getSignalLabel = (type: string) => {
        const labels: Record<string, string> = {
            '1_buy': '一买',
            '2_buy': '二买',
            '3_buy': '三买',
            '1_sell': '一卖',
            '2_sell': '二卖',
            '3_sell': '三卖',
        }
        return labels[type] || type
    }

    const getPeriodLabel = (p: string) => {
        const labels: Record<string, string> = {
            '1d': '日线',
            '1w': '周线',
            '1m': '月线',
        }
        return labels[p] || p
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
            title: '信号类型',
            dataIndex: 'signalType',
            key: 'signalType',
            width: 100,
            render: (type: string) => (
                <Tag
                    className="font-medium"
                    style={{
                        background: `${getSignalColor(type)}20`,
                        borderColor: `${getSignalColor(type)}40`,
                        color: getSignalColor(type),
                        borderRadius: '6px',
                    }}
                >
                    {getSignalLabel(type)}
                </Tag>
            ),
        },
        {
            title: '周期',
            dataIndex: 'period',
            key: 'period',
            width: 80,
            render: (p: string) => (
                <span className="text-gray-300 text-sm">{getPeriodLabel(p)}</span>
            ),
        },
        {
            title: '信号日期',
            dataIndex: 'date',
            key: 'date',
            width: 120,
            render: (date: string) => (
                <span className="text-gray-400 font-mono text-sm">{date}</span>
            ),
        },
        {
            title: '信号价格',
            dataIndex: 'price',
            key: 'price',
            width: 100,
            render: (p: number) => (
                <span className="text-white font-mono">{p.toFixed(2)}</span>
            ),
        },
        {
            title: '置信度',
            dataIndex: 'confidence',
            key: 'confidence',
            width: 120,
            render: (c: number) => (
                <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${c}%`,
                                background: `linear-gradient(90deg, ${c >= 80 ? '#10b981' : c >= 60 ? '#f59e0b' : '#ef4444'}, ${c >= 80 ? '#34d399' : c >= 60 ? '#fbbf24' : '#f87171'})`
                            }}
                        />
                    </div>
                    <span className={`text-sm font-medium ${c >= 80 ? 'text-green-400' : c >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {c}%
                    </span>
                </div>
            ),
        },
    ]

    const stats = [
        { label: '今日信号', value: mockSignals.length, icon: <BellOutlined className="w-5 h-5" />, color: '#6366f1' },
        { label: '买入信号', value: mockSignals.filter(s => s.signalType.includes('buy')).length, icon: <ArrowUpOutlined className="w-5 h-5" />, color: '#10b981' },
        { label: '卖出信号', value: mockSignals.filter(s => s.signalType.includes('sell')).length, icon: <ArrowDownOutlined className="w-5 h-5" />, color: '#ef4444' },
        { label: '平均置信度', value: Math.round(mockSignals.reduce((acc, s) => acc + s.confidence, 0) / mockSignals.length) + '%', icon: <TagOutlined className="w-5 h-5" />, color: '#f59e0b' },
    ]

    return (
        <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                    <Card
                        key={index}
                        className="transition-all duration-300 hover:scale-[1.02]"
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                            border: '1px solid rgba(99, 102, 241, 0.15)',
                            borderRadius: '16px',
                        }}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
                                <Statistic
                                    value={stat.value}
                                    style={{
                                        color: stat.color,
                                        fontWeight: 700,
                                        fontSize: '24px',
                                    }}
                                />
                            </div>
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center"
                                style={{
                                    background: `${stat.color}20`,
                                }}
                            >
                                <span style={{ color: stat.color }}>{stat.icon}</span>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Main card */}
            <Card
                style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    borderRadius: '16px',
                }}
            >
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <BarChartOutlined className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-xl font-bold text-white">信号列表</h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Select
                            placeholder="信号类型"
                            style={{ width: 150 }}
                            value={filters.signalType}
                            onChange={(value) => setFilters((prev) => ({ ...prev, signalType: value }))}
                            options={[
                                { value: '', label: '全部' },
                                { value: '1_buy', label: '一买' },
                                { value: '2_buy', label: '二买' },
                                { value: '3_buy', label: '三买' },
                                { value: '1_sell', label: '一卖' },
                                { value: '2_sell', label: '二卖' },
                                { value: '3_sell', label: '三卖' },
                            ]}
                        />
                        <Select
                            placeholder="周期"
                            style={{ width: 120 }}
                            value={filters.period}
                            onChange={(value) => setFilters((prev) => ({ ...prev, period: value }))}
                            options={[
                                { value: '', label: '全部' },
                                { value: '1d', label: '日线' },
                                { value: '1w', label: '周线' },
                                { value: '1m', label: '月线' },
                            ]}
                        />
                        <DatePicker.RangePicker
                            placeholder={['开始日期', '结束日期']}
                            value={filters.dateRange}
                            onChange={(dates) => setFilters((prev) => ({ ...prev, dateRange: dates || [null, null] }))}
                            style={{ width: 280 }}
                        />
                    </div>
                </div>

                <Table
                    columns={columns}
                    dataSource={mockSignals}
                    rowKey="id"
                    pagination={{ pageSize: 20 }}
                    className="bg-transparent"
                />
            </Card>
        </div>
    )
}

export default Signals
