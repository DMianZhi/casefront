const status = document.getElementById('status');
const modeEl = document.getElementById('mode');

document.getElementById('scan').onclick = async () => {
  const mode = modeEl?.value === 'full' ? 'full' : 'compact';
  status.textContent = mode === 'compact' ? '采集中…（精简模式：同类元素折叠）' : '采集中…（完整模式：全量清单）';
  let res;
  try { res = await chrome.runtime.sendMessage({ type: 'SCAN', mode }); }
  catch (e) { status.textContent = '失败：' + e.message; return; }
  if (!res.ok) { status.textContent = `❌ ${res.error}`; return; }
  const foldInfo = res.folded_groups > 0 ? `\n同类折叠：${res.folded_groups} 组` : '';
  status.textContent = `✅ 采集 ${res.count} 个交互元素${foldInfo}\n已下载：${res.path}\n在 Comate 中 @ 该文件生成用例`;
};
