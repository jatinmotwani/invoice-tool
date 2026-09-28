import { useCallback, useEffect, useId, useState } from 'react';
import { getDb } from '../../../lib/db/db';
import { getMeta } from '../../../lib/db/repo';
import { formatDate } from '../../../lib/invoice/format';
import type { Backup } from '../../../lib/db/backup';
import { saveBlob } from '../download';
import { Button, Section } from '../fields';

/** Invoices made since the last backup before we nudge. */
export const BACKUP_NUDGE_EVERY = 5;

export interface BackupStatus {
  lastBackupAt: string | null;
  sinceBackup: number;
}

/** Reads the backup counters; `refreshKey` re-reads them (e.g. after each save). */
export function useBackupStatus(refreshKey: unknown): [BackupStatus, () => void] {
  const [status, setStatus] = useState<BackupStatus>({ lastBackupAt: null, sinceBackup: 0 });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    const db = getDb();
    Promise.all([getMeta(db, 'lastBackupAt'), getMeta(db, 'invoicesSinceBackup')])
      .then(([last, since]) => {
        if (live) setStatus({ lastBackupAt: last ?? null, sinceBackup: since ?? 0 });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [refreshKey, tick]);
  return [status, useCallback(() => setTick((t) => t + 1), [])];
}

export async function exportBackup(flush: () => Promise<void>): Promise<void> {
  await flush();
  const { buildBackup, backupFileName, markBackedUp } = await import('../../../lib/db/backup');
  const db = getDb();
  const now = new Date().toISOString();
  const backup = await buildBackup(db, now);
  saveBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), backupFileName(now));
  await markBackedUp(db, now);
}

export default function YourData({
  status,
  refresh,
  flush,
}: {
  status: BackupStatus;
  refresh: () => void;
  flush: () => Promise<void>;
}) {
  const fileId = useId();
  const [pending, setPending] = useState<Backup | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function onExport() {
    try {
      await exportBackup(flush);
      refresh();
      setMessage({
        tone: 'ok',
        text: 'Backup saved. Keep the file somewhere safe (e.g. Google Drive or email it to yourself).',
      });
    } catch {
      setMessage({ tone: 'error', text: 'Couldn’t make the backup.' });
    }
  }

  async function onFile(file: File) {
    const { parseBackup } = await import('../../../lib/db/backup');
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error });
      return;
    }
    setMessage(null);
    setPending(result.backup);
  }

  async function onImport(mode: 'merge' | 'replace') {
    if (!pending) return;
    const { importBackup } = await import('../../../lib/db/backup');
    await flush();
    const counts = await importBackup(getDb(), pending, mode);
    setPending(null);
    setMessage({
      tone: 'ok',
      text: `Restored ${counts.invoices} invoices and ${counts.clients} clients. Reloading…`,
    });
    setTimeout(() => window.location.reload(), 800);
  }

  return (
    <Section
      title="Your data"
      description="Invoices are saved only in this browser on this device. Nothing is uploaded, so back up now and then."
    >
      <p className="text-sm text-slate-700">
        Last backup:{' '}
        <strong>{status.lastBackupAt ? formatDate(status.lastBackupAt.slice(0, 10)) : 'never'}</strong>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void onExport()}>Export backup</Button>
        <label
          htmlFor={fileId}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-md px-4 text-base font-medium text-blue-800 hover:bg-blue-50 has-focus-visible:ring-2 has-focus-visible:ring-blue-600"
        >
          Import backup
          <input
            id={fileId}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onFile(f);
            }}
          />
        </label>
      </div>
      {pending && (
        <div
          role="alertdialog"
          aria-label="Restore backup"
          className="rounded-md border border-slate-300 p-3 text-sm"
        >
          <p>
            This backup has {pending.invoices.length} invoices and {pending.clients.length} clients (made{' '}
            {formatDate(pending.exportedAt.slice(0, 10))}).
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void onImport('merge')}>
              Add to this device
            </Button>
            <Button onClick={() => void onImport('replace')}>Replace everything</Button>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {message && (
        <p
          role="status"
          className={message.tone === 'ok' ? 'text-sm text-green-800' : 'text-sm text-red-700'}
        >
          {message.text}
        </p>
      )}
    </Section>
  );
}
