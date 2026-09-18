import {
  Card, Tabs, Table, Collapse, Timeline, Descriptions, List, Space, Typography,
  Statistic, Row, Col, Tag, Calendar, Carousel,
} from 'antd';

const { Title } = Typography;

const tableData = [
  { key: '1', name: '接口回归', owner: '张三', status: '进行中', progress: 60 },
  { key: '2', name: '冒烟测试', owner: '李四', status: '已完成', progress: 100 },
  { key: '3', name: '性能压测', owner: '王五', status: '待启动', progress: 0 },
  { key: '4', name: '安全扫描', owner: '赵六', status: '进行中', progress: 45 },
];

const listData = [
  { title: '版本 2.4.0 发布说明', description: '新增批量导出、修复折叠签名溢出' },
  { title: '版本 2.3.1 发布说明', description: '修复 DevTools 冲突提示误报' },
  { title: '版本 2.3.0 发布说明', description: '同名会话勾选继承' },
];

export default function DataPage() {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Title level={3}>数据展示</Title>

      <Card title="标签页（Tabs，两组）">
        <Tabs
          items={[
            { key: 't1', label: '项目概览', children: <p>项目当前共 4 个任务，2 个进行中。</p> },
            { key: 't2', label: '任务列表', children: <p>共 4 条任务记录，可按状态筛选。</p> },
            { key: 't3', label: '操作日志', children: <p>最近操作：导出 inventory.json（今天 10:24）。</p> },
          ]}
        />
        <Tabs
          defaultActiveKey="a"
          items={[
            { key: 'a', label: '日视图', children: <p>今日新增用例 12 条。</p> },
            { key: 'b', label: '周视图', children: <p>本周新增用例 58 条。</p> },
          ]}
        />
      </Card>

      <Card title="任务表（带排序与筛选）">
        <Table
          dataSource={tableData}
          pagination={{ pageSize: 2, total: 4 }}
          columns={[
            { title: '任务名', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
            { title: '负责人', dataIndex: 'owner', key: 'owner' },
            { title: '状态', dataIndex: 'status', key: 'status',
              filters: [{ text: '进行中', value: '进行中' }, { text: '已完成', value: '已完成' }, { text: '待启动', value: '待启动' }],
              onFilter: (v, r) => r.status === v,
              render: (s) => <Tag color={s === '已完成' ? 'green' : s === '进行中' ? 'blue' : 'default'}>{s}</Tag> },
            { title: '进度', dataIndex: 'progress', key: 'progress', sorter: (a, b) => a.progress - b.progress },
          ]}
        />
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="折叠面板">
            <Collapse
              items={[
                { key: 'c1', label: '如何导出清单？', children: <p>扫描后勾选元素，点「保存并导出」。</p> },
                { key: 'c2', label: '折叠规则是什么？', children: <p>同父同角色且 ≥5 个兄弟、名称有公共前缀时折叠为一组。</p> },
                { key: 'c3', label: '低置信度元素去哪了？', children: <p>进入 unclassified，由 Skill 侧裁决。</p> },
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="统计与时间线">
            <Row gutter={16}>
              <Col span={8}><Statistic title="用例总数" value={186} /></Col>
              <Col span={8}><Statistic title="本周新增" value={58} /></Col>
              <Col span={8}><Statistic title="覆盖率" value={92} suffix="%" /></Col>
            </Row>
            <Timeline style={{ marginTop: 16 }}
              items={[
                { children: '创建用例集 2026-09' },
                { children: '扫描注册页，采集 61 个元素' },
                { children: '生成 18 条用例', color: 'green' },
              ]} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="版本列表">
            <List
              dataSource={listData}
              renderItem={(item) => <List.Item><List.Item.Meta title={item.title} description={item.description} /></List.Item>}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="任务详情（描述列表）">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="任务名">接口回归</Descriptions.Item>
              <Descriptions.Item label="负责人">张三</Descriptions.Item>
              <Descriptions.Item label="优先级">P0</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card title="日历与轮播">
        <Calendar fullscreen={false} />
        <Carousel style={{ marginTop: 16, background: '#e6f4ff', textAlign: 'center', height: 90, lineHeight: '90px' }} autoplay>
          <div><h3>用例模板库已上线</h3></div>
          <div><h3>规则卡突破 12 张</h3></div>
          <div><h3>覆盖率突破 90%</h3></div>
        </Carousel>
      </Card>
    </Space>
  );
}
