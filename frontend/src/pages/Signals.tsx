import { useState } from 'react'
import { Card, Table, Tag, Select, DatePicker } from 'antd'

function Signals() {
  const [filters, setFilters] = useState({
    signalType: '',
    period: '',
    dateRange: [] as any[],
  })

  const mockSignals = [
    { id: 1, code: '000001', name: '平安银行', signalType: '1_buy', period: '1d', date: '2024-01-03', price: 10.9, confidence: 85 },
    { id: 2, code: '000002', name: '万科A', signalType: '2_buy', period: '1d', date: '2024-01-05', price: 8.2, confidence: 78 },
    { id: 3, code: '600036', name: '招商银行', signalType: '3_buy', period: '1w', date: '2024-01-08', price: 35.8, confidence: 90 },
    { id: 4, code: '000858', name: '五粮液', signalType: '1_buy', period: '1m', date: '2024-01-10', price: 145.5, confidence: 88 },
    { id: 5, code: '601318', name: '中国平安', signalType: '2_buy', period: '1d', date: '2024-01-12', price: 48.6, confidence: 75 },
  ]

  const columns = [
    {
      title: '代码',
      dataIndex: 'code',
      key: 'code',
      width: 100,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '信号类型',
      dataIndex: 'signalType',
      key: 'signalType',
      width: 100,
      render: (type: string) => {
        const colors: Record<string, string> = {
          '1_buy': 'green',
          '2_buy': 'blue',
          '3_buy': 'purple',
          '1_sell': 'red',
          '2_sell': 'orange',
          '3_sell': 'brown',
        }
        const labels: Record<string, string> = {
          '1_buy': '1买',
          '2_buy': '2买',
          '3_buy': '3买',
          '1_sell': '1卖',
          '2_sell': '2卖',
          '3_sell': '3卖',
        }
        return <Tag color={colors[type] || 'gray'}>{labels[type] || type}</Tag>
      },
    },
    {
      title: '周期',
      dataIndex: 'period',
      key: 'period',
      width: 80,
      render: (p: string) => {
        const labels: Record<string, string> = {
          '1d': '日线',
          '1w': '周线',
          '1m': '月线',
        }
        return labels[p] || p
      },
    },
    {
      title: '信号日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
    },
    {
      title: '信号价格',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (p: number) => p.toFixed(2),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      render: (c: number) => `${c}%`,
    },
  ]

  return (
    <div className="space-y-6">
      <Card title="信号列表">
        <div className="flex gap-4 mb-4">
          <Select
            placeholder="信号类型"
            style={{ width: 150 }}
            value={filters.signalType}
            onChange={(value) => setFilters((prev) => ({ ...prev, signalType: value }))}
            options={[
              { value: '', label: '全部' },
              { value: '1_buy', label: '1买' },
              { value: '2_buy', label: '2买' },
              { value: '3_buy', label: '3买' },
              { value: '1_sell', label: '1卖' },
              { value: '2_sell', label: '2卖' },
              { value: '3_sell', label: '3卖' },
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
            onChange={(dates) => setFilters((prev) => ({ ...prev, dateRange: dates }))}
          />
        </div>

        <Table
          columns={columns}
          dataSource={mockSignals}
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  )
}

export default Signals
