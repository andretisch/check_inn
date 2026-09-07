import { readFileSync } from "node:fs";
import { validateInn } from "../src/inn.js";
import { evaluateTechFlags } from "../src/techFlags.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(validateInn("7707083893").ok, "Сбер ИНН должен быть валиден");
assert(validateInn("7701234560").ok, "демо ИНН должен быть валиден");
assert(!validateInn("7701234567").ok, "сломанная контрольная сумма");
assert(validateInn("7707083893").kind === "ul", "10 цифр — ЮЛ");

const tech = evaluateTechFlags(
  {
    kind: "ul",
    capital: 10000,
    unreliable: true,
    disqualifiedHit: false,
    regDate: "2026-01-15",
    status: { active: true, name: "действует" },
  },
  { headcount: 1, taxPaid: 0, taxDebt: 240000, fixedAssets: 0 },
);

assert(tech.verdict === "red", `ожидали red, получили ${tech.verdict}`);
assert(tech.flags.some((f) => f.id === "staff_none"));
assert(tech.flags.some((f) => f.id === "egrul_unreliable"));

const rosbankXml = readFileSync(new URL("../public/sample-rosbank-egrul.xml", import.meta.url), "utf8");
assert(validateInn("7730060164").ok, "Росбанк ИНН валиден");
assert(rosbankXml.includes('ИНН="7730060164"'), "sample-rosbank-egrul.xml содержит ИНН");
assert(rosbankXml.includes("СвПрекрЮЛ"), "sample-rosbank-egrul.xml содержит прекращение");
const rosbankTech = evaluateTechFlags(
  {
    kind: "ul",
    capital: 15514018530,
    unreliable: false,
    disqualifiedHit: false,
    regDate: "1993-03-02",
    status: { active: false, name: "Прекратило деятельность путем реорганизации в форме присоединения" },
  },
  { headcount: 9969 },
);
assert(rosbankTech.flags.some((f) => f.id === "inactive"), "ожидали inactive для Росбанка");
assert(rosbankTech.verdict === "yellow", `Росбанк: ожидали yellow (1 красный маркер), получили ${rosbankTech.verdict}`);

console.log("ok");
