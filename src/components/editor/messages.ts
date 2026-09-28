import type { TaxIssue, TaxMode } from '../../lib/invoice/tax-mode';
import type { TotalsIssue } from '../../lib/invoice/totals';

export const MODE_SUMMARY: Record<TaxMode, string> = {
  NON_GST: 'Not GST-registered: a plain invoice without GST.',
  INTRA: 'Client in your state: CGST + SGST.',
  INTER: 'Client in another state: IGST.',
  EXPORT_LUT: 'Export under LUT: IGST at 0%.',
  EXPORT_IGST: 'Export paying IGST (you can claim a refund).',
};

export const ISSUE_TEXT: Record<TaxIssue | TotalsIssue, string> = {
  SUPPLIER_GSTIN_INVALID: 'Your GSTIN doesn’t look right. Check it before sending.',
  SUPPLIER_STATE_MISSING: 'Add your GSTIN so we know your state.',
  CLIENT_GSTIN_INVALID: 'The client’s GSTIN doesn’t look right.',
  CLIENT_STATE_MISMATCH: 'The client’s state doesn’t match their GSTIN. We used the GSTIN’s state.',
  CLIENT_STATE_MISSING: 'Pick the client’s state. Until then we assume it’s the same as yours.',
  LUT_ARN_MISSING: 'Add your LUT ARN (from the GST portal).',
  DISCOUNT_EXCEEDS_AMOUNT: 'A discount is larger than its line amount.',
  EXCHANGE_RATE_MISSING: 'Add the exchange rate so the invoice shows the INR value.',
  NET_NEGATIVE: 'Deductions are more than the invoice total.',
};
