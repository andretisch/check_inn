export const SOURCES = [
  {
    id: "egrul",
    title: "ЕГРЮЛ / ЕГРИП",
    owner: "ФНС",
    role: "Статус, директор, адрес, недостоверность, УК",
    url: "https://egrul.nalog.ru/",
    cors: false,
    captcha: true,
    live: "xml-or-extension",
  },
  {
    id: "pb",
    title: "Прозрачный бизнес",
    owner: "ФНС",
    role: "Налоги, численность, спецрежим, недоимка",
    url: "https://pb.nalog.ru/",
    cors: false,
    captcha: true,
    live: "extension-or-file",
  },
  {
    id: "opendata",
    title: "Open Data ФНС",
    owner: "ФНС",
    role: "Дампы недоимки, paytax, правонарушения, МСП",
    url: "https://www.nalog.gov.ru/opendata/",
    cors: false,
    captcha: false,
    live: "file",
  },
  {
    id: "efrsb",
    title: "ЕФРСБ / Федресурс",
    owner: "Интерфакс",
    role: "Банкротство и сообщения",
    url: "https://bankrot.fedresurs.ru/",
    cors: false,
    captcha: false,
    live: "extension",
  },
  {
    id: "kad",
    title: "Картотека арбитражных дел",
    owner: "КАД",
    role: "Иски, банкротные дела",
    url: "https://kad.arbitr.ru/",
    cors: false,
    captcha: true,
    live: "tab",
  },
  {
    id: "vestnik",
    title: "Вестник госрегистрации",
    owner: "ФНС",
    role: "Предстоящее исключение из ЕГРЮЛ",
    url: "https://www.vestnik-gosreg.ru/",
    cors: false,
    captcha: false,
    live: "tab",
  },
];

export function sourceLinks(inn) {
  const q = encodeURIComponent(inn);
  return [
    { id: "egrul", title: "Открыть ЕГРЮЛ", url: "https://egrul.nalog.ru/" },
    { id: "pb", title: "Открыть «Прозрачный бизнес»", url: "https://pb.nalog.ru/" },
    { id: "efrsb", title: "Открыть ЕФРСБ", url: `https://bankrot.fedresurs.ru/` },
    { id: "kad", title: "Открыть КАД", url: "https://kad.arbitr.ru/" },
    { id: "vestnik", title: "Открыть Вестник", url: "https://www.vestnik-gosreg.ru/" },
    { id: "opendata", title: "Каталог open data ФНС", url: "https://www.nalog.gov.ru/opendata/" },
  ].map((item) => ({ ...item, query: q }));
}

export function isExtensionRuntime() {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
}

export async function extensionFetch(url, options = {}) {
  if (!isExtensionRuntime()) {
    throw new Error("Запрос к госсайтам из обычной вкладки блокирует CORS. Нужно расширение.");
  }
  const response = await chrome.runtime.sendMessage({ type: "FETCH", url, options });
  if (!response?.ok) {
    throw new Error(response?.error || `HTTP ${response?.status || "?"}`);
  }
  return response;
}

export async function probeCors(url) {
  try {
    const res = await fetch(url, { method: "GET", mode: "cors", signal: AbortSignal.timeout(4000) });
    return { ok: res.ok, status: res.status, cors: true };
  } catch (error) {
    return { ok: false, status: 0, cors: false, error: String(error.message || error) };
  }
}
