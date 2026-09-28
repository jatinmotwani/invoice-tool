import { describe, expect, it } from 'vitest';
import { sampleInvoice, sampleLine } from './fixtures';
import { gstinCheckChar } from './gstin';
import type { Invoice } from './schema';
import { dueDateFor } from './terms';
import { buildInvoiceView } from './view';

const GSTIN_27 = `27ABCDE1234F1Z${gstinCheckChar('27ABCDE1234F1Z')}`;
const view = (inv: Invoice) => buildInvoiceView(inv, { brandName: 'YourBrand' });
const base = sampleInvoice();

describe('buildInvoiceView — not GST-registered', () => {
  const v = view(sampleInvoice({ supplier: { ...base.supplier, pan: 'abcde1234f' } }));

  it('is a plain Invoice with no tax columns or rows', () => {
    expect(v.title).toBe('Invoice');
    expect(v.columns.gstRate).toBe(false);
    expect(v.summary.map((r) => r.label)).toEqual(['Subtotal', 'Total']);
    expect(v.meta.map((m) => m.label)).toEqual(['Invoice No.', 'Invoice Date', 'Due Date']);
  });

  it('carries the "Not registered under GST" note and optional PAN', () => {
    expect(v.notes).toContain('Not registered under GST');
    expect(v.supplier.fields).toContainEqual({ label: 'PAN', value: 'ABCDE1234F' });
    expect(v.supplier.fields.find((f) => f.label === 'GSTIN')).toBeUndefined();
  });

  it('formats dates, items and words', () => {
    expect(v.meta[1]).toEqual({ label: 'Invoice Date', value: '28 Sep 2026' });
    expect(v.meta[2]?.value).toBe('13 Oct 2026 (Net 15)');
    expect(v.items[0]).toMatchObject({
      qty: '1',
      unit: 'project',
      rate: '50,000.00',
      amount: '50,000.00',
      gstRate: '',
    });
    expect(v.amountDue).toBe('₹50,000.00');
    expect(v.amountInWords).toBe('Rupees Fifty Thousand Only');
    expect(v.footerCredit).toBe('Made free with YourBrand');
  });
});

describe('buildInvoiceView — GST, other state, with TDS and advance', () => {
  const v = view(
    sampleInvoice({
      supplier: { ...base.supplier, gstin: GSTIN_27 },
      lines: [sampleLine({ qty: 2500, unit: 'day', rate: 2000000 })], // 2.5 days × ₹20,000
      tds: { enabled: true, preset: 'professional', rate: 1000 },
      advance: 1000000,
      upiVpa: 'asha@okaxis',
    }),
  );

  it('is a Tax Invoice with place of supply and reverse charge', () => {
    expect(v.title).toBe('Tax Invoice');
    expect(v.meta).toContainEqual({ label: 'Place of Supply', value: '29 - Karnataka' });
    expect(v.meta).toContainEqual({ label: 'Reverse Charge', value: 'No' });
    expect(v.supplier.fields).toContainEqual({ label: 'GSTIN', value: GSTIN_27 });
    expect(v.supplier.fields).toContainEqual({ label: 'State', value: 'Maharashtra (27)' });
    expect(v.client.fields).toContainEqual({ label: 'State', value: 'Karnataka (29)' });
  });

  it('lists IGST, total, deductions and net receivable', () => {
    expect(v.items[0]).toMatchObject({ qty: '2.5', unit: 'days', amount: '50,000.00', gstRate: '18%' });
    expect(v.summary).toEqual([
      { label: 'Taxable Value', value: '₹50,000.00', kind: 'normal' },
      { label: 'IGST @ 18%', value: '₹9,000.00', kind: 'normal' },
      { label: 'Total', value: '₹59,000.00', kind: 'total' },
      { label: 'Less: TDS @ 10%', value: '-₹5,000.00', kind: 'deduction' },
      { label: 'Less: Advance Received', value: '-₹10,000.00', kind: 'deduction' },
      { label: 'Net Receivable', value: '₹44,000.00', kind: 'net' },
    ]);
    expect(v.amountDue).toBe('₹44,000.00');
    expect(v.amountInWords).toBe('Rupees Fifty-Nine Thousand Only'); // the invoice value, not the net
  });

  it('builds a UPI link for the net receivable', () => {
    expect(v.upi).toEqual({
      uri: 'upi://pay?pa=asha%40okaxis&pn=Asha%20Rao&am=44000.00&cu=INR&tn=INV%2F26-27%2F001',
      vpa: 'asha@okaxis',
      amount: '₹44,000.00',
    });
    expect(v.upiWarning).toBeNull();
  });
});

