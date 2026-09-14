import { applySelections, saveScan } from './selection.js';

const statusEl = document.getElementById('status');
const statusIco = document.getElementById('status-ico');
const statusText = document.getElementById('status-text');
const statusSub = document.getElementById('status-sub');
const pathRow = document.getElementById('path-row');
const pathText = document.getElementById('path-text');
const copyBtn = document.getElementById('copy-path');
const copyLabel = document.getElementById('copy-label');
const modeEl = document.getElementById('mode');
const viewScan = document.getElementById('view-scan');
const viewReview = document.getElementById('view-review');
const listEl = document.getElementById('list');
const selCount = document.getElementById('sel-count');

let currentSession = null; // { session_id, elements }
const pending = new Map(); // id -> boolean
let exportPath = null;

function showView(which) {
  viewScan.classList.toggle('active', which === 'scan');
  viewReview.classList.toggle('active', which === 'review');
}

// ---- 状态区：内联 SVG 图标 + 主文案 + 副文案 ----
const ICONS = {
  idle: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 11.2a2.6 2.6 0 0 1 0 5.2zM12 7.5v.2"/></svg>',
  load: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2.2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M12 7.5v4.5l3 2.5"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="m8.4 12.4 2.4 2.4 4.8-5.2"/></svg>',
  err: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 8v5M12 15.8v.2"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.2 2.8 20h18.4L12 4.2z"/><path d="M12 10.2v4M12 17v.2"/></svg>',
};

function setStatus(kind, text, sub = '') {
  statusIco.innerHTML = ICONS[kind] ?? '';
  if (kind === 'load') {
    const svg = statusIco.querySelector('svg');
    if (svg) svg.classList.add('spinning');
  }
  statusText.textContent = text; // .status-sub 为块级独立元素，不受 textContent 影响
  statusSub.textContent = sub;
}

function initialStatus() {
  setStatus('idle', '就绪', '扫描当前页面，生成可勾选的交互元素清单');
}

// ---- 勾选视图渲染：复选框 + 名称/占位符 + 类型徽章 + 折叠组徽章 ----
function refreshCount() {
  const total = currentSession.elements.length;
  let selected = 0;
  for (const el of currentSession.elements) {
    if (pending.get(el.id) ?? el.selected !== false) selected++;
  }
  selCount.innerHTML = `已选 <b>${String(selected)}</b> / ${String(total)}`;
}

function renderList() {
  listEl.textContent = '';
  for (const el of currentSession.elements) {
    const li = document.createElement('li');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = pending.get(el.id) ?? el.selected !== false;
    cb.dataset.id = el.id;
    cb.addEventListener('change', () => {
      pending.set(el.id, cb.checked);
      refreshCount();
    });

    const main = document.createElement('div');
    main.className = 'el-main';
    const name = document.createElement('div');
    name.className = 'el-name';
    name.textContent = el.label || el.hints?.placeholder || '(未命名)';
    const meta = document.createElement('div');
    meta.className = 'el-meta';
    if (el.interaction_type) {
      const t = document.createElement('span');
      t.className = 'tag';
      t.textContent = el.interaction_type;
      meta.appendChild(t);
    }
    if (el.group) {
      const g = document.createElement('span');
      g.className = 'tag g';
      g.title = `同类折叠组：${el.group.signature}`;
      const n = Number(el.group.member_count) || 0;
      // × 用内联 SVG 十字绘制（U+00D7 在小号等宽字体下字形矮扁）
      g.innerHTML = '<svg viewBox="0 0 10 10" aria-hidden="true">'
        + '<path d="M2.2 2.2l5.6 5.6M7.8 2.2l-5.6 5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
        + '</svg><b>' + n + '</b>';
      meta.appendChild(g);
    }
    main.appendChild(name);
    main.appendChild(meta);

    li.appendChild(cb);
    li.appendChild(main);
    listEl.appendChild(li);
  }
  refreshCount();
}

