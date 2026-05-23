import { useState, useEffect } from 'react'
import { Card, Button, Input, Table, message, Modal, Spin, Empty, Tag } from 'antd'
import { FileTextOutlined, DeleteOutlined, PlayCircleOutlined, CalendarOutlined, CheckCircleOutlined, WarningOutlined, BellOutlined, BarChartOutlined, TagOutlined, ExclamationCircleOutlined, RiseOutlined, RightOutlined, ArrowRightOutlined, BulbOutlined, FileDoneOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
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
    const [generatingStock, setGeneratingStock] = useState<string>('')
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

        const stockKey = `${code}.${market}`
        
        if (isGenerating || generatingStock === stockKey) {
            message.warning('该股票的分析报告正在生成中，请稍后再试')
            return
        }

        setIsGenerating(true)
        setGeneratingStock(stockKey)

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
            setGeneratingStock('')
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
        const lines = content.split('\n');
        const elements = [];
        let i = 0;
        
        while (i < lines.length) {
            const line = lines[i];
            
            // 二级标题
            if (line.startsWith('## ')) {
                const title = line.replace('## ', '');
                const icon = getSectionIcon(title);
                elements.push(
                    <div key={i} className="flex items-center gap-3 mt-6 mb-3 pb-2 border-b border-indigo-900/50">
                        {icon}
                        <h2 className="text-xl font-bold text-indigo-400">
                            {title}
                        </h2>
                    </div>
                );
                i++;
                continue;
            }
            
            // 三级标题
            if (line.startsWith('### ')) {
                const title = line.replace('### ', '');
                elements.push(
                    <h3 key={i} className="text-lg font-semibold text-purple-400 mt-4 mb-2 flex items-center gap-2">
                        <RightOutlined className="text-purple-500" />
                        {title}
                    </h3>
                );
                i++;
                continue;
            }
            
            // 列表项
            if (line.startsWith('- ')) {
                const contentLine = line.replace('- ', '');
                elements.push(
                    <div key={i} className="flex items-start gap-2 text-gray-300 ml-4 my-1">
                        <CheckCircleOutlined className="text-green-400 mt-0.5 flex-shrink-0" />
                        <span>{contentLine}</span>
                    </div>
                );
                i++;
                continue;
            }
            
            // 加粗文字
            if (line.startsWith('**') && line.endsWith('**')) {
                elements.push(
                    <span key={i} className="font-bold text-white">{line.replace(/\*\*/g, '')}</span>
                );
                i++;
                continue;
            }
            
            // 数字列表
            if (line.match(/^\d+\./)) {
                const num = line.match(/^\d+/)?.[0];
                const rest = line.replace(/^\d+\.\s*/, '');
                elements.push(
                    <div key={i} className="flex items-start gap-2 text-gray-300 ml-4 my-1">
                        <span className="text-indigo-400 font-bold">{num}.</span>
                        <span>{rest}</span>
                    </div>
                );
                i++;
                continue;
            }
            
            // 箭头格式
            if (line.includes('→')) {
                const parts = line.split('→');
                if (parts.length === 2) {
                    elements.push(
                        <div key={i} className="flex items-center gap-2 text-gray-300 ml-4 my-1">
                            <span className="text-gray-500">{parts[0].trim()}</span>
                            <ArrowRightOutlined className="text-indigo-400" />
                            <span className="text-white font-medium">{parts[1].trim()}</span>
                        </div>
                    );
                    i++;
                    continue;
                }
            }
            
            // 标签格式 【标签】内容
            if (line.match(/^【.*】/)) {
                const match = line.match(/^【(.*)】(.*)/);
                if (match) {
                    elements.push(
                        <div key={i} className="flex items-start gap-2 my-2">
                            <Tag color="blue">{match[1]}</Tag>
                            <span className="text-gray-300">{match[2]}</span>
                        </div>
                    );
                    i++;
                    continue;
                }
            }
            
            // 指标卡片格式 |指标|数值|单位|状态|
            if (line.startsWith('|') && line.endsWith('|')) {
                const parts = line.split('|').filter(p => p.trim());
                if (parts.length >= 2) {
                    const metric = parts[0].trim();
                    const value = parts[1].trim();
                    const unit = parts.length > 2 ? parts[2].trim() : '';
                    const status = parts.length > 3 ? parts[3].trim() : '';
                    
                    let statusColor = '';
                    let statusBg = '';
                    if (status.includes('好') || status.includes('强') || status.includes('买入') || status.includes('金叉')) {
                        statusColor = 'text-green-400';
                        statusBg = 'bg-green-900/30';
                    } else if (status.includes('弱') || status.includes('卖出') || status.includes('死叉')) {
                        statusColor = 'text-red-400';
                        statusBg = 'bg-red-900/30';
                    } else {
                        statusColor = 'text-yellow-400';
                        statusBg = 'bg-yellow-900/30';
                    }
                    
                    elements.push(
                        <div key={i} className="flex justify-between items-center bg-gray-800/50 rounded-lg px-4 py-2 my-1">
                            <span className="text-gray-400 text-sm">{metric}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-white font-bold">{value}</span>
                                {unit && <span className="text-gray-500 text-xs">{unit}</span>}
                                {status && (
                                    <span className={`${statusColor} ${statusBg} px-2 py-0.5 rounded text-xs`}>
                                        {status}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                    i++;
                    continue;
                }
            }
            
            // 风险/利好标签
            if (line.includes('风险') || line.includes('利好')) {
                const isRisk = line.includes('风险');
                const icon = isRisk ? (
                    <WarningOutlined className="text-red-400" />
                ) : (
                    <CheckCircleOutlined className="text-green-400" />
                );
                const bgColor = isRisk ? 'bg-red-900/30 border-red-800/30' : 'bg-green-900/30 border-green-800/30';
                const title = isRisk ? '风险提示' : '利好催化';
                
                elements.push(
                    <div key={i} className={`border rounded-xl p-3 mt-2 ${bgColor}`}>
                        <div className="flex items-center gap-2 mb-1">
                            {icon}
                            <span className={`text-sm font-semibold ${isRisk ? 'text-red-400' : 'text-green-400'}`}>
                                {title}
                            </span>
                        </div>
                        <p className="text-gray-300 text-sm">{line}</p>
                    </div>
                );
                i++;
                continue;
            }
            
            // 评级标签
            if (line.includes('评级') || line.includes('建议')) {
                const match = line.match(/(买入|增持|持有|观望|卖出)/);
                if (match) {
                    const rating = match[1];
                    const style = getRatingStyle(rating);
                    elements.push(
                        <div key={i} className="flex items-center gap-3 my-2">
                            <span className="text-gray-400">{line.replace(rating, '').trim()}</span>
                            <span className={`px-4 py-1 rounded-lg font-bold ${style.bg} ${style.text}`}>
                                {rating}
                            </span>
                        </div>
                    );
                    i++;
                    continue;
                }
            }
            
            // 涨跌标签
            if (line.match(/([\d.]+%)/) && (line.includes('上涨') || line.includes('下跌') || line.includes('涨') || line.includes('跌'))) {
                const isUp = line.includes('上涨') || (line.includes('涨') && !line.includes('下跌') && !line.includes('跌'));
                const icon = isUp ? <ArrowUpOutlined className="text-green-400" /> : <ArrowDownOutlined className="text-red-400" />;
                const color = isUp ? 'text-green-400' : 'text-red-400';
                elements.push(
                    <div key={i} className="flex items-center gap-2 text-gray-300 my-1">
                        {icon}
                        <span className={color}>{line}</span>
                    </div>
                );
                i++;
                continue;
            }
            
            // 普通段落
            if (line.trim()) {
                elements.push(
                    <p key={i} className="text-gray-300 leading-relaxed my-2">
                        {line}
                    </p>
                );
            }
            
            i++;
        }
        
        return elements;
    }

    const getSectionIcon = (title: string) => {
        if (title.includes('行情') || title.includes('走势')) {
            return <RiseOutlined className="text-green-400" />;
        }
        if (title.includes('基本面') || title.includes('财务')) {
            return <FileTextOutlined className="text-blue-400" />;
        }
        if (title.includes('技术面') || title.includes('指标')) {
            return <BarChartOutlined className="text-purple-400" />;
        }
        if (title.includes('风险') || title.includes('提示')) {
            return <WarningOutlined className="text-amber-400" />;
        }
        if (title.includes('建议') || title.includes('策略')) {
            return <BulbOutlined className="text-yellow-400" />;
        }
        if (title.includes('总结') || title.includes('摘要')) {
            return <FileDoneOutlined className="text-indigo-400" />;
        }
        return <TagOutlined className="text-gray-400" />;
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
                        className="report-table"
                        pagination={{
                            current: pagination.page,
                            pageSize: pagination.pageSize,
                            total: pagination.total,
                            onChange: (page, pageSize) => {
                                setPagination({ page, pageSize, total: pagination.total })
                            },
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50'],
                            showTotal: (total) => <span style={{ color: '#94a3b8' }}>共 {total} 条记录</span>,
                        }}
                        style={{ color: '#fff' }}
                        bordered={false}
                    />
                )}
            </Card>

            {/* 报告详情弹窗 */}
            <Modal
                open={showReportModal}
                onCancel={() => setShowReportModal(false)}
                width={window.innerWidth > 768 ? 1000 : '95%'}
                footer={null}
                centered
                closable={false}
                styles={{
                    body: {
                        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
                        padding: 0,
                    },
                    header: {
                        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                        padding: '16px 24px',
                    },
                    content: {
                        borderRadius: '16px',
                        overflow: 'hidden',
                    },
                }}
            >
                {currentReport && (
                    <div className="min-h-screen md:min-h-0 relative">
                        {/* 自定义关闭按钮 */}
                        <button
                            onClick={() => setShowReportModal(false)}
                            className="absolute top-3 right-3 z-50 w-9 h-9 rounded-full bg-slate-700/90 hover:bg-slate-600 flex items-center justify-center transition-all duration-200 group shadow-lg"
                        >
                            <svg className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* 股票信息头部 */}
                        <div className="relative px-5 py-6 md:px-8 md:py-8 bg-gradient-to-br from-slate-800/80 via-slate-900/90 to-slate-800/80 border-b border-slate-700/50">
                            {/* 装饰背景 */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/10 rounded-full blur-3xl"></div>
                            
                            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                        <FileTextOutlined className="text-2xl text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                                            {currentReport.stock_name}
                                        </h2>
                                        <p className="text-slate-400 text-sm mt-0.5">
                                            {currentReport.stock_code} · {currentReport.market === 'SH' ? '上海' : '深圳'}证券交易所
                                        </p>
                                    </div>
                                </div>
                                
                                {/* 状态标签 */}
                                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                                    currentReport.status === 'completed' 
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}>
                                    <span className={`w-2 h-2 rounded-full ${
                                        currentReport.status === 'completed' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                                    }`}></span>
                                    {currentReport.status === 'completed' ? '分析完成' : '处理中'}
                                </div>
                            </div>
                        </div>

                        {/* 核心数据区域 */}
                        <div className="px-5 py-5 md:px-8 md:py-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 bg-slate-900/50 border-b border-slate-700/30">
                            <div className="bg-slate-800/60 rounded-xl p-3 md:p-4">
                                <div className="flex items-center gap-2 text-slate-400 text-xs md:text-sm mb-1">
                                    <CalendarOutlined className="text-xs" />
                                    分析日期
                                </div>
                                <p className="text-white font-semibold text-sm md:text-base">{currentReport.analysis_date}</p>
                            </div>
                            
                            <div className="bg-slate-800/60 rounded-xl p-3 md:p-4">
                                <div className="flex items-center gap-2 text-slate-400 text-xs md:text-sm mb-1">
                                    <TagOutlined className="text-xs" />
                                    AI 服务商
                                </div>
                                <p className="text-white font-semibold text-sm md:text-base capitalize">{currentReport.ai_provider}</p>
                            </div>
                            
                            {currentReport.investment_rating && (
                                <div className={`rounded-xl p-3 md:p-4 ${getRatingStyle(currentReport.investment_rating).bg}`}>
                                    <div className="flex items-center gap-2 text-slate-300/80 text-xs md:text-sm mb-1">
                                        <ArrowUpOutlined className="text-xs" />
                                        投资评级
                                    </div>
                                    <p className={`text-lg md:text-xl font-bold ${getRatingStyle(currentReport.investment_rating).text}`}>
                                        {currentReport.investment_rating}
                                    </p>
                                </div>
                            )}
                            
                            {currentReport.target_price && (
                                <div className="bg-gradient-to-br from-purple-900/60 to-indigo-900/60 rounded-xl p-3 md:p-4 border border-purple-500/20">
                                    <div className="flex items-center gap-2 text-slate-300/80 text-xs md:text-sm mb-1">
                                        <BarChartOutlined className="text-xs" />
                                        目标价
                                    </div>
                                    <p className="text-lg md:text-xl font-bold text-white">
                                        ¥{currentReport.target_price}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* 核心观点 */}
                        {currentReport.summary && (
                            <div className="px-5 py-5 md:px-8 md:py-6 bg-gradient-to-r from-amber-900/20 via-orange-900/10 to-amber-900/20 border-b border-amber-500/20">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                        <RiseOutlined className="text-amber-400" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-amber-300 uppercase tracking-wider">核心观点</h3>
                                </div>
                                <p className="text-slate-200 leading-relaxed text-sm md:text-base pl-10">
                                    {currentReport.summary}
                                </p>
                            </div>
                        )}

                        {/* 报告内容 */}
                        <div className="px-5 py-5 md:px-8 md:py-6 bg-slate-900/30">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                    <FileDoneOutlined className="text-indigo-400" />
                                </div>
                                <h3 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider">详细分析</h3>
                            </div>
                            <div className="prose prose-invert prose-sm md:prose-base max-w-none text-slate-300">
                                {parseReportContent(currentReport.report_content)}
                            </div>
                        </div>

                        {/* 风险提示 */}
                        <div className="px-5 py-4 md:px-8 md:py-5 bg-slate-800/50 border-t border-slate-700/50">
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-900/20 border border-amber-500/20">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                    <ExclamationCircleOutlined className="text-amber-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-amber-300 mb-1">风险提示</h4>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        本报告仅供参考，不构成投资建议。投资有风险，入市需谨慎。报告内容基于历史数据和AI分析，市场存在不确定性，请投资者自行判断。
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 生成失败信息 */}
                        {currentReport.error_message && (
                            <div className="px-5 py-4 md:px-8 md:py-5 bg-red-900/20 border-t border-red-500/30">
                                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-900/30 border border-red-500/30">
                                    <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                        <WarningOutlined className="text-red-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-red-300 mb-1">生成失败</h4>
                                        <p className="text-red-200/80 text-xs leading-relaxed">
                                            {currentReport.error_message}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <style>{`
                .report-table .ant-pagination {
                    color: #94a3b8;
                    display: flex !important;
                    align-items: center;
                    gap: 8px;
                    height: 100%;
                }
                .report-table .ant-pagination * {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .report-table .ant-pagination-item {
                    background: rgba(51, 65, 85, 0.5);
                    border-color: rgba(100, 116, 139, 0.3);
                }
                .report-table .ant-pagination-item a {
                    color: #cbd5e1;
                }
                .report-table .ant-pagination-item-active {
                    background: rgba(99, 102, 241, 0.2);
                    border-color: rgba(99, 102, 241, 0.5);
                }
                .report-table .ant-pagination-item-active a {
                    color: #818cf8;
                }
                .report-table .ant-pagination-prev button,
                .report-table .ant-pagination-next button {
                    color: #cbd5e1 !important;
                    background: rgba(51, 65, 85, 0.5);
                    border-color: rgba(100, 116, 139, 0.3);
                }
                .report-table .ant-pagination-prev button:hover,
                .report-table .ant-pagination-next button:hover {
                    color: #e2e8f0 !important;
                    background: rgba(71, 85, 105, 0.6);
                    border-color: rgba(100, 116, 139, 0.5);
                }
                .report-table .ant-pagination-prev .ant-pagination-item-link-icon,
                .report-table .ant-pagination-next .ant-pagination-item-link-icon {
                    color: #cbd5e1 !important;
                }
                .report-table .ant-pagination-prev .ant-pagination-item-link,
                .report-table .ant-pagination-next .ant-pagination-item-link {
                    color: #cbd5e1 !important;
                }
                .report-table .ant-pagination-prev .ant-pagination-item-link svg,
                .report-table .ant-pagination-next .ant-pagination-item-link svg {
                    fill: #cbd5e1 !important;
                    color: #cbd5e1 !important;
                }
                .report-table .ant-pagination-prev button:disabled,
                .report-table .ant-pagination-next button:disabled {
                    color: #475569 !important;
                    background: rgba(30, 41, 59, 0.5);
                    border-color: rgba(51, 65, 85, 0.3);
                }
                .report-table .ant-pagination-prev button:disabled svg,
                .report-table .ant-pagination-next button:disabled svg {
                    fill: #475569 !important;
                    color: #475569 !important;
                }
                .report-table .ant-pagination-jump-prev .ant-pagination-item- container-icon,
                .report-table .ant-pagination-jump-next .ant-pagination-item-container-icon {
                    color: #94a3b8;
                }
                .report-table .ant-pagination-options {
                    color: #94a3b8;
                }
                .report-table .ant-select-selector {
                    background: rgba(51, 65, 85, 0.5) !important;
                    border-color: rgba(100, 116, 139, 0.3) !important;
                    color: #cbd5e1 !important;
                }
                .report-table .ant-select-dropdown {
                    background: rgba(30, 41, 59, 0.98);
                }
                .report-table .ant-select-item {
                    color: #cbd5e1;
                }
                .report-table .ant-select-item-option-selected {
                    background: rgba(99, 102, 241, 0.2);
                }
                .report-table .ant-empty-description {
                    color: #64748b;
                }
            `}</style>
        </div>
    )
}

export default AnalysisReportPage
