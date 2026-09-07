function attr(node, name) {
  return node?.getAttribute?.(name) || "";
}

function walk(node, inn) {
  const hits = [];
  if (!node) return hits;
  const innValue = attr(node, "ИННЮЛ") || attr(node, "ИННФЛ") || attr(node, "ИНН");
  if (innValue === inn) hits.push(node);
  for (const child of node.children || []) hits.push(...walk(child, inn));
  return hits;
}

function numberFrom(node) {
  const keys = ["СумНедоим", "СумПени", "СумШтраф", "СумУпл", "СведССчР", "СрСпЧисл"];
  for (const key of keys) {
    const raw = attr(node, key);
    if (raw) return Number(String(raw).replace(",", "."));
  }
  return null;
}

export function parseFnsOpenDataXml(xmlText, inn) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.getElementsByTagName("parsererror")[0]) {
    throw new Error("Не удалось разобрать XML open data ФНС");
  }
  const nodes = walk(doc.documentElement, inn);
  if (!nodes.length) {
    return { found: false, inn, fields: {} };
  }
  const fields = {};
  for (const node of nodes) {
    const headcount = attr(node, "СрСпЧисл") || attr(node, "КолРаб");
    const debt = attr(node, "СумНедоим") || attr(node, "СумНед");
    const paid = attr(node, "СумУпл");
    if (headcount) fields.headcount = Number(headcount);
    if (debt) fields.taxDebt = Number(String(debt).replace(",", "."));
    if (paid) fields.taxPaid = Number(String(paid).replace(",", "."));
    const n = numberFrom(node);
    if (n !== null && fields.taxDebt == null && /недоим|пени|штраф/i.test(node.outerHTML)) {
      fields.taxDebt = n;
    }
  }
  return { found: true, inn, fields };
}
