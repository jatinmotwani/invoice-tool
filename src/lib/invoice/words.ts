import { CURRENCIES, type CurrencyCode } from './currencies';
import type { Minor } from './money';

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below100(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const tens = TENS[Math.floor(n / 10)] ?? '';
  const ones = n % 10;
  return ones ? `${tens}-${ONES[ones]}` : tens;
}

function below1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? below100(rest) : ''].filter(Boolean).join(' ');
}

/** Indian system: crore (10^7), lakh (10^5), thousand, hundred. Crores recurse: "One Lakh Crore". */
export function indianNumberWords(n: bigint): string {
  if (n === 0n) return 'Zero';
  const parts: string[] = [];
  const crore = n / 10_000_000n;
  let rest = Number(n % 10_000_000n);
  if (crore > 0n) parts.push(`${indianNumberWords(crore)} Crore`);
  const lakh = Math.floor(rest / 100_000);
  rest %= 100_000;
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  const thousand = Math.floor(rest / 1000);
  rest %= 1000;
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion', 'Quadrillion'];

/** International system: thousand, million, billion, trillion. */
export function internationalNumberWords(n: bigint): string {
  if (n === 0n) return 'Zero';
  const parts: string[] = [];
  let scale = 0;
  let rest = n;
  while (rest > 0n) {
    const group = Number(rest % 1000n);
    if (group) {
      const scaleWord = SCALES[scale];
      if (scaleWord === undefined) throw new RangeError('Amount too large');
      parts.unshift([below1000(group), scaleWord].filter(Boolean).join(' '));
    }
    rest /= 1000n;
    scale += 1;
  }
  return parts.join(' ');
}

/**
 * Amount in words for the invoice total.
 * INR (Indian system): "Rupees One Lakh Twenty-Three Thousand and Fifty Paise Only".
 * Others (international system): "One Thousand Two Hundred US Dollars and Five Cents Only".
 */
export function amountInWords(amount: Minor, currency: CurrencyCode): string {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new RangeError(`Invalid amount: ${amount}`);
  const c = CURRENCIES[currency];
  const major = BigInt(Math.floor(amount / 100));
  const minor = amount % 100;
  const minorPart = minor ? `${below100(minor)} ${minor === 1 ? c.minor.one : c.minor.many}` : '';

  if (currency === 'INR') {
    const majorLabel = major === 1n ? c.major.one : c.major.many;
    if (major === 0n && minorPart) return `${minorPart} Only`;
    const majorPart = `${majorLabel} ${indianNumberWords(major)}`;
    return `${majorPart}${minorPart ? ` and ${minorPart}` : ''} Only`;
  }

  if (major === 0n && minorPart) return `${minorPart} Only`;
  const majorPart = `${internationalNumberWords(major)} ${major === 1n ? c.major.one : c.major.many}`;
  return `${majorPart}${minorPart ? ` and ${minorPart}` : ''} Only`;
}
