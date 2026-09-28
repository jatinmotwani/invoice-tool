import { describe, expect, it } from 'vitest';
import { InvoiceSchema } from './schema';
import { sampleInvoice } from './fixtures';

describe('InvoiceSchema', () => {
  it('accepts a complete invoice', () => {
    expect(InvoiceSchema.safeParse(sampleInvoice()).success).toBe(true);
  });

  it('rejects floats for money, impossible dates, unknown currencies and long numbers', () => {
    const bad = (patch: Record<string, unknown>) =>
      InvoiceSchema.safeParse({ ...sampleInvoice(), ...patch }).success;
    expect(bad({ advance: 10.5 })).toBe(false);
    expect(bad({ date: '2026-02-30' })).toBe(false);
    expect(bad({ currency: 'JPY' })).toBe(false);
    expect(bad({ number: 'INV/2026-27/00001' })).toBe(false); // 17 chars
    expect(bad({ schemaVersion: 2 })).toBe(false);
  });

  it('rejects negative quantities and GST rates above 100%', () => {
    const line = sampleInvoice().lines[0];
    expect(InvoiceSchema.safeParse({ ...sampleInvoice(), lines: [{ ...line, qty: -1 }] }).success).toBe(
      false,
    );
    expect(
      InvoiceSchema.safeParse({ ...sampleInvoice(), lines: [{ ...line, gstRate: 10_001 }] }).success,
    ).toBe(false);
  });
});
