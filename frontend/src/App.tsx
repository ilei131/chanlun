import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Screener from '@/pages/Screener'
import StockSearch from '@/pages/StockSearch'
import StockDetail from '@/pages/StockDetail'
import Signals from '@/pages/Signals'
import SettingsPage from '@/pages/Settings'
import Login from '@/pages/Login'
import AnalysisReport from '@/pages/AnalysisReport'
import { useState, useEffect } from 'react'
import { authApi } from '@/api'
import { Menu, X, User, LogOut, Settings, ChevronDown } from 'lucide-react'

function App() {
    const location = useLocation()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [userMenuOpen, setUserMenuOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [user, setUser] = useState<{ username: string; role: string } | null>(null)
    const [checkedAuth, setCheckedAuth] = useState(false)

    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth < 768)
            if (window.innerWidth < 768) {
                setSidebarOpen(false)
            }
        }
        checkScreenSize()
        window.addEventListener('resize', checkScreenSize)
        return () => window.removeEventListener('resize', checkScreenSize)
    }, [])

    useEffect(() => {
        const currentUser = authApi.getUser()
        setUser(currentUser)
        setCheckedAuth(true)
    }, [location])

    const handleLogout = () => {
        authApi.logout()
        setUser(null)
        window.location.href = '/login'
    }

    const menuItems = [
        { path: '/', label: '首页', icon: '📊' },
        { path: '/screener', label: '选股大厅', icon: '🎯' },
        { path: '/signals', label: '信号列表', icon: '📈' },
        { path: '/reports', label: '分析报告', icon: '📋' },
        { path: '/settings', label: '系统设置', icon: '⚙️' },
    ]

    const isLoginPage = location.pathname === '/login'
    const isAuthenticated = authApi.isAuthenticated()

    // 如果还没检查认证状态，显示加载中
    if (!checkedAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a12' }}>
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        )
    }

    // 如果是登录页，直接显示登录页面
    if (isLoginPage) {
        return <Login />
    }

    // 如果未登录，重定向到登录页
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    return (
        <div className="min-h-screen flex" style={{ background: '#0a0a12' }}>
            {/* Sidebar - Desktop */}
            {!isMobile && (
                <aside
                    className="w-64 flex-shrink-0 flex flex-col border-r border-slate-800"
                    style={{ background: 'linear-gradient(180deg, #111120 0%, #0a0a12 100%)' }}
                >
                    {/* Logo */}
                    <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800/50">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%)',
                                border: '1px solid rgba(99, 102, 241, 0.5)',
                            }}
                        >
                            <span className="text-xl">⭐</span>
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-white">缠论选股系统</h1>
                            <p className="text-xs text-slate-400">智能量化分析</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 py-4 px-3 space-y-1">
                        {menuItems.map((item) => {
                            const isActive = location.pathname === item.path
                            return (
                                <a
                                    key={item.path}
                                    href={item.path}
                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                                        ? 'text-white'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                        }`}
                                    style={
                                        isActive
                                            ? {
                                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)',
                                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                            }
                                            : {}
                                    }
                                >
                                    <span className="text-lg">{item.icon}</span>
                                    {item.label}
                                </a>
                            )
                        })}
                    </nav>

                    {/* Version */}
                    <div className="px-6 py-4 border-t border-slate-800/50">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>v0.1.0</span>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>在线</span>
                            </div>
                        </div>
                    </div>
                </aside>
            )}

            {/* Mobile Sidebar Overlay */}
            {isMobile && sidebarOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        onClick={() => setSidebarOpen(false)}
                    />
                    <aside
                        className="fixed left-0 top-0 bottom-0 w-64 z-50 flex flex-col border-r border-slate-800"
                        style={{ background: 'linear-gradient(180deg, #111120 0%, #0a0a12 100%)' }}
                    >
                        {/* Logo */}
                        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%)',
                                        border: '1px solid rgba(99, 102, 241, 0.5)',
                                    }}
                                >
                                    <span className="text-xl">⭐</span>
                                </div>
                                <h1 className="text-base font-bold text-white">缠论选股</h1>
                            </div>
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Navigation */}
                        <nav className="flex-1 py-4 px-3 space-y-1">
                            {menuItems.map((item) => {
                                const isActive = location.pathname === item.path
                                return (
                                    <a
                                        key={item.path}
                                        href={item.path}
                                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                                            ? 'text-white'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                            }`}
                                        style={
                                            isActive
                                                ? {
                                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)',
                                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                                }
                                                : {}
                                        }
                                        onClick={() => setSidebarOpen(false)}
                                    >
                                        <span className="text-lg">{item.icon}</span>
                                        {item.label}
                                    </a>
                                )
                            })}
                        </nav>
                    </aside>
                </>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-slate-800" style={{ background: 'rgba(17, 17, 32, 0.8)' }}>
                    {/* Mobile Menu Button */}
                    {isMobile && (
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                    )}

                    {/* Page Title */}
                    <div className="flex-1 md:flex-none">
                        <h2 className="text-lg font-semibold text-white">
                            {menuItems.find(item => item.path === location.pathname)?.label || '缠论选股系统'}
                        </h2>
                    </div>

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors"
                        >
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%)',
                                }}
                            >
                                <User className="w-4 h-4 text-indigo-400" />
                            </div>
                            <span className="hidden md:block text-sm text-white">{user?.username || '用户'}</span>
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                        </button>

                        {userMenuOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setUserMenuOpen(false)}
                                />
                                <div
                                    className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-700/50 overflow-hidden z-50"
                                    style={{ background: '#1e1e30', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
                                >
                                    <div className="px-4 py-3 border-b border-slate-700/50">
                                        <p className="text-sm text-white font-medium">{user?.username}</p>
                                        <p className="text-xs text-slate-400 capitalize">{user?.role || 'user'}</p>
                                    </div>
                                    <div className="py-1">
                                        <a
                                            href="/settings"
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
                                        >
                                            <Settings className="w-4 h-4" />
                                            设置
                                        </a>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-slate-800/50 transition-colors"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            退出登录
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 md:p-6 overflow-auto">
                    <Routes>
                        <Route path="/" element={<StockSearch />} />
                        <Route path="/search" element={<StockSearch />} />
                        <Route path="/screener" element={<Screener />} />
                        <Route path="/stock/:code" element={<StockDetail />} />
                        <Route path="/signals" element={<Signals />} />
                        <Route path="/reports" element={<AnalysisReport />} />
                        <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                </main>

                {/* Footer */}
                <footer className="h-12 flex items-center justify-center border-t border-slate-800 text-xs text-slate-400">
                    <p>缠论选股系统 v0.1.0 · 数据仅供参考，不构成投资建议</p>
                </footer>
            </div>
        </div>
    )
}

export default App
