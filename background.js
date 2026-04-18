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
  if (msg.action === 'saveFile' && sender.tab?.id) {
    const dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(msg.markdown);
    chrome.downloads.download({ url: dataUrl, filename: msg.filename, saveAs: true }, (id) => {
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
