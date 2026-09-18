// 复制文本到剪贴板：优先 Clipboard API，不可用时回落 execCommand（与旧版行为一致）
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.hidden = true;
    document.body.appendChild(ta);
    ta.select();
    try { return document.execCommand('copy'); } catch { return false; }
    finally { ta.remove(); }
  }
}
