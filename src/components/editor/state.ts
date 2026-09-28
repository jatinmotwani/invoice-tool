import { dueDateFor } from '../../lib/invoice/terms';
import { validateGstin } from '../../lib/invoice/gstin';
import {
  financialYear,
  nextInvoiceNumber,
  type NumberedInvoice,
  type Series,
} from '../../lib/invoice/numbering';
import type { ClientRecord, Profile } from '../../lib/invoice/profile';
import type { Bank, Client, Invoice, Line, Supplier } from '../../lib/invoice/schema';

export type Preset = 'default' | 'non-gst' | 'gst' | 'export';

export interface EditorState {
  profile: Profile;
  invoice: Invoice;
  /** Saved client this invoice's client details belong to (created on first save). */
  clientId: string | null;
  clients: ClientRecord[];
  /** Other saved invoices, for numbering and duplicate checks. */
  saved: NumberedInvoice[];
  /** "Registered under GST?" toggle; a GSTIN is only asked for when true. */
  registered: boolean;
  /** Number follows the series automatically until the user edits it. */
  numberAuto: boolean;
  /** Edit counter; `rev > savedRev` means there are unsaved edits. */
  rev: number;
  savedRev: number;
}

export const isDirty = (s: EditorState) => s.rev > s.savedRev;

export type InvoicePatch = Partial<
  Pick<
    Invoice,
    | 'number'
    | 'date'
    | 'terms'
    | 'dueDate'
    | 'currency'
    | 'notes'
    | 'roundOff'
    | 'advance'
    | 'posOverride'
    | 'msme45Days'
    | 'footerCredit'
    | 'status'
    | 'paidOn'
  >
>;

export type Action =
  | { type: 'loaded'; state: EditorState }
  | { type: 'registered'; value: boolean }
  | { type: 'supplier'; patch: Partial<Supplier> }
  | { type: 'client'; patch: Partial<Client> }
  | { type: 'pickClient'; client: ClientRecord | null }
  | { type: 'invoice'; patch: InvoicePatch }
  | { type: 'lut'; patch: Partial<Invoice['lut']> }
  | { type: 'exchange'; patch: Partial<Invoice['exchange']> }
  | { type: 'tds'; patch: Partial<Invoice['tds']> }
  | { type: 'bank'; patch: Partial<Bank> }
  | { type: 'upi'; vpa: string }
  | { type: 'line'; id: string; patch: Partial<Line> }
  | { type: 'addLine'; line: Line }
  | { type: 'removeLine'; id: string }
  | { type: 'moveLine'; id: string; delta: -1 | 1 }
  | { type: 'appearance'; patch: Partial<Profile['appearance']> }
  | { type: 'series'; patch: Partial<Series> }
  | { type: 'replaceInvoice'; invoice: Invoice; clientId: string | null }
  | { type: 'saved'; rev: number; invoice: NumberedInvoice; client: ClientRecord | null };

function withInvoice(state: EditorState, invoice: Invoice): EditorState {
  return { ...state, invoice, rev: state.rev + 1 };
}

function withProfile(state: EditorState, patch: Partial<Profile>): Profile {
  return { ...state.profile, ...patch };
}

/** Fill state (and PAN if empty) from a valid GSTIN. */
function deriveFromGstin<T extends { gstin: string; stateCode: string }>(party: T, withPan: boolean): T {
  const g = validateGstin(party.gstin);
  if (!g.valid) return party;
  const next = { ...party, stateCode: g.stateCode };
  if (withPan && 'pan' in next && !next.pan) return { ...next, pan: g.pan };
  return next;
}

function renumber(state: EditorState, invoice: Invoice): Invoice {
  if (!state.numberAuto) return invoice;
  const others = state.saved.filter((s) => s.id !== invoice.id);
  return { ...invoice, number: nextInvoiceNumber(state.profile.series, invoice.date, others) };
}

