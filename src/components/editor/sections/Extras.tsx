import type { Dispatch } from 'react';
import { Section, Segmented, Select, TextArea, TextInput, Toggle } from '../fields';
import type { Action, EditorState } from '../state';

export default function Extras({
  state,
  dispatch,
  brandName,
}: {
  state: EditorState;
  dispatch: Dispatch<Action>;
  brandName: string;
}) {
  const inv = state.invoice;
  const series = state.profile.series;
  return (
    <Section title="Notes and extras">
      <TextArea
        label="Notes / terms"
        value={inv.notes}
        onChange={(notes) => dispatch({ type: 'invoice', patch: { notes } })}
        rows={3}
        placeholder="e.g. Thank you for your business!"
      />
      <TextInput
        label="Udyam registration number (optional)"
        value={inv.supplier.udyam}
        onChange={(udyam) => dispatch({ type: 'supplier', patch: { udyam } })}
        uppercase
        placeholder="UDYAM-XX-00-0000000"
      />
      {inv.supplier.udyam.trim() && (
        <Toggle
          label="Add the MSME 45-day payment note"
          checked={inv.msme45Days}
          onChange={(msme45Days) => dispatch({ type: 'invoice', patch: { msme45Days } })}
          hint="Prints “Payable within 45 days as per MSMED Act, 2006”."
        />
      )}
      <Toggle
        label={`Show “Made free with ${brandName}” in the footer`}
        checked={inv.footerCredit}
        onChange={(footerCredit) => dispatch({ type: 'invoice', patch: { footerCredit } })}
      />
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-blue-800">
          Invoice numbering
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <TextInput
            label="Prefix"
            value={series.prefix}
            onChange={(prefix) =>
              dispatch({ type: 'series', patch: { prefix: prefix.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) } })
            }
            uppercase
          />
          <Segmented
            legend="Separator"
            value={series.separator}
            options={[
              { value: '/', label: '/' },
              { value: '-', label: '-' },
            ]}
            onChange={(separator) => dispatch({ type: 'series', patch: { separator } })}
          />
          <Select
            label="Digits"
            value={String(series.padding)}
            options={['1', '2', '3', '4', '5', '6'].map((v) => ({ value: v, label: v }))}
            onChange={(v) => dispatch({ type: 'series', patch: { padding: Number(v) } })}
          />
          <Toggle
            label="Include financial year (e.g. 26-27)"
            checked={series.includeFy}
            onChange={(includeFy) => dispatch({ type: 'series', patch: { includeFy } })}
          />
        </div>
      </details>
    </Section>
  );
}
