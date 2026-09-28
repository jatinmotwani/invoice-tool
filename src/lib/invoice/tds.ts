import type { TdsPreset } from './schema';

/**
 * TDS presets for payments to freelancers. From 1 April 2026 the Income-tax Act, 2025 applies: what was
 * section 194J of the 1961 Act is covered by section 393(1) (table of rates).
 * - Fees for professional services: 10%
 * - Fees for technical services: 2%
 * TODO(verify) against the Act's section 393 table on https://www.incometax.gov.in (rates and entry numbers).
 * The base is the value excluding GST when GST is shown separately — CBDT Circular 23/2017 under the 1961 Act;
 * TODO(verify) the equivalent position under the 2025 Act.
 */
export const TDS_PRESET_RATES: Record<Exclude<TdsPreset, 'custom'>, { label: string; rate: number }> = {
  professional: { label: 'Professional services (10%)', rate: 1000 },
  technical: { label: 'Technical services (2%)', rate: 200 },
};
