import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// vitest 未开启 globals，RTL 的自动 cleanup 钩子不生效，需手动挂
afterEach(() => cleanup());
