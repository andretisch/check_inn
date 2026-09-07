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

console.log("ok");
