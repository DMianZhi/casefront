// 自扫描脚本：headless Chrome 直连 CDP，复用 extension/lib 全管线，生成与插件等价的 inventory.json
// 用法：node scripts/scan-testpage.mjs <url> [outdir]
// 前置：测试站已在 localhost:5175（npm run dev）或 4175（npm run preview）运行
import { reduceAxtree } from '../lib/reducer.ts';
import { enrich, resetEnrichSeq } from '../lib/enrich.ts';
import { denoise } from '../lib/denoiser.ts';
import { foldGroups } from '../lib/fold-groups.ts';
import { classify, splitByConfidence } from '../lib/classifier.ts';
import { buildInventory } from '../lib/exporter.ts';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const url = process.argv[2] ?? 'http://localhost:5175/form';
const outDir = resolve(process.argv[3] ?? 'scan-output');

// ---- 启动 headless Chrome（或 Edge）----
import { spawn, execSync } from 'node:child_process';
const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const browserBin = CANDIDATES.find(p => { try { execSync(`test -f "${p}"`); return true; } catch { return false; } });
if (!browserBin) throw new Error('未找到 Chrome/Edge 可执行文件');
// 选一个空闲调试端口：残留的僵尸 Chrome 会占住旧端口，导致新实例绑定失败、
// 脚本却连到僵尸实例（target 永远对不上）
async function pickFreePort(start) {
  for (let port = start; port < start + 20; port++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(500) });
      if (res.ok) continue; // 有响应 → 被占用
    } catch { /* 连不上 → 空闲 */ }
    return port;
  }
  throw new Error('未找到空闲调试端口');
}
const DEBUG_PORT = await pickFreePort(9223);
// 每次运行独立 profile：复用已被占用的 profile 会让新进程附着到残留浏览器实例（扫到旧页面）
const profileDir = resolve(`.scan-profile-${process.pid}`);
const proc = spawn(browserBin, [
  '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profileDir}`, '--no-first-run', '--window-size=1280,900', url,
], { stdio: 'ignore' });
process.on('exit', () => { try { proc.kill(); } catch { /* 已退出 */ } });

// ---- 等待调试端口就绪 ----
async function waitForEndpoint() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      if (res.ok) return await res.json();
    } catch { /* 未就绪 */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('CDP 调试端口未就绪');
}
const targets = await waitForEndpoint();
// 校验 target 确实是目标 URL：附着到错误页面会让整份清单张冠李戴
// （页面 target 初始可能是 about:blank，需轮询 /json 直到导航完成）
let page = null;
for (let i = 0; i < 120; i++) { // Chrome 冷启动可能 >10s，重试窗口放宽到 30s
  try {
    const ts = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`).then(r => r.json());
    page = ts.find(t => t.type === 'page' && t.url.startsWith(url.split('?')[0])) ?? null;
    if (page) break;
  } catch { /* 端口未就绪 */ }
  await new Promise(r => setTimeout(r, 250));
}
if (!page) throw new Error(`未找到 ${url} 对应的页面 target`);

// ---- CDP 客户端（Node 22+ 原生 WebSocket）----
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject: rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      }
    };
    this.ready = new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

const cdp = new Cdp(page.webSocketDebuggerUrl);
await cdp.ready;
const send = (method, params) => cdp.send(method, params);

// ---- 复刻 background.scanActiveTab 管线（传输层不同，逻辑函数全部复用 lib）----
await Promise.all([send('Runtime.enable'), send('DOM.enable'), send('Accessibility.enable')]);

// 等待页面真正加载完成（headless 启动到渲染完成有窗口期，空树会让全管线空转）
let ready = '';
for (let i = 0; i < 40; i++) {
  try {
    const r = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    ready = r.result.value;
    if (ready === 'complete') break;
  } catch { /* 执行环境未就绪 */ }
  await new Promise(rs => setTimeout(rs, 250));
}
if (ready !== 'complete') throw new Error(`页面未加载完成（readyState=${ready}）`);
const ax = await send('Accessibility.getFullAXTree', {});
const candidates = reduceAxtree(ax.nodes);
resetEnrichSeq();
const enriched = [];
for (const c of candidates) enriched.push(await enrich(c, send));
const { kept } = denoise(enriched);
const folded = foldGroups(kept, { mode: 'compact' });
const flat = folded.singles.concat(folded.groups.map(g => ({
  ...g.representative, __group: { kind: g.kind, signature: g.signature, member_count: g.memberCount },
})));
const [sure, review, unclassified] = splitByConfidence(classify(flat));

// 页面标题取自 document.title（与插件 makeSessionId 同规则）
const titleRes = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
const title = titleRes.result.value ?? 'page';
const day = new Date().toISOString().slice(0, 10);
const sessionId = `${day}_${title.slice(0, 20).replace(/[\\/:*?"<>| ]/g, '_')}`;

const inventory = buildInventory({
  meta: { page_url: url, page_title: title, session_id: sessionId, plugin_version: '0.3.0-selfscan', scan_mode: 'compact' },
  sure, review, unclassified,
});

mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'inventory.json');
writeFileSync(outPath, JSON.stringify(inventory, null, 2), 'utf8');

console.log(`页面: ${title} (${url})`);
console.log(`候选 ${candidates.length} → 保留 ${kept.length} → 折叠组 ${folded.groups.length} → 清单 ${inventory.elements.length}`);
console.log(`unclassified ${inventory.unclassified.length}: ${inventory.unclassified.map(u => `${u.role}:"${u.name}"`).join(', ') || '无'}`);
const byType = {};
for (const e of inventory.elements) byType[e.interaction_type] = (byType[e.interaction_type] ?? 0) + 1;
console.log('分类分布:', JSON.stringify(byType));
console.log('review(低信心):', review.map(c => `${c.interaction_type}:"${c.name}"@${c.confidence}`).join(' | ') || '无');
console.log('已写入:', outPath);
