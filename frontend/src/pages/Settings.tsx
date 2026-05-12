import { Card, Form, Input, InputNumber, Switch, Button } from 'antd'

function SettingsPage() {
  const [form] = Form.useForm()

  const onFinish = (values: any) => {
    console.log('Settings saved:', values)
  }

  return (
    <div className="space-y-6">
      <Card title="系统设置">
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
              label="API地址"
              name="apiUrl"
              rules={[{ required: true, message: '请输入API地址' }]}
            >
              <Input placeholder="输入API地址" />
            </Form.Item>

            <Form.Item
              label="自动刷新间隔（秒）"
              name="refreshInterval"
              rules={[{ required: true, message: '请输入刷新间隔' }]}
            >
              <InputNumber min={10} max={300} />
            </Form.Item>

            <Form.Item
              label="自动刷新"
              name="autoRefresh"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              label="最大显示数量"
              name="maxResults"
              rules={[{ required: true, message: '请输入最大显示数量' }]}
            >
              <InputNumber min={10} max={500} />
            </Form.Item>
          </div>

          <div className="flex justify-end mt-6">
            <Button type="primary" htmlType="submit">
              保存设置
            </Button>
          </div>
        </Form>
      </Card>

      <Card title="算法参数">
        <Form layout="vertical">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Form.Item label="分型最小置信度">
              <InputNumber min={0} max={100} defaultValue={50} />
            </Form.Item>

            <Form.Item label="笔最小长度（元）">
              <InputNumber min={0} step={0.01} defaultValue={0.01} />
            </Form.Item>

            <Form.Item label="笔最小质量评分">
              <InputNumber min={0} max={100} defaultValue={50} />
            </Form.Item>

            <Form.Item label="中枢最小重叠比例">
              <InputNumber min={0} max={1} step={0.01} defaultValue={0.5} />
            </Form.Item>
          </div>

          <div className="flex justify-end mt-6">
            <Button type="primary">保存参数</Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default SettingsPage
