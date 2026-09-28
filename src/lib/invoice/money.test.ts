import { describe, expect, it } from 'vitest';
import { convert, mulQtyRate, parseAmount, parsePercent, parseQuantity, percentOf, sum } from './money';

describe('mulQtyRate', () => {
  it('multiplies milli-quantities by minor-unit rates', () => {
    expect(mulQtyRate(1000, 150000)).toBe(150000); // 1 × ₹1,500
    expect(mulQtyRate(1500, 200000)).toBe(300000); // 1.5 h × ₹2,000
    expect(mulQtyRate(1250000, 150)).toBe(187500); // 1,250 words × ₹1.50
  });

  it('rounds fractional paise half-up', () => {
    expect(mulQtyRate(333, 100)).toBe(33); // 0.333 × ₹1 = 33.3 paise
    expect(mulQtyRate(1005, 10)).toBe(10); // 10.05 paise → 10
    expect(mulQtyRate(1050, 10)).toBe(11); // 10.5 paise → 11
  });

  it('rejects non-integers', () => {
    expect(() => mulQtyRate(1.5, 100)).toThrow(RangeError);
  });
});

describe('percentOf', () => {
  it('computes tax on a taxable value', () => {
    expect(percentOf(1000000, 1800)).toBe(180000); // 18% of ₹10,000
    expect(percentOf(1000000, 1800, 2)).toBe(90000); // CGST 9%
  });

  it('rounds half-up to the paisa', () => {
    expect(percentOf(333, 1800)).toBe(60); // 59.94 → 60
    expect(percentOf(25, 1800, 2)).toBe(2); // 2.25 → 2
    expect(percentOf(250, 100)).toBe(3); // 2.5 → 3
  });

  it('supports sub-percent rates', () => {
    expect(percentOf(1000000, 25, 2)).toBe(1250); // 0.125%
  });
});

describe('convert', () => {
  it('converts cents to paise with a decimal exchange rate', () => {
    expect(convert(100000, '83.25')).toBe(8325000); // $1,000 → ₹83,250
    expect(convert(1, '83.2549')).toBe(83); // 1 cent → 83.25 paise → 83
    expect(convert(2, '83.2549')).toBe(167); // 166.51 → 167
  });

  it('rejects zero, negative or malformed rates', () => {
    expect(() => convert(100, '0')).toThrow(RangeError);
    expect(() => convert(100, '-1')).toThrow(RangeError);
    expect(() => convert(100, 'abc')).toThrow(RangeError);
    expect(() => convert(100, '1.1234567')).toThrow(RangeError);
  });
});

describe('parsing user input', () => {
  it('parses amounts with Indian or international grouping', () => {
    expect(parseAmount('1,23,456.78')).toBe(12345678);
    expect(parseAmount('123,456.7')).toBe(12345670);
    expect(parseAmount('1500')).toBe(150000);
    expect(parseAmount('.5')).toBe(50);
    expect(parseAmount(' 2 000 ')).toBe(200000);
  });

  it('rejects malformed amounts', () => {
    for (const bad of ['', '.', 'abc', '1.234', '-5', '1e5', '1.2.3']) expect(parseAmount(bad)).toBeNull();
  });

  it('parses quantities to thousandths and percents to basis points', () => {
    expect(parseQuantity('1.5')).toBe(1500);
    expect(parseQuantity('0.125')).toBe(125);
    expect(parseQuantity('1.2345')).toBeNull();
    expect(parsePercent('18')).toBe(1800);
    expect(parsePercent('0.25')).toBe(25);
    expect(parsePercent('2.5')).toBe(250);
  });

  it('sums minor units', () => {
    expect(sum([100, 250, 5])).toBe(355);
    expect(sum([])).toBe(0);
  });
});
