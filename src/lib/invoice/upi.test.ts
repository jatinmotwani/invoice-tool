import { describe, expect, it } from 'vitest';
import { buildUpiUri, exceedsUpiLimit, isValidVpa, UPI_P2P_LIMIT } from './upi';

describe('buildUpiUri', () => {
  it('builds a payment URI with amount in rupees and INR', () => {
    expect(
      buildUpiUri({ vpa: 'asha@okaxis', payeeName: 'Asha Rao', amount: 1180050, note: 'INV/26-27/001' }),
    ).toBe('upi://pay?pa=asha%40okaxis&pn=Asha%20Rao&am=11800.50&cu=INR&tn=INV%2F26-27%2F001');
  });

  it('percent-encodes names with special characters', () => {
    const uri = buildUpiUri({ vpa: 'a.b@ybl', payeeName: 'R&D Studio #1 · Café', amount: 5, note: '' });
    expect(uri).toBe('upi://pay?pa=a.b%40ybl&pn=R%26D%20Studio%20%231%20%C2%B7%20Caf%C3%A9&am=0.05&cu=INR');
    const params = new URLSearchParams(uri.split('?')[1]);
    expect(params.get('pn')).toBe('R&D Studio #1 · Café');
  });

  it('omits the amount when there is none', () => {
    expect(buildUpiUri({ vpa: 'x@upi', payeeName: 'X', amount: null, note: '' })).toBe(
      'upi://pay?pa=x%40upi&pn=X&cu=INR',
    );
    expect(buildUpiUri({ vpa: 'x@upi', payeeName: 'X', amount: 0, note: '' })).not.toContain('am=');
  });
});

describe('VPA and limits', () => {
  it('checks VPA shape', () => {
    expect(isValidVpa('asha.rao-1@okicici')).toBe(true);
    expect(isValidVpa('9876543210@paytm')).toBe(true);
    expect(isValidVpa('asha')).toBe(false);
    expect(isValidVpa('asha@')).toBe(false);
    expect(isValidVpa('as ha@ybl')).toBe(false);
  });

  it('warns only above ₹1,00,000', () => {
    expect(UPI_P2P_LIMIT).toBe(10_000_000);
    expect(exceedsUpiLimit(10_000_000)).toBe(false);
    expect(exceedsUpiLimit(10_000_001)).toBe(true);
  });
});
