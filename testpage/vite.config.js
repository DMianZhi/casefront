import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 测试站与插件联调时固定端口，避免每次扫描换地址
  server: { port: 5175, strictPort: true },
});