export function reducer(state: EditorState, action: Action): EditorState {
  const inv = state.invoice;
  switch (action.type) {
    case 'loaded':
      return action.state;

    case 'registered': {
      const supplier = action.value ? inv.supplier : { ...inv.supplier, gstin: '' };
      return {
        ...withInvoice(state, {
          ...inv,
          supplier,
          lut: action.value ? inv.lut : { ...inv.lut, enabled: false },
        }),
        profile: withProfile(state, { supplier: { ...state.profile.supplier, gstin: supplier.gstin } }),
        registered: action.value,
      };
    }

    case 'supplier': {
      const supplier = deriveFromGstin({ ...inv.supplier, ...action.patch }, true);
      return { ...withInvoice(state, { ...inv, supplier }), profile: withProfile(state, { supplier }) };
    }

    case 'client': {
      const wasForeign = inv.client.country !== 'IN';
      const client = deriveFromGstin({ ...inv.client, ...action.patch }, false);
      const foreign = client.country !== 'IN';
      let next: Invoice = { ...inv, client };
      if (foreign !== wasForeign) {
        next = {
          ...next,
          currency: foreign ? (inv.currency === 'INR' ? 'USD' : inv.currency) : 'INR',
          // Most freelancers export services under LUT; they can switch to paying IGST.
          lut: { ...inv.lut, enabled: foreign && state.registered },
          posOverride: '',
        };
      }
      return withInvoice(state, next);
    }

    case 'pickClient': {
      const c = action.client;
      const client: Client = c
        ? {
            name: c.name,
            address: c.address,
            email: c.email,
            phone: c.phone,
            gstin: c.gstin,
            country: c.country,
            stateCode: c.stateCode,
          }
        : { name: '', address: '', email: '', phone: '', gstin: '', country: 'IN', stateCode: '' };
      const reset = reducer(
        { ...state, invoice: { ...inv, client: { ...inv.client, country: 'IN' } } },
        { type: 'client', patch: client },
      );
      return { ...reset, clientId: c?.id ?? null };
    }

    case 'invoice': {
      const patch = action.patch;
      let next: Invoice = { ...inv, ...patch };
      let numberAuto = state.numberAuto;
      if (patch.number !== undefined) numberAuto = false;
      if (patch.date !== undefined || patch.terms !== undefined) {
        if (patch.dueDate === undefined) next = { ...next, dueDate: dueDateFor(next.date, next.terms) };
      }
      if (patch.date !== undefined && financialYear(patch.date).start !== financialYear(inv.date).start) {
        next = renumber({ ...state, numberAuto }, next);
      }
      const defaults = { ...state.profile.defaults };
      if (patch.footerCredit !== undefined) defaults.footerCredit = patch.footerCredit;
      if (patch.msme45Days !== undefined) defaults.msme45Days = patch.msme45Days;
      if (patch.roundOff !== undefined) defaults.roundOff = patch.roundOff;
      if (patch.notes !== undefined) defaults.notes = patch.notes;
      if (patch.terms !== undefined) defaults.terms = patch.terms;
      return { ...withInvoice(state, next), numberAuto, profile: withProfile(state, { defaults }) };
    }

    case 'lut':
      return withInvoice(state, { ...inv, lut: { ...inv.lut, ...action.patch } });
    case 'exchange':
      return withInvoice(state, { ...inv, exchange: { ...inv.exchange, ...action.patch } });
    case 'tds':
      return withInvoice(state, { ...inv, tds: { ...inv.tds, ...action.patch } });

    case 'bank': {
      const bank = { ...inv.bank, ...action.patch };
      return { ...withInvoice(state, { ...inv, bank }), profile: withProfile(state, { bank }) };
    }
    case 'upi':
      return {
        ...withInvoice(state, { ...inv, upiVpa: action.vpa }),
        profile: withProfile(state, { upiVpa: action.vpa }),
      };

    case 'line': {
      const lines = inv.lines.map((l) => (l.id === action.id ? { ...l, ...action.patch } : l));
      const profile =
        action.patch.gstRate !== undefined || action.patch.unit !== undefined
          ? withProfile(state, {
              defaults: {
                ...state.profile.defaults,
                ...(action.patch.gstRate !== undefined ? { gstRate: action.patch.gstRate } : {}),
                ...(action.patch.unit !== undefined ? { unit: action.patch.unit } : {}),
              },
            })
          : state.profile;
      return { ...withInvoice(state, { ...inv, lines }), profile };
    }
    case 'addLine':
      return withInvoice(state, { ...inv, lines: [...inv.lines, action.line] });
    case 'removeLine':
      return withInvoice(state, { ...inv, lines: inv.lines.filter((l) => l.id !== action.id) });
    case 'moveLine': {
      const i = inv.lines.findIndex((l) => l.id === action.id);
      const j = i + action.delta;
      if (i < 0 || j < 0 || j >= inv.lines.length) return state;
      const lines = [...inv.lines];
      [lines[i], lines[j]] = [lines[j] as Line, lines[i] as Line];
      return withInvoice(state, { ...inv, lines });
    }

    case 'appearance':
      return {
        ...state,
        rev: state.rev + 1,
        profile: withProfile(state, { appearance: { ...state.profile.appearance, ...action.patch } }),
      };

    case 'series': {
      const profile = withProfile(state, { series: { ...state.profile.series, ...action.patch } });
      const next = { ...state, profile, numberAuto: true };
      return { ...next, invoice: renumber(next, inv), rev: state.rev + 1 };
    }

    case 'replaceInvoice':
      return {
        ...state,
        invoice: action.invoice,
        clientId: action.clientId,
        numberAuto: true,
        savedRev: state.rev,
        registered: action.invoice.supplier.gstin !== '' || state.registered,
      };

    case 'saved': {
      const saved = [...state.saved.filter((s) => s.id !== action.invoice.id), action.invoice];
      const clients = action.client
        ? [...state.clients.filter((c) => c.id !== action.client?.id), action.client].sort((a, b) =>
            a.name.localeCompare(b.name),
          )
        : state.clients;
      return {
        ...state,
        saved,
        clients,
        clientId: action.client?.id ?? state.clientId,
        savedRev: Math.max(state.savedRev, action.rev),
      };
    }
  }
}

/** Initial state for a first-time visitor: presets only shape the blank invoice. */
export function applyPreset(state: EditorState, preset: Preset): EditorState {
  switch (preset) {
    case 'gst':
      return { ...state, registered: true };
    case 'export': {
      const registered = { ...state, registered: true };
      return reducer(registered, { type: 'client', patch: { country: 'US' } });
    }
    default:
      return state;
  }
}
