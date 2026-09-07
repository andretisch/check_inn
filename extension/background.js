const SOURCE_URLS = [
  "https://egrul.nalog.ru/",
  "https://pb.nalog.ru/",
  "https://bankrot.fedresurs.ru/",
  "https://kad.arbitr.ru/",
];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "FETCH") {
    fetch(message.url, message.options || {})
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
  }

  if (message?.type === "OPEN_SOURCES") {
    for (const url of SOURCE_URLS) {
      chrome.tabs.create({ url, active: false });
    }
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
