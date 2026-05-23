import { useState, useEffect } from 'react'
import { Card, Button, Input, Table, message, Modal, Spin, Empty, Tag } from 'antd'
import { FileTextOutlined, DeleteOutlined, PlayCircleOutlined, CalendarOutlined, CheckCircleOutlined, WarningOutlined, BellOutlined, BarChartOutlined, TagOutlined, ExclamationCircleOutlined, RiseOutlined } from '@ant-design/icons'
import { analysisApi } from '@/api'
import type { StockAnalysisReport } from '@/api'

function getFriendlyErrorMessage(msg: string | undefined): string {
    if (!msg) return '生成报告失败，请稍后重试'
    if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        return 'AI 服务请求次数已达上限，请稍后再试'
    }
    if (msg.includes('超时') || msg.includes('timeout')) {
        return 'AI 服务响应超时，请检查网络连接后重试'
    }
    if (msg.includes('连接失败') || msg.includes('connect')) {
        return '无法连接 AI 服务，请检查网络或代理设置'
    }
    if (msg.includes('token 未配置') || msg.includes('API Key')) {
        return '请先在设置页面配置 AI API Key'
    }
    if (msg.includes('未找到股票')) {
        return '未找到该股票，请检查股票代码'
    }
    if (msg.includes('未获取到K线数据')) {
        return '获取股票数据失败，请稍后重试'
    }
    return '生成报告失败，请稍后重试'
}

