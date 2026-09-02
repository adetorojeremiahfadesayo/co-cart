import type { CurrencyTotal } from "../types";

export function normalizeCurrency(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z]{3}$/.test(value)) return null;
  const currency = value.toUpperCase();
  try {
    new Intl.NumberFormat("en", { style: "currency", currency }).format(0);
    return currency;
  } catch {
    return null;
  }
}

export function formatMoney(amount: number, currency = "USD") {
  const valid = normalizeCurrency(currency);
  if (!valid) return `${currency || "USD"} ${amount.toFixed(2)}`;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: valid }).format(amount);
}

export function formatCurrencyTotals(totals: CurrencyTotal[]) {
  if (!totals.length) return formatMoney(0, "USD");
  return totals.map((item) => formatMoney(item.total, item.currency)).join(" + ");
}
