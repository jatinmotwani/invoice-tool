import { parseIsoDate } from './format';

/**
 * Invoice numbers: a consecutive serial number of at most 16 characters, using letters, digits, hyphen
 * and slash, unique for a financial year (one or more series allowed).
 * Source: CGST Rules, 2017, Rule 46(b) — TODO(verify) at
 * https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter6/rule46_v1.00.html
 */
export const INVOICE_NUMBER_MAX = 16;
const INVOICE_NUMBER_RE = /^[A-Za-z0-9/-]+$/;

export interface FinancialYear {
  /** Calendar year the FY starts in (April). */
  start: number;
  /** "2026-27" */
  label: string;
  /** "26-27" */
  short: string;
}

/** Indian financial year (1 April – 31 March) containing a date. */
export function financialYear(isoDate: string): FinancialYear {
  const d = parseIsoDate(isoDate);
  if (!d) throw new RangeError(`Invalid date: ${isoDate}`);
  const start = d.month >= 4 ? d.year : d.year - 1;
  const end2 = String((start + 1) % 100).padStart(2, '0');
  return { start, label: `${start}-${end2}`, short: `${String(start % 100).padStart(2, '0')}-${end2}` };
}

export type InvoiceNumberError = 'empty' | 'too_long' | 'invalid_chars';

export function validateInvoiceNumber(value: string): InvoiceNumberError | null {
  if (!value) return 'empty';
  if (value.length > INVOICE_NUMBER_MAX) return 'too_long';
  if (!INVOICE_NUMBER_RE.test(value)) return 'invalid_chars';
  return null;
}

export interface Series {
  prefix: string;
  separator: '/' | '-';
  includeFy: boolean;
  /** Minimum digits in the sequence number, zero-padded. */
  padding: number;
}

export const DEFAULT_SERIES: Series = { prefix: 'INV', separator: '/', includeFy: true, padding: 3 };

function seriesHead(series: Series, fy: FinancialYear): string {
  const parts = [series.prefix, series.includeFy ? fy.short : ''].filter(Boolean);
  return parts.length ? parts.join(series.separator) + series.separator : '';
}

/** INV/26-27/001 */
export function formatSeriesNumber(series: Series, fy: FinancialYear, seq: number): string {
  return seriesHead(series, fy) + String(seq).padStart(series.padding, '0');
}

/** Sequence number if `number` belongs to this series and FY, else null. */
export function parseSeriesNumber(series: Series, fy: FinancialYear, number: string): number | null {
  const head = seriesHead(series, fy);
  if (!number.toUpperCase().startsWith(head.toUpperCase())) return null;
  const rest = number.slice(head.length);
  return /^\d+$/.test(rest) ? Number(rest) : null;
}

export interface NumberedInvoice {
  id: string;
  number: string;
  date: string;
}

function inFy(invoices: readonly NumberedInvoice[], fy: FinancialYear): NumberedInvoice[] {
  return invoices.filter((i) => parseIsoDate(i.date) && financialYear(i.date).start === fy.start);
}

/**
 * Next number in the series for the FY of `date`. A new FY restarts at 1 because only that FY's
 * invoices are considered.
 */
export function nextInvoiceNumber(
  series: Series,
  date: string,
  invoices: readonly NumberedInvoice[],
): string {
  const fy = financialYear(date);
  const seqs = inFy(invoices, fy)
    .map((i) => parseSeriesNumber(series, fy, i.number))
    .filter((n): n is number => n !== null);
  return formatSeriesNumber(series, fy, seqs.length ? Math.max(...seqs) + 1 : 1);
}

/** Another invoice in the same FY already uses this number (case-insensitive). */
export function isDuplicateNumber(
  candidate: { id: string; number: string; date: string },
  invoices: readonly NumberedInvoice[],
): boolean {
  const fy = financialYear(candidate.date);
  const n = candidate.number.trim().toUpperCase();
  return inFy(invoices, fy).some((i) => i.id !== candidate.id && i.number.trim().toUpperCase() === n);
}

/** Increment the last run of digits, keeping zero padding: INV-0042 → INV-0043, A-99 → A-100. */
export function incrementNumber(number: string): string | null {
  const m = /^(.*?)(\d+)(\D*)$/.exec(number);
  if (!m) return null;
  const [, head = '', digits = '', tail = ''] = m;
  const next = String(Number(digits) + 1).padStart(digits.length, '0');
  return `${head}${next}${tail}`;
}
