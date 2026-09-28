import { type Dispatch, useId } from 'react';
import { CURRENCIES } from '../../../lib/invoice/currencies';
import { newLine } from '../../../lib/invoice/factory';
import { parseAmount, parsePercent, parseQuantity } from '../../../lib/invoice/money';
import { SAC_SEEDS } from '../../../lib/invoice/sac';
import { UNITS } from '../../../lib/invoice/constants';
import type { InvoiceView } from '../../../lib/invoice/view';
import { Button, DecimalInput, Section, Segmented, Select, TextArea, TextInput } from '../fields';
import type { Action, EditorState } from '../state';

const UNIT_OPTIONS = UNITS.map((u) => ({ value: u, label: `per ${u}` }));

export default function Items({
  state,
  dispatch,
  view,
}: {
  state: EditorState;
  dispatch: Dispatch<Action>;
  view: InvoiceView;
}) {
  const sacList = useId();
  const inv = state.invoice;
  const symbol = CURRENCIES[inv.currency].symbol.trim();
  const showGst = view.tax.mode === 'INTRA' || view.tax.mode === 'INTER' || view.tax.mode === 'EXPORT_IGST';
  const showSac = view.tax.registered;

  return (
    <Section title="Items">
      <datalist id={sacList}>
        {SAC_SEEDS.map((s) => (
          <option key={s.code} value={s.code}>
            {s.description}
          </option>
        ))}
      </datalist>
      <ol className="space-y-4">
        {inv.lines.map((line, i) => {
          const set = (patch: Partial<typeof line>) => dispatch({ type: 'line', id: line.id, patch });
          const item = view.items[i];
          return (
            <li key={line.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Item {i + 1}</p>
                <p className="text-sm font-semibold text-slate-900" aria-live="polite">
                  {symbol} {item?.amount}
                </p>
              </div>
              <div className="space-y-3">
                <TextArea
                  label="Description"
                  value={line.description}
                  onChange={(description) => set({ description })}
                  rows={2}
                  placeholder="e.g. Logo design, 3 concepts"
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DecimalInput
                    label="Quantity"
                    value={line.qty}
                    digits={3}
                    parse={parseQuantity}
                    onChange={(qty) => set({ qty })}
                  />
                  <Select
                    label="Unit"
                    value={line.unit}
                    options={UNIT_OPTIONS}
                    onChange={(unit) => set({ unit })}
                  />
                  <DecimalInput
                    label="Rate"
                    value={line.rate}
                    digits={2}
                    parse={parseAmount}
                    prefix={symbol.length === 1 ? symbol : undefined}
                    onChange={(rate) => set({ rate })}
                    placeholder="0"
                  />
                  {showGst && (
                    <DecimalInput
                      label="GST rate"
                      value={line.gstRate}
                      digits={2}
                      parse={parsePercent}
                      suffix="%"
                      onChange={(gstRate) => set({ gstRate })}
                    />
                  )}
                </div>
                {showSac && (
                  <TextInput
                    label="SAC code"
                    value={line.sac}
                    onChange={(sac) => set({ sac: sac.replace(/\D/g, '') })}
                    inputMode="numeric"
                    maxLength={8}
                    list={sacList}
                    hint="Service code for GST. Ask your CA if unsure."
                  />
                )}
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-blue-800">
                    Discount
                  </summary>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <Segmented
                      legend="Discount type"
                      value={line.discountType}
                      options={[
                        { value: 'amount', label: symbol },
                        { value: 'percent', label: '%' },
                      ]}
                      onChange={(discountType) => set({ discountType, discount: 0 })}
                    />
                    <DecimalInput
                      label="Discount"
                      className="w-40"
                      value={line.discount}
                      digits={2}
                      parse={line.discountType === 'percent' ? parsePercent : parseAmount}
                      onChange={(discount) => set({ discount })}
                      placeholder="0"
                    />
                  </div>
                </details>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => dispatch({ type: 'moveLine', id: line.id, delta: -1 })}
                    disabled={i === 0}
                    ariaLabel={`Move item ${i + 1} up`}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => dispatch({ type: 'moveLine', id: line.id, delta: 1 })}
                    disabled={i === inv.lines.length - 1}
                    ariaLabel={`Move item ${i + 1} down`}
                  >
                    ↓
                  </Button>
                  {inv.lines.length > 1 && (
                    <Button
                      variant="ghost"
                      onClick={() => dispatch({ type: 'removeLine', id: line.id })}
                      ariaLabel={`Remove item ${i + 1}`}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        onClick={() => dispatch({ type: 'addLine', line: newLine(state.profile, crypto.randomUUID()) })}
      >
        + Add item
      </Button>
    </Section>
  );
}
