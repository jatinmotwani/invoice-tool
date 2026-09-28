import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatAmount,
  formatDate,
  formatMoney,
  formatPercent,
  formatQuantity,
  groupDigits,
  localIsoDate,
  parseIsoDate,
} from './format';

describe('groupDigits', () => {
  it('groups in the Indian system', () => {
    expect(groupDigits('100', 'indian')).toBe('100');
    expect(groupDigits('1000', 'indian')).toBe('1,000');
    expect(groupDigits('100000', 'indian')).toBe('1,00,000');
    expect(groupDigits('12345678', 'indian')).toBe('1,23,45,678');
    expect(groupDigits('1000000000', 'indian')).toBe('1,00,00,00,000');
  });

  it('groups in the international system', () => {
    expect(groupDigits('100000', 'international')).toBe('100,000');
    expect(groupDigits('12345678', 'international')).toBe('12,345,678');
  });
});

describe('formatMoney / formatAmount', () => {
  it('formats INR with en-IN grouping and ₹', () => {
    expect(formatMoney(12345678, 'INR')).toBe('₹1,23,456.78');
    expect(formatMoney(1234567850, 'INR')).toBe('₹1,23,45,678.50');
    expect(formatMoney(0, 'INR')).toBe('₹0.00');
    expect(formatMoney(5, 'INR')).toBe('₹0.05');
    expect(formatMoney(-50000, 'INR')).toBe('-₹500.00');
  });

  it('formats foreign currencies with en-US grouping', () => {
    expect(formatMoney(123456789, 'USD')).toBe('$1,234,567.89');
    expect(formatMoney(100000, 'EUR')).toBe('€1,000.00');
    expect(formatMoney(99, 'GBP')).toBe('£0.99');
    expect(formatMoney(150000, 'AUD')).toBe('A$1,500.00');
    expect(formatMoney(150000, 'AED')).toBe('AED 1,500.00');
  });

  it('formats bare amounts for table cells', () => {
    expect(formatAmount(12345678, 'INR')).toBe('1,23,456.78');
    expect(formatAmount(12345678, 'USD')).toBe('123,456.78');
    expect(formatAmount(-1, 'INR')).toBe('-0.01');
  });
});

describe('formatPercent', () => {
  it('formats basis points exactly', () => {
    expect(formatPercent(1800)).toBe('18%');
    expect(formatPercent(1800, 2)).toBe('9%');
    expect(formatPercent(500, 2)).toBe('2.5%');
    expect(formatPercent(25, 2)).toBe('0.125%');
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('formatQuantity', () => {
  it('trims trailing zeros and groups', () => {
    expect(formatQuantity(1000)).toBe('1');
    expect(formatQuantity(1500)).toBe('1.5');
    expect(formatQuantity(125)).toBe('0.125');
    expect(formatQuantity(1250000)).toBe('1,250');
    expect(formatQuantity(123456000)).toBe('1,23,456');
    expect(formatQuantity(123456000, 'international')).toBe('123,456');
  });
});

describe('dates', () => {
  it('formats as DD MMM YYYY with fixed month names', () => {
    expect(formatDate('2026-04-01')).toBe('01 Apr 2026');
    expect(formatDate('2026-09-28')).toBe('28 Sep 2026');
    expect(formatDate('2027-03-31')).toBe('31 Mar 2027');
  });

  it('rejects impossible dates', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate('26-04-01')).toBeNull();
    expect(parseIsoDate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
    expect(() => formatDate('nope')).toThrow(RangeError);
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-03-25', 7)).toBe('2026-04-01');
    expect(addDays('2026-12-20', 15)).toBe('2027-01-04');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-04-01', 0)).toBe('2026-04-01');
  });

  it('reads the local calendar date', () => {
    expect(localIsoDate(new Date(2026, 8, 5, 23, 59))).toBe('2026-09-05');
  });
});
