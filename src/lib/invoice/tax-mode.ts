import { validateGstin } from './gstin';
import type { Client, Supplier } from './schema';
import { FOREIGN_POS, stateByCode } from './states';

export type TaxMode = 'NON_GST' | 'INTRA' | 'INTER' | 'EXPORT_LUT' | 'EXPORT_IGST';
export type TaxKind = 'none' | 'cgst_sgst' | 'cgst_utgst' | 'igst';

export type TaxIssue =
  /** Supplier GSTIN typed but invalid: tax is still computed, but the invoice isn't valid. */
  | 'SUPPLIER_GSTIN_INVALID'
  /** Neither GSTIN nor a picked state tells us the supplier's state. */
  | 'SUPPLIER_STATE_MISSING'
  | 'CLIENT_GSTIN_INVALID'
  /** Picked client state differs from the client's GSTIN; the GSTIN wins. */
  | 'CLIENT_STATE_MISMATCH'
  /** Indian client without a state: place of supply falls back to the supplier's state. */
  | 'CLIENT_STATE_MISSING'
  | 'LUT_ARN_MISSING';

/**
 * Rule 46 endorsements for exports. Wording as quoted from CGST Rules, 2017, Rule 46 (as substituted by
 * Notification 38/2023-CT). TODO(verify) against
 * https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter6/rule46_v1.00.html
 */
export const ENDORSEMENT_LUT =
  'SUPPLY MEANT FOR EXPORT/SUPPLY TO SEZ UNIT OR SEZ DEVELOPER FOR AUTHORISED OPERATIONS UNDER BOND OR LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX';
export const ENDORSEMENT_IGST =
  'SUPPLY MEANT FOR EXPORT/SUPPLY TO SEZ UNIT OR SEZ DEVELOPER FOR AUTHORISED OPERATIONS ON PAYMENT OF INTEGRATED TAX';

export interface TaxModeInput {
  supplier: Pick<Supplier, 'gstin' | 'stateCode'>;
  client: Pick<Client, 'gstin' | 'country' | 'stateCode'>;
  /** Manual place-of-supply state code ('' = client's state). Domestic only. */
  posOverride: string;
  lut: { enabled: boolean; arn: string };
}

export interface TaxContext {
  mode: TaxMode;
  title: 'Invoice' | 'Tax Invoice';
  registered: boolean;
  /** Client is outside India. */
  isExport: boolean;
  taxKind: TaxKind;
  supplierStateCode: string | null;
  clientStateCode: string | null;
  /** State code, "96" for exports, null when not GST-registered. */
  placeOfSupply: string | null;
  endorsement: string | null;
  /** LUT needs a GSTIN, so the option is only offered to registered suppliers exporting. */
  lutAvailable: boolean;
  /** Rule 46 asks whether tax is payable on reverse charge; always "No" for our supplies. */
  reverseCharge: 'No' | null;
  issues: TaxIssue[];
}

const known = (code: string) => (code && stateByCode(code) ? code : null);

/**
 * Decide how GST applies to an invoice.
 * Place of supply for domestic services is the recipient's location, falling back to the supplier's location
 * when the recipient's address isn't on record: IGST Act, 2017 s.12(2) — TODO(verify) at
 * https://cbic-gst.gov.in/gst-acts.html. Special place-of-supply rules (events, immovable property, …) are
 * out of scope; users can override the place of supply.
 */
export function resolveTaxMode(input: TaxModeInput): TaxContext {
  const issues: TaxIssue[] = [];
  const registered = input.supplier.gstin.trim() !== '';
  const isExport = input.client.country !== 'IN';

  const supplierGstin = registered ? validateGstin(input.supplier.gstin) : null;
  if (supplierGstin && !supplierGstin.valid) issues.push('SUPPLIER_GSTIN_INVALID');
  const supplierStateCode = supplierGstin?.valid ? supplierGstin.stateCode : known(input.supplier.stateCode);

  let clientStateCode: string | null = null;
  if (!isExport) {
    const clientGstin = input.client.gstin.trim() ? validateGstin(input.client.gstin) : null;
    if (clientGstin && !clientGstin.valid) issues.push('CLIENT_GSTIN_INVALID');
    const picked = known(input.client.stateCode);
    if (clientGstin?.valid) {
      clientStateCode = clientGstin.stateCode;
      if (picked && picked !== clientStateCode) issues.push('CLIENT_STATE_MISMATCH');
    } else {
      clientStateCode = picked;
    }
  }

  const base = {
    registered,
    isExport,
    supplierStateCode,
    clientStateCode,
    lutAvailable: registered && isExport,
    issues,
  };

  if (!registered) {
    return {
      ...base,
      mode: 'NON_GST',
      title: 'Invoice',
      taxKind: 'none',
      placeOfSupply: null,
      endorsement: null,
      reverseCharge: null,
    };
  }

  if (!supplierStateCode) issues.push('SUPPLIER_STATE_MISSING');

  if (isExport) {
    const lut = input.lut.enabled;
    if (lut && !input.lut.arn.trim()) issues.push('LUT_ARN_MISSING');
    return {
      ...base,
      mode: lut ? 'EXPORT_LUT' : 'EXPORT_IGST',
      title: 'Tax Invoice',
      taxKind: 'igst',
      placeOfSupply: FOREIGN_POS.code,
      endorsement: lut ? ENDORSEMENT_LUT : ENDORSEMENT_IGST,
      reverseCharge: 'No',
    };
  }

  if (!clientStateCode) issues.push('CLIENT_STATE_MISSING');
  const placeOfSupply = known(input.posOverride) ?? clientStateCode ?? supplierStateCode;
  const intra = placeOfSupply !== null && placeOfSupply === supplierStateCode;
  const utgst = intra && stateByCode(placeOfSupply)?.utgst === true;

  return {
    ...base,
    mode: intra ? 'INTRA' : 'INTER',
    title: 'Tax Invoice',
    taxKind: intra ? (utgst ? 'cgst_utgst' : 'cgst_sgst') : 'igst',
    placeOfSupply,
    endorsement: null,
    reverseCharge: 'No',
  };
}
