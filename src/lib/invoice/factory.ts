import { nextInvoiceNumber, type NumberedInvoice } from './numbering';
import type { ClientRecord, Profile } from './profile';
import { type Client, type Invoice, type Line, SCHEMA_VERSION } from './schema';
import { dueDateFor } from './terms';

export const EMPTY_CLIENT: Client = {
  name: '',
  address: '',
  email: '',
  phone: '',
  gstin: '',
  country: 'IN',
  stateCode: '',
};

export function newLine(profile: Profile, id: string): Line {
  return {
    id,
    description: '',
    sac: '',
    qty: 1000,
    unit: profile.defaults.unit,
    rate: 0,
    discountType: 'amount',
    discount: 0,
    gstRate: profile.defaults.gstRate,
  };
}

export interface NewInvoiceArgs {
  profile: Profile;
  existing: readonly NumberedInvoice[];
  today: string;
  now: string;
  newId: () => string;
  client?: ClientRecord | undefined;
}

/** A fresh draft pre-filled from the saved profile, numbered next in the series for today's FY. */
export function newInvoice({ profile, existing, today, now, newId, client }: NewInvoiceArgs): Invoice {
  const clientFields: Client = client
    ? {
        name: client.name,
        address: client.address,
        email: client.email,
        phone: client.phone,
        gstin: client.gstin,
        country: client.country,
        stateCode: client.stateCode,
      }
    : { ...EMPTY_CLIENT };
  const foreign = clientFields.country !== 'IN';
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    number: nextInvoiceNumber(profile.series, today, existing),
    date: today,
    terms: profile.defaults.terms,
    dueDate: dueDateFor(today, profile.defaults.terms),
    currency: foreign && profile.defaults.currency === 'INR' ? 'USD' : profile.defaults.currency,
    supplier: { ...profile.supplier },
    client: clientFields,
    lines: [newLine(profile, newId())],
    posOverride: '',
    lut: { enabled: false, arn: '', fy: '' },
    exchange: { rate: '', source: '', date: '' },
    roundOff: profile.defaults.roundOff,
    tds: { enabled: false, preset: 'professional', rate: 1000 },
    advance: 0,
    notes: profile.defaults.notes,
    bank: { ...profile.bank },
    upiVpa: profile.upiVpa,
    msme45Days: profile.defaults.msme45Days,
    footerCredit: profile.defaults.footerCredit,
    status: 'draft',
    paidOn: '',
    createdAt: now,
    updatedAt: now,
  };
}

/** Copy an invoice as a new draft: new id and number, today's dates, not paid. */
export function duplicateInvoice(
  source: Invoice,
  { profile, existing, today, now, newId }: Omit<NewInvoiceArgs, 'client'>,
): Invoice {
  return {
    ...structuredClone(source),
    id: newId(),
    number: nextInvoiceNumber(profile.series, today, existing),
    date: today,
    dueDate: dueDateFor(today, source.terms),
    lines: source.lines.map((l) => ({ ...l, id: newId() })),
    advance: 0,
    status: 'draft',
    paidOn: '',
    createdAt: now,
    updatedAt: now,
  };
}
