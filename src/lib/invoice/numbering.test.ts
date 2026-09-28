import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SERIES,
  financialYear,
  formatSeriesNumber,
  incrementNumber,
  isDuplicateNumber,
  nextInvoiceNumber,
  parseSeriesNumber,
  validateInvoiceNumber,
} from './numbering';

describe('financialYear', () => {
  it('runs April to March', () => {
    expect(financialYear('2026-03-31')).toEqual({ start: 2025, label: '2025-26', short: '25-26' });
    expect(financialYear('2026-04-01')).toEqual({ start: 2026, label: '2026-27', short: '26-27' });
    expect(financialYear('2026-12-31').label).toBe('2026-27');
    expect(financialYear('2027-01-01').label).toBe('2026-27');
  });

  it('handles the century wrap', () => {
    expect(financialYear('2099-06-01').short).toBe('99-00');
    expect(financialYear('2100-01-15').label).toBe('2099-00');
  });

  it('rejects invalid dates', () => {
    expect(() => financialYear('2026-02-30')).toThrow(RangeError);
  });
});

describe('validateInvoiceNumber', () => {
  it('allows letters, digits, hyphen and slash up to 16 characters', () => {
    expect(validateInvoiceNumber('INV/26-27/001')).toBeNull();
    expect(validateInvoiceNumber('A'.repeat(16))).toBeNull();
  });

  it('rejects empty, long and other characters', () => {
    expect(validateInvoiceNumber('')).toBe('empty');
    expect(validateInvoiceNumber('A'.repeat(17))).toBe('too_long');
    expect(validateInvoiceNumber('INV 001')).toBe('invalid_chars');
    expect(validateInvoiceNumber('INV_001')).toBe('invalid_chars');
    expect(validateInvoiceNumber('INV#1')).toBe('invalid_chars');
  });
});

describe('series numbering', () => {
  const fy = financialYear('2026-09-28');

  it('formats the default series', () => {
    expect(formatSeriesNumber(DEFAULT_SERIES, fy, 1)).toBe('INV/26-27/001');
    expect(formatSeriesNumber(DEFAULT_SERIES, fy, 1234)).toBe('INV/26-27/1234');
    expect(formatSeriesNumber({ prefix: '', separator: '-', includeFy: false, padding: 4 }, fy, 7)).toBe(
      '0007',
    );
    expect(formatSeriesNumber({ prefix: 'AR', separator: '-', includeFy: false, padding: 1 }, fy, 7)).toBe(
      'AR-7',
    );
  });

  it('parses its own numbers only', () => {
    expect(parseSeriesNumber(DEFAULT_SERIES, fy, 'INV/26-27/042')).toBe(42);
    expect(parseSeriesNumber(DEFAULT_SERIES, fy, 'inv/26-27/042')).toBe(42);
    expect(parseSeriesNumber(DEFAULT_SERIES, fy, 'INV/25-26/042')).toBeNull();
    expect(parseSeriesNumber(DEFAULT_SERIES, fy, 'INV/26-27/04A')).toBeNull();
  });

  it('auto-increments within the FY and rolls over on 1 April', () => {
    const invoices = [
      { id: 'a', number: 'INV/25-26/044', date: '2026-03-30' },
      { id: 'b', number: 'INV/25-26/045', date: '2026-03-31' },
      { id: 'c', number: 'CUSTOM-9', date: '2026-03-31' },
    ];
    expect(nextInvoiceNumber(DEFAULT_SERIES, '2026-03-31', invoices)).toBe('INV/25-26/046');
    expect(nextInvoiceNumber(DEFAULT_SERIES, '2026-04-01', invoices)).toBe('INV/26-27/001');
    expect(nextInvoiceNumber(DEFAULT_SERIES, '2026-04-01', [])).toBe('INV/26-27/001');
  });

  it('continues after gaps from the highest number', () => {
    const invoices = [
      { id: 'a', number: 'INV/26-27/001', date: '2026-04-02' },
      { id: 'b', number: 'INV/26-27/007', date: '2026-05-02' },
    ];
    expect(nextInvoiceNumber(DEFAULT_SERIES, '2026-06-01', invoices)).toBe('INV/26-27/008');
  });
});

describe('isDuplicateNumber', () => {
  const invoices = [
    { id: 'a', number: 'INV/26-27/001', date: '2026-04-02' },
    { id: 'b', number: 'A-1', date: '2025-06-01' },
  ];

  it('flags the same number in the same FY, ignoring case and the invoice itself', () => {
    expect(isDuplicateNumber({ id: 'x', number: 'inv/26-27/001', date: '2026-09-01' }, invoices)).toBe(true);
    expect(isDuplicateNumber({ id: 'a', number: 'INV/26-27/001', date: '2026-04-02' }, invoices)).toBe(false);
  });

  it('allows reusing a number in a different FY', () => {
    expect(isDuplicateNumber({ id: 'x', number: 'A-1', date: '2026-06-01' }, invoices)).toBe(false);
    expect(isDuplicateNumber({ id: 'x', number: 'A-1', date: '2026-03-31' }, invoices)).toBe(true);
  });
});

describe('incrementNumber', () => {
  it('bumps the last digit run and keeps padding', () => {
    expect(incrementNumber('INV-0042')).toBe('INV-0043');
    expect(incrementNumber('A-99')).toBe('A-100');
    expect(incrementNumber('2026/007')).toBe('2026/008');
    expect(incrementNumber('7A')).toBe('8A');
    expect(incrementNumber('ABC')).toBeNull();
  });
});