document.getElementById('scan').onclick = async () => {
  const mode = modeEl?.value === 'full' ? 'full' : 'compact';
  setStatus('load', '采集中…', mode === 'compact' ? '精简模式：同类元素折叠为一组代表' : '完整模式：全量清单，不折叠');
  let res;
  try { res = await chrome.runtime.sendMessage({ type: 'SCAN', mode }); }
  catch (e) { setStatus('err', '扫描失败：' + e.message); return; }
  if (!res.ok) {
    setStatus('err', res.error, 'DevTools 开着会占用调试通道，关闭后重试');
    return;
  }
  setStatus('ok', `已采集 ${res.count} 个交互元素`, res.folded_groups > 0 ? `同类折叠：${res.folded_groups} 组，进入勾选确认` : '进入勾选确认');
  // 拉取快照进入勾选视图
  const snap = await chrome.runtime.sendMessage({ type: 'GET_LAST_SCAN' });
  if (snap?.ok && snap.inventory) {
    currentSession = snap.inventory;
    pending.clear();
    renderList();
    showView('review');
  }
};

document.getElementById('back').onclick = () => {
  initialStatus();
  showView('scan');
};

document.getElementById('all').onclick = () => {
  for (const el of currentSession.elements) pending.set(el.id, true);
  renderList();
};
document.getElementById('none').onclick = () => {
  for (const el of currentSession.elements) pending.set(el.id, false);
  renderList();
};

// ---- 复制导出绝对路径（下载落盘真实路径 → 剪贴板，Comate 里 @ 直接粘）----
const COPY_ICON = copyBtn.innerHTML;
copyBtn.onclick = async () => {
  if (!exportPath) return;
  let ok = false;
  try {
    await navigator.clipboard.writeText(exportPath);
    ok = true;
  } catch {
    // 剪贴板 API 不可用时回落 execCommand
    const ta = document.createElement('textarea');
    ta.value = exportPath;
    ta.hidden = true;
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch { /* 忽略 */ }
    ta.remove();
  }
  copyBtn.classList.toggle('ok', ok);
  copyLabel.textContent = ok ? '已复制' : '复制失败';
  if (!ok) copyBtn.style.color = 'var(--red)';
  setTimeout(() => {
    copyBtn.classList.remove('ok');
    copyBtn.style.color = '';
    copyLabel.textContent = '复制路径';
  }, 1500);
};

document.getElementById('save').onclick = async () => {
  const btn = document.getElementById('save');
  const saveNode = btn.lastChild; // 文本节点（svg 之后）
  btn.disabled = true;
  saveNode.textContent = ' 导出中…';
  pathRow.hidden = true;
  exportPath = null;
  try {
    const sessionId = currentSession.meta?.session_id ?? currentSession.session_id;
    const elements = applySelections(currentSession.elements, Object.fromEntries(pending));
    const inventory = { ...currentSession, elements, session_id: sessionId };
    inventory.meta = { ...currentSession.meta, session_id: sessionId, exported_at: new Date().toISOString() };
    try { await saveScan(inventory); } catch { /* 快照持久化失败不阻塞导出 */ }
    const res = await chrome.runtime.sendMessage({ type: 'DOWNLOAD_EXPORT', inventory });
    if (!res?.ok) { setStatus('err', '导出失败：' + (res?.error ?? '未知错误')); return; }
    if (res.absolute_path) {
      exportPath = res.absolute_path;
      pathText.textContent = res.absolute_path;
      pathRow.hidden = false;
      setStatus('ok', '已导出（selected 已写回清单）', '在 Comate 中 @ 该文件生成用例');
    } else {
      setStatus('warn', '已导出（未解析到落盘绝对路径）', res.path);
    }
    showView('scan');
  } finally {
    btn.disabled = false;
    saveNode.textContent = ' 保存并导出';
  }
};

// 初始化视图
initialStatus();
showView('scan');
