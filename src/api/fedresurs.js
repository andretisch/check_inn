import { browserRequest } from "../sources.js";

const DEMO = "https://bank-publications-demo.fedresurs.ru";
const PROD = "https://bank-publications-prod.fedresurs.ru";

function parseJson(body, fallbackMessage) {
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(fallbackMessage);
  }
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function last31DayWindow() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return { begin: isoDate(start), end: isoDate(end) };
}

export async function searchBankruptcy({ inn, login, password, demo = true }) {
  const base = demo ? DEMO : PROD;
  const auth = await browserRequest(`${base}/v1/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ login, password }),
  });
  if (!auth.ok) {
    const hint =
      auth.status === 0
        ? "Браузер заблокировал REST Федресурса (CORS). Ключи остаются у вас, но запрос нужно слать из расширения."
        : `Федресурс auth HTTP ${auth.status}`;
    throw new Error(hint);
  }
  const payload = parseJson(auth.body, "Федресурс вернул не JSON на /v1/auth");
  const token = payload.jwt || payload.token || payload.access_token || payload.accessToken;
  if (!token) {
    throw new Error("В ответе /v1/auth нет jwt/token. Проверьте логин и контур (demo/prod).");
  }

  const { begin, end } = last31DayWindow();
  const query = new URLSearchParams({
    Inn: inn,
    DateLastModifBegin: begin,
    DateLastModifEnd: end,
    Limit: "20",
    Offset: "0",
  });
  const bankrupts = await browserRequest(`${base}/v1/bankrupts?${query}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!bankrupts.ok) {
    throw new Error(`Федресурс bankrupts HTTP ${bankrupts.status}`);
  }
  const data = parseJson(bankrupts.body, "Федресурс вернул не JSON на /v1/bankrupts");
  return {
    inn,
    period: { begin, end },
    bankrupts: data.pageData || [],
    total: data.total ?? 0,
    note:
      data.total === 0
        ? "За последние 31 день записей о банкротстве по этому ИНН нет. Реорганизация/ликвидация без процедуры банкротства сюда не попадает."
        : undefined,
  };
}
