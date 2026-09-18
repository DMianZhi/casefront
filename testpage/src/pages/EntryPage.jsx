import { Card, Button, Space, Typography, Switch, Slider, Rate } from 'antd';
import { DownloadOutlined, LinkOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

// 折叠组的靶子：同前缀链接与同尾 token 按钮需 ≥5 个兄弟才触发折叠
const PATH_ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const REPORT_TYPES = ['日报 0', '周报 0', '月报 0', '季报 0', '年报 0', '审计报告 0'];

export default function EntryPage() {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Title level={3}>入口与链接</Title>

      <Card title="按钮全家福">
        <Space wrap>
          <Button type="primary">主按钮</Button>
          <Button>默认按钮</Button>
          <Button type="dashed">虚线按钮</Button>
          <Button type="text">文字按钮</Button>
          <Button type="link">链接按钮</Button>
          <Button type="primary" danger>危险按钮</Button>
          <Button type="primary" icon={<DownloadOutlined />}>带图标按钮</Button>
          <Button loading>加载中按钮</Button>
        </Space>
      </Card>

      <Card title="链接集合">
        <Space direction="vertical">
          <Typography.Link href="#doc">查看使用文档</Typography.Link>
          <Typography.Link href="#skill" target="_blank">Skill 使用说明（新窗口）</Typography.Link>
          <a href="https://ant.design" target="_blank" rel="noreferrer"><LinkOutlined /> 外部链接：Ant Design 官网</a>
          <a href="#download">下载规则卡模板</a>
          <Text copyable={{ text: 'inventory.json 路径示例' }}>复制示例路径</Text>
        </Space>
      </Card>

      {/* 折叠组 1：8 个同前缀链接（同父同角色 ≥5，公共前缀「复制 路径」） */}
      <Card title="文件路径操作（同类折叠靶子 1）">
        <Space direction="vertical">
          {PATH_ROWS.map((r) => (
            <a key={r} href={`#copy-${r}`}>复制 路径 {r}</a>
          ))}
        </Space>
      </Card>

      {/* 折叠组 2：6 个同尾 token 按钮（前缀不成 → 尾 token「报告」等价类） */}
      <Card title="报告导出（同类折叠靶子 2）">
        <Space wrap>
          {REPORT_TYPES.map((t) => (
            <Button key={t}>{t}</Button>
          ))}
        </Space>
      </Card>

      <Card title="开关、滑杆与评分">
        <Space direction="vertical" size="large">
          <div>
            <Text type="secondary">夜间模式</Text>
            <div><Switch defaultChecked={false} /></div>
          </div>
          <div>
            <Text type="secondary">音量</Text>
            <div style={{ width: 280 }}><Slider defaultValue={30} /></div>
          </div>
          <div>
            <Text type="secondary">页面满意度</Text>
            <div><Rate defaultValue={4} /></div>
          </div>
        </Space>
      </Card>
    </Space>
  );
}
