import type { Dispatch } from 'react';
import { validateGstin } from '../../../lib/invoice/gstin';
import { SELECTABLE_STATES, stateByCode } from '../../../lib/invoice/states';
import { Section, Segmented, Select, TextArea, TextInput } from '../fields';
import type { Action, EditorState } from '../state';

export const STATE_OPTIONS = [
  { value: '', label: 'Select state' },
  ...SELECTABLE_STATES.map((s) => ({ value: s.code, label: s.name })),
];

export function gstinFeedback(value: string): { error: string | null; hint: string } {
  if (!value) return { error: null, hint: '15 characters, e.g. 27ABCDE1234F1Z5' };
  const g = validateGstin(value);
  if (g.valid) return { error: null, hint: `${stateByCode(g.stateCode)?.name} · PAN ${g.pan}` };
  return {
    error: g.gstin.length < 15 ? null : g.message,
    hint: g.gstin.length < 15 ? `${g.gstin.length}/15` : '',
  };
}

export default function Business({ state, dispatch }: { state: EditorState; dispatch: Dispatch<Action> }) {
  const s = state.invoice.supplier;
  const set = (patch: Partial<typeof s>) => dispatch({ type: 'supplier', patch });
  const gst = gstinFeedback(s.gstin);
  return (
    <Section title="Your details" description="Saved on this device for your next invoice.">
      <Segmented
        legend="Registered under GST?"
        value={state.registered ? 'yes' : 'no'}
        options={[
          { value: 'no', label: 'No' },
          { value: 'yes', label: 'Yes' },
        ]}
        onChange={(v) => dispatch({ type: 'registered', value: v === 'yes' })}
      />
      {state.registered ? (
        <TextInput
          label="Your GSTIN"
          value={s.gstin}
          onChange={(gstin) => set({ gstin })}
          uppercase
          maxLength={15}
          hint={gst.hint}
          error={gst.error}
          autoComplete="off"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Your state"
            value={s.stateCode}
            options={STATE_OPTIONS}
            onChange={(stateCode) => set({ stateCode })}
          />
          <TextInput
            label="PAN (optional)"
            value={s.pan}
            onChange={(pan) => set({ pan })}
            uppercase
            maxLength={10}
          />
        </div>
      )}
      <TextInput
        label="Your name or business name"
        value={s.name}
        onChange={(name) => set({ name })}
        autoComplete="organization"
      />
      <TextArea label="Address" value={s.address} onChange={(address) => set({ address })} rows={2} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Email"
          type="email"
          value={s.email}
          onChange={(email) => set({ email })}
          autoComplete="email"
        />
        <TextInput
          label="Phone"
          type="tel"
          value={s.phone}
          onChange={(phone) => set({ phone })}
          autoComplete="tel"
        />
      </div>
    </Section>
  );
}
