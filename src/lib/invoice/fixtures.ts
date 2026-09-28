import type { Invoice, Line } from './schema';
import { SCHEMA_VERSION } from './constants';

/** Test/demo data. Also used by the static sample invoices on content pages. */
export function sampleLine(overrides: Partial<Line> = {}): Line {
  return {
    id: 'l1',
    description: 'Website design',
    sac: '998314',
    qty: 1000,
    unit: 'project',
    rate: 5000000,
    discountType: 'amount',
    discount: 0,
    gstRate: 1800,
    ...overrides,
  };
}

export function sampleInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'inv-1',
    number: 'INV/26-27/001',
    date: '2026-09-28',
    terms: 'net15',
    dueDate: '2026-10-13',
    currency: 'INR',
    supplier: {
      name: 'Asha Rao',
      address: '12 MG Road\nPune 411001',
      email: 'asha@example.com',
      phone: '',
      gstin: '',
      pan: '',
      stateCode: '27',
      udyam: '',
    },
    client: {
      name: 'Acme Pvt Ltd',
      address: '5 Residency Road\nBengaluru 560025',
      email: '',
      phone: '',
      gstin: '',
      country: 'IN',
      stateCode: '29',
    },
    lines: [sampleLine()],
    posOverride: '',
    lut: { enabled: false, arn: '', fy: '' },
    exchange: { rate: '', source: '', date: '' },
    roundOff: false,
    tds: { enabled: false, preset: 'professional', rate: 1000 },
    advance: 0,
    notes: '',
    bank: {
      accountName: '',
      accountNumber: '',
      ifsc: '',
      bankName: '',
      branch: '',
      swift: '',
      iban: '',
      routing: '',
    },
    upiVpa: '',
    msme45Days: false,
    footerCredit: true,
    status: 'draft',
    paidOn: '',
    createdAt: '2026-09-28T10:00:00.000Z',
    updatedAt: '2026-09-28T10:00:00.000Z',
    ...overrides,
  };
}
