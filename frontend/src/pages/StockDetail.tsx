import { useParams, useNavigate } from 'react-router-dom'
import { Card, Tabs, Button, Tag, Descriptions, Spin, Empty, Row, Col, Statistic } from 'antd'
import ReactECharts from 'echarts-for-react'
import { ArrowLeftOutlined, CaretUpOutlined, CaretDownOutlined, BarChartOutlined, LineChartOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { stockApi, indicatorsApi, type StockDetailInfo, type TechnicalIndicator } from '@/api'

function StockDetail() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stockInfo, setStockInfo] = useState<StockDetailInfo | null>(null)
  const [indicators, setIndicators] = useState<TechnicalIndicator[]>([])
  const [period, setPeriod] = useState('1d')

  useEffect(() => {
    if (!code) return
    
    const fetchData = async () => {
      setLoading(true)
      try {
        const [stockRes, indicatorsRes] = await Promise.all([
          stockApi.getAll(),
          indicatorsApi.getByStock(1, period),
        ])
        
        const stock = stockRes.data.find(s => s.code === code)
        if (stock) {
          setStockInfo(stock)
        }
        
        setIndicators(indicatorsRes.data)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [code, period])

  const klineOption = {
    backgroundColor: '#1a1a2e',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(26, 26, 46, 0.9)',
      borderColor: '#4a5568',
      textStyle: { color: '#e2e8f0' },
    },
    legend: {
      data: ['K线', 'MA5', 'MA10', 'MA20'],
      textStyle: { color: '#e2e8f0' },
    },
    grid: [
      { left: '10%', right: '10%', top: '5%', height: '55%' },
      { left: '10%', right: '10%', top: '68%', height: '20%' },
    ],
    xAxis: [
      {
        type: 'category',
        data: indicators.map((d) => d.trade_date),
        gridIndex: 0,
        axisLine: { lineStyle: { color: '#4a5568' } },
        axisLabel: { color: '#a0aec0' },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: indicators.map((d) => d.trade_date),
        axisLine: { lineStyle: { color: '#4a5568' } },
        axisLabel: { show: false },
      },
    ],
    yAxis: [
      {
        type: 'value',
        scale: true,
        gridIndex: 0,
        splitNumber: 4,
        axisLine: { lineStyle: { color: '#4a5568' } },
        axisLabel: { color: '#a0aec0' },
        splitLine: { lineStyle: { color: '#2d3748', type: 'dashed' } },
      },
      {
        type: 'value',
        gridIndex: 1,
        splitNumber: 2,
        axisLine: { lineStyle: { color: '#4a5568' } },
        axisLabel: { color: '#a0aec0' },
        splitLine: { lineStyle: { color: '#2d3748', type: 'dashed' } },
      },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: 50, end: 100 },
      { 
        show: true, 
        xAxisIndex: [0, 1], 
        type: 'slider', 
        bottom: '2%', 
        start: 50, 
        end: 100,
        height: 20,
        borderColor: '#4a5568',
        fillerColor: 'rgba(99, 102, 241, 0.2)',
        handleStyle: { color: '#6366f1' },
      },
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: indicators.map((d) => [d.close, d.close * 1.02, d.close * 0.98, d.close]),
        itemStyle: {
          color: '#10b981',
          color0: '#ef4444',
          borderColor: '#10b981',
          borderColor0: '#ef4444',
        },
        markPoint: {
          data: [
            { name: '1买', coord: [indicators.length - 5, indicators[indicators.length - 5]?.close], value: '1买', itemStyle: { color: '#10b981' } },
            { name: '2买', coord: [indicators.length - 3, indicators[indicators.length - 3]?.close], value: '2买', itemStyle: { color: '#3b82f6' } },
          ],
        },
        markLine: {
          data: [
            {
              yAxis: indicators[indicators.length - 1]?.close * 1.05,
              name: '中枢上沿',
              lineStyle: { color: '#f59e0b', type: 'dashed' },
            },
            {
              yAxis: indicators[indicators.length - 1]?.close * 0.95,
              name: '中枢下沿',
              lineStyle: { color: '#f59e0b', type: 'dashed' },
            },
          ],
        },
      },
      {
        name: 'MA5',
        type: 'line',
        data: indicators.map((d) => d.ma5),
        smooth: true,
        lineStyle: { width: 1.5, color: '#22d3ee' },
      },
      {
        name: 'MA10',
        type: 'line',
        data: indicators.map((d) => d.ma10),
        smooth: true,
        lineStyle: { width: 1.5, color: '#fbbf24' },
      },
      {
        name: 'MA20',
        type: 'line',
        data: indicators.map((d) => d.ma20),
        smooth: true,
        lineStyle: { width: 1.5, color: '#ec4899' },
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: indicators.map((_, i) => (i % 2 === 0 ? 1000 + Math.random() * 500 : 800 + Math.random() * 400)),
        itemStyle: {
          color: (params: { dataIndex: number }) =>
            params.dataIndex % 2 === 0 ? '#10b981' : '#ef4444',
        },
      },
    ],
  }

  const macdOption = {
    backgroundColor: '#1a1a2e',
    tooltip: { 
      trigger: 'axis',
      backgroundColor: 'rgba(26, 26, 46, 0.9)',
      borderColor: '#4a5568',
      textStyle: { color: '#e2e8f0' },
    },
    legend: { 
      data: ['DIF', 'DEA', 'MACD'],
      textStyle: { color: '#e2e8f0' },
    },
    grid: { left: '10%', right: '10%', top: '10%', height: '80%' },
    xAxis: {
      type: 'category',
      data: indicators.map((d) => d.trade_date),
      axisLine: { lineStyle: { color: '#4a5568' } },
      axisLabel: { color: '#a0aec0', rotate: 45 },
    },
    yAxis: {
      type: 'value',
      splitNumber: 4,
      axisLine: { lineStyle: { color: '#4a5568' } },
      axisLabel: { color: '#a0aec0' },
      splitLine: { lineStyle: { color: '#2d3748', type: 'dashed' } },
    },
    series: [
      { name: 'DIF', type: 'line', data: indicators.map((d) => d.macd_dif), lineStyle: { color: '#10b981', width: 2 } },
      { name: 'DEA', type: 'line', data: indicators.map((d) => d.macd_dea), lineStyle: { color: '#ef4444', width: 2 } },
      {
        name: 'MACD',
        type: 'bar',
        data: indicators.map((d) => d.macd_hist),
        itemStyle: {
          color: (params: { value: number }) => (params.value >= 0 ? '#10b981' : '#ef4444'),
        },
      },
    ],
  }

  const kdjOption = {
    backgroundColor: '#1a1a2e',
    tooltip: { 
      trigger: 'axis',
      backgroundColor: 'rgba(26, 26, 46, 0.9)',
      borderColor: '#4a5568',
      textStyle: { color: '#e2e8f0' },
    },
    legend: { 
      data: ['K', 'D', 'J'],
      textStyle: { color: '#e2e8f0' },
    },
    grid: { left: '10%', right: '10%', top: '10%', height: '80%' },
    xAxis: {
      type: 'category',
      data: indicators.map((d) => d.trade_date),
      axisLine: { lineStyle: { color: '#4a5568' } },
      axisLabel: { color: '#a0aec0', rotate: 45 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitNumber: 5,
      axisLine: { lineStyle: { color: '#4a5568' } },
      axisLabel: { color: '#a0aec0' },
      splitLine: { lineStyle: { color: '#2d3748', type: 'dashed' } },
    },
    series: [
      { name: 'K', type: 'line', data: indicators.map((d) => d.kdj_k), lineStyle: { color: '#10b981', width: 2 } },
      { name: 'D', type: 'line', data: indicators.map((d) => d.kdj_d), lineStyle: { color: '#3b82f6', width: 2 } },
      { name: 'J', type: 'line', data: indicators.map((d) => d.kdj_j), lineStyle: { color: '#fbbf24', width: 2 } },
    ],
  }

  const bollOption = {
    backgroundColor: '#1a1a2e',
    tooltip: { 
      trigger: 'axis',
      backgroundColor: 'rgba(26, 26, 46, 0.9)',
      borderColor: '#4a5568',
      textStyle: { color: '#e2e8f0' },
    },
    legend: { 
      data: ['收盘价', '布林上轨', '布林中轨', '布林下轨'],
      textStyle: { color: '#e2e8f0' },
    },
    grid: { left: '10%', right: '10%', top: '10%', height: '80%' },
    xAxis: {
      type: 'category',
      data: indicators.map((d) => d.trade_date),
      axisLine: { lineStyle: { color: '#4a5568' } },
      axisLabel: { color: '#a0aec0', rotate: 45 },
    },
    yAxis: {
      type: 'value',
      splitNumber: 4,
      axisLine: { lineStyle: { color: '#4a5568' } },
      axisLabel: { color: '#a0aec0' },
      splitLine: { lineStyle: { color: '#2d3748', type: 'dashed' } },
    },
    series: [
      { name: '收盘价', type: 'line', data: indicators.map((d) => d.close), lineStyle: { color: '#e2e8f0', width: 2 } },
      { name: '布林上轨', type: 'line', data: indicators.map((d) => d.boll_upper), lineStyle: { color: '#ef4444', type: 'dashed', width: 1.5 } },
      { name: '布林中轨', type: 'line', data: indicators.map((d) => d.boll_mid), lineStyle: { color: '#10b981', width: 1.5 } },
      { name: '布林下轨', type: 'line', data: indicators.map((d) => d.boll_lower), lineStyle: { color: '#3b82f6', type: 'dashed', width: 1.5 } },
    ],
  }

  const latestIndicators = indicators[indicators.length - 1]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate(-1)}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
              返回
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <BarChartOutlined />
                {stockInfo?.code || code} {stockInfo?.name || '股票详情'}
              </h1>
              <p className="text-gray-400 text-sm">缠论分析 · {period === '1d' ? '日线' : period === '1w' ? '周线' : '月线'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {['1d', '1w', '1m'].map((p) => (
              <Button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 ${period === p ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                {p === '1d' ? '日线' : p === '1w' ? '周线' : '月线'}
              </Button>
            ))}
          </div>
        </div>

        <Spin spinning={loading}>
          {stockInfo && (
            <>
              <Row gutter={16}>
                <Col span={6}>
                  <Card className="bg-white/5 backdrop-blur-sm border border-white/10">
                    <Statistic 
                      title="最新价格" 
                      value={latestIndicators?.close || 0} 
                      precision={2}
                      prefix={<span className="text-2xl">¥</span>}
                      valueStyle={{ color: '#fff', fontSize: '28px' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card className="bg-white/5 backdrop-blur-sm border border-white/10">
                    <Statistic 
                      title="涨跌幅" 
                      value={2.35} 
                      precision={2}
                      suffix="%"
                      prefix={2.35 >= 0 ? <CaretUpOutlined className="text-green-400" /> : <CaretDownOutlined className="text-red-400" />}
                      valueStyle={{ color: 2.35 >= 0 ? '#10b981' : '#ef4444' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card className="bg-white/5 backdrop-blur-sm border border-white/10">
                    <Statistic 
                      title="成交量" 
                      value={2500} 
                      suffix="万手"
                      valueStyle={{ color: '#fff' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card className="bg-white/5 backdrop-blur-sm border border-white/10">
                    <Statistic 
                      title="成交额" 
                      value={31.5} 
                      prefix="¥"
                      suffix="亿"
                      valueStyle={{ color: '#fff' }}
                    />
                  </Card>
                </Col>
              </Row>

              <Card className="bg-white/5 backdrop-blur-sm border border-white/10">
                <Descriptions bordered column={4} size="small">
                  <Descriptions.Item label="开盘价" labelStyle={{ color: '#a0aec0' }} contentStyle={{ color: '#fff' }}>
                    {(latestIndicators?.close * 0.99).toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="最高价" labelStyle={{ color: '#a0aec0' }} contentStyle={{ color: '#fff' }}>
                    {(latestIndicators?.close * 1.02).toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="最低价" labelStyle={{ color: '#a0aec0' }} contentStyle={{ color: '#fff' }}>
                    {(latestIndicators?.close * 0.98).toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="换手率" labelStyle={{ color: '#a0aec0' }} contentStyle={{ color: '#fff' }}>
                    1.2%
                  </Descriptions.Item>
                  <Descriptions.Item label="市盈率" labelStyle={{ color: '#a0aec0' }} contentStyle={{ color: '#fff' }}>
                    10.5
                  </Descriptions.Item>
                  <Descriptions.Item label="市净率" labelStyle={{ color: '#a0aec0' }} contentStyle={{ color: '#fff' }}>
                    1.2
                  </Descriptions.Item>
                  <Descriptions.Item label="上市日期" labelStyle={{ color: '#a0aec0' }} contentStyle={{ color: '#fff' }}>
                    {stockInfo.list_date || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="市场类型" labelStyle={{ color: '#a0aec0' }} contentStyle={{ color: '#fff' }}>
                    {stockInfo.market === 'SH' ? '沪市' : '深市'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Card 
                className="bg-white/5 backdrop-blur-sm border border-white/10"
                title={
                  <div className="flex items-center gap-2 text-white">
                    <LineChartOutlined className="text-indigo-400" />
                    K线图（含中枢区间）
                  </div>
                }
              >
                {indicators.length > 0 ? (
                  <ReactECharts option={klineOption} style={{ height: '500px' }} />
                ) : (
                  <Empty description="暂无K线数据" className="text-gray-400" />
                )}
              </Card>

              <Tabs 
                defaultActiveKey="macd" 
                className="bg-white/5 backdrop-blur-sm border border-white/10"
                tabBarStyle={{ color: '#fff' }}
              >
                <Tabs.TabPane tab={<span className="text-white">MACD</span>} key="macd">
                  {indicators.length > 0 ? (
                    <ReactECharts option={macdOption} style={{ height: '350px' }} />
                  ) : (
                    <Empty description="暂无MACD数据" className="text-gray-400" />
                  )}
                </Tabs.TabPane>
                <Tabs.TabPane tab={<span className="text-white">KDJ</span>} key="kdj">
                  {indicators.length > 0 ? (
                    <ReactECharts option={kdjOption} style={{ height: '350px' }} />
                  ) : (
                    <Empty description="暂无KDJ数据" className="text-gray-400" />
                  )}
                </Tabs.TabPane>
                <Tabs.TabPane tab={<span className="text-white">布林带</span>} key="boll">
                  {indicators.length > 0 ? (
                    <ReactECharts option={bollOption} style={{ height: '350px' }} />
                  ) : (
                    <Empty description="暂无布林带数据" className="text-gray-400" />
                  )}
                </Tabs.TabPane>
              </Tabs>

              <Row gutter={16}>
                <Col span={12}>
                  <Card 
                    className="bg-white/5 backdrop-blur-sm border border-white/10"
                    title={<span className="text-white">缠论信号</span>}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Tag color="green">1买</Tag>
                          <span className="text-gray-300">2024-01-03</span>
                        </div>
                        <div className="text-right">
                          <p className="text-white">价格: {latestIndicators?.close?.toFixed(2)}</p>
                          <p className="text-green-400 text-sm">置信度: 85%</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Tag color="blue">2买</Tag>
                          <span className="text-gray-300">2024-01-08</span>
                        </div>
                        <div className="text-right">
                          <p className="text-white">价格: {(latestIndicators?.close * 1.05).toFixed(2)}</p>
                          <p className="text-green-400 text-sm">置信度: 78%</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card 
                    className="bg-white/5 backdrop-blur-sm border border-white/10"
                    title={<span className="text-white">中枢区间</span>}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                        <div>
                          <span className="text-white">中枢#1</span>
                          <p className="text-gray-400 text-sm">2024-01-02 ~ 2024-01-10</p>
                        </div>
                        <div className="text-right">
                          <p className="text-yellow-400">ZG: {(latestIndicators?.close * 1.05).toFixed(2)}</p>
                          <p className="text-blue-400">ZD: {(latestIndicators?.close * 0.95).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </Spin>
      </div>
    </div>
  )
}

export default StockDetail