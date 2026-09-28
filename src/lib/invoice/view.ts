import { countryName } from './countries';
import { CURRENCIES, type CurrencyCode } from './currencies';
import { formatAmount, formatDate, formatMoney, formatPercent, formatQuantity } from './format';
import { validateGstin } from './gstin';
import { AUTHORISED_SIGNATORY, MSME_45_DAY_NOTE, NOT_REGISTERED_NOTE } from './legal';
import type { Minor } from './money';
import type { Invoice, Unit } from './schema';
import { placeOfSupplyLabel, stateByCode } from './states';
import { resolveTaxMode, type TaxContext, type TaxIssue } from './tax-mode';
import { TERMS } from './terms';
import { computeTotals, type Totals, type TotalsIssue } from './totals';
import { buildUpiUri, exceedsUpiLimit, isValidVpa } from './upi';
import { amountInWords } from './words';

export interface Field {
  label: string;
  value: string;
}

export interface PartyView {
  heading: string;
  name: string;
  addressLines: string[];
  fields: Field[];
}

export interface ItemView {
  index: number;
  description: string;
  sac: string;
  qty: string;
  unit: string;
  rate: string;
  discount: string;
  gstRate: string;
  amount: string;
}

export interface SummaryRow {
  label: string;
  value: string;
  kind: 'normal' | 'total' | 'deduction' | 'net';
}

export interface InvoiceView {
  title: 'Invoice' | 'Tax Invoice';
  currency: CurrencyCode;
  meta: Field[];
  supplier: PartyView;
  client: PartyView;
  columns: { sac: boolean; discount: boolean; gstRate: boolean };
  /** Column header for money columns, e.g. "Amount (₹)". */
  moneyHeader: string;
  items: ItemView[];
  summary: SummaryRow[];
  /** The figure the words describe (net receivable when deductions exist, else total). */
  amountDue: string;
  amountInWords: string;
  inrEquivalent: string | null;
  endorsement: string | null;
  lut: string | null;
  notes: string[];
  bank: Field[];
  upi: { uri: string; vpa: string; amount: string | null } | null;
  upiWarning: string | null;
  signatory: { forName: string; label: string };
  footerCredit: string | null;
  tax: TaxContext;
  totals: Totals;
  issues: (TaxIssue | TotalsIssue)[];
}

const UNIT_LABELS: Record<Unit, [string, string]> = {
  hour: ['hour', 'hours'],
  day: ['day', 'days'],
  project: ['project', 'projects'],
  word: ['word', 'words'],
  month: ['month', 'months'],
};

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function fields(entries: [string, string][]): Field[] {
  return entries.filter(([, v]) => v.trim() !== '').map(([label, value]) => ({ label, value: value.trim() }));
}

function stateLabel(code: string | null): string {
  const state = code ? stateByCode(code) : undefined;
  return state ? `${state.name} (${state.code})` : '';
}

export interface ViewOptions {
  /** For the optional "Made free with …" footer. */
  brandName: string;
}

