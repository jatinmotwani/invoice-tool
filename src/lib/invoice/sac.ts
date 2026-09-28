/**
 * Seed list for the SAC picker; users can also type any code.
 * Descriptions per the CBIC "Classification Scheme for Services under GST" — TODO(verify) every row against
 * https://cbic-gst.gov.in/pdf/Classification%20Scheme%20for%20Services%20under%20GST.xlsx
 */
export const SAC_SEEDS = [
  { code: '998314', description: 'Information technology (IT) design and development services' },
  { code: '998313', description: 'Information technology (IT) consulting and support services' },
  {
    code: '998391',
    description: 'Specialty design services, including interior, fashion and industrial design',
  },
  { code: '998383', description: 'Event photography and event videography services' },
  { code: '998395', description: 'Translation and interpretation services' },
  { code: '998361', description: 'Advertising services' },
] as const;

/** SAC codes are numeric; services codes start with 99. We only check the shape. */
export function isPlausibleSac(code: string): boolean {
  return /^\d{4,8}$/.test(code);
}
