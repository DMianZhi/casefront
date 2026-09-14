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

// ---- M1 Task 5：工作区目录授权与直写 ----
const dirBtn = document.getElementById('dir');
const dirStatus = document.getElementById('dir-status');

async function refreshDirStatus() {
  const st = await chrome.runtime.sendMessage({ type: 'GET_DIR_STATUS' });
  dirStatus.textContent = !st?.ok || !st.handle
    ? '未授权（导出走下载兜底）'
    : st.permission === 'granted' ? '✅ 已授权，导出直写 workspace/inventory/' : '⏸ 需重新授权';
}
dirBtn.onclick = async () => {
  try {
    const handle = await showDirectoryPicker({ mode: 'readwrite' }); // 必须用户手势
    await chrome.runtime.sendMessage({ type: 'SAVE_DIR_HANDLE', handle });
    dirStatus.textContent = '✅ 已授权，导出直写 workspace/inventory/';
  } catch (e) {
    if (e.name !== 'AbortError') dirStatus.textContent = '授权失败：' + e.message;
  }
};
refreshDirStatus();

document.getElementById('save').onclick = async () => {
  // 未被触碰的元素保持后端默认（继承 last_selections）
  const btn = document.getElementById('save');
  btn.disabled = true;
  btn.textContent = '导出中…';
  try {
    const res = await chrome.runtime.sendMessage({
      type: 'APPLY_AND_EXPORT',
      session_id: currentSession.session_id,
      selections: Object.fromEntries(pending),
    });
    if (!res.ok) { status.textContent = `❌ ${res.error}`; return; }
    const via = res.via === 'dir' ? '已直写工作区' : '已下载（未授权目录直写，走下载兜底）';
    status.textContent = `✅ ${via}（selected 已写回清单）\n${res.path}\n在 Comate 中 @ 该文件生成用例`;
    showView('scan');
  } finally {
    btn.disabled = false;
    btn.textContent = '保存并导出';
  }
};

// 初始化视图
showView('scan');