function AnalysisReportPage() {
    const [reports, setReports] = useState<StockAnalysisReport[]>([])
    const [loading, setLoading] = useState(false)
    const [stockInput, setStockInput] = useState<string>('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [showReportModal, setShowReportModal] = useState(false)
    const [currentReport, setCurrentReport] = useState<StockAnalysisReport | null>(null)
    const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 })

    useEffect(() => {
        loadReports()
    }, [pagination.page, pagination.pageSize])

    const loadReports = async () => {
        setLoading(true)
        try {
            const data = await analysisApi.getReports({
                page: pagination.page,
                page_size: pagination.pageSize,
            })
            if (data.reports) {
                setReports(data.reports)
                setPagination(prev => ({ ...prev, total: data.total || 0 }))
            }
        } catch (error) {
            console.error('Failed to load reports:', error)
            message.error('加载报告列表失败')
        } finally {
            setLoading(false)
        }
    }

    const handleGenerateReport = async () => {
        if (!stockInput.trim()) {
            message.warning('请输入股票代码或名称')
            return
        }

        const input = stockInput.trim()
        let code = ''
        let market = ''

        if (input.includes('.')) {
            const parts = input.split('.')
            code = parts[0]
            market = parts[1]
        } else if (input.startsWith('6') || input.startsWith('9')) {
            code = input
            market = 'SH'
        } else {
            code = input
            market = 'SZ'
        }

        setIsGenerating(true)

        try {
            const response = await analysisApi.createReport({
                stock_code: code,
                market,
            })

            if (response.success) {
                message.success('报告生成成功')
                loadReports()
            } else {
                message.error(getFriendlyErrorMessage(response.message))
            }
        } catch (error: any) {
            message.error(getFriendlyErrorMessage(error.response?.data?.message))
        } finally {
            setIsGenerating(false)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStockInput(e.target.value)
    }

    const handleViewReport = async (report: StockAnalysisReport) => {
        setCurrentReport(report)
        setShowReportModal(true)
    }

    const handleDeleteReport = async (id: number) => {
        Modal.confirm({
            title: '确认删除',
            content: '确定要删除这份分析报告吗？',
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await analysisApi.deleteReport(id)
                    message.success('删除成功')
                    loadReports()
                } catch (error) {
                    message.error('删除失败')
                }
            },
        })
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircleOutlined className="text-green-500" />
            case 'pending':
                return <BellOutlined className="text-yellow-500" />
            case 'failed':
                return <WarningOutlined className="text-red-500" />
            default:
                return <BellOutlined className="text-gray-500" />
        }
    }

    const getStatusText = (status: string) => {
        switch (status) {
            case 'completed':
                return '已完成'
            case 'pending':
                return '处理中'
            case 'failed':
                return '失败'
            default:
                return status
        }
    }

    const columns = [
        {
            title: '股票信息',
            key: 'stock',
            render: (record: StockAnalysisReport) => (
                <div>
                    <div className="font-medium text-white">{record.stock_name}</div>
                    <div className="text-sm text-gray-400">{record.stock_code}.{record.market}</div>
                </div>
            ),
        },
        {
            title: '分析日期',
            dataIndex: 'analysis_date',
            key: 'analysis_date',
            render: (date: string) => (
                <span className="text-gray-300">{date}</span>
            ),
        },
        {
            title: 'AI服务商',
            dataIndex: 'ai_provider',
            key: 'ai_provider',
            render: (provider: string) => (
                <span className="text-blue-400 capitalize">{provider}</span>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <div className="flex items-center gap-2">
                    {getStatusIcon(status)}
                    <span className={`text-sm ${status === 'completed' ? 'text-green-400' :
                        status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                        {getStatusText(status)}
                    </span>
                </div>
            ),
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (time: string) => (
                <span className="text-gray-400 text-sm">{new Date(time).toLocaleString('zh-CN')}</span>
            ),
        },
        {
            title: '操作',
            key: 'actions',
            render: (_: any, record: StockAnalysisReport) => (
                <div className="flex gap-2">
                    <Button
                        type="primary"
                        size="small"
                        icon={<FileTextOutlined />}
                        onClick={() => handleViewReport(record)}
                        disabled={record.status !== 'completed'}
                    >
                        查看
                    </Button>
                    <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteReport(record.id)}
                    >
                        删除
                    </Button>
                </div>
            ),
        },
    ]

    const getRatingStyle = (rating: string) => {
        switch (rating) {
            case '买入':
                return { bg: 'bg-gradient-to-r from-green-600 to-green-500', text: 'text-green-50', border: 'border-green-500/30' }
            case '持有':
                return { bg: 'bg-gradient-to-r from-yellow-600 to-yellow-500', text: 'text-yellow-50', border: 'border-yellow-500/30' }
            case '卖出':
                return { bg: 'bg-gradient-to-r from-red-600 to-red-500', text: 'text-red-50', border: 'border-red-500/30' }
            default:
                return { bg: 'bg-gradient-to-r from-gray-600 to-gray-500', text: 'text-gray-50', border: 'border-gray-500/30' }
        }
    }

    const parseReportContent = (content: string) => {
        return content.split('\n').map((line, index) => {
            if (line.startsWith('## ')) {
                return (
                    <h2 key={index} className="text-xl font-bold text-indigo-400 mt-6 mb-3 pb-2 border-b border-indigo-900/50">
                        {line.replace('## ', '')}
                    </h2>
                )
            }
            if (line.startsWith('### ')) {
                return (
                    <h3 key={index} className="text-lg font-semibold text-purple-400 mt-4 mb-2">
                        {line.replace('### ', '')}
                    </h3>
                )
            }
            if (line.startsWith('- ')) {
                return (
                    <div key={index} className="flex items-start gap-2 text-gray-300 ml-4">
                        <span className="text-indigo-400 mt-1">•</span>
                        <span>{line.replace('- ', '')}</span>
                    </div>
                )
            }
            if (line.startsWith('**') && line.endsWith('**')) {
                return (
                    <span key={index} className="font-bold text-white">{line.replace(/\*\*/g, '')}</span>
                )
            }
            if (line.match(/^\d+\./)) {
                return (
                    <div key={index} className="text-gray-300 ml-4 my-1">
                        {line}
                    </div>
                )
            }
            if (line.trim()) {
                return (
                    <p key={index} className="text-gray-300 leading-relaxed my-2">
                        {line}
                    </p>
                )
            }
            return null
        })
    }

    return (
        <div className="space-y-6">
            {/* 生成报告区域 */}
            <Card
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                            <PlayCircleOutlined className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">生成分析报告</h2>
                            <p className="text-xs text-gray-400">输入股票代码或名称，使用AI生成专业分析报告</p>
                        </div>
                    </div>
                }
                style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    borderRadius: '16px',
                }}
            >
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            placeholder="输入股票代码或名称（如：600519 或 贵州茅台）"
                            value={stockInput}
                            onChange={handleInputChange}
                            style={{
                                width: '100%',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                borderColor: 'rgba(255,255,255,0.1)',
                                color: '#fff',
                            }}
                        />
                    </div>
                    <Button
                        type="primary"
                        size="large"
                        icon={<PlayCircleOutlined />}
                        onClick={handleGenerateReport}
                        loading={isGenerating}
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            borderColor: 'transparent',
                            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
                        }}
                    >
                        {isGenerating ? '生成中...' : '生成分析报告'}
                    </Button>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                    <span className="mr-4">格式示例：600519.SH 或 600519 或 贵州茅台</span>
                    <span>6开头默认沪市，其他默认深市</span>
                </div>
            </Card>

            {/* 历史报告列表 */}
            <Card
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
                            <FileTextOutlined className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">历史分析报告</h2>
                            <p className="text-xs text-gray-400">查看和管理您的股票分析报告</p>
                        </div>
                    </div>
                }
                style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                    border: '1px solid rgba(168, 85, 247, 0.15)',
                    borderRadius: '16px',
                }}
            >
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Spin size="large" />
                    </div>
                ) : reports.length === 0 ? (
                    <Empty
                        description={
                            <div className="text-gray-400">
                                <p>暂无分析报告</p>
                                <p className="text-sm">在上方选择股票并点击生成按钮创建第一份报告</p>
                            </div>
                        }
                    />
                ) : (
                    <Table
                        dataSource={reports}
                        columns={columns}
                        rowKey="id"
                        pagination={{
                            current: pagination.page,
                            pageSize: pagination.pageSize,
                            total: pagination.total,
                            onChange: (page, pageSize) => {
                                setPagination({ page, pageSize, total: pagination.total })
                            },
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50'],
                            showTotal: (total) => `共 ${total} 条记录`,
                        }}
                        style={{ color: '#fff' }}
                        bordered={false}
                    />
                )}
            </Card>

            {/* 报告详情弹窗 */}
            <Modal
                title={
                    currentReport ? (
                        <div className="flex items-center gap-2">
                            <FileTextOutlined className="text-indigo-400" />
                            <span className="text-white">{currentReport.stock_name} 分析报告</span>
                        </div>
                    ) : null
                }
                visible={showReportModal}
                onCancel={() => setShowReportModal(false)}
                width={900}
                footer={null}
                style={{ top: 20 }}
                bodyStyle={{
                    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
                    borderRadius: '16px',
                }}
            >
                {currentReport && (
                    <div className="space-y-6">
                        {/* 报告头部信息 */}
                        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-700">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <CalendarOutlined className="text-gray-400" />
                                    <span className="text-gray-300">分析日期: {currentReport.analysis_date}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400">AI服务商:</span>
                                    <Tag color="blue">{currentReport.ai_provider}</Tag>
                                </div>
                            </div>
                            {currentReport.investment_rating && (
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <TagOutlined className="text-indigo-400" />
                                        <span className="text-gray-400">投资评级:</span>
                                        <div className={`px-4 py-2 rounded-lg font-bold ${getRatingStyle(currentReport.investment_rating).bg} ${getRatingStyle(currentReport.investment_rating).text} shadow-lg`}>
                                            {currentReport.investment_rating}
                                        </div>
                                    </div>
                                    {currentReport.target_price && (
                                        <div className="flex items-center gap-2">
                                            <BarChartOutlined className="text-purple-400" />
                                            <span className="text-gray-300">目标价: <span className="text-white font-bold">{currentReport.target_price}</span></span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 报告摘要卡片 */}
                        {currentReport.summary && (
                            <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-800/30 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <RiseOutlined className="text-indigo-400" />
                                    <span className="text-sm font-semibold text-indigo-300">核心观点</span>
                                </div>
                                <p className="text-gray-200 text-sm leading-relaxed">{currentReport.summary}</p>
                            </div>
                        )}

                        {/* 报告内容 */}
                        <div className="prose prose-invert max-w-none">
                            {parseReportContent(currentReport.report_content)}
                        </div>

                        {/* 风险提示 */}
                        <div className="bg-amber-900/20 border border-amber-800/30 rounded-xl p-4 mt-6">
                            <div className="flex items-center gap-2 mb-2">
                                <ExclamationCircleOutlined className="text-amber-500" />
                                <span className="text-sm font-semibold text-amber-400">风险提示</span>
                            </div>
                            <p className="text-gray-400 text-xs leading-relaxed">
                                本报告仅供参考，不构成投资建议。投资有风险，入市需谨慎。
                                报告内容基于历史数据和AI分析，市场有不确定性，请投资者自行判断。
                            </p>
                        </div>

                        {/* 生成失败信息 */}
                        {currentReport.error_message && (
                            <div className="bg-red-900/30 border border-red-800/30 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <WarningOutlined className="text-red-400" />
                                    <span className="text-sm font-semibold text-red-400">生成失败</span>
                                </div>
                                <p className="text-red-300 text-sm">{currentReport.error_message}</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default AnalysisReportPage
