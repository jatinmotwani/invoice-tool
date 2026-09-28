/**
 * GST state/UT codes (first two digits of a GSTIN).
 * Source: GSTN state code master — TODO(verify) against the official list on gst.gov.in / cbic-gst.gov.in.
 *
 * `utgst: true` marks Union territories *without* a legislature, where UTGST replaces SGST on intra-UT supplies.
 * Source: CGST Act, 2017 s.2(114) (definition of "Union territory") and UTGST Act, 2017 —
 * https://cbic-gst.gov.in/gst-acts.html — TODO(verify). Delhi (07), Puducherry (34) and Jammu & Kashmir (01)
 * have legislatures and levy SGST.
 */
export interface State {
  code: string;
  name: string;
  utgst: boolean;
  /** Codes that still decode from old GSTINs but can't be picked for new invoices. */
  legacy?: true;
}

export const STATES: readonly State[] = [
  { code: '01', name: 'Jammu and Kashmir', utgst: false },
  { code: '02', name: 'Himachal Pradesh', utgst: false },
  { code: '03', name: 'Punjab', utgst: false },
  { code: '04', name: 'Chandigarh', utgst: true },
  { code: '05', name: 'Uttarakhand', utgst: false },
  { code: '06', name: 'Haryana', utgst: false },
  { code: '07', name: 'Delhi', utgst: false },
  { code: '08', name: 'Rajasthan', utgst: false },
  { code: '09', name: 'Uttar Pradesh', utgst: false },
  { code: '10', name: 'Bihar', utgst: false },
  { code: '11', name: 'Sikkim', utgst: false },
  { code: '12', name: 'Arunachal Pradesh', utgst: false },
  { code: '13', name: 'Nagaland', utgst: false },
  { code: '14', name: 'Manipur', utgst: false },
  { code: '15', name: 'Mizoram', utgst: false },
  { code: '16', name: 'Tripura', utgst: false },
  { code: '17', name: 'Meghalaya', utgst: false },
  { code: '18', name: 'Assam', utgst: false },
  { code: '19', name: 'West Bengal', utgst: false },
  { code: '20', name: 'Jharkhand', utgst: false },
  { code: '21', name: 'Odisha', utgst: false },
  { code: '22', name: 'Chhattisgarh', utgst: false },
  { code: '23', name: 'Madhya Pradesh', utgst: false },
  { code: '24', name: 'Gujarat', utgst: false },
  // Pre-2020 code for Daman and Diu, before the merger into 26. TODO(verify): still valid on old GSTINs? UTGST?
  { code: '25', name: 'Daman and Diu', utgst: true, legacy: true },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu', utgst: true },
  { code: '27', name: 'Maharashtra', utgst: false },
  // Pre-2014 Andhra Pradesh. TODO(verify): whether any live GSTIN uses 28.
  { code: '28', name: 'Andhra Pradesh (old)', utgst: false, legacy: true },
  { code: '29', name: 'Karnataka', utgst: false },
  { code: '30', name: 'Goa', utgst: false },
  { code: '31', name: 'Lakshadweep', utgst: true },
  { code: '32', name: 'Kerala', utgst: false },
  { code: '33', name: 'Tamil Nadu', utgst: false },
  { code: '34', name: 'Puducherry', utgst: false },
  { code: '35', name: 'Andaman and Nicobar Islands', utgst: true },
  { code: '36', name: 'Telangana', utgst: false },
  { code: '37', name: 'Andhra Pradesh', utgst: false },
  { code: '38', name: 'Ladakh', utgst: true },
  // "Other Territory" (e.g. offshore areas). TODO(verify) UTGST treatment; not offered in pickers.
  { code: '97', name: 'Other Territory', utgst: true, legacy: true },
];

/** Place of supply for exports. Label per GST practice — TODO(verify) exact wording on the GST portal. */
export const FOREIGN_POS = { code: '96', name: 'Other Countries' } as const;

const BY_CODE = new Map(STATES.map((s) => [s.code, s]));

export function stateByCode(code: string): State | undefined {
  return BY_CODE.get(code);
}

/** States and UTs a user can pick, alphabetically. */
export const SELECTABLE_STATES: readonly State[] = STATES.filter((s) => !s.legacy).toSorted((a, b) =>
  a.name.localeCompare(b.name),
);

/** "27 - Maharashtra" */
export function placeOfSupplyLabel(code: string): string {
  if (code === FOREIGN_POS.code) return `${FOREIGN_POS.code} - ${FOREIGN_POS.name}`;
  const state = stateByCode(code);
  return state ? `${state.code} - ${state.name}` : code;
}
