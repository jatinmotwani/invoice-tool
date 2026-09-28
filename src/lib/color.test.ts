import { describe, expect, it } from 'vitest';
import { AA, contrastWithWhite } from './color';
import { ACCENTS } from '../components/editor/sections/Appearance';

describe('contrastWithWhite', () => {
  it('matches known WCAG ratios', () => {
    expect(contrastWithWhite('#000000')).toBeCloseTo(21, 1);
    expect(contrastWithWhite('#ffffff')).toBeCloseTo(1, 5);
    expect(contrastWithWhite('#767676')).toBeCloseTo(4.54, 1);
  });

  it('keeps every preset accent at AA or better', () => {
    for (const a of ACCENTS) expect(contrastWithWhite(a.value)).toBeGreaterThanOrEqual(AA);
  });

  it('rejects malformed colours', () => {
    expect(() => contrastWithWhite('blue')).toThrow(RangeError);
  });
});
