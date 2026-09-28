import { useMemo, useState } from 'react';
import { getDb } from '../../lib/db/db';
import { setMeta } from '../../lib/db/repo';
import { newInvoice } from '../../lib/invoice/factory';
import { localIsoDate } from '../../lib/invoice/format';
import type { Invoice } from '../../lib/invoice/schema';
import { buildInvoiceView } from '../../lib/invoice/view';
import InvoicePreview from '../preview/InvoicePreview';
import { Button } from './fields';
import { ISSUE_TEXT, MODE_SUMMARY } from './messages';
import Adjustments from './sections/Adjustments';
import Business from './sections/Business';
import Client from './sections/Client';
import Details from './sections/Details';
import Extras from './sections/Extras';
import Items from './sections/Items';
import Payment from './sections/Payment';
import type { Preset } from './state';
import { usePersistentEditor } from './usePersistentEditor';

interface Props {
  preset?: Preset;
  /** Build date, so the server render and first client render match. */
  today: string;
  brandName: string;
}

export default function Editor({ preset = 'default', today, brandName }: Props) {
  const { state, dispatch, ready, status, loadError, flush } = usePersistentEditor(preset, today);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const view = useMemo(() => buildInvoiceView(state.invoice, { brandName }), [state.invoice, brandName]);
  const { tax } = view;

  async function replaceWith(invoice: Invoice) {
    await flush();
    dispatch({ type: 'replaceInvoice', invoice, clientId: null });
    setTab('edit');
    try {
      await setMeta(getDb(), 'currentInvoiceId', invoice.id);
    } catch {
      // storage unavailable: nothing to remember
    }
    window.scrollTo({ top: 0 });
  }

  function startNew() {
    const existing = [
      ...state.saved.filter((s) => s.id !== state.invoice.id),
      ...(state.rev > 0 || state.saved.some((s) => s.id === state.invoice.id)
        ? [{ id: state.invoice.id, number: state.invoice.number, date: state.invoice.date }]
        : []),
    ];
    void replaceWith(
      newInvoice({
        profile: state.profile,
        existing,
        today: localIsoDate(),
        now: new Date().toISOString(),
        newId: () => crypto.randomUUID(),
      }),
    );
  }

  const toggle = (value: 'edit' | 'preview', label: string) => (
    <button
      type="button"
      aria-pressed={tab === value}
      aria-controls={`editor-${value}`}
      onClick={() => setTab(value)}
      className="min-h-11 flex-1 rounded-md text-base font-medium aria-pressed:bg-blue-700 aria-pressed:text-white"
    >
      {label}
    </button>
  );

  return (
    <div className="editor">
      <div className="sticky top-0 z-20 -mx-4 mb-4 flex gap-1 border-b border-slate-200 bg-white/95 p-2 backdrop-blur lg:hidden print:hidden">
        {toggle('edit', 'Edit')}
        {toggle('preview', 'Preview')}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-6">
        <div id="editor-edit" className={`${tab === 'edit' ? '' : 'hidden'} space-y-4 lg:block print:hidden`}>
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"
          >
            <p className="font-medium">
              {view.title}: {MODE_SUMMARY[tax.mode]}
            </p>
            {view.issues.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-amber-900">
                {view.issues.map((issue) => (
                  <li key={issue}>{ISSUE_TEXT[issue]}</li>
                ))}
              </ul>
            )}
          </div>
          {loadError && (
            <p
              role="alert"
              className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
            >
              Your browser is blocking storage (private mode?). You can still make and download an invoice,
              but it won’t be saved on this device.
            </p>
          )}
          <fieldset disabled={!ready} className="space-y-4">
            <legend className="sr-only">Invoice editor</legend>
            <Business state={state} dispatch={dispatch} />
            <Client state={state} dispatch={dispatch} />
            <Details state={state} dispatch={dispatch} tax={tax} />
            <Items state={state} dispatch={dispatch} view={view} />
            <Adjustments state={state} dispatch={dispatch} tax={tax} />
            <Payment state={state} dispatch={dispatch} tax={tax} upiWarning={view.upiWarning} />
            <Extras state={state} dispatch={dispatch} brandName={brandName} />
          </fieldset>
        </div>

        <div id="editor-preview" className={`${tab === 'preview' ? '' : 'hidden'} lg:block print:block`}>
          <div className="lg:sticky lg:top-4">
            <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
              <InvoicePreview view={view} appearance={state.profile.appearance} />
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => window.print()} disabled={!ready}>
            Print / Save as PDF
          </Button>
          <Button onClick={startNew} disabled={!ready}>
            New invoice
          </Button>
          <p className="ml-auto text-sm text-slate-600" aria-live="polite">
            {loadError
              ? 'Not saved (storage blocked)'
              : status === 'saving'
                ? 'Saving…'
                : status === 'saved'
                  ? 'Saved on this device'
                  : status === 'error'
                    ? 'Couldn’t save'
                    : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
