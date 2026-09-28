import type { Dispatch } from 'react';
import { parseAmount, parsePercent } from '../../../lib/invoice/money';
import type { TdsPreset } from '../../../lib/invoice/schema';
import { TDS_PRESETS } from '../../../lib/invoice/constants';
import type { TaxContext } from '../../../lib/invoice/tax-mode';
import { TDS_PRESET_RATES } from '../../../lib/invoice/tds';
import { DecimalInput, Section, Select, Toggle } from '../fields';
import type { Action, EditorState } from '../state';

const PRESET_OPTIONS = TDS_PRESETS.map((p) => ({
  value: p,
  label: p === 'custom' ? 'Custom rate' : TDS_PRESET_RATES[p].label,
}));

export default function Adjustments({
  state,
  dispatch,
  tax,
}: {
  state: EditorState;
  dispatch: Dispatch<Action>;
  tax: TaxContext;
}) {
  const inv = state.invoice;
  const inr = inv.currency === 'INR';
  const setPreset = (preset: TdsPreset) =>
    dispatch({
      type: 'tds',
      patch: preset === 'custom' ? { preset } : { preset, rate: TDS_PRESET_RATES[preset].rate },
    });

  return (
    <Section title="TDS, advance and rounding">
      {!tax.isExport && (
        <>
          <Toggle
            label="TDS"
            checked={inv.tds.enabled}
            onChange={(enabled) => dispatch({ type: 'tds', patch: { enabled } })}
            hint="If your client deducts TDS, show it so the amount they pay you is right."
          />
          {inv.tds.enabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="TDS type" value={inv.tds.preset} options={PRESET_OPTIONS} onChange={setPreset} />
              {inv.tds.preset === 'custom' && (
                <DecimalInput
                  label="TDS rate"
                  value={inv.tds.rate}
                  digits={2}
                  parse={parsePercent}
                  suffix="%"
                  onChange={(rate) => dispatch({ type: 'tds', patch: { rate } })}
                />
              )}
            </div>
          )}
        </>
      )}
      <DecimalInput
        label="Advance received"
        value={inv.advance}
        digits={2}
        parse={parseAmount}
        onChange={(advance) => dispatch({ type: 'invoice', patch: { advance } })}
        placeholder="0"
        className="sm:w-1/2"
      />
      {inr && (
        <Toggle
          label="Round off total to the nearest rupee"
          checked={inv.roundOff}
          onChange={(roundOff) => dispatch({ type: 'invoice', patch: { roundOff } })}
        />
      )}
    </Section>
  );
}
