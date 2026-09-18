import {
  Card, Col, Form, Input, InputNumber, Select, Radio, Checkbox, DatePicker,
  TimePicker, Upload, Button, AutoComplete, Cascader, TreeSelect, Row, Space, Typography,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';

const { TextArea, Search } = Input;
const { Title } = Typography;

// 边界元素：隐藏与零尺寸（插件去噪的靶子，不应出现在清单里）
const hiddenStyle = { display: 'none' };
const ghostStyle = { visibility: 'hidden', height: 0, overflow: 'hidden' };

export default function FormPage() {
  const [form] = Form.useForm();
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Title level={3}>表单中心</Title>

      <Card title="注册信息（核心表单）">
        <Form form={form} layout="vertical" onFinish={(v) => console.log(v)}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input placeholder="4-20 个字符" maxLength={20} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="昵称" name="nickname">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="年龄" name="age">
                <InputNumber min={0} max={150} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="个性签名" name="bio">
            <TextArea rows={3} placeholder="介绍一下自己" maxLength={200} showCount />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="所在城市" name="city">
                <Select placeholder="请选择" options={[
                  { value: 'beijing', label: '北京' },
                  { value: 'shanghai', label: '上海' },
                  { value: 'shenzhen', label: '深圳' },
                  { value: 'hangzhou', label: '杭州' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="籍贯（级联）" name="origin">
                <Cascader placeholder="请选择省市" options={[
                  { value: 'zj', label: '浙江省', children: [
                    { value: 'hangzhou', label: '杭州市' },
                    { value: 'ningbo', label: '宁波市' },
                  ] },
                  { value: 'gd', label: '广东省', children: [
                    { value: 'gz', label: '广州市' },
                    { value: 'sz', label: '深圳市' },
                  ] },
                ]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="部门（树选择）" name="dept">
                <TreeSelect placeholder="请选择部门" treeData={[
                  { value: 'rd', title: '研发部', children: [
                    { value: 'fe', title: '前端组' },
                    { value: 'be', title: '后端组' },
                  ] },
                  { value: 'qa', title: '测试部' },
                ]} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="性别" name="gender">
                <Radio.Group>
                  <Radio value="m">男</Radio>
                  <Radio value="f">女</Radio>
                  <Radio value="s">保密</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="订阅方式" name="subscribe">
                <Checkbox.Group options={['邮件', '短信', '站内信']} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="入职日期" name="joinDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="项目周期" name="range">
                <DatePicker.RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="值班时间" name="duty">
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="agreement" valuePropName="checked" rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject(new Error('请先阅读并同意协议')) }]}>
            <Checkbox>我已阅读并同意《用户协议》与《隐私政策》</Checkbox>
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit">注册</Button>
            <Button htmlType="button" onClick={() => form.resetFields()}>重置</Button>
            <Button type="text" disabled>禁用按钮</Button>
          </Space>
        </Form>
      </Card>

      <Card title="搜索与联想">
        <Row gutter={16}>
          <Col span={8}>
            <Search placeholder="搜索文章" onSearch={(v) => console.log(v)} enterButton />
          </Col>
          <Col span={8}>
            <AutoComplete placeholder="输入框架名联想" options={[
              { value: 'React' }, { value: 'Vue' }, { value: 'Angular' }, { value: 'Svelte' },
            ]} style={{ width: '100%' }} />
          </Col>
          <Col span={8}>
            <Input placeholder="禁用输入框" disabled />
          </Col>
        </Row>
      </Card>

      <Card title="附件上传">
        <Upload.Dragger name="file" multiple beforeUpload={() => false}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持单个或批量，严禁上传公司内部数据</p>
        </Upload.Dragger>
      </Card>

      {/* 边界：隐藏元素——插件应全部去噪，不出现在清单 */}
      <div style={hiddenStyle}>
        <Button type="primary">display-none 按钮</Button>
        <Input placeholder="display-none 输入框" />
        <a href="#hidden">display-none 链接</a>
      </div>
      <div style={ghostStyle} aria-hidden="true">
        <Button>visibility-hidden 按钮</Button>
      </div>
      {/* 边界：零尺寸（bounds 为 0 时应去噪） */}
      <Button style={{ width: 0, height: 0, padding: 0, overflow: 'hidden' }}>零尺寸按钮</Button>
    </Space>
  );
}
