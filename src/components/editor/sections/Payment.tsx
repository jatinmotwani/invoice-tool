import type { Dispatch } from 'react';
import type { TaxContext } from '../../../lib/invoice/tax-mode';
import { isValidVpa } from '../../../lib/invoice/upi';
import { Section, TextInput } from '../fields';
import type { Action, EditorState } from '../state';

export default function Payment({
  state,
  dispatch,
  tax,
  upiWarning,
}: {
  state: EditorState;
  dispatch: Dispatch<Action>;
  tax: TaxContext;
  upiWarning: string | null;
}) {
  const inv = state.invoice;
  const b = inv.bank;
  const set = (patch: Partial<typeof b>) => dispatch({ type: 'bank', patch });
  const vpaError = inv.upiVpa && !isValidVpa(inv.upiVpa) ? 'A UPI ID looks like name@bank' : null;
  return (
    <Section title="How you get paid" description="Saved on this device for your next invoice.">
      {inv.currency === 'INR' && (
        <TextInput
          label="UPI ID"
          value={inv.upiVpa}
          onChange={(vpa) => dispatch({ type: 'upi', vpa: vpa.trim() })}
          placeholder="yourname@okaxis"
          error={vpaError}
          hint={upiWarning ?? 'Adds a “scan to pay” QR code with the exact amount.'}
          inputMode="email"
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Account name"
          value={b.accountName}
          onChange={(accountName) => set({ accountName })}
        />
        <TextInput
          label="Account number"
          value={b.accountNumber}
          onChange={(accountNumber) => set({ accountNumber })}
          inputMode="numeric"
        />
        <TextInput label="IFSC" value={b.ifsc} onChange={(ifsc) => set({ ifsc })} uppercase maxLength={11} />
        <TextInput label="Bank name" value={b.bankName} onChange={(bankName) => set({ bankName })} />
        {tax.isExport && (
          <>
            <TextInput
              label="SWIFT / BIC"
              value={b.swift}
              onChange={(swift) => set({ swift })}
              uppercase
              maxLength={11}
            />
            <TextInput label="IBAN (if any)" value={b.iban} onChange={(iban) => set({ iban })} uppercase />
            <TextInput
              label="Routing number (if any)"
              value={b.routing}
              onChange={(routing) => set({ routing })}
            />
          </>
        )}
      </div>
    </Section>
  );
}