describe('buildInvoiceView — intra-state', () => {
  it('shows CGST and SGST at half rate and round-off', () => {
    const v = view(
      sampleInvoice({
        supplier: { ...base.supplier, gstin: GSTIN_27 },
        client: { ...base.client, stateCode: '27' },
        lines: [sampleLine({ rate: 100050 })],
        roundOff: true,
      }),
    );
    expect(v.summary.map((r) => `${r.label}: ${r.value}`)).toEqual([
      'Taxable Value: ₹1,000.50',
      'CGST @ 9%: ₹90.05',
      'SGST @ 9%: ₹90.05',
      'Round Off: +₹0.40',
      'Total: ₹1,181.00',
    ]);
  });
});

describe('buildInvoiceView — export under LUT', () => {
  const v = view(
    sampleInvoice({
      supplier: { ...base.supplier, gstin: GSTIN_27 },
      client: { ...base.client, country: 'US', stateCode: '', name: 'Globex Inc.' },
      currency: 'USD',
      lines: [sampleLine({ qty: 10000, unit: 'hour', rate: 4550 })], // 10 h × $45.50
      lut: { enabled: true, arn: 'AD270326000123X', fy: '2026-27' },
      exchange: { rate: '83.25', source: 'RBI reference rate', date: '2026-09-27' },
      bank: { ...base.bank, swift: 'hdfcinbb', accountNumber: '50100012345678' },
      upiVpa: 'asha@okaxis',
      tds: { enabled: true, preset: 'professional', rate: 1000 },
    }),
  );

  it('prints POS 96, IGST 0%, LUT and the Rule 46 endorsement', () => {
    expect(v.meta).toContainEqual({ label: 'Place of Supply', value: '96 - Other Countries' });
    expect(v.meta).toContainEqual({ label: 'Currency', value: 'USD' });
    expect(v.summary.map((r) => `${r.label}: ${r.value}`)).toEqual([
      'Taxable Value: $455.00',
      'IGST @ 0%: $0.00',
      'Total: $455.00',
    ]);
    expect(v.lut).toBe('LUT ARN: AD270326000123X (FY 2026-27)');
    expect(v.endorsement).toMatch(/UNDER BOND OR LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX$/);
  });

  it('uses international formatting, words and the INR equivalent', () => {
    expect(v.items[0]).toMatchObject({
      qty: '10',
      unit: 'hours',
      rate: '45.50',
      amount: '455.00',
      gstRate: '0%',
    });
    expect(v.moneyHeader).toBe('Amount ($)');
    expect(v.amountInWords).toBe('Four Hundred Fifty-Five US Dollars Only');
    expect(v.inrEquivalent).toBe(
      'INR equivalent: ₹37,878.75 at ₹83.25 per USD, RBI reference rate, 27 Sep 2026',
    );
    expect(v.client.fields).toContainEqual({ label: 'Country', value: 'United States' });
  });

  it('shows no UPI (INR only) or TDS for foreign clients, and bank SWIFT', () => {
    expect(v.upi).toBeNull();
    expect(v.summary.some((r) => r.label.includes('TDS'))).toBe(false);
    expect(v.bank).toContainEqual({ label: 'SWIFT/BIC', value: 'HDFCINBB' });
  });
});

describe('buildInvoiceView — misc', () => {
  it('warns about the UPI cap above ₹1,00,000', () => {
    const v = view(sampleInvoice({ upiVpa: 'ab@ybl', lines: [sampleLine({ rate: 15000000 })] }));
    expect(v.upiWarning).toMatch(/₹1,00,000/);
  });

  it('adds the MSME note only with a Udyam number', () => {
    const withUdyam = sampleInvoice({
      msme45Days: true,
      supplier: { ...base.supplier, udyam: 'udyam-mh-26-0012345' },
    });
    expect(view(withUdyam).notes).toContain('Payable within 45 days as per MSMED Act, 2006');
    expect(view(withUdyam).supplier.fields).toContainEqual({
      label: 'Udyam No.',
      value: 'UDYAM-MH-26-0012345',
    });
    expect(view(sampleInvoice({ msme45Days: true })).notes).not.toContain(
      'Payable within 45 days as per MSMED Act, 2006',
    );
  });

  it('hides the footer credit when turned off and passes through issues', () => {
    expect(view(sampleInvoice({ footerCredit: false })).footerCredit).toBeNull();
    expect(view(sampleInvoice({ advance: 99999999 })).issues).toContain('NET_NEGATIVE');
  });

  it('computes due dates from terms', () => {
    expect(dueDateFor('2026-09-28', 'receipt')).toBe('2026-09-28');
    expect(dueDateFor('2026-09-28', 'net7')).toBe('2026-10-05');
    expect(dueDateFor('2026-09-28', 'net30')).toBe('2026-10-28');
  });
});
