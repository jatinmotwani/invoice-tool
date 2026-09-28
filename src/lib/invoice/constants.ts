/** Plain constants shared by schemas and UI. Kept free of zod so the editor bundle doesn't pull it in. */
export const SCHEMA_VERSION = 1;
export const UNITS = ['hour', 'day', 'project', 'word', 'month'] as const;
export const PAYMENT_TERMS = ['receipt', 'net7', 'net15', 'net30'] as const;
export const TDS_PRESETS = ['professional', 'technical', 'custom'] as const;
export const INVOICE_STATUSES = ['draft', 'sent', 'paid'] as const;
export const TEMPLATES = ['classic', 'modern'] as const;
export const DEFAULT_ACCENT = '#1d4ed8';

export type Unit = (typeof UNITS)[number];
export type PaymentTerms = (typeof PAYMENT_TERMS)[number];
export type TdsPreset = (typeof TDS_PRESETS)[number];
export type Template = (typeof TEMPLATES)[number];
