import { Card, Form, Input, InputNumber, Switch, Button } from 'antd'
import { SaveOutlined, DatabaseOutlined, SettingOutlined, RestOutlined, SlidersOutlined } from '@ant-design/icons'

function SettingsPage() {
    const [form] = Form.useForm()

    const onFinish = (values: any) => {
        console.log('Settings saved:', values)
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
        </div>
    )
}

export default SettingsPage
