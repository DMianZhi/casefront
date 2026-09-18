import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from '../entrypoints/popup/App';
import type { Inventory } from '../lib/inventory';

const session: Inventory = {
  schema_version: '0.1',
  session_id: '2026-09-19_demo',
  meta: { page_url: 'https://x', page_title: 'demo', session_id: '2026-09-19_demo', plugin_version: '0.3.0', scan_mode: 'compact' },
  elements: [
    { id: 'e001', interaction_type: 'text_input', label: '用户名', hints: { css_selector: null, aria_path: null, placeholder: null }, constraints: { required: null, maxlength: null, pattern: null, input_type: null, disabled: false }, visibility: 'visible', confidence: 0.95, selected: true, notes: '' },
    { id: 'e002', interaction_type: 'button', label: '提交', hints: { css_selector: null, aria_path: null, placeholder: null }, constraints: { required: null, maxlength: null, pattern: null, input_type: null, disabled: false }, visibility: 'visible', confidence: 0.95, selected: true, notes: '' },
  ],
  unclassified: [],
};

const sendMessage = vi.fn();

beforeEach(() => {
  vi.stubGlobal('chrome', { runtime: { sendMessage: sendMessage } });
  sendMessage.mockReset();
});

describe('popup App', () => {
  it('扫描成功后进入勾选视图，勾选计数正确', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, session_id: 's', count: 2, folded_groups: 0 })
      .mockResolvedValueOnce({ ok: true, inventory: session });
    render(<App />);
    fireEvent.click(screen.getByText('扫描此页'));
    expect(await screen.findByText('勾选纳入用例生成的元素')).toBeInTheDocument();
    expect(screen.getByText(/已选/)).toHaveTextContent('已选 2 / 2');
  });

  it('全不选后计数为 0，单项勾选恢复', async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, session_id: 's', count: 2, folded_groups: 0 })
      .mockResolvedValueOnce({ ok: true, inventory: session });
    render(<App />);
    fireEvent.click(screen.getByText('扫描此页'));
    await screen.findByText('勾选纳入用例生成的元素');
    fireEvent.click(screen.getByText('全不选'));
    expect(screen.getByText(/已选/)).toHaveTextContent('已选 0 / 2');
    fireEvent.click(screen.getByLabelText('用户名'));
    expect(screen.getByText(/已选/)).toHaveTextContent('已选 1 / 2');
  });

  it('复制路径：clipboard 失败回落 execCommand', async () => {
    // 直接测 lib/clipboard.ts（DRY 抽取后的单元）
    const { copyText } = await import('../lib/clipboard');
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } });
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec as unknown as typeof document.execCommand;
    await expect(copyText('C:/x/inventory.json')).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('扫描失败显示错误与 DevTools 提示', async () => {
    sendMessage.mockResolvedValueOnce({ ok: false, error: 'CDP attach 失败' });
    render(<App />);
    fireEvent.click(screen.getByText('扫描此页'));
    expect(await screen.findByText(/CDP attach 失败/)).toBeInTheDocument();
    expect(screen.getByText(/DevTools 开着会占用调试通道/)).toBeInTheDocument();
  });
});
