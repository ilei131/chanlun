// src/pages/Login.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { authApi } from '@/api'

export default function Login() {
    const navigate = useNavigate()
    const [isLogin, setIsLogin] = useState(true)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showSuccessModal, setShowSuccessModal] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // 验证
        if (!username.trim()) {
            setError('请输入用户名')
            return
        }
        if (!password) {
            setError('请输入密码')
            return
        }
        if (!isLogin) {
            if (password !== confirmPassword) {
                setError('两次输入的密码不一致')
                return
            }
            if (password.length < 6) {
                setError('密码长度至少为6位')
                return
            }
        }

        setLoading(true)

        try {
            if (isLogin) {
                const response = await authApi.login({ username, password })
                localStorage.setItem('token', response.data.token)
                localStorage.setItem('user', JSON.stringify(response.data.user))
                navigate('/')
            } else {
                await authApi.register({ username, password, email: email || undefined })
                setError('')
                setShowSuccessModal(true)
                setPassword('')
                setConfirmPassword('')
                setEmail('')
            }
        } catch (err: any) {
            setError(err.response?.data?.error || (isLogin ? '登录失败' : '注册失败'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)' }}>
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%)' }} />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)' }} />
            </div>

            {/* Login Card */}
            <div className="relative w-full max-w-md mx-4">
                <div className="relative p-8 rounded-2xl backdrop-blur-xl border border-slate-700/50" style={{ background: 'rgba(17, 17, 32, 0.8)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                            <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 bg-clip-text text-transparent">
                            缠论选股系统
                        </h1>
                        <p className="text-slate-400 text-sm mt-2">
                            {isLogin ? '欢迎回来，请登录您的账户' : '创建新账户'}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Error Message */}
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Username */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                用户名
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all"
                                placeholder="请输入用户名"
                            />
                        </div>

                        {/* Email (Register only) */}
                        {!isLogin && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    邮箱（可选）
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all"
                                    placeholder="请输入邮箱（可选）"
                                />
                            </div>
                        )}

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                密码
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all"
                                placeholder={isLogin ? '请输入密码' : '至少6位密码'}
                            />
                        </div>

                        {/* Confirm Password (Register only) */}
                        {!isLogin && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    确认密码
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all"
                                    placeholder="请再次输入密码"
                                />
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 rounded-xl font-medium text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                                background: loading ? '#6366f1' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                boxShadow: loading ? 'none' : '0 10px 25px -5px rgba(99, 102, 241, 0.4)',
                            }}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    处理中...
                                </span>
                            ) : (
                                isLogin ? '登录' : '注册'
                            )}
                        </button>
                    </form>

                    {/* Toggle */}
                    <div className="mt-6 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin)
                                setError('')
                                setPassword('')
                                setConfirmPassword('')
                            }}
                            className="text-sm text-slate-400 hover:text-indigo-400 transition-colors"
                        >
                            {isLogin ? '还没有账户？立即注册' : '已有账户？立即登录'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Success Modal */}
            <Modal
                open={showSuccessModal}
                onCancel={() => setShowSuccessModal(false)}
                footer={null}
                centered
                width={360}
                style={{
                    background: 'rgba(17, 17, 32, 0.9)',
                    borderRadius: '16px',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
            >
                <div className="text-center py-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(20, 184, 166, 0.2) 100%)' }}>
                        <CheckCircleOutlined className="w-10 h-10" style={{ color: '#22c55e' }} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">注册成功</h3>
                    <p className="text-slate-400 text-sm mb-6">恭喜您创建账户成功，请登录</p>
                    <button
                        onClick={() => {
                            setShowSuccessModal(false)
                            setIsLogin(true)
                        }}
                        className="w-full py-3 px-4 rounded-xl font-medium text-white transition-all duration-200"
                        style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                            boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)',
                        }}
                    >
                        去登录
                    </button>
                </div>
            </Modal>
        </div>
    )
}
