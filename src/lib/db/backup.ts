import * as z from 'zod/mini';
import {
  ClientRecordSchema,
  type ClientRecord,
  type Profile,
  ProfileSchema,
} from '../invoice/profile-schema';
import { type Invoice, InvoiceSchema } from '../invoice/schema';
import type { InvoiceDb } from './db';
import { setMeta } from './repo';

export const BACKUP_FORMAT = 'invoice-tool-backup';
export const BACKUP_VERSION = 1;

const BackupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  profile: z.nullable(ProfileSchema),
  clients: z.array(ClientRecordSchema),
  invoices: z.array(InvoiceSchema),
});

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  profile: Profile | null;
  clients: ClientRecord[];
  invoices: Invoice[];
}

export async function buildBackup(db: InvoiceDb, now: string): Promise<Backup> {
  const [profile, clients, invoices] = await Promise.all([
    db.profile.get('default'),
    db.clients.toArray(),
    db.invoices.toArray(),
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    profile: profile ?? null,
    clients,
    invoices,
  };
}

export function backupFileName(now: string): string {
  return `invoices-backup-${now.slice(0, 10)}.json`;
}

/** Record that the user has a fresh backup (resets the nudge counter). */
export async function markBackedUp(db: InvoiceDb, now: string): Promise<void> {
  await setMeta(db, 'lastBackupAt', now);
  await setMeta(db, 'invoicesSinceBackup', 0);
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file isn’t valid JSON.' };
  }
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== BACKUP_FORMAT) {
    return { ok: false, error: 'This isn’t a backup file from this app.' };
  }
  if ((raw as { version?: unknown }).version !== BACKUP_VERSION) {
    return { ok: false, error: 'This backup was made by a different version of the app.' };
  }
  const result = BackupSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      ok: false,
      error: `The backup is damaged (${issue?.path.join('.') || 'file'}: ${issue?.message ?? 'invalid'}).`,
    };
  }
  return { ok: true, backup: result.data as Backup };
}

export interface ImportCounts {
  invoices: number;
  clients: number;
}

/**
 * `merge` keeps existing data and takes the newer copy of anything with the same id;
 * `replace` wipes this device's data first.
 */
export async function importBackup(
  db: InvoiceDb,
  backup: Backup,
  mode: 'merge' | 'replace',
): Promise<ImportCounts> {
  return db.transaction('rw', db.profile, db.clients, db.invoices, async () => {
    if (mode === 'replace') {
      await Promise.all([db.profile.clear(), db.clients.clear(), db.invoices.clear()]);
    }
    const newer = <T extends { id: string; updatedAt: string }>(existing: T | undefined, incoming: T) =>
      !existing || incoming.updatedAt >= existing.updatedAt;

    if (backup.profile && newer(await db.profile.get('default'), backup.profile))
      await db.profile.put(backup.profile);

    let clients = 0;
    for (const c of backup.clients) {
      if (newer(await db.clients.get(c.id), c)) {
        await db.clients.put(c);
        clients++;
      }
    }
    let invoices = 0;
    for (const inv of backup.invoices) {
      if (newer(await db.invoices.get(inv.id), inv)) {
        await db.invoices.put(inv);
        invoices++;
      }
    }
    return { invoices, clients };
  });
}
