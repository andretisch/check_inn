import "./style.css";
import { normalizeInn, validateInn } from "./inn.js";
import { parseEgrulXml } from "./parseEgrulXml.js";
import { evaluateTechFlags } from "./techFlags.js";
import { SOURCES, isExtensionRuntime, sourceLinks, probeCors } from "./sources.js";

const app = document.querySelector("#app");
const state = {
  inn: "",
  error: "",
  card: null,
  extras: {},
  tech: null,
  corsNote: null,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function modeLabel() {
  return isExtensionRuntime()
    ? "режим расширения · запросы с этого компьютера"
    : "статическая страница · живые госсайты закрыты CORS";
}

function renderReport() {
  if (state.error) {
    return `<div class="error">${escapeHtml(state.error)}</div>`;
  }
  if (!state.card) {
    return `
      <div class="report">
        <div class="report-head">
          <div>
            <h2>Экспресс-срез</h2>
            <div>Загрузите XML-выписку ФНС или откройте официальные реестры в соседних вкладках.</div>
          </div>
          <div class="stamp yellow">нет данных</div>
        </div>
        <p class="empty">
          Браузерный сайт не может прочитать egrul.nalog.ru, pb.nalog.ru, КАД и Федресурс напрямую:
          у них нет CORS. Без вашего сервера остаются три пути — XML-выписка, расширение Chrome
          и ручной просмотр официальных страниц.
        </p>
      </div>
    `;
  }

  const card = state.card;
  const tech = state.tech;
  const stamp = tech?.verdict || "green";
  const flags = tech?.flags?.length
    ? tech.flags
        .map(
          (flag) => `
            <div class="flag ${flag.level}">
              <strong>${escapeHtml(flag.title)}</strong>
              <p>${escapeHtml(flag.detail)}</p>
            </div>`,
        )
        .join("")
    : `<div class="flag green"><strong>Маркеры оболочки не сработали</strong><p>Это не вердикт ФНС, а отсутствие формальных признаков в загруженных данных.</p></div>`;

  return `
    <div class="report">
      <div class="report-head">
        <div>
          <h2>${escapeHtml(card.shortName || card.fullName)}</h2>
          <div>${escapeHtml(card.fullName)}</div>
        </div>
        <div class="stamp ${stamp}">${escapeHtml(tech?.verdictLabel || "")}</div>
      </div>
      <div class="kv">
        <b>ИНН</b><span>${escapeHtml(card.inn)}</span>
        <b>ОГРН</b><span>${escapeHtml(card.ogrn || "—")}</span>
        <b>КПП</b><span>${escapeHtml(card.kpp || "—")}</span>
        <b>Статус</b><span>${escapeHtml(card.status?.name || "—")}</span>
        <b>Дата регистрации</b><span>${escapeHtml(card.regDate || "—")}</span>
        <b>Адрес</b><span>${escapeHtml(card.address || "—")}</span>
        <b>Руководитель</b><span>${escapeHtml([card.director?.title, card.director?.name].filter(Boolean).join(" · ") || "—")}</span>
        <b>УК</b><span>${card.capital ? `${card.capital.toLocaleString("ru-RU")} ₽` : "—"}</span>
        <b>ОКВЭД</b><span>${escapeHtml(card.okved || "—")}</span>
        <b>Выписка на</b><span>${escapeHtml(card.issuedAt || "—")}</span>
      </div>
      <h3>Признаки технической организации</h3>
      <div class="flags">${flags}</div>
      <h3>Налоги, суды, банкротство</h3>
      <p>
        Эти блоки живут в других реестрах. С этой страницы они не скачиваются сами:
        откройте источники справа. Расширение делает запрос с вашего IP, но капчу ФНС/КАД
        всё равно нужно пройти вручную.
      </p>
    </div>
  `;
}

function render() {
  const links = sourceLinks(state.inn || "7707083893")
    .map((link) => `<a href="${link.url}" target="_blank" rel="noreferrer">${escapeHtml(link.title)}</a>`)
    .join("");
  const sources = SOURCES.map(
    (src) => `
      <div class="src">
        <div>
          <strong>${escapeHtml(src.title)}</strong>
          <div>${escapeHtml(src.role)}</div>
        </div>
        <div>${src.cors ? "CORS есть" : "CORS нет"}</div>
      </div>`,
  ).join("");

  app.innerHTML = `
    <div class="shell">
      <div class="top">
        <div>
          <p class="mode">${modeLabel()}</p>
          <h1 class="brand">Срез<span>.</span></h1>
          <p class="lede">
            Локальная проверка контрагента без вашего бэкенда. Статус ЕГРЮЛ, налоговые дампы,
            банкротство и суды собираются на этой странице, а HTTP уходит с компьютера пользователя.
          </p>
        </div>
      </div>
      <form class="search" id="search-form">
        <input id="inn" type="text" inputmode="numeric" placeholder="ИНН 10 или 12 цифр" value="${escapeHtml(state.inn)}" />
        <button class="primary" type="submit">Проверить</button>
        <label class="file">Загрузить XML-выписку<input id="xml" type="file" accept=".xml,text/xml,application/xml" /></label>
      </form>
      ${state.corsNote ? `<div class="notice">${escapeHtml(state.corsNote)}</div>` : ""}
      <div class="grid">
        ${renderReport()}
        <aside class="side">
          <section class="card">
            <h3>Официальные вкладки</h3>
            <p>ИНН копируется, страницы открываются у первоисточника. Браузер не даст прочитать чужой HTML с этого сайта.</p>
            <div class="links">${links}</div>
            <div style="margin-top:10px;display:grid;gap:8px">
              <button class="ghost" type="button" id="copy-inn">Скопировать ИНН</button>
              <button class="ghost" type="button" id="open-all">Открыть ЕГРЮЛ, ФНС, Федресурс, КАД</button>
              <button class="ghost" type="button" id="demo">Показать демо-выписку</button>
            </div>
          </section>
          <section class="card">
            <h3>Почему без сервера</h3>
            <ul>
              <li>Обычный fetch() к ФНС/КАД режет CORS.</li>
              <li>Капча ЕГРЮЛ и КАД не обходится.</li>
              <li>Расширение ходит с вашего компьютера и не поднимает бэкенд.</li>
              <li>XML-выписка — единственный полностью автономный канал.</li>
            </ul>
          </section>
          <section class="card">
            <h3>Источники</h3>
            <div class="sources">${sources}</div>
          </section>
        </aside>
      </div>
    </div>
  `;

  document.getElementById("search-form").addEventListener("submit", onSearch);
  document.getElementById("xml").addEventListener("change", onXml);
  document.getElementById("copy-inn").addEventListener("click", onCopy);
  document.getElementById("open-all").addEventListener("click", onOpenAll);
  document.getElementById("demo").addEventListener("click", onDemo);
}

function applyCard(card, extras = {}) {
  state.card = card;
  state.extras = extras;
  state.tech = evaluateTechFlags(card, extras);
  state.error = "";
  render();
}

async function onSearch(event) {
  event.preventDefault();
  const inn = normalizeInn(document.getElementById("inn").value);
  state.inn = inn;
  const check = validateInn(inn);
  if (!check.ok) {
    state.error = check.error;
    state.card = null;
    render();
    return;
  }
  state.error = "";
  const probe = await probeCors("https://egrul.nalog.ru/");
  state.corsNote = probe.cors
    ? "Неожиданно: egrul.nalog.ru ответил на CORS. Живой запрос всё равно может упереться в капчу."
    : "Проверка CORS: egrul.nalog.ru из этой вкладки недоступен. Загрузите выписку или поставьте расширение.";
  if (isExtensionRuntime()) {
    await chrome.runtime.sendMessage({ type: "OPEN_SOURCES", inn });
    state.corsNote =
      "Расширение открыло официальные вкладки с вашего компьютера. Капчу нужно пройти вручную, затем сохранить XML-выписку сюда.";
  }
  render();
}

async function onXml(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const card = parseEgrulXml(text);
    state.inn = card.inn || state.inn;
    applyCard(card);
  } catch (error) {
    state.error = error.message;
    render();
  }
}

async function onCopy() {
  const inn = normalizeInn(document.getElementById("inn").value || state.inn);
  if (!inn) return;
  await navigator.clipboard.writeText(inn);
}

function onOpenAll() {
  const inn = normalizeInn(document.getElementById("inn").value || state.inn);
  state.inn = inn;
  for (const link of sourceLinks(inn)) {
    window.open(link.url, "_blank", "noopener,noreferrer");
  }
}

async function onDemo() {
  const res = await fetch("./sample-egrul.xml");
  const text = await res.text();
  const card = parseEgrulXml(text);
  state.inn = card.inn;
  applyCard(card, { headcount: 1, taxPaid: 0, taxDebt: 240000, fixedAssets: 0 });
}

render();
