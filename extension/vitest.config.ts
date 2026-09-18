import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Task 1: 仅跑 WXT 工具链冒烟测试；旧 Deno 风格 *.test.js 由原有 Deno 流程负责，
    // 后续任务迁移后再扩展 include。
    include: ['tests/**/*.test.ts'],
  },
});
