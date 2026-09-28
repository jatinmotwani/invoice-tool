import { divRoundHalfUp } from './rounding';

/**
 * Money is stored as integer minor units (paise for INR, cents etc. for others) in a plain `number`,
 * which is exact up to 2^53 (≈ ₹90 lakh crore). Multiplication happens in BigInt, then rounds half-up once.
 */
export type Minor = number;
/** Percentage rates in basis points: 18% = 1800, 0.25% = 25. */
export type Bps = number;
/** Quantities in thousandths: 1.5 hours = 1500. */
export type Milli = number;

export const BPS_PER_UNIT = 10_000;
export const MILLI_PER_UNIT = 1_000;

function assertSafeInteger(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${what} must be a safe integer, got ${value}`);
}

function toNumber(value: bigint): number {
  const n = Number(value);
  assertSafeInteger(n, 'Result');
  return n;
}

/** qty × unit rate, rounded half-up to the minor unit. */
export function mulQtyRate(qty: Milli, rate: Minor): Minor {
  assertSafeInteger(qty, 'Quantity');
  assertSafeInteger(rate, 'Rate');
  return toNumber(divRoundHalfUp(BigInt(qty) * BigInt(rate), BigInt(MILLI_PER_UNIT)));
}

/** `amount × bps / 10000 / divisor`, rounded half-up. `divisor = 2` gives the CGST/SGST half-rate. */
export function percentOf(amount: Minor, bps: Bps, divisor = 1): Minor {
  assertSafeInteger(amount, 'Amount');
  assertSafeInteger(bps, 'Rate');
  return toNumber(divRoundHalfUp(BigInt(amount) * BigInt(bps), BigInt(BPS_PER_UNIT * divisor)));
}

/** Convert with an exchange rate given as a decimal string (≤ 6 dp): 1 USD = "83.2500" INR. */
export function convert(amount: Minor, rate: string): Minor {
  const scaled = parseScaledDecimal(rate, 6);
  if (scaled === null || scaled <= 0n) throw new RangeError(`Invalid exchange rate: ${rate}`);
  return toNumber(divRoundHalfUp(BigInt(amount) * scaled, 1_000_000n));
}

export function sum(values: readonly Minor[]): Minor {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Parse a user-typed non-negative decimal ("1,23,456.7") into an integer scaled by 10^digits.
 * Grouping commas and spaces are ignored. Returns null for anything else, including too many decimals.
 */
export function parseScaledDecimal(input: string, digits: number): bigint | null {
  const cleaned = input.replace(/[,\s]/g, '');
  const match = /^(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match || cleaned === '' || cleaned === '.') return null;
  const whole = match[1] ?? '';
  const frac = match[2] ?? '';
  if (frac.length > digits) return null;
  return BigInt((whole || '0') + frac.padEnd(digits, '0'));
}

function parseScaled(input: string, digits: number): number | null {
  const value = parseScaledDecimal(input, digits);
  if (value === null) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

/** "1,234.5" → 123450 (minor units). */
export const parseAmount = (input: string, minorDigits = 2): Minor | null => parseScaled(input, minorDigits);
/** "1.5" → 1500 (thousandths). */
export const parseQuantity = (input: string): Milli | null => parseScaled(input, 3);
/** "18" → 1800, "0.25" → 25 (basis points). */
export const parsePercent = (input: string): Bps | null => parseScaled(input, 2);
