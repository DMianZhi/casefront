// M1 勾选直写：元素勾选合并（纯函数）+ IndexedDB 薄封装
// 契约：selections 是 Record<elementId, boolean>（或 Map）；写回 inventory.elements[].selected
// 原则：未出现在 selections 里的元素保持原值（默认 true）

function selectionHas(selections, id) {
  return selections instanceof Map ? selections.has(id) : Object.prototype.hasOwnProperty.call(selections, id);
}
function selectionGet(selections, id) {
  return selections instanceof Map ? selections.get(id) : selections[id];
}

export function applySelections(elements, selections) {
  if (selections == null || typeof selections !== 'object') throw new TypeError('selections 必须是对象或 Map');
  return elements.map(el => {
    if (!selectionHas(selections, el.id)) return el;
    return { ...el, selected: Boolean(selectionGet(selections, el.id)) };
  });
}

// 新清单 vs 上次已勾选清单：同 id 继承勾选；新元素默认 true（存疑不删）
export function reconcileElements(next, prev) {
  if (!Array.isArray(prev) || prev.length === 0) {
    return (next ?? []).map(el => ({ ...el, selected: true }));
  }
  const prevSel = new Map(prev.filter(e => e && e.id != null).map(e => [e.id, Boolean(e.selected)]));
  return (next ?? []).map(el => ({ ...el, selected: prevSel.has(el.id) ? prevSel.get(el.id) : true }));
}

// ---- IndexedDB 薄封装（MV3 SW 原生 indexedDB）----
const DB_NAME = 'casefront';
const STORE = 'scans';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'session_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveScan(inventory) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...inventory, saved_at: new Date().toISOString() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadScan(sessionId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(sessionId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}
