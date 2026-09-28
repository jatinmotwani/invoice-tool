import { describe, expect, it } from 'vitest';
import { divRoundHalfUp } from './rounding';

describe('divRoundHalfUp', () => {
  it('rounds exact halves up', () => {
    expect(divRoundHalfUp(5n, 2n)).toBe(3n);
    expect(divRoundHalfUp(15n, 10n)).toBe(2n);
    expect(divRoundHalfUp(25n, 10n)).toBe(3n); // not banker's rounding
  });

  it('rounds below half down and above half up', () => {
    expect(divRoundHalfUp(14n, 10n)).toBe(1n);
    expect(divRoundHalfUp(16n, 10n)).toBe(2n);
    expect(divRoundHalfUp(1n, 3n)).toBe(0n);
    expect(divRoundHalfUp(2n, 3n)).toBe(1n);
  });

  it('returns exact quotients unchanged', () => {
    expect(divRoundHalfUp(0n, 7n)).toBe(0n);
    expect(divRoundHalfUp(100n, 10n)).toBe(10n);
  });

  it('rounds negatives half away from zero', () => {
    expect(divRoundHalfUp(-5n, 2n)).toBe(-3n);
    expect(divRoundHalfUp(5n, -2n)).toBe(-3n);
    expect(divRoundHalfUp(-14n, 10n)).toBe(-1n);
  });

  it('rejects division by zero', () => {
    expect(() => divRoundHalfUp(1n, 0n)).toThrow(RangeError);
  });
});
