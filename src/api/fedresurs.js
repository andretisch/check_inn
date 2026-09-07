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

export async function searchBankruptcy({ inn, login, password, demo = true }) {
  const base = demo ? DEMO : PROD;
  const auth = await browserRequest(`${base}/v1/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ login, password }),
  });
  if (!auth.ok) {
    const hint = auth.status === 0
      ? "Браузер заблокировал REST Федресурса (CORS). Ключи остаются у вас, но запрос нужно слать из расширения."
      : `Федресурс auth HTTP ${auth.status}`;
    throw new Error(hint);
  }
  const payload = parseJson(auth.body, "Федресурс вернул не JSON на /v1/auth");
  const token = payload.token || payload.access_token || payload.accessToken;
  if (!token) {
    throw new Error("В ответе /v1/auth нет token. Проверьте логин и контур (demo/prod).");
  }
  const query = new URLSearchParams({
    limit: "20",
    offset: "0",
    debtorInn: inn,
  });
  const messages = await browserRequest(`${base}/v1/messages?${query}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!messages.ok) {
    throw new Error(`Федресурс messages HTTP ${messages.status}`);
  }
  return parseJson(messages.body, "Федресурс вернул не JSON на /v1/messages");
}
