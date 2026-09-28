import { describe, expect, it } from 'vitest';
import { gstinCheckChar } from './gstin';
import { ENDORSEMENT_IGST, ENDORSEMENT_LUT, resolveTaxMode, type TaxModeInput } from './tax-mode';

const gstin = (state: string, pan = 'ABCDE1234F') => `${state}${pan}1Z${gstinCheckChar(`${state}${pan}1Z`)}`;

function input(overrides: {
  supplierGstin?: string;
  supplierState?: string;
  clientCountry?: string;
  clientState?: string;
  clientGstin?: string;
  pos?: string;
  lut?: boolean;
  arn?: string;
}): TaxModeInput {
  return {
    supplier: { gstin: overrides.supplierGstin ?? '', stateCode: overrides.supplierState ?? '' },
    client: {
      gstin: overrides.clientGstin ?? '',
      country: overrides.clientCountry ?? 'IN',
      stateCode: overrides.clientState ?? '',
    },
    posOverride: overrides.pos ?? '',
    lut: { enabled: overrides.lut ?? false, arn: overrides.arn ?? '' },
  };
}

describe('resolveTaxMode', () => {
  it.each([
    // [case, input, mode, taxKind, title, placeOfSupply]
    [
      'unregistered, domestic',
      input({ supplierState: '27', clientState: '29' }),
      'NON_GST',
      'none',
      'Invoice',
      null,
    ],
    [
      'unregistered, foreign',
      input({ supplierState: '27', clientCountry: 'US' }),
      'NON_GST',
      'none',
      'Invoice',
      null,
    ],
    [
      'same state',
      input({ supplierGstin: gstin('27'), clientState: '27' }),
      'INTRA',
      'cgst_sgst',
      'Tax Invoice',
      '27',
    ],
    [
      'other state',
      input({ supplierGstin: gstin('27'), clientState: '29' }),
      'INTER',
      'igst',
      'Tax Invoice',
      '29',
    ],
    [
      'Chandigarh intra-UT',
      input({ supplierGstin: gstin('04'), clientState: '04' }),
      'INTRA',
      'cgst_utgst',
      'Tax Invoice',
      '04',
    ],
    [
      'DNH&DD intra-UT',
      input({ supplierGstin: gstin('26'), clientState: '26' }),
      'INTRA',
      'cgst_utgst',
      'Tax Invoice',
      '26',
    ],
    [
      'Lakshadweep intra-UT',
      input({ supplierGstin: gstin('31'), clientState: '31' }),
      'INTRA',
      'cgst_utgst',
      'Tax Invoice',
      '31',
    ],
    [
      'A&N intra-UT',
      input({ supplierGstin: gstin('35'), clientState: '35' }),
      'INTRA',
      'cgst_utgst',
      'Tax Invoice',
      '35',
    ],
    [
      'Ladakh intra-UT',
      input({ supplierGstin: gstin('38'), clientState: '38' }),
      'INTRA',
      'cgst_utgst',
      'Tax Invoice',
      '38',
    ],
    [
      'Delhi (legislature) intra',
      input({ supplierGstin: gstin('07'), clientState: '07' }),
      'INTRA',
      'cgst_sgst',
      'Tax Invoice',
      '07',
    ],
    [
      'Puducherry intra',
      input({ supplierGstin: gstin('34'), clientState: '34' }),
      'INTRA',
      'cgst_sgst',
      'Tax Invoice',
      '34',
    ],
    [
      'UT to other state',
      input({ supplierGstin: gstin('04'), clientState: '03' }),
      'INTER',
      'igst',
      'Tax Invoice',
      '03',
    ],
    [
      'export under LUT',
      input({ supplierGstin: gstin('27'), clientCountry: 'US', lut: true, arn: 'AD270326000001X' }),
      'EXPORT_LUT',
      'igst',
      'Tax Invoice',
      '96',
    ],
    [
      'export paying IGST',
      input({ supplierGstin: gstin('27'), clientCountry: 'GB' }),
      'EXPORT_IGST',
      'igst',
      'Tax Invoice',
      '96',
    ],
  ] as const)('%s', (_, i, mode, taxKind, title, pos) => {
    const ctx = resolveTaxMode(i);
    expect(ctx).toMatchObject({ mode, taxKind, title, placeOfSupply: pos });
    expect(ctx.issues).toEqual([]);
  });

  it('adds Rule 46 endorsements for exports only', () => {
    expect(
      resolveTaxMode(input({ supplierGstin: gstin('27'), clientCountry: 'US', lut: true, arn: 'X' }))
        .endorsement,
    ).toBe(ENDORSEMENT_LUT);
    expect(resolveTaxMode(input({ supplierGstin: gstin('27'), clientCountry: 'US' })).endorsement).toBe(
      ENDORSEMENT_IGST,
    );
    expect(resolveTaxMode(input({ supplierGstin: gstin('27'), clientState: '29' })).endorsement).toBeNull();
    expect(ENDORSEMENT_LUT).toContain(
      'UNDER BOND OR LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX',
    );
  });

  it('offers LUT only to registered suppliers with foreign clients', () => {
    expect(resolveTaxMode(input({ supplierGstin: gstin('27'), clientCountry: 'US' })).lutAvailable).toBe(
      true,
    );
    expect(resolveTaxMode(input({ supplierState: '27', clientCountry: 'US', lut: true })).lutAvailable).toBe(
      false,
    );
    expect(resolveTaxMode(input({ supplierState: '27', clientCountry: 'US', lut: true })).mode).toBe(
      'NON_GST',
    );
    expect(resolveTaxMode(input({ supplierGstin: gstin('27'), clientState: '27' })).lutAvailable).toBe(false);
  });

  it('shows reverse charge "No" on tax invoices only', () => {
    expect(resolveTaxMode(input({ supplierGstin: gstin('27'), clientState: '27' })).reverseCharge).toBe('No');
    expect(resolveTaxMode(input({ supplierState: '27', clientState: '27' })).reverseCharge).toBeNull();
  });

  it("takes the client's state from their GSTIN and flags a mismatch", () => {
    const ctx = resolveTaxMode(
      input({ supplierGstin: gstin('27'), clientGstin: gstin('29', 'PQRST6789K'), clientState: '27' }),
    );
    expect(ctx).toMatchObject({ mode: 'INTER', placeOfSupply: '29', clientStateCode: '29' });
    expect(ctx.issues).toEqual(['CLIENT_STATE_MISMATCH']);
  });

  it("falls back to the supplier's state when the client's state is unknown (IGST Act s.12(2)(b))", () => {
    const ctx = resolveTaxMode(input({ supplierGstin: gstin('27') }));
    expect(ctx).toMatchObject({ mode: 'INTRA', placeOfSupply: '27' });
    expect(ctx.issues).toEqual(['CLIENT_STATE_MISSING']);
  });

  it('honours a manual place-of-supply override', () => {
    const ctx = resolveTaxMode(input({ supplierGstin: gstin('27'), clientState: '27', pos: '29' }));
    expect(ctx).toMatchObject({ mode: 'INTER', placeOfSupply: '29' });
    expect(
      resolveTaxMode(input({ supplierGstin: gstin('27'), clientState: '27', pos: '99' })).placeOfSupply,
    ).toBe('27');
  });

  it('flags invalid GSTINs and a missing LUT ARN', () => {
    expect(
      resolveTaxMode(input({ supplierGstin: '27ABCDE1234F1Z1', supplierState: '27', clientState: '27' }))
        .issues,
    ).toContain('SUPPLIER_GSTIN_INVALID');
    expect(resolveTaxMode(input({ supplierGstin: '27ABCDE1234F1Z1', clientState: '27' })).issues).toContain(
      'SUPPLIER_STATE_MISSING',
    );
    expect(
      resolveTaxMode(input({ supplierGstin: gstin('27'), clientGstin: 'bad', clientState: '27' })).issues,
    ).toEqual(['CLIENT_GSTIN_INVALID']);
    expect(
      resolveTaxMode(input({ supplierGstin: gstin('27'), clientCountry: 'US', lut: true })).issues,
    ).toEqual(['LUT_ARN_MISSING']);
  });

  it("ignores the client's Indian state and GSTIN for foreign clients", () => {
    const ctx = resolveTaxMode(
      input({ supplierGstin: gstin('27'), clientCountry: 'US', clientState: '29', clientGstin: 'x' }),
    );
    expect(ctx).toMatchObject({ clientStateCode: null, placeOfSupply: '96', issues: [] });
  });
});
