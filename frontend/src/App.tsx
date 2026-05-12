import { Routes, Route } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import { BarChartOutlined, SearchOutlined, FileTextOutlined, SettingOutlined } from '@ant-design/icons'
import Screener from '@/pages/Screener'
import StockDetail from '@/pages/StockDetail'
import Signals from '@/pages/Signals'
import SettingsPage from '@/pages/Settings'
import { useState } from 'react'

const { Header, Content, Sider } = Layout

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [current, setCurrent] = useState('screener')

  const menuItems = [
    { key: 'screener', icon: <SearchOutlined className="text-gray-300" />, label: '选股大厅' },
    { key: 'signals', icon: <BarChartOutlined className="text-gray-300" />, label: '信号列表' },
    { key: 'reports', icon: <FileTextOutlined className="text-gray-300" />, label: '分析报告' },
    { key: 'settings', icon: <SettingOutlined className="text-gray-300" />, label: '系统设置' },
  ]

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#0f0f23' }}>
      <Header className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChartOutlined className="text-xl text-indigo-300" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
              缠论选股系统
            </h1>
          </div>
          <div className="text-gray-400 text-sm">Version 0.1.0</div>
        </div>
      </Header>
      <Layout>
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          className="bg-slate-900/50 border-r border-white/10 backdrop-blur-sm"
          width={200}
        >
          <Menu
            mode="inline"
            selectedKeys={[current]}
            items={menuItems}
            onClick={({ key }) => setCurrent(key)}
            className="bg-transparent border-none [&_.ant-menu-item-selected]:bg-indigo-500/20 [&_.ant-menu-item-selected]:border-r-2 [&_.ant-menu-item-selected]:border-indigo-500"
            style={{ 
              color: '#a0aec0',
              fontSize: '14px',
            }}
          />
        </Sider>
        <Layout className="p-6">
          <Content className="min-h-[calc(100vh-180px)]">
            <Routes>
              <Route path="/" element={<Screener />} />
              <Route path="/screener" element={<Screener />} />
              <Route path="/stock/:code" element={<StockDetail />} />
              <Route path="/signals" element={<Signals />} />
              <Route path="/reports" element={<Signals />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}

export default App