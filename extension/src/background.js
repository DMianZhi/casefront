import { reduceAxtree } from './reducer.js';
import { denoise } from './denoiser.js';
import { classify, splitByConfidence } from './classifier.js';
import { buildInventory } from './exporter.js';
import { foldGroups } from './fold-groups.js';

const DEBUGGER_PROTO = '1.3';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'SCAN') {
    scanActiveTab(msg.mode === 'full' ? 'full' : 'compact')
      .then(sendResponse)
      .catch(e => sendResponse({ ok: false, error: String(e?.message ?? e) }));
  }
  return true; // 异步 sendResponse
});

async function scanActiveTab(mode = 'compact') {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('未找到活动标签页');
  const target = { tabId: tab.id };
  const send = (method, params) => chrome.debugger.sendCommand(target, method, params);

  // attach（失败最常见原因：DevTools 占用了 debugger）
  try { await chrome.debugger.attach(target, DEBUGGER_PROTO); }
  catch (e) { throw new Error('CDP attach 失败（若开着 DevTools，请关闭后重试）：' + e.message); }

  try {
    // 1) 拿完整语义树
    const ax = await send('Accessibility.getFullAXTree', {});
    // 2) 候选元素 + 逐个补 DOM 属性与几何
    const candidates = reduceAxtree(ax.nodes);
    await Promise.all([send('Runtime.enable', {}), send('DOM.enable', {})]);
    const enriched = [];
    enrichSeq = 0; // 每次扫描重置
    for (const c of candidates) {
      enriched.push(await enrich(c, send));
    }
    // 3) 去噪 → 同类折叠（精简模式；完整模式跳过）→ 分类 → 分流
    const { kept } = denoise(enriched);
    const folded = foldGroups(kept, { mode });
    const flat = folded.singles.concat(folded.groups.map(g => {
      const rep = { ...g.representative, __group: { kind: g.kind, signature: g.signature, member_count: g.memberCount } };
      return rep;
    }));
    const [sure, review, unclassified] = splitByConfidence(classify(flat));
    // 4) 组装契约
    const inventory = buildInventory({
      meta: {
        page_url: tab.url,
        page_title: tab.title ?? '',
        session_id: makeSessionId(tab),
        plugin_version: chrome.runtime.getManifest().version,
        scan_mode: mode,
      },
      sure, review, unclassified,
    });
    // 5) M0 出口：下载 inventory.json；目录直写在 Task 5/6 接入
    // MV3 SW 无 URL.createObjectURL（Blob URL 不可用），改用 data URL
    const body = JSON.stringify(inventory, null, 2);
    const url = `data:application/json;charset=utf-8,${encodeURIComponent(body)}`;
    const dlId = await chrome.downloads.download({
      url,
      filename: `casefront/${inventory.meta.session_id}/inventory.json`,
      saveAs: false,
    });
    return {
      ok: true,
      path: `casefront/${inventory.meta.session_id}/inventory.json`,
      count: inventory.elements.length,      // 清单条目数（含折叠后的组代表）
      folded_groups: folded.groups.length,   // 折叠组数（popup 展示）
      downloadId: dlId,
    };
  } finally {
    try { await chrome.debugger.detach(target); } catch { /* 已分离 */ } // 任何路径必须 detach
  }
}

let enrichSeq = 0;
async function enrich(candidate, send) {
  const out = { ...candidate, hints: { css_selector: null, aria_path: null, placeholder: null }, constraints: { required: null, maxlength: null, pattern: null, input_type: null }, visible: true };
  try {
    const resolved = await send('DOM.resolveNode', { backendNodeId: candidate.backendDOMNodeId });
    const obj = resolved?.object;
    if (obj?.objectId) {
      const evalr = await send('Runtime.callFunctionOn', {
        objectId: obj.objectId,
        returnByValue: true,
        functionDeclaration: `function () {
          const el = this;
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName, input_type: el.getAttribute('type'), required: el.required ?? null,
            maxlength: el.maxLength && el.maxLength > 0 ? el.maxLength : null, pattern: el.getAttribute('pattern'),
            placeholder: el.getAttribute('placeholder'), width: r.width, height: r.height,
            rect_visible: r.width > 0 && r.height > 0
          };
        }`,
      });
      const d = evalr?.result?.value ?? {};
      out.constraints = {
        input_type: d.input_type ?? null,
        required: d.required ?? null,
        maxlength: d.maxlength ?? null,
        pattern: d.pattern ?? null,
      };
      out.hints.placeholder = d.placeholder ?? null;
      out.hints.css_selector = d.tag ? String(d.tag).toLowerCase() : null;
      out.visible = d.rect_visible !== false;
    }
  } catch { /* 补属性失败不阻塞：诚实降级为无约束 */ }
  out.backendDOMNodeId = candidate.backendDOMNodeId ?? `alt-${++resolveSeq}`;
  return out;
}

function makeSessionId(tab) {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const title = (tab.title ?? 'page').slice(0, 20).replace(/[\\/:*?"<>| ]/g, '_');
  return `${day}_${title}`;
}