/** Everything a renderer (HTML preview, PDF, print) needs, pre-formatted. Renderers never do maths. */
export function buildInvoiceView(invoice: Invoice, options: ViewOptions): InvoiceView {
  const tax = resolveTaxMode(invoice);
  const totals = computeTotals(invoice, tax);
  const cur = invoice.currency;
  const grouping = CURRENCIES[cur].grouping;
  const money = (m: Minor) => formatMoney(m, cur);

  const meta = fields([
    ['Invoice No.', invoice.number],
    ['Invoice Date', formatDate(invoice.date)],
    ['Due Date', `${formatDate(invoice.dueDate)} (${TERMS[invoice.terms].label})`],
    ['Place of Supply', tax.placeOfSupply ? placeOfSupplyLabel(tax.placeOfSupply) : ''],
    ['Reverse Charge', tax.reverseCharge ?? ''],
    ['Currency', cur === 'INR' ? '' : cur],
  ]);

  const s = invoice.supplier;
  const supplierGstin = tax.registered ? validateGstin(s.gstin).gstin : '';
  const supplier: PartyView = {
    heading: 'From',
    name: s.name,
    addressLines: lines(s.address),
    fields: fields([
      ['GSTIN', supplierGstin],
      ['PAN', s.pan.toUpperCase()],
      ['State', stateLabel(tax.supplierStateCode)],
      ['Udyam No.', s.udyam.toUpperCase()],
      ['Email', s.email],
      ['Phone', s.phone],
    ]),
  };

  const c = invoice.client;
  const client: PartyView = {
    heading: 'Bill To',
    name: c.name,
    addressLines: lines(c.address),
    fields: fields([
      ['GSTIN', tax.isExport ? '' : c.gstin.toUpperCase()],
      ['State', tax.isExport ? '' : stateLabel(tax.clientStateCode)],
      ['Country', tax.isExport ? countryName(c.country) : ''],
      ['Email', c.email],
      ['Phone', c.phone],
    ]),
  };

  const gst = tax.mode !== 'NON_GST';
  const items: ItemView[] = invoice.lines.map((line, i) => {
    const t = totals.lines[i];
    const [one, many] = UNIT_LABELS[line.unit];
    return {
      index: i + 1,
      description: line.description,
      sac: line.sac,
      qty: formatQuantity(line.qty, grouping),
      unit: line.qty === 1000 ? one : many,
      rate: formatAmount(line.rate, cur),
      discount: t && t.discount ? formatAmount(t.discount, cur) : '',
      gstRate: t?.gstRate !== null && t?.gstRate !== undefined ? formatPercent(t.gstRate) : '',
      amount: formatAmount(t?.taxable ?? 0, cur),
    };
  });

  const summary: SummaryRow[] = [
    { label: gst ? 'Taxable Value' : 'Subtotal', value: money(totals.subtotal), kind: 'normal' },
  ];
  for (const t of totals.taxLines) {
    summary.push({
      label: `${t.head} @ ${formatPercent(t.rate, t.divisor)}`,
      value: money(t.amount),
      kind: 'normal',
    });
  }
  if (totals.roundOff) {
    summary.push({
      label: 'Round Off',
      value: `${totals.roundOff > 0 ? '+' : '-'}${money(Math.abs(totals.roundOff))}`,
      kind: 'normal',
    });
  }
  summary.push({ label: 'Total', value: money(totals.grandTotal), kind: 'total' });
  const deductions = totals.tds !== null || totals.advance > 0;
  if (totals.tds) {
    summary.push({
      label: `Less: TDS @ ${formatPercent(totals.tds.rate)}`,
      value: `-${money(totals.tds.amount)}`,
      kind: 'deduction',
    });
  }
  if (totals.advance > 0) {
    summary.push({ label: 'Less: Advance Received', value: `-${money(totals.advance)}`, kind: 'deduction' });
  }
  if (deductions) summary.push({ label: 'Net Receivable', value: money(totals.netReceivable), kind: 'net' });

  const due = deductions ? totals.netReceivable : totals.grandTotal;

  const inrEquivalent = totals.inr
    ? [
        `INR equivalent: ${formatMoney(totals.inr.grandTotal, 'INR')} at ₹${totals.inr.rate} per ${cur}`,
        invoice.exchange.source.trim(),
        invoice.exchange.date ? formatDate(invoice.exchange.date) : '',
      ]
        .filter(Boolean)
        .join(', ')
    : null;

  const lut =
    tax.mode === 'EXPORT_LUT' && invoice.lut.arn.trim()
      ? `LUT ARN: ${invoice.lut.arn.trim()}${invoice.lut.fy.trim() ? ` (FY ${invoice.lut.fy.trim()})` : ''}`
      : null;

  const notes = [
    ...(tax.registered ? [] : [NOT_REGISTERED_NOTE]),
    ...(invoice.msme45Days && s.udyam.trim() ? [MSME_45_DAY_NOTE] : []),
    ...lines(invoice.notes),
  ];

  const b = invoice.bank;
  const bank = fields([
    ['Account Name', b.accountName],
    ['Account No.', b.accountNumber],
    ['Bank', [b.bankName, b.branch].filter((x) => x.trim()).join(', ')],
    ['IFSC', b.ifsc.toUpperCase()],
    ['SWIFT/BIC', b.swift.toUpperCase()],
    ['IBAN', b.iban.toUpperCase()],
    ['Routing No.', b.routing],
  ]);

  const upiEligible = cur === 'INR' && isValidVpa(invoice.upiVpa);
  const upiAmount = due > 0 ? due : null;
  const upi = upiEligible
    ? {
        uri: buildUpiUri({ vpa: invoice.upiVpa, payeeName: s.name, amount: upiAmount, note: invoice.number }),
        vpa: invoice.upiVpa.trim(),
        amount: upiAmount === null ? null : money(upiAmount),
      }
    : null;
  const upiWarning =
    upi && upiAmount !== null && exceedsUpiLimit(upiAmount)
      ? 'UPI transfers between individuals are usually capped at ₹1,00,000 a day. For this amount, bank transfer is safer.'
      : null;

  return {
    title: tax.title,
    currency: cur,
    meta,
    supplier,
    client,
    columns: {
      sac: invoice.lines.some((l) => l.sac.trim()),
      discount: totals.discountTotal > 0,
      gstRate: gst,
    },
    moneyHeader: `Amount (${CURRENCIES[cur].symbol.trim()})`,
    items,
    summary,
    amountDue: money(due),
    amountInWords: amountInWords(Math.max(due, 0), cur),
    inrEquivalent,
    endorsement: tax.endorsement,
    lut,
    notes,
    bank,
    upi,
    upiWarning,
    signatory: { forName: s.name, label: AUTHORISED_SIGNATORY },
    footerCredit: invoice.footerCredit ? `Made free with ${options.brandName}` : null,
    tax,
    totals,
    issues: [...tax.issues, ...totals.issues],
  };
}
