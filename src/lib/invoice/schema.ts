import * as z from 'zod/mini';
import { CURRENCY_CODES } from './currencies';
import { parseIsoDate } from './format';

/**
 * The persisted, user-editable invoice document. Money is integer minor units, rates are basis points,
 * quantities are thousandths. Optional text fields are empty strings (simpler forms, no undefined).
 * Bump SCHEMA_VERSION and add a migration in src/lib/db when this shape changes.
 */
export const SCHEMA_VERSION = 1;

const isoDate = z.string().check(z.refine((v) => parseIsoDate(v) !== null, 'Invalid date'));
const minor = z.int().check(z.minimum(0));
const text = (max: number) => z.string().check(z.maxLength(max));

export const UNITS = ['hour', 'day', 'project', 'word', 'month'] as const;
export const PAYMENT_TERMS = ['receipt', 'net7', 'net15', 'net30'] as const;
export const TDS_PRESETS = ['professional', 'technical', 'custom'] as const;
export const INVOICE_STATUSES = ['draft', 'sent', 'paid'] as const;

const party = {
  name: text(200),
  address: text(500),
  email: text(200),
  phone: text(50),
  gstin: text(20),
};

export const SupplierSchema = z.object({
  ...party,
  pan: text(20),
  /** For registered suppliers this follows the GSTIN; unregistered suppliers pick it. */
  stateCode: text(2),
  udyam: text(30),
});

export const ClientSchema = z.object({
  ...party,
  /** ISO 3166-1 alpha-2; "IN" for Indian clients. */
  country: z.string().check(z.regex(/^[A-Z]{2}$/)),
  stateCode: text(2),
});

export const LineSchema = z.object({
  id: text(64),
  description: text(1000),
  sac: text(20),
  qty: minor,
  unit: z.enum(UNITS),
  rate: minor,
  discountType: z.enum(['amount', 'percent']),
  /** Minor units when `amount`, basis points when `percent`. */
  discount: minor,
  gstRate: z.int().check(z.minimum(0), z.maximum(10_000)),
});

export const BankSchema = z.object({
  accountName: text(200),
  accountNumber: text(40),
  ifsc: text(20),
  bankName: text(200),
  branch: text(200),
  swift: text(20),
  iban: text(40),
  routing: text(40),
});

export const InvoiceSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: text(64),
  number: text(16),
  date: isoDate,
  terms: z.enum(PAYMENT_TERMS),
  dueDate: isoDate,
  currency: z.enum(CURRENCY_CODES),
  supplier: SupplierSchema,
  client: ClientSchema,
  lines: z.array(LineSchema).check(z.maxLength(200)),
  /** Manual place-of-supply state code; empty means "client's state". */
  posOverride: text(2),
  lut: z.object({ enabled: z.boolean(), arn: text(30), fy: text(9) }),
  exchange: z.object({ rate: text(20), source: text(200), date: z.union([z.literal(''), isoDate]) }),
  roundOff: z.boolean(),
  tds: z.object({
    enabled: z.boolean(),
    preset: z.enum(TDS_PRESETS),
    rate: z.int().check(z.minimum(0), z.maximum(10_000)),
  }),
  advance: minor,
  notes: text(2000),
  bank: BankSchema,
  upiVpa: text(100),
  msme45Days: z.boolean(),
  footerCredit: z.boolean(),
  status: z.enum(INVOICE_STATUSES),
  paidOn: z.union([z.literal(''), isoDate]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Supplier = z.infer<typeof SupplierSchema>;
export type Client = z.infer<typeof ClientSchema>;
export type Line = z.infer<typeof LineSchema>;
export type Bank = z.infer<typeof BankSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type Unit = (typeof UNITS)[number];
export type PaymentTerms = (typeof PAYMENT_TERMS)[number];
export type TdsPreset = (typeof TDS_PRESETS)[number];
