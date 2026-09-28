import type { Minor } from './money';

/**
 * UPI payment URI (NPCI UPI Linking Specification): upi://pay?pa=&pn=&am=&cu=INR&tn=
 * Values are percent-encoded; `am` is rupees with two decimals; INR is the only currency.
 * TODO(verify) parameter rules against the current NPCI linking specification (npci.org.in).
 */
export interface UpiRequest {
  vpa: string;
  payeeName: string;
  /** Paise. Omitted (payer enters it) when null or ≤ 0. */
  amount: Minor | null;
  note: string;
}

/** handle@psp — loose shape check only; the payer's app does the real validation. TODO(verify). */
const VPA_RE = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/;

export function isValidVpa(vpa: string): boolean {
  return VPA_RE.test(vpa.trim());
}

function rupees(amount: Minor): string {
  return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, '0')}`;
}

export function buildUpiUri(req: UpiRequest): string {
  const params: [string, string][] = [
    ['pa', req.vpa.trim()],
    ['pn', req.payeeName.trim()],
  ];
  if (req.amount !== null && req.amount > 0) params.push(['am', rupees(req.amount)]);
  params.push(['cu', 'INR']);
  if (req.note.trim()) params.push(['tn', req.note.trim()]);
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

/**
 * Person-to-person UPI transfers are capped at ₹1,00,000 per day for most users; above that we suggest a
 * bank transfer. Source: NPCI UPI limits — TODO(verify) at https://www.npci.org.in (UPI → transaction limits).
 */
export const UPI_P2P_LIMIT: Minor = 1_00_000_00;

export function exceedsUpiLimit(amount: Minor): boolean {
  return amount > UPI_P2P_LIMIT;
}
