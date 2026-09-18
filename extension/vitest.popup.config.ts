import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Task 7: popup 组件测试专用配置（jsdom + RTL）；纯逻辑测试走默认 vitest.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/popup-app.test.tsx'],
    setupFiles: ['tests/setup.ts'],
  },
});
