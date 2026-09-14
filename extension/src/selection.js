// M1 Task 4/5：勾选合并（纯函数）+ IndexedDB 薄封装（扫描快照 + 工作区目录句柄）+ 目录直写
// 契约：selections 是 Record<elementId, boolean>（或 Map）；写回 inventory.elements[].selected
// 原则：未出现在 selections 里的元素保持原值（默认 true）

function selectionHas(selections, id) {
  return selections instanceof Map
    ? selections.has(id)
    : Object.prototype.hasOwnProperty.call(selections, id);
}
function selectionGet(selections, id) {
  return selections instanceof Map ? selections.get(id) : selections[id];
}

export function applySelections(elements, selections) {
  if (selections == null || typeof selections !== 'object') {
    throw new TypeError('selections 必须是对象或 Map');
  }
  return elements.map(el =>
    selectionHas(selections, el.id) ? { ...el, selected: Boolean(selectionGet(selections, el.id)) } : el
  );
}

// 新清单 vs 上次已勾选清单：同 id 继承勾选；新元素默认 true（存疑不删）
export function reconcileElements(next, prev) {
  if (!Array.isArray(prev) || prev.length === 0) {
    return (next ?? []).map(el => ({ ...el, selected: true }));
  }
  const prevSel = new Map(
    prev.filter(e => e && e.id != null).map(e => [e.id, Boolean(e.selected)])
  );
  return (next ?? []).map(el => ({
    ...el,
    selected: prevSel.has(el.id) ? prevSel.get(el.id) : true,
  }));
}

// ---- IndexedDB 薄封装（popup 与 SW 同源共享同一个库）----
const DB_NAME = 'casefront';
const DB_VERSION = 2;
const STORE_SCANS = 'scans'; // keyPath: session_id
const STORE_HANDLES = 'handles'; // key：'export_dir'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SCANS)) {
        db.createObjectStore(STORE_SCANS, { keyPath: 'session_id' });
      }
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveScan(inventory) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCANS, 'readwrite');
    tx.objectStore(STORE_SCANS).put({ ...inventory, saved_at: new Date().toISOString() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadScan(sessionId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCANS, 'readonly');
    const req = tx.objectStore(STORE_SCANS).get(sessionId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

// ---- 工作区目录句柄（File System Access API）----
// 注意：showDirectoryPicker 只在 window 上下文（popup）可用，由 popup 调用后把句柄存进来；
// 句柄可结构化克隆，IndexedDB 里能安全持久化，SW 侧读取使用。

export async function saveDirHandle(handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HANDLES, 'readwrite');
    tx.objectStore(STORE_HANDLES).put(handle, 'export_dir');
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// 读取目录句柄；顺带返回授权状态（granted 静默可写；prompt 需用户手势再授权）
export async function getDirHandle() {
  const db = await openDb();
  const handle = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_HANDLES, 'readonly');
    const req = tx.objectStore(STORE_HANDLES).get('export_dir');
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  if (!handle) return { handle: null, permission: 'unavailable' };
  const permission = (await handle.queryPermission?.({ mode: 'readwrite' })) ?? 'prompt';
  return { handle, permission };
}

// 直写 inventory.json 到已授权目录 workspace/inventory/<session>/
// 【必须】在 popup（window 上下文）调用：createWritable 仅 window 可用，SW 无此 API
// 成功返回相对路径；未授权/权限过期/写入失败抛错（调用方决定兜底），不再静默吞错
export async function writeInventoryToDir(inventory) {
  const { handle: dir, permission } = await getDirHandle();
  if (!dir) throw new Error('尚未授权工作区目录（请点「授权目录」）');
  if (permission !== 'granted') throw new Error('授权已过期，请重新授权目录');
  const sessionDir = await dir
    .getDirectoryHandle('workspace', { create: true })
    .then(w => w.getDirectoryHandle('inventory', { create: true }))
    .then(i => i.getDirectoryHandle(inventory.meta.session_id, { create: true }));
  const file = await sessionDir.getFileHandle('inventory.json', { create: true });
  const w = await file.createWritable();
  await w.write(JSON.stringify(inventory, null, 2));
  await w.close();
  return `workspace/inventory/${inventory.meta.session_id}/inventory.json`;
}
