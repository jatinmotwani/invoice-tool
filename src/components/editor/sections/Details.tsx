import type { Dispatch } from 'react';
import { CURRENCIES, CURRENCY_CODES } from '../../../lib/invoice/currencies';
import { parseScaledDecimal } from '../../../lib/invoice/money';
import { financialYear, isDuplicateNumber, validateInvoiceNumber } from '../../../lib/invoice/numbering';
import { PAYMENT_TERMS } from '../../../lib/invoice/constants';
import { SELECTABLE_STATES } from '../../../lib/invoice/states';
import type { TaxContext } from '../../../lib/invoice/tax-mode';
import { TERMS } from '../../../lib/invoice/terms';
import { Section, Segmented, Select, TextInput } from '../fields';
import type { Action, EditorState } from '../state';

const NUMBER_ERRORS = {
  empty: 'Enter an invoice number.',
  too_long: 'Invoice numbers can have at most 16 characters (GST rule).',
  invalid_chars: 'Use only letters, numbers, “-” and “/”.',
} as const;

export default function Details({
  state,
  dispatch,
  tax,
}: {
  state: EditorState;
  dispatch: Dispatch<Action>;
  tax: TaxContext;
}) {
  const inv = state.invoice;
  const numberError = validateInvoiceNumber(inv.number);
  const duplicate = !numberError && isDuplicateNumber(inv, state.saved);
  const foreign = tax.isExport;
  const rateInvalid = inv.exchange.rate.trim() !== '' && !(parseScaledDecimal(inv.exchange.rate, 6) ?? 0n);

  return (
    <Section title="Invoice details">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Invoice number"
          value={inv.number}
          onChange={(number) => dispatch({ type: 'invoice', patch: { number } })}
          maxLength={16}
          error={
            numberError
              ? NUMBER_ERRORS[numberError]
              : duplicate
                ? 'You already used this number this financial year.'
                : null
          }
          hint={`Must be unique in FY ${inv.date ? financialYear(inv.date).label : ''}.`}
        />
        <TextInput
          label="Invoice date"
          type="date"
          value={inv.date}
          onChange={(date) => date && dispatch({ type: 'invoice', patch: { date } })}
        />
        <Select
          label="Payment terms"
          value={inv.terms}
          options={PAYMENT_TERMS.map((t) => ({ value: t, label: TERMS[t].label }))}
          onChange={(terms) => dispatch({ type: 'invoice', patch: { terms } })}
        />
        <TextInput
          label="Due date"
          type="date"
          value={inv.dueDate}
          onChange={(dueDate) => dueDate && dispatch({ type: 'invoice', patch: { dueDate } })}
        />
      </div>

      {foreign && (
        <Select
          label="Currency"
          value={inv.currency}
          options={CURRENCY_CODES.filter((c) => c !== 'INR').map((c) => ({
            value: c,
            label: `${c} (${CURRENCIES[c].symbol.trim()})`,
          }))}
          onChange={(currency) => dispatch({ type: 'invoice', patch: { currency } })}
        />
      )}

      {tax.lutAvailable && (
        <>
          <Segmented
            legend="GST on this export"
            value={inv.lut.enabled ? 'lut' : 'igst'}
            options={[
              { value: 'lut', label: 'Under LUT (0%)' },
              { value: 'igst', label: 'Pay IGST' },
            ]}
            onChange={(v) => dispatch({ type: 'lut', patch: { enabled: v === 'lut' } })}
          />
          {inv.lut.enabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="LUT ARN"
                value={inv.lut.arn}
                onChange={(arn) => dispatch({ type: 'lut', patch: { arn } })}
                uppercase
                maxLength={30}
                hint="Acknowledgement number from the GST portal."
              />
              <TextInput
                label="LUT financial year"
                value={inv.lut.fy}
                onChange={(fy) => dispatch({ type: 'lut', patch: { fy } })}
                placeholder={financialYear(inv.date).label}
                maxLength={9}
              />
            </div>
          )}
        </>
      )}

      {foreign && (
        <div className="grid gap-3 sm:grid-cols-3">
          <TextInput
            label={`Exchange rate (₹ per ${inv.currency})`}
            value={inv.exchange.rate}
            onChange={(rate) => dispatch({ type: 'exchange', patch: { rate } })}
            inputMode="decimal"
            placeholder="e.g. 83.25"
            error={rateInvalid ? 'Enter a number like 83.25' : null}
            hint={tax.registered ? 'Needed to report the INR value.' : 'Optional: shows the INR value.'}
          />
          <TextInput
            label="Rate source"
            value={inv.exchange.source}
            onChange={(source) => dispatch({ type: 'exchange', patch: { source } })}
            placeholder="e.g. RBI reference rate"
          />
          <TextInput
            label="Rate date"
            type="date"
            value={inv.exchange.date}
            onChange={(date) => dispatch({ type: 'exchange', patch: { date } })}
          />
        </div>
      )}

      {tax.registered && !foreign && (
        <Select
          label="Place of supply"
          value={inv.posOverride}
          options={[
            { value: '', label: 'Client’s state (usual)' },
            ...SELECTABLE_STATES.map((s) => ({ value: s.code, label: `${s.code} - ${s.name}` })),
          ]}
          onChange={(posOverride) => dispatch({ type: 'invoice', patch: { posOverride } })}
          hint="Change only if your CA says the place of supply is different."
        />
      )}
    </Section>
  );
}
