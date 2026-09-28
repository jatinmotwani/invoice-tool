import { describe, expect, it } from 'vitest';
import { newInvoice } from '../../lib/invoice/factory';
import { gstinCheckChar } from '../../lib/invoice/gstin';
import { defaultProfile } from '../../lib/invoice/profile';
import { applyPreset, type EditorState, isDirty, reducer } from './state';

const NOW = '2026-09-28T10:00:00.000Z';
const GSTIN = `27ABCDE1234F1Z${gstinCheckChar('27ABCDE1234F1Z')}`;
let n = 0;
const newId = () => `id-${++n}`;

function initial(overrides: Partial<EditorState> = {}): EditorState {
  const profile = defaultProfile(NOW);
  return {
    profile,
    invoice: newInvoice({ profile, existing: [], today: '2026-09-28', now: NOW, newId }),
    clientId: null,
    clients: [],
    saved: [],
    registered: false,
    numberAuto: true,
    rev: 0,
    savedRev: 0,
    ...overrides,
  };
}

describe('editor reducer', () => {
  it('derives state and PAN from a typed GSTIN and remembers supplier details', () => {
    const s = reducer(initial({ registered: true }), {
      type: 'supplier',
      patch: { gstin: GSTIN, name: 'Asha' },
    });
    expect(s.invoice.supplier).toMatchObject({ gstin: GSTIN, stateCode: '27', pan: 'ABCDE1234F' });
    expect(s.profile.supplier.name).toBe('Asha');
    expect(isDirty(s)).toBe(true);
  });

  it('clears the GSTIN and LUT when switching to not registered', () => {
    let s = reducer(initial({ registered: true }), { type: 'supplier', patch: { gstin: GSTIN } });
    s = reducer(s, { type: 'client', patch: { country: 'US' } });
    expect(s.invoice.lut.enabled).toBe(true);
    s = reducer(s, { type: 'registered', value: false });
    expect(s.invoice.supplier.gstin).toBe('');
    expect(s.invoice.lut.enabled).toBe(false);
  });

  it('switches currency with the client country', () => {
    let s = reducer(initial(), { type: 'client', patch: { country: 'GB' } });
    expect(s.invoice.currency).toBe('USD');
    s = reducer(s, { type: 'invoice', patch: { currency: 'GBP' } });
    s = reducer(s, { type: 'client', patch: { country: 'DE' } });
    expect(s.invoice.currency).toBe('GBP');
    s = reducer(s, { type: 'client', patch: { country: 'IN' } });
    expect(s.invoice.currency).toBe('INR');
  });

  it("takes the client's state from their GSTIN", () => {
    const g = `29PQRST6789K1Z${gstinCheckChar('29PQRST6789K1Z')}`;
    const s = reducer(initial(), { type: 'client', patch: { gstin: g } });
    expect(s.invoice.client.stateCode).toBe('29');
  });

  it('recomputes the due date from date and terms', () => {
    let s = reducer(initial(), { type: 'invoice', patch: { terms: 'net30' } });
    expect(s.invoice.dueDate).toBe('2026-10-28');
    s = reducer(s, { type: 'invoice', patch: { date: '2026-10-01' } });
    expect(s.invoice.dueDate).toBe('2026-10-31');
    expect(s.profile.defaults.terms).toBe('net30');
  });

  it('renumbers on an FY change while the number is automatic, not after a manual edit', () => {
    const base = initial({ saved: [{ id: 'x', number: 'INV/25-26/009', date: '2026-03-01' }] });
    let s = reducer(base, { type: 'invoice', patch: { date: '2026-03-31' } });
    expect(s.invoice.number).toBe('INV/25-26/010');
    s = reducer(s, { type: 'invoice', patch: { number: 'MY-1' } });
    s = reducer(s, { type: 'invoice', patch: { date: '2026-04-01' } });
    expect(s.invoice.number).toBe('MY-1');
  });

  it('adds, edits, moves and removes lines and remembers the last GST rate', () => {
    let s = initial();
    const firstLine = s.invoice.lines[0];
    if (!firstLine) throw new Error('expected a line');
    const first = firstLine.id;
    s = reducer(s, { type: 'addLine', line: { ...firstLine, id: 'second' } });
    s = reducer(s, { type: 'line', id: 'second', patch: { description: 'Revisions', gstRate: 500 } });
    s = reducer(s, { type: 'moveLine', id: 'second', delta: -1 });
    expect(s.invoice.lines.map((l) => l.id)).toEqual(['second', first]);
    expect(s.profile.defaults.gstRate).toBe(500);
    expect(reducer(s, { type: 'moveLine', id: 'second', delta: -1 })).toBe(s);
    s = reducer(s, { type: 'removeLine', id: first });
    expect(s.invoice.lines.map((l) => l.description)).toEqual(['Revisions']);
  });

  it('picks a saved client and remembers it after saving', () => {
    const client = {
      name: 'Globex',
      address: '',
      email: '',
      phone: '',
      gstin: '',
      country: 'US',
      stateCode: '',
      id: 'c1',
      updatedAt: NOW,
    };
    let s = reducer(initial({ registered: true }), { type: 'pickClient', client });
    expect(s.clientId).toBe('c1');
    expect(s.invoice.client.name).toBe('Globex');
    expect(s.invoice.currency).toBe('USD');
    s = reducer(s, {
      type: 'saved',
      rev: s.rev,
      invoice: { id: s.invoice.id, number: s.invoice.number, date: s.invoice.date },
      client,
    });
    expect(isDirty(s)).toBe(false);
    expect(s.saved).toHaveLength(1);
    expect(s.clients).toEqual([client]);
    s = reducer(s, { type: 'pickClient', client: null });
    expect(s.clientId).toBeNull();
    expect(s.invoice.client.country).toBe('IN');
  });

  it('keeps bank/UPI/footer preferences in the profile', () => {
    let s = reducer(initial(), { type: 'bank', patch: { ifsc: 'HDFC0000001' } });
    s = reducer(s, { type: 'upi', vpa: 'asha@okaxis' });
    s = reducer(s, { type: 'invoice', patch: { footerCredit: false } });
    expect(s.profile.bank.ifsc).toBe('HDFC0000001');
    expect(s.profile.upiVpa).toBe('asha@okaxis');
    expect(s.profile.defaults.footerCredit).toBe(false);
  });

  it('renumbers when the series changes', () => {
    const s = reducer(initial(), {
      type: 'series',
      patch: { prefix: 'AR', includeFy: false, separator: '-' },
    });
    expect(s.invoice.number).toBe('AR-001');
  });

  it('stays dirty when edits land while a save is in flight', () => {
    let s = reducer(initial(), { type: 'invoice', patch: { notes: 'a' } });
    const savingRev = s.rev;
    s = reducer(s, { type: 'invoice', patch: { notes: 'ab' } });
    s = reducer(s, {
      type: 'saved',
      rev: savingRev,
      invoice: { id: s.invoice.id, number: s.invoice.number, date: s.invoice.date },
      client: null,
    });
    expect(isDirty(s)).toBe(true);
  });

  it('applies presets', () => {
    expect(applyPreset(initial(), 'gst').registered).toBe(true);
    const exp = applyPreset(initial(), 'export');
    expect(exp.invoice.client.country).toBe('US');
    expect(exp.invoice.currency).toBe('USD');
    expect(exp.invoice.lut.enabled).toBe(true);
    expect(applyPreset(initial(), 'non-gst').registered).toBe(false);
  });
});
