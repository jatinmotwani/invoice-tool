import { describe, expect, it } from 'vitest';
import { amountInWords, indianNumberWords, internationalNumberWords } from './words';

describe('amountInWords — INR (Indian system)', () => {
  it.each([
    [0, 'Rupees Zero Only'],
    [50, 'Fifty Paise Only'], // ₹0.50
    [1, 'One Paisa Only'],
    [9999, 'Rupees Ninety-Nine and Ninety-Nine Paise Only'], // ₹99.99
    [100, 'Rupee One Only'],
    [10000000, 'Rupees One Lakh Only'], // ₹1,00,000
    [
      1234567850,
      'Rupees One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight and Fifty Paise Only',
    ],
    [10000000000, 'Rupees Ten Crore Only'],
    [125000000000, 'Rupees One Hundred Twenty-Five Crore Only'],
    [12500000000, 'Rupees Twelve Crore Fifty Lakh Only'],
    [
      98765432109876,
      'Rupees Ninety-Eight Thousand Seven Hundred Sixty-Five Crore Forty-Three Lakh Twenty-One Thousand Ninety-Eight and Seventy-Six Paise Only',
    ],
    [100000000000000, 'Rupees One Lakh Crore Only'],
    [11800000, 'Rupees One Lakh Eighteen Thousand Only'],
    [101001, 'Rupees One Thousand Ten and One Paisa Only'],
  ])('%i paise → %s', (paise, words) => {
    expect(amountInWords(paise, 'INR')).toBe(words);
  });
});

describe('amountInWords — foreign currencies (international system)', () => {
  it.each([
    [123456, 'USD', 'One Thousand Two Hundred Thirty-Four US Dollars and Fifty-Six Cents Only'],
    [1, 'USD', 'One Cent Only'],
    [99, 'USD', 'Ninety-Nine Cents Only'],
    [100, 'USD', 'One US Dollar Only'],
    [0, 'USD', 'Zero US Dollars Only'],
    [100000000, 'USD', 'One Million US Dollars Only'],
    [
      123456789012,
      'EUR',
      'One Billion Two Hundred Thirty-Four Million Five Hundred Sixty-Seven Thousand Eight Hundred Ninety Euros and Twelve Cents Only',
    ],
    [1, 'GBP', 'One Penny Only'],
    [250005, 'GBP', 'Two Thousand Five Hundred Pounds Sterling and Five Pence Only'],
    [110, 'AED', 'One UAE Dirham and Ten Fils Only'],
    [50000, 'AUD', 'Five Hundred Australian Dollars Only'],
  ] as const)('%i %s → %s', (minor, currency, words) => {
    expect(amountInWords(minor, currency)).toBe(words);
  });
});

describe('number words', () => {
  it('covers teens, tens and hundreds', () => {
    expect(indianNumberWords(11n)).toBe('Eleven');
    expect(indianNumberWords(20n)).toBe('Twenty');
    expect(indianNumberWords(105n)).toBe('One Hundred Five');
    expect(indianNumberWords(100100n)).toBe('One Lakh One Hundred');
    expect(internationalNumberWords(1000001n)).toBe('One Million One');
  });

  it('rejects negative or fractional amounts', () => {
    expect(() => amountInWords(-1, 'INR')).toThrow(RangeError);
    expect(() => amountInWords(1.5, 'INR')).toThrow(RangeError);
  });
});
