import { CURRENCIES, type CurrencyCode } from './currencies';
import type { Bps, Milli, Minor } from './money';

/** Group an unsigned digit string: Indian (12,34,567) or international (1,234,567). */
export function groupDigits(digits: string, grouping: 'indian' | 'international'): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const size = grouping === 'indian' ? 2 : 3;
  const groups: string[] = [];
  for (let end = rest.length; end > 0; end -= size) groups.unshift(rest.slice(Math.max(0, end - size), end));
  return `${groups.join(',')},${last3}`;
}

/** Minor units as a grouped decimal without a symbol: 12345678 → "1,23,456.78". */
export function formatAmount(amount: Minor, currency: CurrencyCode): string {
  const { grouping } = CURRENCIES[currency];
  const abs = Math.abs(amount);
  const whole = Math.floor(abs / 100).toString();
  const frac = (abs % 100).toString().padStart(2, '0');
  return `${amount < 0 ? '-' : ''}${groupDigits(whole, grouping)}.${frac}`;
}

/** Amount with its currency symbol: "₹1,23,456.78", "$1,234.56", "-₹500.00". */
export function formatMoney(amount: Minor, currency: CurrencyCode): string {
  const body = formatAmount(Math.abs(amount), currency);
  return `${amount < 0 ? '-' : ''}${CURRENCIES[currency].symbol}${body}`;
}

/** Exact decimal of `numerator / 10^scale`, trailing zeros trimmed. */
function trimmedDecimal(numerator: number, scale: number): string {
  const abs = Math.abs(numerator);
  const whole = Math.floor(abs / 10 ** scale);
  const frac = (abs % 10 ** scale).toString().padStart(scale, '0').replace(/0+$/, '');
  return `${numerator < 0 ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

/** Basis points as a percentage label; `divisor = 2` for the CGST/SGST half-rate. 1800 → "18%", 25/2 → "0.125%". */
export function formatPercent(bps: Bps, divisor = 1): string {
  // 1 bps = 1/100 of a percent = 100 ten-thousandths of a percent; stays an exact integer.
  const tenThousandths = (bps * 100) / divisor;
  if (!Number.isInteger(tenThousandths)) throw new RangeError(`Rate ${bps}/${divisor} is too precise`);
  return `${trimmedDecimal(tenThousandths, 4)}%`;
}

/** Quantity in thousandths: 1500 → "1.5", 1250000 → "1,250". */
export function formatQuantity(qty: Milli, grouping: 'indian' | 'international' = 'indian'): string {
  const [whole = '0', frac] = trimmedDecimal(qty, 3).split('.');
  return `${groupDigits(whole, grouping)}${frac ? `.${frac}` : ''}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Parse a `YYYY-MM-DD` calendar date. Returns null for malformed or impossible dates (e.g. 2026-02-30). */
export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** "2026-04-01" → "01 Apr 2026". Uses a fixed month table, not Intl (ICU varies: "Sep" vs "Sept"). */
export function formatDate(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) throw new RangeError(`Invalid date: ${iso}`);
  return `${String(d.day).padStart(2, '0')} ${MONTHS[d.month - 1]} ${d.year}`;
}

/** Add days to a calendar date without timezone drift. */
export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  if (!d) throw new RangeError(`Invalid date: ${iso}`);
  return new Date(Date.UTC(d.year, d.month - 1, d.day + days)).toISOString().slice(0, 10);
}

/** The device's local calendar date as `YYYY-MM-DD`. */
export function localIsoDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
