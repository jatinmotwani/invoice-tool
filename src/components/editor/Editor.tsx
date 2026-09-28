import { useEffect, useMemo, useState } from 'react';
import { getDb } from '../../lib/db/db';
import { getMeta, setMeta } from '../../lib/db/repo';
import { duplicateInvoice, newInvoice } from '../../lib/invoice/factory';
import { localIsoDate } from '../../lib/invoice/format';
import type { Invoice } from '../../lib/invoice/schema';
import { shareMessage, whatsappUrl } from '../../lib/invoice/share';
import { buildInvoiceView } from '../../lib/invoice/view';
import InvoicePreview from '../preview/InvoicePreview';
import { saveBlob } from './download';
import { Button } from './fields';
import { ISSUE_TEXT, MODE_SUMMARY } from './messages';
import Adjustments from './sections/Adjustments';
import Appearance from './sections/Appearance';
import Business from './sections/Business';
import Client from './sections/Client';
import Details from './sections/Details';
import Extras from './sections/Extras';
import Items from './sections/Items';
import Payment from './sections/Payment';
import YourData, { BACKUP_NUDGE_EVERY, exportBackup, useBackupStatus } from './sections/YourData';
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
  const [pdfState, setPdfState] = useState<'idle' | 'working' | 'error'>('idle');
  /** Set when sharing needs one more tap (gesture expired) or when falling back to WhatsApp. */
  const [shareReady, setShareReady] = useState<{ file: File; text: string; native: boolean } | null>(null);
  const view = useMemo(() => buildInvoiceView(state.invoice, { brandName }), [state.invoice, brandName]);
  const { tax } = view;
  const [backup, refreshBackup] = useBackupStatus(state.savedRev);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const showNudge = ready && !loadError && !nudgeDismissed && backup.sinceBackup >= BACKUP_NUDGE_EVERY;

  // Warm the (large, lazy) PDF chunk once the user has saved something, so the first download is quick.
  useEffect(() => {
    if (status !== 'saved') return;
    const warm = () => void import('../pdf/render').catch(() => undefined);
    if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 5000 });
    else setTimeout(warm, 2000);
  }, [status]);

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

  async function makePdf(): Promise<{ blob: Blob; name: string }> {
    const { renderInvoicePdf, pdfFileName } = await import('../pdf/render');
    const blob = await renderInvoicePdf(view, state.profile.appearance);
    return { blob, name: pdfFileName(view) };
  }

  async function countDownload() {
    try {
      const db = getDb();
      await setMeta(db, 'downloads', ((await getMeta(db, 'downloads')) ?? 0) + 1);
    } catch {
      // storage unavailable
    }
  }

  async function downloadPdf() {
    setPdfState('working');
    try {
      void flush();
      const { blob, name } = await makePdf();
      saveBlob(blob, name);
      setPdfState('idle');
      void countDownload();
    } catch (err) {
      console.warn('PDF failed', err);
      setPdfState('error');
    }
  }

  async function shareNow(file: File, text: string): Promise<void> {
    try {
      await navigator.share({ files: [file], title: file.name, text });
      setShareReady(null);
      void countDownload();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // user closed the share sheet
      // The tap "expired" while the PDF was being made: ask for one more tap.
      setShareReady({ file, text, native: true });
    }
  }

  async function share() {
    setPdfState('working');
    setShareReady(null);
    try {
      void flush();
      const { blob, name } = await makePdf();
      const file = new File([blob], name, { type: 'application/pdf' });
      const text = shareMessage(view);
      setPdfState('idle');
      if (navigator.canShare?.({ files: [file] })) {
        await shareNow(file, text);
      } else {
        // No file sharing (most desktops): save the PDF and offer WhatsApp with a prefilled message.
        saveBlob(blob, name);
        void countDownload();
        setShareReady({ file, text, native: false });
      }
    } catch (err) {
      console.warn('Share failed', err);
      setPdfState('error');
    }
  }

  function existingNumbers() {
    return [
      ...state.saved.filter((s) => s.id !== state.invoice.id),
      ...(state.rev > 0 || state.saved.some((s) => s.id === state.invoice.id)
        ? [{ id: state.invoice.id, number: state.invoice.number, date: state.invoice.date }]
        : []),
    ];
  }

  function duplicate() {
    void replaceWith(
      duplicateInvoice(state.invoice, {
        profile: state.profile,
        existing: existingNumbers(),
        today: localIsoDate(),
        now: new Date().toISOString(),
        newId: () => crypto.randomUUID(),
      }),
    );
  }

  function startNew() {
    void replaceWith(
      newInvoice({
        profile: state.profile,
        existing: existingNumbers(),
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
          {showNudge && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
            >
              <p className="flex-1">
                You’ve made {backup.sinceBackup} invoices since your last backup. They’re stored only on this
                device.
              </p>
              <Button
                onClick={() =>
                  void exportBackup(flush)
                    .then(refreshBackup)
                    .catch(() => undefined)
                }
              >
                Export backup
              </Button>
              <Button variant="ghost" onClick={() => setNudgeDismissed(true)} ariaLabel="Remind me later">
                Later
              </Button>
            </div>
          )}
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
            <Appearance state={state} dispatch={dispatch} />
            {!loadError && <YourData status={backup} refresh={refreshBackup} flush={flush} />}
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
        {shareReady && (
          <div
            role="status"
            className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-950"
          >
            {shareReady.native ? (
              <>
                <span>Your PDF is ready.</span>
                <Button variant="primary" onClick={() => void shareNow(shareReady.file, shareReady.text)}>
                  Share PDF
                </Button>
              </>
            ) : (
              <>
                <span>PDF downloaded. Send it on WhatsApp and attach the file:</span>
                <a
                  href={whatsappUrl(shareReady.text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-md bg-green-700 px-4 font-medium text-white hover:bg-green-800 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                >
                  Open WhatsApp
                </a>
              </>
            )}
            <Button variant="ghost" onClick={() => setShareReady(null)} ariaLabel="Dismiss">
              ✕
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={() => void downloadPdf()}
            disabled={!ready || pdfState === 'working'}
          >
            {pdfState === 'working' ? 'Preparing PDF…' : 'Download PDF'}
          </Button>
          <Button onClick={() => void share()} disabled={!ready || pdfState === 'working'}>
            Share
          </Button>
          <Button onClick={() => window.print()} disabled={!ready}>
            Print
          </Button>
          <Button onClick={duplicate} disabled={!ready}>
            Duplicate
          </Button>
          <Button onClick={startNew} disabled={!ready}>
            New
          </Button>
          <p className="ml-auto text-sm text-slate-600" aria-live="polite">
            {pdfState === 'error'
              ? 'Couldn’t make the PDF. Try Print → Save as PDF.'
              : loadError
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
