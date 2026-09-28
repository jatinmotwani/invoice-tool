export const CURRENCY_CODES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED'] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export interface Currency {
  code: CurrencyCode;
  /** Prefix shown before amounts. Non-USD dollars are disambiguated (A$, C$, S$). */
  symbol: string;
  minorDigits: 2;
  /** Digit grouping: Indian (1,23,456) for INR, international (123,456) for the rest. */
  grouping: 'indian' | 'international';
  major: { one: string; many: string };
  minor: { one: string; many: string };
}

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    minorDigits: 2,
    grouping: 'indian',
    major: { one: 'Rupee', many: 'Rupees' },
    minor: { one: 'Paisa', many: 'Paise' },
  },
  USD: {
    code: 'USD',
    symbol: '$',
    minorDigits: 2,
    grouping: 'international',
    major: { one: 'US Dollar', many: 'US Dollars' },
    minor: { one: 'Cent', many: 'Cents' },
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    minorDigits: 2,
    grouping: 'international',
    major: { one: 'Euro', many: 'Euros' },
    minor: { one: 'Cent', many: 'Cents' },
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    minorDigits: 2,
    grouping: 'international',
    major: { one: 'Pound Sterling', many: 'Pounds Sterling' },
    minor: { one: 'Penny', many: 'Pence' },
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    minorDigits: 2,
    grouping: 'international',
    major: { one: 'Australian Dollar', many: 'Australian Dollars' },
    minor: { one: 'Cent', many: 'Cents' },
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    minorDigits: 2,
    grouping: 'international',
    major: { one: 'Canadian Dollar', many: 'Canadian Dollars' },
    minor: { one: 'Cent', many: 'Cents' },
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    minorDigits: 2,
    grouping: 'international',
    major: { one: 'Singapore Dollar', many: 'Singapore Dollars' },
    minor: { one: 'Cent', many: 'Cents' },
  },
  AED: {
    code: 'AED',
    symbol: 'AED ',
    minorDigits: 2,
    grouping: 'international',
    major: { one: 'UAE Dirham', many: 'UAE Dirhams' },
    minor: { one: 'Fils', many: 'Fils' },
  },
};

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(value);
}
