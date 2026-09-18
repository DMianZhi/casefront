import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { Menu } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import FormPage from './pages/FormPage';
import DataPage from './pages/DataPage';
import NavPage from './pages/NavPage';
import EntryPage from './pages/EntryPage';
import ModalPage from './pages/ModalPage';

const NAV_ITEMS = [
  { key: '/form', label: <Link to="/form">表单中心</Link> },
  { key: '/data', label: <Link to="/data">数据展示</Link> },
  { key: '/nav', label: <Link to="/nav">导航中心</Link> },
  { key: '/entry', label: <Link to="/entry">入口与链接</Link> },
  { key: '/modal', label: <Link to="/modal">弹层中心</Link> },
];

function Layout() {
  const location = useLocation();
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Menu mode="horizontal" selectedKeys={[location.pathname]} items={NAV_ITEMS} style={{ marginBottom: 16 }} />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px 48px' }}>
        <Outlet />
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <FormPage /> },
      { path: 'form', element: <FormPage /> },
      { path: 'data', element: <DataPage /> },
      { path: 'nav', element: <NavPage /> },
      { path: 'entry', element: <EntryPage /> },
      { path: 'modal', element: <ModalPage /> },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff' } }}>
    <RouterProvider router={router} />
  </ConfigProvider>,
);
