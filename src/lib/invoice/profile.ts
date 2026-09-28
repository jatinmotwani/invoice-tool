import * as z from 'zod/mini';
import { CURRENCY_CODES } from './currencies';
import { DEFAULT_SERIES } from './numbering';
import { BankSchema, ClientSchema, PAYMENT_TERMS, SupplierSchema, UNITS } from './schema';

const text = (max: number) => z.string().check(z.maxLength(max));

export const TEMPLATES = ['classic', 'modern'] as const;
export type Template = (typeof TEMPLATES)[number];
export const DEFAULT_ACCENT = '#1d4ed8';

/** The freelancer's saved business details and defaults (one per device). */
export const ProfileSchema = z.object({
  id: z.literal('default'),
  supplier: SupplierSchema,
  bank: BankSchema,
  upiVpa: text(100),
  series: z.object({
    prefix: z.string().check(z.regex(/^[A-Za-z0-9]{0,8}$/)),
    separator: z.enum(['/', '-']),
    includeFy: z.boolean(),
    padding: z.int().check(z.minimum(1), z.maximum(6)),
  }),
  defaults: z.object({
    gstRate: z.int().check(z.minimum(0), z.maximum(10_000)),
    terms: z.enum(PAYMENT_TERMS),
    unit: z.enum(UNITS),
    currency: z.enum(CURRENCY_CODES),
    notes: text(2000),
    msme45Days: z.boolean(),
    footerCredit: z.boolean(),
    roundOff: z.boolean(),
  }),
  appearance: z.object({
    template: z.enum(TEMPLATES),
    accent: z.string().check(z.regex(/^#[0-9a-fA-F]{6}$/)),
    /** PNG/JPEG data URLs, resized client-side to ≤ 200 KB. */
    logo: text(300_000),
    signature: text(300_000),
  }),
  updatedAt: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ClientRecordSchema = z.object({ ...ClientSchema.shape, id: text(64), updatedAt: z.string() });
export type ClientRecord = z.infer<typeof ClientRecordSchema>;

export function defaultProfile(now: string): Profile {
  return {
    id: 'default',
    supplier: { name: '', address: '', email: '', phone: '', gstin: '', pan: '', stateCode: '', udyam: '' },
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
    series: { ...DEFAULT_SERIES },
    defaults: {
      gstRate: 1800, // spec default; editable per line
      terms: 'net15',
      unit: 'project',
      currency: 'INR',
      notes: '',
      msme45Days: false,
      footerCredit: true,
      roundOff: false,
    },
    appearance: { template: 'classic', accent: DEFAULT_ACCENT, logo: '', signature: '' },
    updatedAt: now,
  };
}
