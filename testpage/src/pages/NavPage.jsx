import { Card, Pagination, Breadcrumb, Steps, Space, Typography, Tag, Dropdown, Menu, Slider, Switch } from 'antd';

const { Title, Text } = Typography;

// 三个不同规模的 Pagination：验证 pagination 分类与「页/分页」低信心路径
export default function NavPage() {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Title level={3}>导航中心</Title>

      <Card title="面包屑与步骤条">
        <Breadcrumb items={[
          { title: '首页' }, { title: '测试资产' }, { title: '导航中心' },
        ]} />
        <Steps style={{ marginTop: 16 }} current={1}
          items={[{ title: '扫描', description: '采集交互元素' }, { title: '勾选', description: '确认用例范围' }, { title: '生成', description: 'Skill 产出用例' }]} />
      </Card>

      <Card title="分页（三处不同规模）">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text type="secondary">文章列表分页（10 页）</Text>
            <div><Pagination defaultCurrent={1} total={100} showSizeChanger /></div>
          </div>
          <div>
            <Text type="secondary">日志分页（5 页，快速跳转）</Text>
            <div><Pagination defaultCurrent={2} total={50} showQuickJumper /></div>
          </div>
          <div>
            <Text type="secondary">评论分页（简单模式）</Text>
            <div><Pagination simple defaultCurrent={1} total={30} /></div>
          </div>
        </Space>
      </Card>

      <Card title="下拉菜单与滑杆">
        <Space size="large" wrap>
          <Dropdown menu={{
            items: [
              { key: '1', label: '导出 Markdown' },
              { key: '2', label: '导出 JSON' },
              { type: 'divider' },
              { key: '3', label: '删除用例集', danger: true },
            ],
          }}>
            <a onClick={(e) => e.preventDefault()}>用例集操作 ▾</a>
          </Dropdown>
          <div style={{ width: 240 }}>
            <Text type="secondary">置信度阈值</Text>
            <Slider defaultValue={90} min={50} max={100} />
          </div>
          <div>
            <Text type="secondary">自动折叠</Text>
            <div><Switch defaultChecked /></div>
          </div>
        </Space>
      </Card>

      <Card title="标签集合">
        <Space wrap>
          <Tag>默认</Tag>
          <Tag color="blue">P0</Tag>
          <Tag color="green">已通过</Tag>
          <Tag color="red">阻塞</Tag>
          <Tag closable>可移除标签</Tag>
          <Tag.CheckableTag checked>可选中标签</Tag.CheckableTag>
        </Space>
      </Card>

      <Card title="边框区菜单（子导航）">
        <Menu
          style={{ width: 256, border: '1px solid #f0f0f0' }}
          defaultSelectedKeys={['1']}
          mode="inline"
          items={[
            { key: '1', label: '用例管理' },
            { key: '2', label: '规则卡库', children: [
              { key: '2-1', label: '内置标准卡' },
              { key: '2-2', label: '项目自定义卡' },
            ] },
            { key: '3', label: '规则缺口报告' },
            { key: '4', label: '导出适配器' },
          ]}
        />
      </Card>
    </Space>
  );
}
