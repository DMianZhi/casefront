import { useState } from 'react';
import {
  Card, Button, Modal, Drawer, Popconfirm, message, notification, Progress,
  Alert, Result, Skeleton, Space, Typography, Input,
} from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function ModalPage() {
  const [openModal, setOpenModal] = useState(false);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [confirmApi, confirmContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Title level={3}>弹层中心</Title>
      {confirmContextHolder}
      {messageContextHolder}
      {notificationContextHolder}

      <Alert type="info" showIcon message="弹层打开后再扫描" description="Modal / Drawer 打开时其内容才进入 a11y 树——点开弹层后重新扫描，验证 dialog 分类与弹层内元素采集。" />

      <Card title="对话框（Modal / Drawer / confirm / Popconfirm）">
        <Space wrap>
          <Button type="primary" onClick={() => setOpenModal(true)}>打开 Modal</Button>
          <Button onClick={() => setOpenDrawer(true)}>打开 Drawer</Button>
          <Button
            onClick={() => confirmApi.confirm({
              title: '确认删除用例集？',
              icon: <ExclamationCircleOutlined />,
              content: '删除后不可恢复，确定继续吗？',
              onOk: () => messageApi.success('已删除'),
            })}
          >
            confirm 确认框
          </Button>
          <Popconfirm title="确定放弃未保存的修改吗？" onConfirm={() => messageApi.info('已放弃')}>
            <Button danger>Popconfirm 放弃修改</Button>
          </Popconfirm>
        </Space>
      </Card>

      <Card title="消息与通知">
        <Space wrap>
          <Button onClick={() => messageApi.success('导出成功')}>message 成功</Button>
          <Button onClick={() => messageApi.error('导出失败：下载目录不可写')}>message 失败</Button>
          <Button onClick={() => notificationApi.open({
            message: '规则缺口提醒',
            description: '检测到 dialog / tabs 规则卡较薄，建议补充。',
          })}>
            notification 提醒
          </Button>
        </Space>
      </Card>

      <Card title="进度与反馈">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text type="secondary">扫描进度</Text>
            <Progress percent={72} status="active" />
          </div>
          <div>
            <Text type="secondary">上传进度（成功）</Text>
            <Progress percent={100} />
          </div>
          <Alert type="warning" showIcon message="DevTools 占用调试通道" description="关闭 DevTools 后重试。" />
          <Alert type="error" showIcon message="CDP attach 失败" />
          <Skeleton loading={false} avatar paragraph={{ rows: 2 }}>
            <Text>Skeleton 占位内容</Text>
          </Skeleton>
        </Space>
      </Card>

      <Card title="结果页">
        <Result
          status="success"
          title="用例生成完成"
          subTitle="共生成 18 条用例，覆盖率 92%"
          extra={<Button type="primary">查看报告</Button>}
        />
      </Card>

      <Modal
        title="新建用例集"
        open={openModal}
        onOk={() => { setOpenModal(false); messageApi.success('已创建'); }}
        onCancel={() => setOpenModal(false)}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder="用例集名称，如：注册页回归" />
          <Input.TextArea rows={3} placeholder="描述本次回归的范围与重点" />
          <Text type="secondary">弹层内元素（输入框/按钮）应在扫描中出现且分类为 dialog 上下文。</Text>
        </Space>
      </Modal>

      <Drawer title="扫描历史" open={openDrawer} onClose={() => setOpenDrawer(false)} width={360}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.Search placeholder="搜索历史会话" enterButton />
          <Text>2026-09-19_注册页 · 61 元素 · 已导出</Text>
          <Text>2026-09-18_订单列表 · 88 元素 · 未导出</Text>
          <Button type="primary" danger>清空历史</Button>
        </Space>
      </Drawer>
    </Space>
  );
}
