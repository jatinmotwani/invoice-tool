import { describe, expect, it } from 'vitest';
import { sampleInvoice, sampleLine } from './fixtures';
import { gstinCheckChar } from './gstin';
import type { Invoice } from './schema';
import { resolveTaxMode } from './tax-mode';
import { computeTotals } from './totals';

const GSTIN_27 = `27ABCDE1234F1Z${gstinCheckChar('27ABCDE1234F1Z')}`;
const GSTIN_04 = `04ABCDE1234F1Z${gstinCheckChar('04ABCDE1234F1Z')}`;

function totals(inv: Invoice) {
  return computeTotals(inv, resolveTaxMode(inv));
}

function registered(overrides: Partial<Invoice> = {}, clientState = '27'): Invoice {
  const base = sampleInvoice();
  return {
    ...base,
    supplier: { ...base.supplier, gstin: GSTIN_27 },
    client: { ...base.client, stateCode: clientState },
    ...overrides,
  };
}

describe('line amounts', () => {
  it('applies amount and percent discounts', () => {
    const t = totals(
      sampleInvoice({
        lines: [
          sampleLine({ id: 'a', qty: 2000, rate: 150000, discountType: 'amount', discount: 50000 }), // 3000 − 500
          sampleLine({ id: 'b', qty: 1500, rate: 200000, discountType: 'percent', discount: 1000 }), // 3000 − 10%
        ],
      }),
    );
    expect(t.lines.map((l) => [l.gross, l.discount, l.taxable])).toEqual([
      [300000, 50000, 250000],
      [300000, 30000, 270000],
    ]);
    expect(t.subtotal).toBe(520000);
    expect(t.discountTotal).toBe(80000);
  });

  it('clamps a discount larger than the amount and flags it', () => {
    const t = totals(sampleInvoice({ lines: [sampleLine({ rate: 1000, discount: 5000 })] }));
    expect(t.lines[0]?.taxable).toBe(0);
    expect(t.issues).toContain('DISCOUNT_EXCEEDS_AMOUNT');
  });
});

describe('GST', () => {
  it('has no tax lines when not registered, whatever the line rate', () => {
    const t = totals(sampleInvoice({ lines: [sampleLine({ gstRate: 1800 })] }));
    expect(t.taxLines).toEqual([]);
    expect(t.grandTotal).toBe(t.subtotal);
    expect(t.lines[0]?.gstRate).toBeNull();
  });

  it('splits intra-state tax into CGST + SGST per rate group', () => {
    const t = totals(
      registered({
        lines: [
          sampleLine({ id: 'a', rate: 1000000, gstRate: 1800 }),
          sampleLine({ id: 'b', rate: 100000, gstRate: 500 }),
          sampleLine({ id: 'c', rate: 50000, gstRate: 1800 }),
        ],
      }),
    );
    expect(t.taxLines).toEqual([
      { head: 'CGST', rate: 1800, divisor: 2, taxable: 1050000, amount: 94500 },
      { head: 'SGST', rate: 1800, divisor: 2, taxable: 1050000, amount: 94500 },
      { head: 'CGST', rate: 500, divisor: 2, taxable: 100000, amount: 2500 },
      { head: 'SGST', rate: 500, divisor: 2, taxable: 100000, amount: 2500 },
    ]);
    expect(t.taxTotal).toBe(194000);
    expect(t.grandTotal).toBe(1344000);
  });

  it('computes each half on the taxable value, never by splitting a rounded total', () => {
    // 25 paise at 18%: IGST would be 4.5 → 5, but CGST 2.25 → 2 and SGST 2.25 → 2.
    const t = totals(registered({ lines: [sampleLine({ qty: 1000, rate: 25 })] }));
    expect(t.taxLines.map((l) => l.amount)).toEqual([2, 2]);
    const inter = totals(registered({ lines: [sampleLine({ qty: 1000, rate: 25 })] }, '29'));
    expect(inter.taxLines).toEqual([{ head: 'IGST', rate: 1800, divisor: 1, taxable: 25, amount: 5 }]);
  });

  it('uses UTGST instead of SGST inside a UT without legislature', () => {
    const base = sampleInvoice();
    const t = totals({
      ...base,
      supplier: { ...base.supplier, gstin: GSTIN_04 },
      client: { ...base.client, stateCode: '04' },
    });
    expect(t.taxLines.map((l) => l.head)).toEqual(['CGST', 'UTGST']);
  });

  it('skips 0% groups in domestic invoices', () => {
    const t = totals(registered({ lines: [sampleLine({ gstRate: 0 })] }, '29'));
    expect(t.taxLines).toEqual([]);
  });

  it('charges IGST @ 0% under LUT and IGST at the line rate without it', () => {
    const base = registered({
      currency: 'USD',
      client: { ...sampleInvoice().client, country: 'US', stateCode: '' },
      lines: [sampleLine({ rate: 100000, gstRate: 1800 })],
      exchange: { rate: '83.25', source: 'RBI reference rate', date: '2026-09-28' },
    });
    const lut = totals({ ...base, lut: { enabled: true, arn: 'AD2703260000001', fy: '2026-27' } });
    expect(lut.taxLines).toEqual([{ head: 'IGST', rate: 0, divisor: 1, taxable: 100000, amount: 0 }]);
    expect(lut.grandTotal).toBe(100000);
    expect(lut.inr).toEqual({ rate: '83.25', subtotal: 8325000, taxTotal: 0, grandTotal: 8325000 });

    const igst = totals(base);
    expect(igst.taxLines).toEqual([{ head: 'IGST', rate: 1800, divisor: 1, taxable: 100000, amount: 18000 }]);
    expect(igst.inr?.grandTotal).toBe(9823500);
  });

  it('flags a missing exchange rate on registered exports only', () => {
    const client = { ...sampleInvoice().client, country: 'US', stateCode: '' };
    expect(totals(registered({ currency: 'USD', client })).issues).toContain('EXCHANGE_RATE_MISSING');
    expect(totals(sampleInvoice({ currency: 'USD', client })).issues).toEqual([]);
    expect(totals(sampleInvoice({ currency: 'USD', client })).inr).toBeNull();
  });
});

