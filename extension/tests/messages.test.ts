import { describe, expect, it } from 'vitest';
import type { PopupRequest } from '../lib/messages';

describe('消息协议', () => {
  it('discriminated union 收窄正确', () => {
    const req: PopupRequest = { type: 'SCAN', mode: 'compact' };
    if (req.type === 'SCAN') {
      expect(req.mode).toBe('compact');
    } else {
      throw new Error('SCAN 应收窄到 ScanRequest');
    }
  });
});
