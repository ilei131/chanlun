import { useState, useEffect } from 'react'
import { Card, Button, Input, Select, Table, message, Modal, Spin, Empty } from 'antd'
import { FileTextOutlined, DeleteOutlined, PlayCircleOutlined, CalendarOutlined, CheckCircleOutlined, WarningOutlined, BellOutlined } from '@ant-design/icons'
import { analysisApi } from '@/api'
import type { StockAnalysisReport, CreateReportRequest } from '@/api'

function AnalysisReportPage() {
    const [reports, setReports] = useState<StockAnalysisReport[]>([])
    const [loading, setLoading] = useState(false)
    const [searchKeyword, setSearchKeyword] = useState('')
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
            const response = await analysisApi.getReports({
                page: pagination.page,
                page_size: pagination.pageSize,
            })
            setReports(response.data.reports)
            setPagination(prev => ({ ...prev, total: response.data.total }))
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

            if (response.data.success) {
                message.success('报告生成成功')
                loadReports()
            } else {
                message.error(response.data.message || '生成报告失败')
            }
        } catch (error: any) {
            message.error(error.response?.data?.message || '生成报告失败')
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
            render: (_, record: StockAnalysisReport) => (
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
                            <p className="text-xs text-gray-400">输入股票代码或名称，使用AI生成分析报告</p>
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
                width={800}
                footer={null}
                style={{ top: 20 }}
            >
                {currentReport && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                                <CalendarOutlined />
                                分析日期: {currentReport.analysis_date}
                            </span>
                            <span>AI服务商: <span className="text-blue-400">{currentReport.ai_provider}</span></span>
                        </div>
                        {currentReport.investment_rating && (
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400">投资评级:</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${currentReport.investment_rating === '买入' ? 'bg-green-900/30 text-green-400' :
                                    currentReport.investment_rating === '持有' ? 'bg-yellow-900/30 text-yellow-400' :
                                        'bg-red-900/30 text-red-400'
                                    }`}>
                                    {currentReport.investment_rating}
                                </span>
                                {currentReport.target_price && (
                                    <span className="text-gray-300">目标价: {currentReport.target_price}</span>
                                )}
                            </div>
                        )}
                        <div className="border-t border-gray-700 pt-4">
                            <div
                                className="whitespace-pre-wrap text-gray-200 leading-relaxed"
                                style={{ whiteSpace: 'pre-wrap' }}
                            >
                                {currentReport.report_content}
                            </div>
                        </div>
                        {currentReport.error_message && (
                            <div className="bg-red-900/30 border border-red-800/30 rounded-lg p-4">
                                <p className="text-red-400 text-sm">生成失败原因:</p>
                                <p className="text-red-300">{currentReport.error_message}</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default AnalysisReportPage