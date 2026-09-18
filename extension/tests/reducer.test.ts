import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { reduceAxtree, type AxNode } from '../lib/reducer';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/axtree-register.json', import.meta.url), 'utf8'));

it('只保留可映射交互 role 的未忽略叶子节点', () => {
    const out = reduceAxtree(fixture.nodes as AxNode[]);
    expect(out.map(c => c.role)).toEqual(['textbox', 'textbox', 'combobox', 'checkbox', 'button', 'link']);
    expect(out.every(c => typeof c.backendDOMNodeId === 'number')).toBeTruthy();
  });

  it('回归：包着 staticText 的按钮不再被叶子过滤丢掉（真实 CDP 数据）', () => {
    const nodes = [
      { nodeId: 1, backendDOMNodeId: 201, role: { type: 'role', value: 'button' }, name: { value: '搜索' }, ignored: false, properties: [], childIds: [2] },
      { nodeId: 2, backendDOMNodeId: 202, role: { type: 'role', value: 'staticText' }, name: { value: '搜索' }, ignored: false, properties: [], childIds: [] },
    ] as unknown as AxNode[];
    const out = reduceAxtree(nodes);
    expect(out.map(c => c.role)).toEqual(['button']);
  });

it('ignored=true 的 textbox(name 为空) 被丢弃', () => {
    const out = reduceAxtree(fixture.nodes as AxNode[]);
    expect(!out.some(c => c.name === '')).toBeTruthy();
});
