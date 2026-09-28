import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, countryName } from './countries';
import { CURRENCY_CODES, isCurrencyCode } from './currencies';
import { isPlausibleSac, SAC_SEEDS } from './sac';
import { TDS_PRESET_RATES } from './tds';

describe('reference data', () => {
  it('seeds the SAC codes from the spec', () => {
    expect(SAC_SEEDS.map((s) => s.code)).toEqual([
      '998314',
      '998313',
      '998391',
      '998383',
      '998395',
      '998361',
    ]);
    expect(SAC_SEEDS.every((s) => isPlausibleSac(s.code))).toBe(true);
    expect(isPlausibleSac('99-83')).toBe(false);
  });

  it('has TDS presets of 10% (professional) and 2% (technical)', () => {
    expect(TDS_PRESET_RATES.professional.rate).toBe(1000);
    expect(TDS_PRESET_RATES.technical.rate).toBe(200);
  });

  it('supports the export currencies from the spec', () => {
    expect(CURRENCY_CODES).toEqual(['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED']);
    expect(isCurrencyCode('USD')).toBe(true);
    expect(isCurrencyCode('JPY')).toBe(false);
  });

  it('names countries and falls back to the code', () => {
    expect(COUNTRY_CODES).toContain('US');
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect(countryName('GB')).toBe('United Kingdom');
    expect(countryName('not-a-region')).toBe('not-a-region');
    const names = COUNTRY_CODES.map(countryName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en'))); // listed alphabetically
  });
});
