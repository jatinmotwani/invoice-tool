import { describe, expect, it } from 'vitest';
import { duplicateInvoice, newInvoice } from './factory';
import { sampleInvoice } from './fixtures';
import { defaultProfile } from './profile';
import { ProfileSchema } from './profile-schema';
import { InvoiceSchema } from './schema';

const NOW = '2026-09-28T10:00:00.000Z';
let n = 0;
const newId = () => `id-${++n}`;

describe('newInvoice', () => {
  const profile = defaultProfile(NOW);

  it('creates a valid draft numbered next in the series', () => {
    const inv = newInvoice({
      profile,
      existing: [{ id: 'x', number: 'INV/26-27/004', date: '2026-05-01' }],
      today: '2026-09-28',
      now: NOW,
      newId,
    });
    expect(inv.number).toBe('INV/26-27/005');
    expect(inv.dueDate).toBe('2026-10-13');
    expect(inv.lines).toHaveLength(1);
    expect(inv.lines[0]?.gstRate).toBe(1800);
    expect(InvoiceSchema.safeParse(inv).success).toBe(true);
  });

  it('prefills a saved client and picks a foreign currency for foreign clients', () => {
    const client = { ...sampleInvoice().client, country: 'US', stateCode: '', id: 'c', updatedAt: NOW };
    const inv = newInvoice({ profile, existing: [], today: '2026-09-28', now: NOW, newId, client });
    expect(inv.client.country).toBe('US');
    expect(inv.currency).toBe('USD');
  });

  it('has a valid default profile', () => {
    expect(ProfileSchema.safeParse(profile).success).toBe(true);
  });
});

describe('duplicateInvoice', () => {
  it('copies content with a new id, number and dates, reset to draft', () => {
    const source = sampleInvoice({ status: 'paid', paidOn: '2026-05-01', advance: 500, date: '2026-04-15' });
    const copy = duplicateInvoice(source, {
      profile: defaultProfile(NOW),
      existing: [{ id: source.id, number: source.number, date: source.date }],
      today: '2026-09-28',
      now: NOW,
      newId,
    });
    expect(copy.id).not.toBe(source.id);
    expect(copy.number).toBe('INV/26-27/002');
    expect(copy).toMatchObject({
      status: 'draft',
      paidOn: '',
      advance: 0,
      date: '2026-09-28',
      dueDate: '2026-10-13',
    });
    expect(copy.lines[0]?.description).toBe(source.lines[0]?.description);
    expect(copy.lines[0]?.id).not.toBe(source.lines[0]?.id);
  });
});
