import { buildInventory } from '@/lib/exporter';
import { classify, splitByConfidence } from '@/lib/classifier';
import { denoise } from '@/lib/denoiser';
import { foldGroups } from '@/lib/fold-groups';
import { reduceAxtree } from '@/lib/reducer';
import { enrich, resetEnrichSeq } from '@/lib/enrich';
import { loadScan, saveScan } from '@/lib/storage';
import { reconcileElements } from '@/lib/selection';
import type { EnrichedCandidate, Inventory } from '@/lib/inventory';
import type { DebuggerSend, GetFullAXTreeResult } from '@/lib/cdp-types';
import type { DownloadExportResponse, GetLastScanResponse, PopupRequest, ScanResponse } from '@/lib/messages';

export default defineBackground(() => {
  const DEBUGGER_PROTO = '1.3';
  let lastInventory: Inventory | null = null; // M1：最近一次扫描快照（内存层；持久层在 IndexedDB）

  chrome.runtime.onMessage.addListener((msg: PopupRequest, _sender, sendResponse) => {
    if (msg?.type === 'SCAN') {
      scanActiveTab(msg.mode === 'full' ? 'full' : 'compact')
        .then(sendResponse)
        .catch(e => sendResponse({ ok: false, error: String((e as Error)?.message ?? e) }));
      return true; // 异步 sendResponse
    }
    if (msg?.type === 'GET_LAST_SCAN') {
      sendResponse({ ok: true, inventory: lastInventory } satisfies GetLastScanResponse);
      return false;
    }
    if (msg?.type === 'DOWNLOAD_EXPORT') {
      downloadExport(msg.inventory)
        .then(sendResponse)
        .catch(e => sendResponse({ ok: false, error: String((e as Error)?.message ?? e) }));
      return true;
    }
    return false;
  });

  async function scanActiveTab(mode: 'compact' | 'full'): Promise<ScanResponse> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('未找到活动标签页');
    const target = { tabId: tab.id };
    const send: DebuggerSend = (method, params) =>
      chrome.debugger.sendCommand(target, method, params as Record<string, unknown> | undefined) as unknown as Promise<never>;

    // attach（失败最常见原因：DevTools 占用了 debugger）
    try { await chrome.debugger.attach(target, DEBUGGER_PROTO); }
    catch (e) { throw new Error('CDP attach 失败（若开着 DevTools，请关闭后重试）：' + (e as Error).message); }

    try {
      // 1) 拿完整语义树
      const ax = (await send<GetFullAXTreeResult>('Accessibility.getFullAXTree', {})) as GetFullAXTreeResult;
      // 2) 候选元素 + 逐个补 DOM 属性与几何
      const candidates = reduceAxtree(ax.nodes);
      await Promise.all([send('Runtime.enable', {}), send('DOM.enable', {})]);
      resetEnrichSeq(); // 每次扫描重置
      const enriched: EnrichedCandidate[] = [];
      for (const c of candidates) {
        enriched.push(await enrich(c as EnrichedCandidate, send));
      }
      // 3) 去噪 → 同类折叠（精简模式；完整模式跳过）→ 分类 → 分流
      // 3) 去噪（denoise 自行计算 state，不读入参的 state；enrich 输出与旧版一致不含 state）
      const { kept } = denoise(enriched as EnrichedCandidate[]);
      const folded = foldGroups(kept, { mode });
      const flat = folded.singles.concat(folded.groups.map(g => {
        const rep = { ...g.representative, __group: { kind: g.kind, signature: g.signature, member_count: g.memberCount } };
        return rep;
      }));
      const [sure, review, unclassified] = splitByConfidence(classify(flat));
      // 4) 组装契约
      const inventory = buildInventory({
        meta: {
          page_url: tab.url as string, // 旧版原样传 tab.url（可能 undefined，导出时被 JSON 忽略）
          page_title: tab.title ?? '',
          session_id: makeSessionId(tab),
          plugin_version: chrome.runtime.getManifest().version,
          scan_mode: mode,
        },
        sure, review, unclassified,
      });
      // 4.5) M1：同名会话重扫时继承上次勾选（reconcile），快照落 IndexedDB
      let prev: Inventory | null = null;
      try { prev = await loadScan(inventory.meta.session_id); } catch { /* IDB 不可用不阻塞 */ }
      if (prev?.elements?.length) {
        inventory.elements = reconcileElements(inventory.elements, prev.elements);
      }
      try { await saveScan({ ...inventory, session_id: inventory.meta.session_id }); } catch { /* 持久化失败不阻塞导出 */ }
      lastInventory = inventory;
      // 5) M1 修复：扫描只采集+落快照，不落盘——导出只发生在 popup「保存并导出」
      //    （原 M0 遗留行为是扫描即导出，导致勾选 UI 被架空）
      return {
        ok: true,
        session_id: inventory.meta.session_id,
        count: inventory.elements.length,      // 清单条目数（含折叠后的组代表）
        folded_groups: folded.groups.length,   // 折叠组数（popup 展示）
      };
    } finally {
      try { await chrome.debugger.detach(target); } catch { /* 已分离 */ } // 任何路径必须 detach
    }
  }

  // 唯一导出路径：浏览器下载（SW 侧；data URL 因 MV3 SW 无 createObjectURL）
  // 下载完成后用 downloads.search 回查真实落盘绝对路径，回传 popup 供「复制路径」使用
  async function downloadExport(inventory: Inventory): Promise<DownloadExportResponse> {
    if (!inventory?.meta?.session_id) throw new Error('清单缺少 session_id，无法导出');
    const body = JSON.stringify(inventory, null, 2);
    const url = `data:application/json;charset=utf-8,${encodeURIComponent(body)}`;
    const downloadId = await chrome.downloads.download({
      url,
      filename: `casefront/${inventory.meta.session_id}/inventory.json`,
      saveAs: false,
    });
    const abs = await resolveDownloadPath(downloadId).catch(() => null);
    return {
      ok: true,
      via: 'download',
      path: abs ?? `浏览器下载目录/casefront/${inventory.meta.session_id}/inventory.json`,
      absolute_path: abs, // null 时 popup 展示相对描述，不启用复制按钮
      count: inventory.elements?.length ?? 0,
    };
  }

  async function resolveDownloadPath(downloadId: number, timeoutMs = 8000): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 250));
      const items = await chrome.downloads.search({ id: downloadId });
      if (!items?.length) return null;
      const it = items[0]!;
      if (it.state === 'complete' && it.filename) return it.filename;
      if (it.error && (it.error as string) !== 'IN_PROGRESS') throw new Error(`下载失败：${it.error}`);
    }
    return null; // 超时未完成：回传 null，UI 走相对路径文案
  }

  function makeSessionId(tab: { title?: string }): string {
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const title = (tab.title ?? 'page').slice(0, 20).replace(/[\\/:*?"<>| ]/g, '_');
    return `${day}_${title}`;
  }
});
