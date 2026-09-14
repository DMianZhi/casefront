import { applySelections, saveScan } from './selection.js';

const status = document.getElementById('status');
const modeEl = document.getElementById('mode');
const viewScan = document.getElementById('view-scan');
const viewReview = document.getElementById('view-review');
const listEl = document.getElementById('list');
const selCount = document.getElementById('sel-count');

let currentSession = null; // { session_id, elements }
const pending = new Map(); // id -> boolean

function showView(which) {
  viewScan.classList.toggle('active', which === 'scan');
  viewReview.classList.toggle('active', which === 'review');
}

function renderList() {
  listEl.textContent = '';
  let selected = 0;
  for (const el of currentSession.elements) {
    const li = document.createElement('li');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = pending.get(el.id) ?? el.selected !== false;
    if (cb.checked) selected++;
    cb.dataset.id = el.id;
    cb.addEventListener('change', () => {
      pending.set(el.id, cb.checked);
      updateCount();
    });
    const label = document.createElement('label');
    const typeTag = el.interaction_type ? `[${el.interaction_type}] ` : '';
    const grpInfo = el.group ? ` （${el.group.signature} ×${el.group.member_count}）` : '';
    label.textContent = typeTag + (el.label || el.hints?.placeholder || '(未命名)') + grpInfo;
    if (el.group) label.className = 'grp';
    li.appendChild(cb);
    li.appendChild(label);
    listEl.appendChild(li);
  }
  updateCount(selected);
}

function updateCount() {
  const total = currentSession.elements.length;
  let selected = 0;
  for (const el of currentSession.elements) {
    if (pending.get(el.id) ?? el.selected !== false) selected++;
  }
  selCount.textContent = `已选 ${selected} / ${total}`;
}

document.getElementById('scan').onclick = async () => {
  const mode = modeEl?.value === 'full' ? 'full' : 'compact';
  status.textContent = mode === 'compact' ? '采集中…（精简模式：同类元素折叠）' : '采集中…（完整模式：全量清单）';
  let res;
  try { res = await chrome.runtime.sendMessage({ type: 'SCAN', mode }); }
  catch (e) { status.textContent = '失败：' + e.message; return; }
  if (!res.ok) { status.textContent = `❌ ${res.error}`; return; }
  const foldInfo = res.folded_groups > 0 ? `\n同类折叠：${res.folded_groups} 组` : '';
  status.textContent = `✅ 采集 ${res.count} 个交互元素${foldInfo}\n请勾选要纳入用例生成的元素，再点「保存并导出」`;
  // 拉取快照进入勾选视图
  const snap = await chrome.runtime.sendMessage({ type: 'GET_LAST_SCAN' });
  if (snap?.ok && snap.inventory) {
    currentSession = snap.inventory;
    pending.clear();
    renderList();
    showView('review');
  }
};

document.getElementById('back').onclick = () => showView('scan');

document.getElementById('all').onclick = () => {
  for (const el of currentSession.elements) pending.set(el.id, true);
  renderList();
};
document.getElementById('none').onclick = () => {
  for (const el of currentSession.elements) pending.set(el.id, false);
  renderList();
};

// ---- 导出路径一键复制（下载落盘绝对路径 → 剪贴板，Comate 里 @ 直接粘）----
let exportPath = null;
const copyBar = document.getElementById('copy-bar');
const copyBtn = document.getElementById('copy-path');

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
  copyBtn.textContent = ok ? '✅ 已复制' : '❌ 复制失败';
  setTimeout(() => { copyBtn.textContent = '📋 复制路径'; }, 1500);
};

document.getElementById('save').onclick = async () => {
  const btn = document.getElementById('save');
  btn.disabled = true;
  btn.textContent = '导出中…';
  copyBar.hidden = true;
  exportPath = null;
  try {
    const sessionId = currentSession.meta?.session_id ?? currentSession.session_id;
    const elements = applySelections(currentSession.elements, Object.fromEntries(pending));
    const inventory = { ...currentSession, elements, session_id: sessionId };
    inventory.meta = { ...currentSession.meta, session_id: sessionId, exported_at: new Date().toISOString() };
    try { await saveScan(inventory); } catch { /* 快照持久化失败不阻塞导出 */ }
    const res = await chrome.runtime.sendMessage({ type: 'DOWNLOAD_EXPORT', inventory });
    if (!res?.ok) { status.textContent = `❌ 导出失败：${res?.error ?? '未知错误'}`; return; }
    if (res.absolute_path) {
      exportPath = res.absolute_path;
      copyBar.hidden = false;
      status.textContent = `✅ 已导出（selected 已写回清单）\n${res.absolute_path}\n在 Comate 中 @ 该文件生成用例`;
    } else {
      status.textContent = `⚠️ 已导出（未解析到落盘绝对路径）\n${res.path}\n在 Comate 中 @ 该文件生成用例`;
    }
    showView('scan');
  } finally {
    btn.disabled = false;
    btn.textContent = '保存并导出';
  }
};

// 初始化视图
showView('scan');
