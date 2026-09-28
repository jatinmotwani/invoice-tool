import { stateByCode } from './states';

/**
 * GSTIN structure for regular taxpayers: 2-digit state code, 10-character PAN, entity number (1-9, A-Z),
 * "Z" by default, and a mod-36 check character (GSTN algorithm).
 * TODO(verify): link GSTN's published structure/checksum note once reachable. The algorithm is confirmed
 * against real GSTINs in gstin.test.ts.
 * Offline only: this checks the shape and checksum, never whether the GSTIN is live.
 */
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export type GstinError = 'empty' | 'length' | 'format' | 'state' | 'checksum';

export type GstinResult =
  | { valid: true; gstin: string; stateCode: string; pan: string; entityNumber: string }
  | { valid: false; gstin: string; error: GstinError; message: string };

export function normalizeGstin(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

/** Check character for the first 14 characters of a GSTIN. */
export function gstinCheckChar(first14: string): string {
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARS.indexOf(first14[i] ?? '');
    if (value < 0) throw new RangeError(`Invalid GSTIN character at ${i + 1}`);
    const product = value * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (total % 36)) % 36] ?? '';
}

export function validateGstin(input: string): GstinResult {
  const gstin = normalizeGstin(input);
  const fail = (error: GstinError, message: string): GstinResult => ({ valid: false, gstin, error, message });
  if (!gstin) return fail('empty', 'Enter a GSTIN.');
  if (gstin.length !== 15) return fail('length', `A GSTIN has 15 characters; this has ${gstin.length}.`);
  if (!GSTIN_RE.test(gstin))
    return fail('format', "This doesn't match the GSTIN format (e.g. 27ABCDE1234F1Z5).");
  const stateCode = gstin.slice(0, 2);
  if (!stateByCode(stateCode)) return fail('state', `${stateCode} isn't a valid state code.`);
  if (gstinCheckChar(gstin.slice(0, 14)) !== gstin[14]) {
    return fail('checksum', 'The last character doesn’t match. Check for a typo.');
  }
  return { valid: true, gstin, stateCode, pan: gstin.slice(2, 12), entityNumber: gstin.slice(12, 13) };
}

export function normalizePan(input: string): string {
  return input.toUpperCase().replace(/\s/g, '');
}

/** PAN shape only (5 letters, 4 digits, 1 letter). */
export function isValidPan(input: string): boolean {
  return PAN_RE.test(normalizePan(input));
}
