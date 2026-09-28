import { type Bps, convert, type Minor, mulQtyRate, parseScaledDecimal, percentOf, sum } from './money';
import { divRoundHalfUp } from './rounding';
import type { Invoice } from './schema';
import type { TaxContext } from './tax-mode';

export interface LineTotals {
  id: string;
  gross: Minor;
  discount: Minor;
  taxable: Minor;
  /** Rate actually applied: 0 under LUT, null when not GST-registered. */
  gstRate: Bps | null;
}

export type TaxHead = 'CGST' | 'SGST' | 'UTGST' | 'IGST';

export interface TaxLine {
  head: TaxHead;
  /** Full GST rate of the group (e.g. 1800); the head's own rate is `rate / divisor`. */
  rate: Bps;
  divisor: 1 | 2;
  taxable: Minor;
  amount: Minor;
}

export type TotalsIssue = 'DISCOUNT_EXCEEDS_AMOUNT' | 'EXCHANGE_RATE_MISSING' | 'NET_NEGATIVE';

export interface Totals {
  lines: LineTotals[];
  /** Sum of taxable values (after discounts, before tax). */
  subtotal: Minor;
  discountTotal: Minor;
  taxLines: TaxLine[];
  taxTotal: Minor;
  roundOff: Minor;
  grandTotal: Minor;
  tds: { rate: Bps; base: Minor; amount: Minor } | null;
  advance: Minor;
  /** What the client should actually pay: total − TDS − advance. */
  netReceivable: Minor;
  /** INR equivalents for foreign-currency invoices. */
  inr: { rate: string; subtotal: Minor; taxTotal: Minor; grandTotal: Minor } | null;
  issues: TotalsIssue[];
}

function lineTotals(line: Invoice['lines'][number], ctx: TaxContext, issues: Set<TotalsIssue>): LineTotals {
  const gross = mulQtyRate(line.qty, line.rate);
  let discount =
    line.discountType === 'percent' ? percentOf(gross, Math.min(line.discount, 10_000)) : line.discount;
  if (discount > gross) {
    issues.add('DISCOUNT_EXCEEDS_AMOUNT');
    discount = gross;
  }
  const gstRate = ctx.mode === 'NON_GST' ? null : ctx.mode === 'EXPORT_LUT' ? 0 : line.gstRate;
  return { id: line.id, gross, discount, taxable: gross - discount, gstRate };
}

/**
 * Tax is computed per rate group on the group's taxable value, rounded half-up to the minor unit.
 * CGST and SGST/UTGST are each computed at half the rate on the same taxable value; a rounded total is
 * never split, so both halves are always equal.
 */
function taxLines(lines: LineTotals[], ctx: TaxContext): TaxLine[] {
  if (ctx.taxKind === 'none') return [];
  const groups = new Map<Bps, Minor>();
  for (const l of lines)
    if (l.gstRate !== null) groups.set(l.gstRate, (groups.get(l.gstRate) ?? 0) + l.taxable);
  const rates = [...groups.keys()].toSorted((a, b) => b - a);

  if (ctx.mode === 'EXPORT_LUT') {
    return [{ head: 'IGST', rate: 0, divisor: 1, taxable: sum([...groups.values()]), amount: 0 }];
  }

  const out: TaxLine[] = [];
  for (const rate of rates) {
    const taxable = groups.get(rate) ?? 0;
    if (rate === 0) continue;
    if (ctx.taxKind === 'igst') {
      out.push({ head: 'IGST', rate, divisor: 1, taxable, amount: percentOf(taxable, rate) });
    } else {
      const half = percentOf(taxable, rate, 2);
      out.push({ head: 'CGST', rate, divisor: 2, taxable, amount: half });
      out.push({
        head: ctx.taxKind === 'cgst_utgst' ? 'UTGST' : 'SGST',
        rate,
        divisor: 2,
        taxable,
        amount: half,
      });
    }
  }
  return out;
}

export function computeTotals(invoice: Invoice, ctx: TaxContext): Totals {
  const issues = new Set<TotalsIssue>();
  const lines = invoice.lines.map((l) => lineTotals(l, ctx, issues));
  const subtotal = sum(lines.map((l) => l.taxable));
  const discountTotal = sum(lines.map((l) => l.discount));
  const taxes = taxLines(lines, ctx);
  const taxTotal = sum(taxes.map((t) => t.amount));
  const beforeRounding = subtotal + taxTotal;

  // Round-off to the nearest rupee is an INR-only option.
  const roundOff =
    invoice.roundOff && invoice.currency === 'INR'
      ? Number(divRoundHalfUp(BigInt(beforeRounding), 100n)) * 100 - beforeRounding
      : 0;
  const grandTotal = beforeRounding + roundOff;

  // TDS is deducted by Indian payers on the value excluding GST (see src/lib/invoice/tds.ts for sources).
  const tds =
    invoice.tds.enabled && !ctx.isExport && invoice.currency === 'INR'
      ? { rate: invoice.tds.rate, base: subtotal, amount: percentOf(subtotal, invoice.tds.rate) }
      : null;

  const advance = invoice.advance;
  const netReceivable = grandTotal - (tds?.amount ?? 0) - advance;
  if (netReceivable < 0) issues.add('NET_NEGATIVE');

  let inr: Totals['inr'] = null;
  if (invoice.currency !== 'INR') {
    const rate = invoice.exchange.rate.trim();
    const scaled = rate ? parseScaledDecimal(rate, 6) : null;
    if (scaled !== null && scaled > 0n) {
      inr = {
        rate,
        subtotal: convert(subtotal, rate),
        taxTotal: convert(taxTotal, rate),
        grandTotal: convert(grandTotal, rate),
      };
    } else if (ctx.registered) {
      // GST returns need the INR value of an export. TODO(verify): which rate (RBI reference / customs) applies.
      issues.add('EXCHANGE_RATE_MISSING');
    }
  }

  return {
    lines,
    subtotal,
    discountTotal,
    taxLines: taxes,
    taxTotal,
    roundOff,
    grandTotal,
    tds,
    advance,
    netReceivable,
    inr,
    issues: [...issues],
  };
}
