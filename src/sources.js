export const SOURCES = [
  {
    id: "egrul",
    title: "ЕГРЮЛ / ЕГРИП",
    channel: "официальная интеграция ФНС, XML 4.07/4.08",
    role: "Статус, директор, адрес, недостоверность, УК",
    url: "https://www.nalog.gov.ru/rn77/service/egrip2/",
    kind: "files",
    cors: false,
  },
  {
    id: "opendata",
    title: "Open Data ФНС, ст. 102 НК",
    channel: "XML/CSV с nalog.gov.ru/opendata",
    role: "Недоимка, уплаченные налоги, правонарушения, численность, спецрежим",
    url: "https://www.nalog.gov.ru/opendata/",
    kind: "files",
    cors: false,
  },
  {
    id: "efrsb",
    title: "ЕФРСБ REST",
    channel: "bank-publications-*.fedresurs.ru, договор с оператором",
    role: "Банкротство и сообщения",
    url: "https://fedresurs.ru/help#bankrupt",
    kind: "rest",
    cors: false,
  },
  {
    id: "kad",
    title: "Арбитраж",
    channel: "публичного официального API нет",
    role: "Иски и банкротные дела",
    url: "https://kad.arbitr.ru/",
    kind: "none",
    cors: false,
  },
];

export function isExtensionRuntime() {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
}

export async function browserRequest(url, options = {}) {
  if (isExtensionRuntime()) {
    const response = await chrome.runtime.sendMessage({ type: "FETCH", url, options });
    if (!response) throw new Error("Расширение не ответило на FETCH");
    return response;
  }
  try {
    const res = await fetch(url, { ...options, mode: "cors", signal: options.signal || AbortSignal.timeout(15000) });
    return { ok: res.ok, status: res.status, body: await res.text() };
  } catch (error) {
    return { ok: false, status: 0, body: "", error: String(error.message || error) };
  }
}
