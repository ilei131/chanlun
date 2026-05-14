import { Routes, Route } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import { BarChartOutlined, SearchOutlined, FileTextOutlined, SettingOutlined, StarOutlined } from '@ant-design/icons'
import Screener from '@/pages/Screener'
import StockSearch from '@/pages/StockSearch'
import StockDetail from '@/pages/StockDetail'
import Signals from '@/pages/Signals'
import SettingsPage from '@/pages/Settings'
import { useState } from 'react'

const { Header, Content, Sider } = Layout

function App() {
    const [collapsed, setCollapsed] = useState(false)
    const [current, setCurrent] = useState('screener')

    const menuItems = [
        { key: 'screener', icon: <SearchOutlined className="w-5 h-5" />, label: '选股大厅' },
        { key: 'signals', icon: <BarChartOutlined className="w-5 h-5" />, label: '信号列表' },
        { key: 'reports', icon: <FileTextOutlined className="w-5 h-5" />, label: '分析报告' },
        { key: 'settings', icon: <SettingOutlined className="w-5 h-5" />, label: '系统设置' },
    ]

    return (
        <Layout className="min-h-screen" style={{ background: '#0a0a12' }}>
            {/* Header */}
            <Header
                className="relative overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.9) 0%, rgba(55, 48, 163, 0.9) 50%, rgba(79, 70, 229, 0.9) 100%)',
                    borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
                    backdropFilter: 'blur(20px)',
                }}
            >
                {/* Glow effect */}
                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        background: 'radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.5) 0%, transparent 70%)',
                    }}
                />

                <div className="relative z-10 flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="relative p-2 rounded-xl"
                            style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)',
                            }}
                        >
                            <StarOutlined className="w-6 h-6 text-indigo-300" />
                        </div>
                        <div>
                            <h1
                                className="text-xl font-bold bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 bg-clip-text text-transparent"
                                style={{
                                    textShadow: '0 0 30px rgba(99, 102, 241, 0.5)',
                                }}
                            >
                                缠论选股系统
                            </h1>
                            <p className="text-xs text-indigo-300/60">智能量化分析平台</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-indigo-200/60 font-mono">v0.1.0</span>
                        <div
                            className="w-2 h-2 rounded-full animate-pulse"
                            style={{ backgroundColor: '#10b981' }}
                        />
                    </div>
                </div>
            </Header>

            <Layout>
                {/* Sidebar */}
                <Sider
                    trigger={null}
                    collapsible
                    collapsed={collapsed}
                    className="relative"
                    style={{
                        background: 'linear-gradient(180deg, rgba(17, 17, 32, 0.95) 0%, rgba(10, 10, 18, 0.98) 100%)',
                        borderRight: '1px solid rgba(99, 102, 241, 0.15)',
                        backdropFilter: 'blur(20px)',
                    }}
                    width={220}
                >
                    {/* Sidebar glow */}
                    <div
                        className="absolute top-0 left-0 right-0 h-px"
                        style={{
                            background: 'linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.5), transparent)',
                        }}
                    />

                    <div className="py-4 px-3">
                        <Menu
                            mode="inline"
                            selectedKeys={[current]}
                            items={menuItems}
                            onClick={({ key }) => setCurrent(key)}
                            className="bg-transparent border-none"
                            style={{
                                color: '#94a3b8',
                                fontSize: '14px',
                            }}
                        />
                    </div>

                    {/* Collapse button */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            boxShadow: '0 0 15px rgba(99, 102, 241, 0.5)',
                        }}
                    >
                        <svg
                            className="w-3 h-3 text-white transition-transform duration-300"
                            style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </Sider>

                {/* Content area */}
                <Layout className="flex-1">
                    <Content className="p-6">
                        <div className="min-h-full relative">
                            {/* Content glow overlay */}
                            <div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                    background: 'radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.05) 0%, transparent 50%)',
                                }}
                            />

                            <Routes>
                                <Route path="/" element={<StockSearch />} />
                                <Route path="/search" element={<StockSearch />} />
                                <Route path="/screener" element={<Screener />} />
                                <Route path="/stock/:code" element={<StockDetail />} />
                                <Route path="/signals" element={<Signals />} />
                                <Route path="/reports" element={<Signals />} />
                                <Route path="/settings" element={<SettingsPage />} />
                            </Routes>
                        </div>
                    </Content>
                </Layout>
            </Layout>
        </Layout>
    )
}

export default App
