import { addDays } from './format';
import type { PaymentTerms } from './schema';

export const TERMS: Record<PaymentTerms, { label: string; days: number }> = {
  receipt: { label: 'Due on receipt', days: 0 },
  net7: { label: 'Net 7', days: 7 },
  net15: { label: 'Net 15', days: 15 },
  net30: { label: 'Net 30', days: 30 },
};

export function dueDateFor(invoiceDate: string, terms: PaymentTerms): string {
  return addDays(invoiceDate, TERMS[terms].days);
}
