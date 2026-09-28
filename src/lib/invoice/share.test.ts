import { describe, expect, it } from 'vitest';
import { sampleInvoice } from './fixtures';
import { shareMessage, whatsappUrl } from './share';
import { buildInvoiceView } from './view';

describe('shareMessage', () => {
  it('includes number, amount due, due date and the UPI link', () => {
    const view = buildInvoiceView(sampleInvoice({ upiVpa: 'asha@okaxis' }), { brandName: 'X' });
    expect(shareMessage(view)).toBe(
      [
        'Hi Acme Pvt Ltd,',
        'Please find invoice INV/26-27/001 for ₹50,000.00, due on 13 Oct 2026.',
        'Pay by UPI to asha@okaxis: upi://pay?pa=asha%40okaxis&pn=Asha%20Rao&am=50000.00&cu=INR&tn=INV%2F26-27%2F001',
        'Thank you!',
        'Asha Rao',
      ].join('\n'),
    );
  });

  it('works without a client name or UPI', () => {
    const base = sampleInvoice();
    const view = buildInvoiceView(sampleInvoice({ client: { ...base.client, name: '' } }), {
      brandName: 'X',
    });
    expect(shareMessage(view).startsWith('Hi,\n')).toBe(true);
    expect(shareMessage(view)).not.toContain('UPI');
  });

  it('builds a wa.me link with the encoded message', () => {
    expect(whatsappUrl('Hi & bye\n₹5')).toBe('https://wa.me/?text=Hi%20%26%20bye%0A%E2%82%B95');
  });
});
