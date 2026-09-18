import type { Inventory } from './inventory';

// 存储接口：M1 只实现 IndexedDB；M2 可替换（如 chrome.storage / 远端托管）
export interface ScanStorage {
  saveScan(inventory: Inventory): Promise<boolean>;
  loadScan(sessionId: string): Promise<Inventory | null>;
}

const DB_NAME = 'casefront';
const DB_VERSION = 2; // 目录句柄存储已废弃；库结构维持 v2 不再升级，旧库残留的空 store 无害
const STORE_SCANS = 'scans'; // keyPath: session_id

function openDb(): Promise<IDBDatabase> {
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

export function createIdbStorage(): ScanStorage {
  return {
    async saveScan(inventory) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SCANS, 'readwrite');
        tx.objectStore(STORE_SCANS).put({ ...inventory, saved_at: new Date().toISOString() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    },
    async loadScan(sessionId) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SCANS, 'readonly');
        const req = tx.objectStore(STORE_SCANS).get(sessionId);
        req.onsuccess = () => resolve((req.result as Inventory | undefined) ?? null);
        req.onerror = () => reject(req.error);
      });
    },
  };
}

// 默认实例：popup 与 SW 同源共享同一个库（与旧版行为一致）
export const storage: ScanStorage = createIdbStorage();
export const saveScan = storage.saveScan.bind(storage);
export const loadScan = storage.loadScan.bind(storage);
