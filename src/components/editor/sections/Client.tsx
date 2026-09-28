import { type Dispatch, useMemo } from 'react';
import { COUNTRY_CODES, countryName } from '../../../lib/invoice/countries';
import { Section, Select, TextArea, TextInput } from '../fields';
import type { Action, EditorState } from '../state';
import { gstinFeedback, STATE_OPTIONS } from './Business';

export default function Client({ state, dispatch }: { state: EditorState; dispatch: Dispatch<Action> }) {
  const c = state.invoice.client;
  const set = (patch: Partial<typeof c>) => dispatch({ type: 'client', patch });
  const countries = useMemo(
    () => [
      { value: 'IN', label: 'India' },
      ...COUNTRY_CODES.filter((code) => code !== 'IN').map((code) => ({
        value: code,
        label: countryName(code),
      })),
    ],
    [],
  );
  const india = c.country === 'IN';
  const gst = gstinFeedback(c.gstin);
  return (
    <Section title="Client">
      {state.clients.length > 0 && (
        <Select
          label="Saved clients"
          value={state.clientId ?? ''}
          options={[
            { value: '', label: 'New client' },
            ...state.clients.map((x) => ({ value: x.id, label: x.name })),
          ]}
          onChange={(id) =>
            dispatch({ type: 'pickClient', client: state.clients.find((x) => x.id === id) ?? null })
          }
        />
      )}
      <TextInput label="Client name" value={c.name} onChange={(name) => set({ name })} />
      <Select
        label="Country"
        value={c.country}
        options={countries}
        onChange={(country) => set({ country })}
      />
      {india && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Client's state"
            value={c.stateCode}
            options={STATE_OPTIONS}
            onChange={(stateCode) => set({ stateCode })}
          />
          <TextInput
            label="Client GSTIN (if registered)"
            value={c.gstin}
            onChange={(gstin) => set({ gstin })}
            uppercase
            maxLength={15}
            hint={c.gstin ? gst.hint : undefined}
            error={gst.error}
          />
        </div>
      )}
      <TextArea label="Client address" value={c.address} onChange={(address) => set({ address })} rows={2} />
      <TextInput
        label="Client email (optional)"
        type="email"
        value={c.email}
        onChange={(email) => set({ email })}
      />
    </Section>
  );
}
