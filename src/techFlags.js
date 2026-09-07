function yearsSince(dateStr) {
  if (!dateStr) return null;
  const stamp = Date.parse(dateStr.replace(/^(\d{2})\.(\d{2})\.(\d{4})$/, "$3-$2-$1"));
  if (Number.isNaN(stamp)) return null;
  return (Date.now() - stamp) / (365.25 * 24 * 3600 * 1000);
}

export function evaluateTechFlags(card, extras = {}) {
  const flags = [];
  const headcount = extras.headcount;
  const taxPaid = extras.taxPaid;
  const taxDebt = extras.taxDebt;
  const assets = extras.fixedAssets;
  const directorCompanies = extras.directorCompanies;
  const addressCompanies = extras.addressCompanies;

  if (headcount === 0 || headcount === 1) {
    flags.push({
      id: "staff_none",
      level: "yellow",
      title: "Нет персонала или единственный сотрудник — руководитель",
      detail: `Среднесписочная численность: ${headcount}. Типичный маркер технической компании по методике ФНС / экспресс-отчёта Фокуса.`,
    });
  }
  if (card.unreliable) {
    flags.push({
      id: "egrul_unreliable",
      level: "red",
      title: "Недостоверные сведения в ЕГРЮЛ",
      detail: "ФНС уже поставила отметку о недостоверности адреса, руководителя или участников.",
    });
  }
  if (card.disqualifiedHit) {
    flags.push({
      id: "director_disqualified",
      level: "red",
      title: "Признак дисквалификации в выписке",
      detail: "Руководитель или иное лицо связано с реестром дисквалифицированных.",
    });
  }
  if (card.capital > 0 && card.capital <= 10000 && card.kind === "ul") {
    flags.push({
      id: "min_capital",
      level: "yellow",
      title: "Минимальный уставный капитал",
      detail: `${card.capital.toLocaleString("ru-RU")} ₽. Сам по себе не доказывает «оболочку», но усиливает совокупность признаков.`,
    });
  }
  const age = yearsSince(card.regDate);
  if (age !== null && age < 0.5) {
    flags.push({
      id: "fresh_company",
      level: "yellow",
      title: "Компания зарегистрирована недавно",
      detail: `Возраст ≈ ${Math.max(age, 0).toFixed(1)} года. Слабый признак, учитывается только вместе с другими.`,
    });
  }
  if (typeof taxPaid === "number" && taxPaid === 0 && age !== null && age >= 1) {
    flags.push({
      id: "no_tax",
      level: "red",
      title: "Нулевые налоговые платежи при возрасте старше года",
      detail: "По открытым данным ФНС (paytax) нет уплаченных налогов.",
    });
  }
  if (typeof taxDebt === "number" && taxDebt > 0) {
    flags.push({
      id: "tax_debt",
      level: taxDebt >= 100000 ? "red" : "yellow",
      title: "Налоговая недоимка",
      detail: `${taxDebt.toLocaleString("ru-RU")} ₽ по срезу open data ФНС.`,
    });
  }
  if (assets === 0) {
    flags.push({
      id: "no_assets",
      level: "yellow",
      title: "Нулевые основные средства и НМА",
      detail: "Маркер из экспресс-отчёта Фокуса. Нужна бухотчётность (ГИР БО), в чистой выписке ЕГРЮЛ его нет.",
    });
  }
  if (typeof directorCompanies === "number" && directorCompanies >= 5) {
    flags.push({
      id: "mass_director",
      level: directorCompanies >= 10 ? "red" : "yellow",
      title: "Массовый руководитель",
      detail: `Одно лицо указано руководителем в ${directorCompanies} организациях. Считается по локальному срезу ЕГРЮЛ, не по устаревшим CSV ФНС 2021 года.`,
    });
  }
  if (typeof addressCompanies === "number" && addressCompanies >= 10) {
    flags.push({
      id: "mass_address",
      level: addressCompanies >= 50 ? "red" : "yellow",
      title: "Массовый адрес",
      detail: `По этому адресу зарегистрировано ${addressCompanies} ЮЛ.`,
    });
  }
  if (card.status && card.status.active === false) {
    flags.push({
      id: "inactive",
      level: "red",
      title: "Компания не действует",
      detail: card.status.name,
    });
  }

  const red = flags.filter((f) => f.level === "red").length;
  const yellow = flags.filter((f) => f.level === "yellow").length;
  let verdict = "green";
  let verdictLabel = "Признаки технической организации не собраны";
  if (red >= 1 && flags.length >= 2) {
    verdict = "red";
    verdictLabel = "Высокая вероятность оболочки по открытым данным";
  } else if (red >= 1 || yellow >= 2) {
    verdict = "yellow";
    verdictLabel = "Обнаружены признаки технической организации";
  } else if (yellow === 1) {
    verdict = "yellow";
    verdictLabel = "Есть единичный признак, совокупности нет";
  }

  return { flags, verdict, verdictLabel, red, yellow };
}
