import { useState, useEffect } from 'react'
import { Card, Form, Input, InputNumber, Switch, Button, message, Select } from 'antd'
import { DatabaseOutlined, SaveOutlined, SettingOutlined, RestOutlined, SlidersOutlined, KeyOutlined, ApiOutlined } from '@ant-design/icons'
import { authApi } from '@/api'

function SettingsPage() {
    const [form] = Form.useForm()
    const [tushareForm] = Form.useForm()
    const [aiForm] = Form.useForm()
    const [currentToken, setCurrentToken] = useState<string>('')
    const [currentGeminiToken, setCurrentGeminiToken] = useState<string>('')
    const [currentOpenaiToken, setCurrentOpenaiToken] = useState<string>('')
    const [currentProvider, setCurrentProvider] = useState<string>('')
    const [loading, setLoading] = useState(false)

    // 加载当前用户的 tushare token
    useEffect(() => {
        loadUserToken()
    }, [])

    const loadUserToken = async () => {
        try {
            const user = authApi.getUser()
            if (user?.tushare_token) {
                setCurrentToken(user.tushare_token)
                tushareForm.setFieldsValue({
                    tushare_token: user.tushare_token
                })
            }
            if (user?.gemini_token) {
                setCurrentGeminiToken(user.gemini_token)
            }
            if (user?.openai_token) {
                setCurrentOpenaiToken(user.openai_token)
            }
            if (user?.preferred_ai_provider) {
                setCurrentProvider(user.preferred_ai_provider)
            }
            aiForm.setFieldsValue({
                gemini_token: user?.gemini_token || '',
                openai_token: user?.openai_token || '',
                preferred_ai_provider: user?.preferred_ai_provider || 'gemini',
            })
        } catch (error) {
            console.error('Failed to load tokens:', error)
        }
    }

    const handleSaveTushareToken = async (values: any) => {
        setLoading(true)
        try {
            await authApi.updateTushareToken(values.tushare_token)
            message.success('tushare token 更新成功')
            setCurrentToken(values.tushare_token)

            // 更新本地存储的用户信息
            const user = authApi.getUser()
            if (user) {
                user.tushare_token = values.tushare_token
                localStorage.setItem('user', JSON.stringify(user))
            }
        } catch (error: any) {
            message.error(error.response?.data?.error || '更新失败')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteTushareToken = async () => {
        setLoading(true)
        try {
            await authApi.deleteTushareToken()
            message.success('tushare token 已删除')
            setCurrentToken('')
            tushareForm.resetFields()

            // 更新本地存储的用户信息
            const user = authApi.getUser()
            if (user) {
                user.tushare_token = undefined
                localStorage.setItem('user', JSON.stringify(user))
            }
        } catch (error: any) {
            message.error(error.response?.data?.error || '删除失败')
        } finally {
            setLoading(false)
        }
    }

    const handleSaveAiToken = async (values: any) => {
        setLoading(true)
        try {
            await authApi.updateAiToken({
                gemini_token: values.gemini_token || undefined,
                openai_token: values.openai_token || undefined,
                preferred_ai_provider: values.preferred_ai_provider,
            })
            message.success('AI token 更新成功')
            setCurrentGeminiToken(values.gemini_token || '')
            setCurrentOpenaiToken(values.openai_token || '')
            setCurrentProvider(values.preferred_ai_provider)

            // 更新本地存储的用户信息
            const user = authApi.getUser()
            if (user) {
                user.gemini_token = values.gemini_token || undefined
                user.openai_token = values.openai_token || undefined
                user.preferred_ai_provider = values.preferred_ai_provider
                localStorage.setItem('user', JSON.stringify(user))
            }
        } catch (error: any) {
            message.error(error.response?.data?.error || '更新失败')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteAiToken = async () => {
        setLoading(true)
        try {
            await authApi.deleteAiToken()
            message.success('AI token 已删除')
            setCurrentGeminiToken('')
            setCurrentOpenaiToken('')
            setCurrentProvider('')
            aiForm.resetFields()

            // 更新本地存储的用户信息
            const user = authApi.getUser()
            if (user) {
                user.gemini_token = undefined
                user.openai_token = undefined
                user.preferred_ai_provider = undefined
                localStorage.setItem('user', JSON.stringify(user))
            }
        } catch (error: any) {
            message.error(error.response?.data?.error || '删除失败')
        } finally {
            setLoading(false)
        }
    }

    const onFinish = (values: any) => {
        message.success('系统设置已保存')
        console.log('System settings saved:', values)
    }

    return (
        <div className="space-y-6">
            {/* System Settings Card */}
            <Card
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                            <SettingOutlined className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">系统设置</h2>
                            <p className="text-xs text-gray-400">配置系统基础参数</p>
                        </div>
                    </div>
                }
                style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    borderRadius: '16px',
                }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    initialValues={{
                        apiUrl: 'http://localhost:8080/api/v1',
                        refreshInterval: 30,
                        autoRefresh: true,
                        maxResults: 100,
                    }}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Form.Item
                            label={
                                <div className="flex items-center gap-2">
                                    <DatabaseOutlined className="w-4 h-4 text-indigo-400" />
                                    <span className="text-gray-300">API地址</span>
                                </div>
                            }
                            name="apiUrl"
                            rules={[{ required: true, message: '请输入API地址' }]}
                        >
                            <Input
                                placeholder="输入API地址"
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    color: '#fff',
                                }}
                            />
                        </Form.Item>

                        <Form.Item
                            label={
                                <div className="flex items-center gap-2">
                                    <RestOutlined className="w-4 h-4 text-green-400" />
                                    <span className="text-gray-300">自动刷新间隔（秒）</span>
                                </div>
                            }
                            name="refreshInterval"
                            rules={[{ required: true, message: '请输入刷新间隔' }]}
                        >
                            <InputNumber
                                min={10}
                                max={300}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    color: '#fff',
                                }}
                            />
                        </Form.Item>

                        <Form.Item
                            label={
                                <div className="flex items-center gap-2">
                                    <RestOutlined className="w-4 h-4 text-yellow-400" />
                                    <span className="text-gray-300">自动刷新</span>
                                </div>
                            }
                            name="autoRefresh"
                            valuePropName="checked"
                        >
                            <Switch
                                checkedChildren="开启"
                                unCheckedChildren="关闭"
                                style={{ backgroundColor: '#6366f1' }}
                            />
                        </Form.Item>

                        <Form.Item
                            label={
                                <div className="flex items-center gap-2">
                                    <DatabaseOutlined className="w-4 h-4 text-purple-400" />
                                    <span className="text-gray-300">最大显示数量</span>
                                </div>
                            }
                            name="maxResults"
                            rules={[{ required: true, message: '请输入最大显示数量' }]}
                        >
                            <InputNumber
                                min={10}
                                max={500}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    color: '#fff',
                                }}
                            />
                        </Form.Item>
                    </div>

                    <div className="flex justify-end mt-6">
                        <Button
                            type="primary"
                            htmlType="submit"
                            icon={<SaveOutlined />}
                            style={{
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                borderColor: 'transparent',
                                boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
                            }}
                        >
                            保存设置
                        </Button>
                    </div>
                </Form>
            </Card>

            {/* Algorithm Settings Card */}
            <Card
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
                            <SlidersOutlined className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">算法参数</h2>
                            <p className="text-xs text-gray-400">配置缠论分析算法参数</p>
                        </div>
                    </div>
                }
                style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                    border: '1px solid rgba(168, 85, 247, 0.15)',
                    borderRadius: '16px',
                }}
            >
                <Form layout="vertical">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Form.Item
                            label={
                                <div className="flex items-center gap-2">
                                    <SlidersOutlined className="w-4 h-4 text-cyan-400" />
                                    <span className="text-gray-300">分型最小置信度</span>
                                </div>
                            }
                        >
                            <InputNumber
                                min={0}
                                max={100}
                                defaultValue={50}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    color: '#fff',
                                }}
                            />
                        </Form.Item>

                        <Form.Item
                            label={
                                <div className="flex items-center gap-2">
                                    <SlidersOutlined className="w-4 h-4 text-green-400" />
                                    <span className="text-gray-300">笔最小长度（元）</span>
                                </div>
                            }
                        >
                            <InputNumber
                                min={0}
                                step={0.01}
                                defaultValue={0.01}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    color: '#fff',
                                }}
                            />
                        </Form.Item>

                        <Form.Item
                            label={
                                <div className="flex items-center gap-2">
                                    <SlidersOutlined className="w-4 h-4 text-yellow-400" />
                                    <span className="text-gray-300">笔最小质量评分</span>
                                </div>
                            }
                        >
                            <InputNumber
                                min={0}
                                max={100}
                                defaultValue={50}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    color: '#fff',
                                }}
                            />
                        </Form.Item>

                        <Form.Item
                            label={
                                <div className="flex items-center gap-2">
                                    <SlidersOutlined className="w-4 h-4 text-purple-400" />
                                    <span className="text-gray-300">中枢最小重叠比例</span>
                                </div>
                            }
                        >
                            <InputNumber
                                min={0}
                                max={1}
                                step={0.01}
                                defaultValue={0.5}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    color: '#fff',
                                }}
                            />
                        </Form.Item>
                    </div>

                    <div className="flex justify-end mt-6">
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            style={{
                                background: 'linear-gradient(135deg, #a855f7, #d946ef)',
                                borderColor: 'transparent',
                                boxShadow: '0 4px 20px rgba(168, 85, 247, 0.3)',
                            }}
                        >
                            保存参数
                        </Button>
                    </div>
                </Form>
            </Card>

            {/* Tushare Token Settings Card */}
            <Card
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34, 211, 238, 0.15)' }}>
                            <KeyOutlined className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Tushare Token 配置</h2>
                            <p className="text-xs text-gray-400">配置您的 Tushare API 访问令牌</p>
                        </div>
                    </div>
                }
                style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                    border: '1px solid rgba(34, 211, 238, 0.15)',
                    borderRadius: '16px',
                }}
            >
                <Form
                    form={tushareForm}
                    layout="vertical"
                    onFinish={handleSaveTushareToken}
                >
                    <div className="space-y-4">
                        <div className="bg-cyan-900/20 border border-cyan-800/30 rounded-lg p-4">
                            <p className="text-sm text-cyan-300 mb-2">什么是 Tushare Token？</p>
                            <p className="text-xs text-gray-400">
                                Tushare Token 是访问 Tushare 数据接口所需的认证令牌。您可以在{' '}
                                <a href="https://tushare.pro/user/token" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                                    Tushare 官网
                                </a>
                                {' '}获取您的个人 Token。
                            </p>
                        </div>

                        <Form.Item
                            label={
                                <div className="flex items-center gap-2">
                                    <KeyOutlined className="w-4 h-4 text-cyan-400" />
                                    <span className="text-gray-300">Tushare Token</span>
                                </div>
                            }
                            name="tushare_token"
                            rules={[{ required: false, message: '请输入 Tushare Token' }]}
                        >
                            <Input.Password
                                placeholder="输入您的 Tushare Token"
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    color: '#fff',
                                }}
                            />
                        </Form.Item>

                        {currentToken && (
                            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-3">
                                <p className="text-sm text-green-300">
                                    ✓ 当前已配置 Token：{currentToken.substring(0, 8)}...{currentToken.substring(currentToken.length - 8)}
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-6">
                            {currentToken && (
                                <Button
                                    danger
                                    onClick={handleDeleteTushareToken}
                                    loading={loading}
                                    style={{
                                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                        borderColor: 'rgba(239, 68, 68, 0.3)',
                                        color: '#ef4444',
                                    }}
                                >
                                    删除 Token
                                </Button>
                            )}
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                icon={<SaveOutlined />}
                                style={{
                                    background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
                                    borderColor: 'transparent',
                                    boxShadow: '0 4px 20px rgba(34, 211, 238, 0.3)',
                                }}
                            >
                                保存 Token
                            </Button>
                        </div>
                    </div>
                </Form>
            </Card>

            {/* AI Token Settings Card */}
            <Card
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(14, 165, 233, 0.15)' }}>
                            <ApiOutlined className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">AI Token 配置</h2>
                            <p className="text-xs text-gray-400">配置您的 AI API 访问令牌（Gemini/OpenAI）</p>
                        </div>
                    </div>
                }
                style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                    border: '1px solid rgba(14, 165, 233, 0.15)',
                    borderRadius: '16px',
                }}
            >
                <Form
                    form={aiForm}
                    layout="vertical"
                    onFinish={handleSaveAiToken}
                >
                    <div className="space-y-4">
                        <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
                            <p className="text-sm text-blue-300 mb-2">什么是 AI Token？</p>
                            <p className="text-xs text-gray-400">
                                AI Token 是访问 Gemini 或 OpenAI API 所需的认证令牌。
                                您可以在{' '}
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                    Google AI Studio
                                </a>
                                {' '}获取 Gemini Token，或在{' '}
                                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                    OpenAI Platform
                                </a>
                                {' '}获取 OpenAI Token。
                            </p>
                        </div>

                        <Form.Item
                            label={
                                <div className="flex items-center gap-2">
                                    <ApiOutlined className="w-4 h-4 text-blue-400" />
                                    <span className="text-gray-300">首选 AI 服务商</span>
                                </div>
                            }
                            name="preferred_ai_provider"
                            rules={[{ required: true, message: '请选择 AI 服务商' }]}
                        >
                            <Select
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    color: '#fff',
                                }}
                                options={[
                                    { value: 'gemini', label: 'Gemini' },
                                    { value: 'openai', label: 'OpenAI' },
                                ]}
                            />
                        </Form.Item>

                        <Form.Item
                            label={
                                <div className="flex items-center gap-2">
                                    <KeyOutlined className="w-4 h-4 text-green-400" />
                                    <span className="text-gray-300">Gemini API Key</span>
                                </div>
                            }
                            name="gemini_token"
                        >
                            <Input.Password
                                placeholder="输入您的 Gemini API Key"
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    color: '#fff',
                                }}
                            />
                        </Form.Item>

                        <Form.Item
                            label={
                                <div className="flex items-center gap-2">
                                    <KeyOutlined className="w-4 h-4 text-orange-400" />
                                    <span className="text-gray-300">OpenAI API Key</span>
                                </div>
                            }
                            name="openai_token"
                        >
                            <Input.Password
                                placeholder="输入您的 OpenAI API Key"
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    color: '#fff',
                                }}
                            />
                        </Form.Item>

                        {(currentGeminiToken || currentOpenaiToken) && (
                            <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-3">
                                <p className="text-sm text-green-300">
                                    ✓ 当前已配置：
                                    {currentGeminiToken && ` Gemini: ${currentGeminiToken.substring(0, 8)}...`}
                                    {currentOpenaiToken && ` OpenAI: ${currentOpenaiToken.substring(0, 8)}...`}
                                </p>
                                {currentProvider && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        首选服务商：{currentProvider === 'gemini' ? 'Gemini' : 'OpenAI'}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-6">
                            {(currentGeminiToken || currentOpenaiToken) && (
                                <Button
                                    danger
                                    onClick={handleDeleteAiToken}
                                    loading={loading}
                                    style={{
                                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                        borderColor: 'rgba(239, 68, 68, 0.3)',
                                        color: '#ef4444',
                                    }}
                                >
                                    删除 Token
                                </Button>
                            )}
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                icon={<SaveOutlined />}
                                style={{
                                    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                                    borderColor: 'transparent',
                                    boxShadow: '0 4px 20px rgba(14, 165, 233, 0.3)',
                                }}
                            >
                                保存 Token
                            </Button>
                        </div>
                    </div>
                </Form>
            </Card>
        </div>
    )
}

export default SettingsPage
