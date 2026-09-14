import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reduceAxtree } from '../src/reducer.js';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/axtree-register.json', import.meta.url), 'utf8'));

test('只保留可映射交互 role 的未忽略叶子节点', () => {
  const out = reduceAxtree(fixture.nodes);
  assert.deepEqual(out.map(c => c.role), ['textbox', 'textbox', 'combobox', 'checkbox', 'button', 'link']);
  assert.ok(out.every(c => typeof c.backendDOMNodeId === 'number'));
});

test('ignored=true 的 textbox(name 为空) 被丢弃', () => {
  const out = reduceAxtree(fixture.nodes);
  assert.ok(!out.some(c => c.name === ''));
});
