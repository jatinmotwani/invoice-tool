import { type ClientRecord, defaultProfile, type Profile } from '../invoice/profile';
import type { Invoice } from '../invoice/schema';
import type { InvoiceDb } from './db';

/** Counters and flags kept on the device (never sent anywhere). */
export interface MetaValues {
  lastBackupAt: string;
  invoicesSinceBackup: number;
  downloads: number;
  supportCardShownAtDownload: number;
  supportCardDismissed: boolean;
}

export async function getMeta<K extends keyof MetaValues>(
  db: InvoiceDb,
  key: K,
): Promise<MetaValues[K] | undefined> {
  return (await db.meta.get(key))?.value as MetaValues[K] | undefined;
}

export async function setMeta<K extends keyof MetaValues>(
  db: InvoiceDb,
  key: K,
  value: MetaValues[K],
): Promise<void> {
  await db.meta.put({ key, value });
}

export async function getProfile(db: InvoiceDb, now: string): Promise<Profile> {
  return (await db.profile.get('default')) ?? defaultProfile(now);
}

export async function saveProfile(db: InvoiceDb, profile: Profile, now: string): Promise<void> {
  await db.profile.put({ ...profile, updatedAt: now });
}

export async function listClients(db: InvoiceDb): Promise<ClientRecord[]> {
  return db.clients.orderBy('name').toArray();
}

export async function saveClient(db: InvoiceDb, client: ClientRecord, now: string): Promise<void> {
  await db.clients.put({ ...client, updatedAt: now });
}

export async function deleteClient(db: InvoiceDb, id: string): Promise<void> {
  await db.clients.delete(id);
}

/** Newest first. */
export async function listInvoices(db: InvoiceDb): Promise<Invoice[]> {
  const all = await db.invoices.toArray();
  return all.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export async function getInvoice(db: InvoiceDb, id: string): Promise<Invoice | undefined> {
  return db.invoices.get(id);
}

/** Save an invoice; counts it towards the backup nudge the first time it is stored. */
export async function saveInvoice(db: InvoiceDb, invoice: Invoice, now: string): Promise<void> {
  await db.transaction('rw', db.invoices, db.meta, async () => {
    const isNew = (await db.invoices.get(invoice.id)) === undefined;
    await db.invoices.put({ ...invoice, updatedAt: now });
    if (isNew) {
      const count = (await getMeta(db, 'invoicesSinceBackup')) ?? 0;
      await setMeta(db, 'invoicesSinceBackup', count + 1);
    }
  });
}

export async function deleteInvoice(db: InvoiceDb, id: string): Promise<void> {
  await db.invoices.delete(id);
}
