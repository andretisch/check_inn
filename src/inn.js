const INN10_W = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const INN12_W11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const INN12_W12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

function checksum(digits, weights) {
  const sum = weights.reduce((acc, weight, i) => acc + weight * digits[i], 0);
  return (sum % 11) % 10;
}

export function normalizeInn(value) {
  return String(value || "").replace(/\D/g, "");
}

export function validateInn(value) {
  const inn = normalizeInn(value);
  if (!inn) {
    return { ok: false, inn, kind: null, error: "Введите ИНН" };
  }
  if (inn.length !== 10 && inn.length !== 12) {
    return { ok: false, inn, kind: null, error: "ИНН юридического лица — 10 цифр, ИП — 12" };
  }
  const digits = inn.split("").map(Number);
  if (digits.some((n) => Number.isNaN(n))) {
    return { ok: false, inn, kind: null, error: "ИНН должен состоять из цифр" };
  }
  if (inn.length === 10) {
    const ok = checksum(digits, INN10_W) === digits[9];
    return ok
      ? { ok: true, inn, kind: "ul", error: null }
      : { ok: false, inn, kind: "ul", error: "Неверная контрольная сумма ИНН" };
  }
  const ok = checksum(digits, INN12_W11) === digits[10] && checksum(digits, INN12_W12) === digits[11];
  return ok
    ? { ok: true, inn, kind: "ip", error: null }
    : { ok: false, inn, kind: "ip", error: "Неверная контрольная сумма ИНН" };
}
