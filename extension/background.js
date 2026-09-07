chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "FETCH") return false;
  const options = { ...(message.options || {}) };
  fetch(message.url, options)
    .then(async (res) => {
      sendResponse({
        ok: res.ok,
        status: res.status,
        body: await res.text(),
      });
    })
    .catch((error) => {
      sendResponse({ ok: false, error: error.message, status: 0, body: "" });
    });
  return true;
});
