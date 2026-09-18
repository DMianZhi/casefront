import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 纯逻辑测试（node 环境）；组件测试走 vitest.popup.config.ts（jsdom）
    include: ['tests/**/*.test.ts'],
  },
});