describe('round-off, TDS, advance', () => {
  it('rounds the INR total to the nearest rupee, half-up', () => {
    const up = totals(sampleInvoice({ roundOff: true, lines: [sampleLine({ rate: 118050 })] }));
    expect([up.roundOff, up.grandTotal]).toEqual([50, 118100]);
    const down = totals(sampleInvoice({ roundOff: true, lines: [sampleLine({ rate: 118049 })] }));
    expect([down.roundOff, down.grandTotal]).toEqual([-49, 118000]);
    const usd = totals(
      sampleInvoice({ currency: 'USD', roundOff: true, lines: [sampleLine({ rate: 118049 })] }),
    );
    expect(usd.roundOff).toBe(0);
  });

  it('deducts TDS on the value excluding GST, then the advance', () => {
    const t = totals(
      registered(
        {
          tds: { enabled: true, preset: 'professional', rate: 1000 },
          advance: 2000000,
          lines: [sampleLine({ rate: 10000000 })],
        },
        '29',
      ),
    );
    expect(t.grandTotal).toBe(11800000); // ₹1,00,000 + 18% IGST
    expect(t.tds).toEqual({ rate: 1000, base: 10000000, amount: 1000000 });
    expect(t.netReceivable).toBe(11800000 - 1000000 - 2000000);
  });

  it('never applies TDS to foreign clients', () => {
    const client = { ...sampleInvoice().client, country: 'US', stateCode: '' };
    const t = totals(
      sampleInvoice({ currency: 'USD', client, tds: { enabled: true, preset: 'professional', rate: 1000 } }),
    );
    expect(t.tds).toBeNull();
  });

  it('flags a negative net receivable', () => {
    expect(totals(sampleInvoice({ advance: 99999999 })).issues).toContain('NET_NEGATIVE');
  });
});

describe('invariants over random invoices', () => {
  // Small seeded PRNG so failures are reproducible.
  function rng(seed: number) {
    return () => {
      seed = (seed * 1664525 + 1013904223) % 2 ** 32;
      return seed / 2 ** 32;
    };
  }

  it('totals always reconcile', () => {
    const rand = rng(42);
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)] as T;
    for (let i = 0; i < 500; i++) {
      const lines = Array.from({ length: 1 + Math.floor(rand() * 6) }, (_, j) =>
        sampleLine({
          id: String(j),
          qty: 1 + Math.floor(rand() * 20000),
          rate: Math.floor(rand() * 10_000_000),
          discountType: pick(['amount', 'percent'] as const),
          discount: Math.floor(rand() * 5000),
          gstRate: pick([0, 500, 1800, 4000, 25]),
        }),
      );
      const inv = registered(
        { lines, roundOff: rand() < 0.5, tds: { enabled: rand() < 0.5, preset: 'custom', rate: 200 } },
        pick(['27', '29']),
      );
      const t = totals(inv);
      expect(t.subtotal).toBe(t.lines.reduce((s, l) => s + l.taxable, 0));
      expect(t.grandTotal).toBe(t.subtotal + t.taxTotal + t.roundOff);
      expect(Math.abs(t.roundOff)).toBeLessThanOrEqual(50);
      if (t.roundOff) expect(t.grandTotal % 100).toBe(0);
      for (let k = 0; k + 1 < t.taxLines.length; k += 2) {
        const [a, b] = [t.taxLines[k], t.taxLines[k + 1]];
        if (a?.head === 'CGST') expect(b?.amount).toBe(a.amount);
      }
      expect(t.netReceivable).toBe(t.grandTotal - (t.tds?.amount ?? 0) - t.advance);
    }
  });
});
