import { describe, expect, it } from 'vitest';
import { gstinCheckChar, isValidPan, normalizeGstin, validateGstin } from './gstin';
import { placeOfSupplyLabel, SELECTABLE_STATES, stateByCode, STATES } from './states';

/** Real, publicly listed GSTINs — independent vectors for the checksum algorithm. */
const KNOWN_VALID = [
  '27AAPFU0939F1ZV',
  '27AAACR5055K1Z7',
  '07AAGFF2194N1Z1',
  '24AAACC1206D1ZM',
  '09AAACH7409R1ZZ',
];

/** Build a valid GSTIN for a state code (for UT cases). */
const make = (state: string, pan = 'ABCDE1234F') => `${state}${pan}1Z${gstinCheckChar(`${state}${pan}1Z`)}`;

describe('validateGstin', () => {
  it.each(KNOWN_VALID)('accepts %s', (g) => {
    expect(validateGstin(g).valid).toBe(true);
  });

  it('decodes state code, PAN and entity number', () => {
    expect(validateGstin('27AAPFU0939F1ZV')).toEqual({
      valid: true,
      gstin: '27AAPFU0939F1ZV',
      stateCode: '27',
      pan: 'AAPFU0939F',
      entityNumber: '1',
    });
  });

  it('normalises case, spaces and dashes', () => {
    expect(normalizeGstin(' 27aapfu 0939-f1zv ')).toBe('27AAPFU0939F1ZV');
    expect(validateGstin('27aapfu0939f1zv').valid).toBe(true);
  });

  it('rejects a wrong check character', () => {
    const result = validateGstin('27AAPFU0939F1ZW');
    expect(result).toMatchObject({ valid: false, error: 'checksum' });
  });

  it('rejects every single-character typo in the last position', () => {
    const base = '27AAPFU0939F1Z';
    const ok = [...'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter((c) => validateGstin(base + c).valid);
    expect(ok).toEqual(['V']);
  });

  it('rejects bad length, format and state', () => {
    expect(validateGstin('')).toMatchObject({ error: 'empty' });
    expect(validateGstin('27AAPFU0939F1Z')).toMatchObject({ error: 'length' });
    expect(validateGstin('27AAPFU0939F1AV')).toMatchObject({ error: 'format' }); // 14th must be Z
    expect(validateGstin('27AAPFU0939F0ZV')).toMatchObject({ error: 'format' }); // entity 0
    expect(validateGstin(make('39'))).toMatchObject({ error: 'state' });
    expect(validateGstin(make('00'))).toMatchObject({ error: 'state' });
  });

  it('decodes UT codes', () => {
    for (const code of ['04', '26', '31', '35', '38']) {
      const r = validateGstin(make(code));
      expect(r.valid && r.stateCode).toBe(code);
    }
  });
});

describe('PAN', () => {
  it('checks shape', () => {
    expect(isValidPan('AAPFU0939F')).toBe(true);
    expect(isValidPan('aapfu0939f')).toBe(true);
    expect(isValidPan('AAPFU0939')).toBe(false);
    expect(isValidPan('1APFU0939F')).toBe(false);
  });
});

describe('states', () => {
  it('flags exactly the UTs without legislature from the spec as UTGST (plus legacy/other codes)', () => {
    const utgst = STATES.filter((s) => s.utgst && !s.legacy).map((s) => s.code);
    expect(utgst).toEqual(['04', '26', '31', '35', '38']);
  });

  it('levies SGST in Delhi, Puducherry and J&K', () => {
    for (const code of ['01', '07', '34']) expect(stateByCode(code)?.utgst).toBe(false);
  });

  it('offers 36 selectable states/UTs, without legacy codes', () => {
    expect(SELECTABLE_STATES).toHaveLength(36);
    expect(SELECTABLE_STATES.some((s) => s.code === '25' || s.code === '97')).toBe(false);
  });

  it('labels places of supply', () => {
    expect(placeOfSupplyLabel('27')).toBe('27 - Maharashtra');
    expect(placeOfSupplyLabel('96')).toBe('96 - Other Countries');
  });
});
