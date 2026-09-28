import { type Dispatch, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { getDb, requestPersistence } from '../../lib/db/db';
import {
  getMeta,
  getProfile,
  listClients,
  listInvoices,
  saveClient,
  saveInvoice,
  saveProfile,
  setMeta,
} from '../../lib/db/repo';
import { newInvoice } from '../../lib/invoice/factory';
import { localIsoDate } from '../../lib/invoice/format';
import { defaultProfile } from '../../lib/invoice/profile';
import { type Action, applyPreset, type EditorState, isDirty, type Preset, reducer } from './state';

const newId = () => crypto.randomUUID();

/** Deterministic state for the server render and the first client render (no clock, no random ids). */
export function initialState(preset: Preset, today: string): EditorState {
  let n = 0;
  const profile = defaultProfile(`${today}T00:00:00.000Z`);
  const invoice = newInvoice({
    profile,
    existing: [],
    today,
    now: `${today}T00:00:00.000Z`,
    newId: () => `ssr-${++n}`,
  });
  const base: EditorState = {
    profile,
    invoice,
    clientId: null,
    clients: [],
    saved: [],
    registered: false,
    numberAuto: true,
    rev: 0,
    savedRev: 0,
  };
  return applyPreset(base, preset);
}

async function load(preset: Preset): Promise<EditorState> {
  const db = getDb();
  const now = new Date().toISOString();
  const today = localIsoDate();
  const [profile, clients, invoices, currentId] = await Promise.all([
    getProfile(db, now),
    listClients(db),
    listInvoices(db),
    getMeta(db, 'currentInvoiceId'),
  ]);
  const saved = invoices.map(({ id, number, date }) => ({ id, number, date }));
  const current = currentId ? invoices.find((i) => i.id === currentId) : undefined;
  const base: EditorState = {
    profile,
    invoice: current ?? newInvoice({ profile, existing: saved, today, now, newId }),
    clientId: current ? (clients.find((c) => c.name === current.client.name)?.id ?? null) : null,
    clients,
    saved,
    registered: (current?.supplier.gstin ?? profile.supplier.gstin) !== '',
    numberAuto: !current,
    rev: 0,
    savedRev: 0,
  };
  // Presets only shape a brand-new visitor's first invoice.
  const firstVisit = !current && invoices.length === 0 && !profile.supplier.name;
  return firstVisit ? applyPreset(base, preset) : base;
}

async function persist(state: EditorState): Promise<{ client: EditorState['clients'][number] | null }> {
  const db = getDb();
  const now = new Date().toISOString();
  const { invoice } = state;
  await saveProfile(db, state.profile, now);
  await saveInvoice(db, invoice, now);
  await setMeta(db, 'currentInvoiceId', invoice.id);
  let client = null;
  if (invoice.client.name.trim()) {
    client = { ...invoice.client, id: state.clientId ?? newId(), updatedAt: now };
    await saveClient(db, client, now);
  }
  return { client };
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Editor state backed by IndexedDB: loads after hydration, autosaves edits (debounced) and on tab hide. */
export function usePersistentEditor(preset: Preset, today: string) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(preset, today));
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [loadError, setLoadError] = useState(false);
  const latest = useRef(state);
  const saving = useRef<Promise<void> | null>(null);
  const persisted = useRef(false);

  useEffect(() => {
    latest.current = state;
  }, [state]);

  useEffect(() => {
    let live = true;
    load(preset)
      .then((s) => {
        if (!live) return;
        dispatch({ type: 'loaded', state: s });
        setReady(true);
      })
      .catch(() => {
        // Private mode / blocked storage: keep working in memory.
        if (live) {
          setLoadError(true);
          setReady(true);
        }
      });
    return () => {
      live = false;
    };
  }, [preset]);

  const flush = useCallback(async () => {
    const s = latest.current;
    if (!isDirty(s) || loadError) return;
    if (saving.current) await saving.current;
    setStatus('saving');
    const job = persist(s)
      .then(({ client }) => {
        dispatch({
          type: 'saved',
          rev: s.rev,
          invoice: { id: s.invoice.id, number: s.invoice.number, date: s.invoice.date },
          client,
        });
        setStatus('saved');
        if (!persisted.current) {
          persisted.current = true;
          void requestPersistence();
        }
      })
      .catch(() => setStatus('error'))
      .finally(() => {
        saving.current = null;
      });
    saving.current = job;
    await job;
  }, [loadError]);

  useEffect(() => {
    if (!ready || !isDirty(state)) return;
    const t = setTimeout(() => void flush(), 500);
    return () => clearTimeout(t);
  }, [state, ready, flush]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [flush]);

  return { state, dispatch: dispatch as Dispatch<Action>, ready, status, loadError, flush };
}
