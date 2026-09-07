function attr(node, name) {
  return node?.getAttribute?.(name) || "";
}

function first(parent, tag) {
  return parent?.getElementsByTagName(tag)?.[0] || null;
}

function textJoin(node, fields) {
  return fields.map((name) => attr(node, name)).filter(Boolean).join(" ");
}

function parseAddress(svUl) {
  const addr = first(svUl, "АдресРФ") || first(svUl, "СвАдрЮЛФИАС") || first(svUl, "СвАдресЮЛ");
  if (!addr) return "";
  const parts = [
    attr(addr, "Индекс"),
    attr(first(addr, "Регион") || addr, "НаимРегион") || attr(addr, "НаимРегион"),
    attr(addr, "Город") || attr(first(addr, "Город") || {}, "НаимГород"),
    attr(addr, "Улица") || attr(first(addr, "Улица") || {}, "НаимУлица"),
    attr(addr, "Дом") ? `д. ${attr(addr, "Дом")}` : "",
  ].filter(Boolean);
  return parts.join(", ");
}

function parseDirector(svUl) {
  const person = first(svUl, "СведДолжнФЛ") || first(svUl, "СвФЛ");
  if (!person) return { name: "", inn: "", title: "" };
  const nameNode = first(person, "СвФЛ") || first(person, "ГрНФЛ") || person;
  const job = first(person, "СвДолжн") || person;
  return {
    name: textJoin(nameNode, ["Фамилия", "Имя", "Отчество"]),
    inn: attr(nameNode, "ИННФЛ") || attr(person, "ИННФЛ"),
    title: attr(job, "НаимДолжн") || attr(job, "НаимВидДолжн") || "руководитель",
  };
}

function parseFounders(svUl) {
  const founders = [];
  const wrap = first(svUl, "СвУчредит");
  const nodes = wrap ? [...wrap.getElementsByTagName("УчрФЛ"), ...wrap.getElementsByTagName("УчрЮЛРос")] : [];
  for (const node of nodes) {
    const fl = first(node, "СвФЛ") || node;
    founders.push({
      name:
        textJoin(fl, ["Фамилия", "Имя", "Отчество"]) ||
        attr(node, "НаимЮЛПолн") ||
        attr(first(node, "НаимИННЮЛ") || {}, "НаимЮЛПолн"),
      inn: attr(fl, "ИННФЛ") || attr(node, "ИНН") || attr(first(node, "НаимИННЮЛ") || {}, "ИНН"),
    });
  }
  return founders;
}

function hasUnreliable(svUl) {
  const tags = ["СвНедДанДолжн", "СвНедАдресЮЛ", "СвНедДанУчр", "ГРНДатаНедАдресЮЛ"];
  return tags.some((tag) => svUl.getElementsByTagName(tag).length > 0);
}

function parseStatus(svUl) {
  const status = first(svUl, "СвСтатус");
  const stop = first(svUl, "СвПрекрЮЛ");
  if (stop) {
    return {
      code: attr(stop, "КодСпПрекрЮЛ"),
      name: attr(stop, "НаимСпПрекрЮЛ") || "деятельность прекращена",
      date: attr(stop, "ДатаПрекрЮЛ"),
      active: false,
    };
  }
  if (status) {
    const name = attr(status, "НаимСтатусЮЛ") || "сведения о статусе есть в выписке";
    const inactive = /ликвидац|исключ|банкрот|прекращ/i.test(name);
    return {
      code: attr(status, "КодСтатусЮЛ"),
      name,
      date: attr(status, "ДатаПрекрЮЛ") || attr(svUl, "ДатаВып"),
      active: !inactive,
    };
  }
  return {
    code: "",
    name: "действующее (признак прекращения в выписке не найден)",
    date: attr(svUl, "ДатаВып"),
    active: true,
    inferred: true,
  };
}

export function parseEgrulXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const parseError = first(doc, "parsererror");
  if (parseError) {
    throw new Error("Не удалось разобрать XML. Нужна выписка ЕГРЮЛ/ЕГРИП в формате ФНС.");
  }
  const svUl = first(doc, "СвЮЛ") || first(doc, "СвИП");
  if (!svUl) {
    throw new Error("В файле нет блока СвЮЛ/СвИП — это не выписка ФНС.");
  }
  const isIp = svUl.tagName === "СвИП";
  const nameNode = first(svUl, "СвНаимЮЛ") || first(svUl, "СвФЛ") || svUl;
  const capital = first(svUl, "СвУстКап");
  const director = isIp
    ? {
        name: textJoin(first(svUl, "СвФЛ") || svUl, ["Фамилия", "Имя", "Отчество"]),
        inn: attr(svUl, "ИНН") || attr(first(svUl, "СвФЛ") || {}, "ИННФЛ"),
        title: "индивидуальный предприниматель",
      }
    : parseDirector(svUl);
  const okved = first(first(svUl, "СвОКВЭД"), "СвОКВЭДОсн") || first(svUl, "СвОКВЭДОсн");
  return {
    source: "egrul-xml",
    kind: isIp ? "ip" : "ul",
    inn: attr(svUl, "ИНН") || attr(svUl, "ИННФЛ"),
    ogrn: attr(svUl, "ОГРН") || attr(svUl, "ОГРНИП"),
    kpp: attr(svUl, "КПП"),
    issuedAt: attr(svUl, "ДатаВып"),
    fullName:
      attr(nameNode, "НаимЮЛПолн") ||
      textJoin(nameNode, ["Фамилия", "Имя", "Отчество"]) ||
      "наименование не указано",
    shortName: attr(nameNode, "НаимЮЛСокр"),
    address: parseAddress(svUl),
    regDate: attr(first(svUl, "СвОбрЮЛ") || svUl, "ДатаОГРН") || attr(svUl, "ДатаОГРНИП"),
    capital: Number(attr(capital, "СумКап") || 0),
    status: parseStatus(svUl),
    director,
    founders: parseFounders(svUl),
    okved: okved ? `${attr(okved, "КодОКВЭД")} ${attr(okved, "НаимОКВЭД")}`.trim() : "",
    unreliable: hasUnreliable(svUl),
    disqualifiedHit: Boolean(first(svUl, "СвДискв") || first(svUl, "СвДисквФЛ")),
  };
}
