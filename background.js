async function setBadge(tabId, text, color) {
  await chrome.action.setBadgeText({ text, tabId });
  if (color) await chrome.action.setBadgeBackgroundColor({ color, tabId });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

  await setBadge(tab.id, '…', '#7c6af7');

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractAndCopy' });
    if (response?.error) throw new Error(response.error);

    await setBadge(tab.id, '✓', '#34d399');
    setTimeout(() => setBadge(tab.id, '', null), 2500);
  } catch (err) {
    await setBadge(tab.id, '!', '#f87171');
    setTimeout(() => setBadge(tab.id, '', null), 3000);
    chrome.tabs.sendMessage(tab.id, { action: 'showToast', type: 'error', text: `Failed: ${err.message}` });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only accept messages from content scripts in real tabs
  if (!sender.tab?.id || sender.frameId !== 0) return false;

  if (msg.action === 'saveFile') {
    const MAX = 5 * 1024 * 1024;
    if (!msg.markdown || msg.markdown.length > MAX) {
      sendResponse({ error: 'Invalid or oversized content' });
      return;
    }
    const filename = String(msg.filename || 'page.md')
      .replace(/[^a-z0-9\-_.]/gi, '').slice(0, 64) || 'page.md';

    const dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(msg.markdown);
    chrome.downloads.download({ url: dataUrl, filename, saveAs: true }, (id) => {
      const ok = id !== undefined && !chrome.runtime.lastError;
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'showToast',
        type: ok ? 'success' : 'error',
        text: ok ? 'Saved!' : 'Save failed.',
      });
    });
    sendResponse({ ok: true });
  }
  return true;
});
