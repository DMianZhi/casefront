import { describe, expect, it } from 'vitest';

describe('工具链冒烟', () => {
  it('TS + vitest 可用', () => {
    expect(1 + 1).toBe(2);
  });
});
