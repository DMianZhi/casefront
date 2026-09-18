import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'CaseFront',
    description: 'Web 测试用例 AI 前置助手——采集页面交互清单',
    permissions: ['debugger', 'downloads', 'tabs'],
    action: { default_title: '扫描此页' },
  },
});
