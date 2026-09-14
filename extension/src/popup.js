const status = document.getElementById('status');
document.getElementById('scan').onclick = async () => {
  status.textContent = '采集中…（CDP 读取语义树）';
  let res;
  try { res = await chrome.runtime.sendMessage({ type: 'SCAN' }); }
  catch (e) { status.textContent = '失败：' + e.message; return; }
  status.textContent = res.ok
    ? `✅ 采集 ${res.count} 个交互元素\n已下载：${res.path}\n在 Comate 中 @ 该文件生成用例`
    : `❌ ${res.error}`;
};
