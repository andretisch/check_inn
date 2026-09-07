import "./style.css";
import { normalizeInn, validateInn } from "./inn.js";
import { parseEgrulXml } from "./parseEgrulXml.js";
import { evaluateTechFlags } from "./techFlags.js";
import { SOURCES, isExtensionRuntime } from "./sources.js";
import { searchBankruptcy } from "./api/fedresurs.js";
import { parseFnsOpenDataXml } from "./api/fnsOpenData.js";

const SETTINGS_KEY = "srez-api-settings";

const app = document.querySelector("#app");
const state = {
  inn: "",
  error: "",
  notice: "",
  card: null,
  extras: {},
  tech: null,
  bankruptcy: null,
  settings: loadSettings(),
};

function loadSettings() {
  try {
    return {
      fedresursLogin: "",
      fedresursPassword: "",
      fedresursDemo: true,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"),
    };
  } catch {
    return { fedresursLogin: "", fedresursPassword: "", fedresursDemo: true };
  }
}

function saveSettings(next) {
  state.settings = { ...state.settings, ...next };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function modeLabel() {
  return isExtensionRuntime()
    ? "расширение · официальные API с этого компьютера"
    : "статическая страница · файлы ФНС локально, REST упирается в CORS";
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
            <div>Официальные машиночитаемые каналы: XML ЕГРЮЛ, open data ФНС, REST ЕФРСБ.</div>
          </div>
          <div class="stamp yellow">нет данных</div>
        </div>
        <p class="empty">
          Сайты вроде egrul.nalog.ru и kad.arbitr.ru — не API. Капча там ни при чём для этого контура.
          Карточка собирается из официального XML ФНС; налоги — из open data; банкротство — из REST Федресурса
          по вашему логину. Публичного API КАД нет.
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
    : `<div class="flag green"><strong>Маркеры оболочки не сработали</strong><p>Это не вердикт ФНС, а отсутствие формальных признаков в загруженных официальных данных.</p></div>`;

  const bank = state.bankruptcy
    ? `<pre>${escapeHtml(JSON.stringify(state.bankruptcy, null, 2).slice(0, 2500))}</pre>`
    : `<p class="empty">ЕФРСБ ещё не запрашивали. Нужны логин/пароль официального REST (демо-контур есть в спецификации оператора).</p>`;

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
        <b>Численность</b><span>${state.extras.headcount ?? "—"}</span>
        <b>Недоимка</b><span>${state.extras.taxDebt != null ? `${Number(state.extras.taxDebt).toLocaleString("ru-RU")} ₽` : "—"}</span>
        <b>Уплачено налогов</b><span>${state.extras.taxPaid != null ? `${Number(state.extras.taxPaid).toLocaleString("ru-RU")} ₽` : "—"}</span>
      </div>
      <h3>Признаки технической организации</h3>
      <div class="flags">${flags}</div>
      <h3>ЕФРСБ</h3>
      ${bank}
    </div>
  `;
}

function render() {
  const sources = SOURCES.map(
    (src) => `
      <div class="src">
        <div>
          <strong>${escapeHtml(src.title)}</strong>
          <div>${escapeHtml(src.channel)}</div>
          <div>${escapeHtml(src.role)}</div>
        </div>
        <div>${src.kind}</div>
      </div>`,
  ).join("");

  app.innerHTML = `
    <div class="shell">
      <div class="top">
        <div>
          <p class="mode">${modeLabel()}</p>
          <h1 class="brand">Срез<span>.</span></h1>
          <p class="lede">
            Клиент без бэкенда: браузер читает официальные XML ФНС и дергает REST ЕФРСБ с этой машины.
            Ключи не уходят на наш сервер — его нет.
          </p>
        </div>
      </div>
      <form class="search" id="search-form">
        <input id="inn" type="text" inputmode="numeric" placeholder="ИНН 10 или 12 цифр" value="${escapeHtml(state.inn)}" />
        <button class="primary" type="submit">Запросить ЕФРСБ</button>
        <label class="file">XML ЕГРЮЛ<input id="xml" type="file" accept=".xml,text/xml,application/xml" /></label>
      </form>
      ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ""}
      <div class="grid">
        ${renderReport()}
        <aside class="side">
          <section class="card">
            <h3>Официальные каналы</h3>
            <p>Не сайты с формами, а машиночитаемые выгрузки и REST.</p>
            <div class="sources">${sources}</div>
            <label class="file" style="margin-top:10px">Open data ФНС XML<input id="opendata" type="file" accept=".xml,text/xml,application/xml" /></label>
            <button class="ghost" type="button" id="demo" style="margin-top:8px;min-height:40px">Демо-выписка</button>
          </section>
          <section class="card">
            <h3>REST Федресурса</h3>
            <p>Логин хранится только в localStorage этого браузера.</p>
            <form id="api-form" class="api-form">
              <input id="fr-login" type="text" placeholder="login" value="${escapeHtml(state.settings.fedresursLogin)}" />
              <input id="fr-password" type="password" placeholder="password" value="${escapeHtml(state.settings.fedresursPassword)}" />
              <label class="check"><input id="fr-demo" type="checkbox" ${state.settings.fedresursDemo ? "checked" : ""} /> демо-контур</label>
              <button class="ghost" type="submit">Сохранить ключи</button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  `;

  document.getElementById("search-form").addEventListener("submit", onSearch);
  document.getElementById("xml").addEventListener("change", onXml);
  document.getElementById("opendata").addEventListener("change", onOpenData);
  document.getElementById("demo").addEventListener("click", onDemo);
  document.getElementById("api-form").addEventListener("submit", onSaveKeys);
}

function applyCard(card, extras = state.extras) {
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
  if (!state.settings.fedresursLogin || !state.settings.fedresursPassword) {
    state.notice = "ИНН валиден. Для банкротства сохраните логин REST ЕФРСБ. Карточку статуса даёт XML ЕГРЮЛ, налоги — open data ФНС.";
    render();
    return;
  }
  try {
    state.notice = "Запрос к официальному REST ЕФРСБ…";
    render();
    state.bankruptcy = await searchBankruptcy({
      inn,
      login: state.settings.fedresursLogin,
      password: state.settings.fedresursPassword,
      demo: state.settings.fedresursDemo,
    });
    state.notice = "ЕФРСБ ответил. Статус ЮЛ по-прежнему из XML интеграции ФНС — это отдельный официальный канал.";
    state.error = "";
  } catch (error) {
    state.error = error.message;
    state.notice = "";
  }
  render();
}

async function onXml(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const card = parseEgrulXml(await file.text());
    state.inn = card.inn || state.inn;
    applyCard(card);
  } catch (error) {
    state.error = error.message;
    render();
  }
}

async function onOpenData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const inn = normalizeInn(document.getElementById("inn").value || state.inn || state.card?.inn);
  if (!validateInn(inn).ok) {
    state.error = "Сначала укажите валидный ИНН, затем загрузите open data XML.";
    render();
    return;
  }
  try {
    const parsed = parseFnsOpenDataXml(await file.text(), inn);
    if (!parsed.found) {
      state.notice = "В этом файле open data ИНН не найден. Нужен набор ФНС (debtam, paytax, sshr), не выписка ЕГРЮЛ.";
    } else {
      state.extras = { ...state.extras, ...parsed.fields };
      state.notice = "Open data ФНС разобраны локально, без сайта «Прозрачный бизнес».";
      if (state.card) state.tech = evaluateTechFlags(state.card, state.extras);
    }
    state.inn = inn;
    state.error = "";
  } catch (error) {
    state.error = error.message;
  }
  render();
}

function onSaveKeys(event) {
  event.preventDefault();
  saveSettings({
    fedresursLogin: document.getElementById("fr-login").value.trim(),
    fedresursPassword: document.getElementById("fr-password").value,
    fedresursDemo: document.getElementById("fr-demo").checked,
  });
  state.notice = "Ключи ЕФРСБ записаны только в этот браузер.";
  render();
}

async function onDemo() {
  const res = await fetch("./sample-egrul.xml");
  const card = parseEgrulXml(await res.text());
  state.inn = card.inn;
  applyCard(card, { headcount: 1, taxPaid: 0, taxDebt: 240000, fixedAssets: 0 });
}

render();
