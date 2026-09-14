// M1：勾选合并（纯函数）+ IndexedDB 薄封装（扫描快照持久层）
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
const DB_VERSION = 2; // 目录句柄存储已废弃；库结构维持 v2 不再升级，旧库残留的空 store 无害
const STORE_SCANS = 'scans'; // keyPath: session_id

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SCANS)) {
        db.createObjectStore(STORE_SCANS, { keyPath: 'session_id' });
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

