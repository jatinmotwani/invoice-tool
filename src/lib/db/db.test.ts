import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { sampleInvoice } from '../invoice/fixtures';
import { DB_VERSIONS, InvoiceDb, requestPersistence } from './db';
import {
  deleteInvoice,
  getInvoice,
  getMeta,
  getProfile,
  listClients,
  listInvoices,
  saveClient,
  saveInvoice,
  saveProfile,
  setMeta,
} from './repo';

const NOW = '2026-09-28T10:00:00.000Z';
let n = 0;
const dbs: InvoiceDb[] = [];
function freshDb(versions = DB_VERSIONS, name = `test-${++n}`) {
  const db = new InvoiceDb(name, versions);
  dbs.push(db);
  return db;
}
afterEach(async () => {
  for (const db of dbs.splice(0)) {
    db.close();
    await db.delete();
  }
});

describe('repositories', () => {
  it('returns a default profile until one is saved', async () => {
    const db = freshDb();
    const p = await getProfile(db, NOW);
    expect(p.defaults.gstRate).toBe(1800);
    expect(p.series).toEqual({ prefix: 'INV', separator: '/', includeFy: true, padding: 3 });
    await saveProfile(db, { ...p, supplier: { ...p.supplier, name: 'Asha' } }, NOW);
    expect((await getProfile(db, NOW)).supplier.name).toBe('Asha');
  });

  it('stores invoices newest first and counts new ones for the backup nudge', async () => {
    const db = freshDb();
    await saveInvoice(db, sampleInvoice({ id: 'a', date: '2026-04-01' }), NOW);
    await saveInvoice(db, sampleInvoice({ id: 'b', date: '2026-09-01' }), NOW);
    await saveInvoice(db, sampleInvoice({ id: 'a', date: '2026-04-01', notes: 'edited' }), NOW);
    expect((await listInvoices(db)).map((i) => i.id)).toEqual(['b', 'a']);
    expect((await getInvoice(db, 'a'))?.notes).toBe('edited');
    expect(await getMeta(db, 'invoicesSinceBackup')).toBe(2);
    await deleteInvoice(db, 'a');
    expect(await getInvoice(db, 'a')).toBeUndefined();
  });

  it('stores clients sorted by name and meta values', async () => {
    const db = freshDb();
    const client = { ...sampleInvoice().client, id: 'c1', updatedAt: NOW };
    await saveClient(db, { ...client, name: 'Zeta' }, NOW);
    await saveClient(db, { ...client, id: 'c2', name: 'Acme' }, NOW);
    expect((await listClients(db)).map((c) => c.name)).toEqual(['Acme', 'Zeta']);
    await setMeta(db, 'lastBackupAt', NOW);
    expect(await getMeta(db, 'lastBackupAt')).toBe(NOW);
  });
});

describe('migration harness', () => {
  it('upgrades existing rows when a new version is appended', async () => {
    const name = 'migrate';
    const v1 = freshDb(DB_VERSIONS, name);
    await saveInvoice(v1, sampleInvoice({ id: 'old' }), NOW);
    v1.close();

    const v2 = freshDb(
      [
        ...DB_VERSIONS,
        {
          version: 2,
          stores: { invoices: 'id, number, date, status, updatedAt, clientName' },
          upgrade: (tx) =>
            tx
              .table('invoices')
              .toCollection()
              .modify((inv: { client: { name: string }; clientName?: string }) => {
                inv.clientName = inv.client.name;
              }),
        },
      ],
      name,
    );
    const migrated = (await v2.invoices.get('old')) as unknown as { clientName: string };
    expect(migrated.clientName).toBe('Acme Pvt Ltd');
  });
});

describe('requestPersistence', () => {
  it('reports unsupported, persisted or denied', async () => {
    expect(await requestPersistence(undefined)).toBe('unsupported');
    const storage = (persisted: boolean, grant: boolean) =>
      ({ persisted: async () => persisted, persist: async () => grant }) as unknown as StorageManager;
    expect(await requestPersistence(storage(true, false))).toBe('persisted');
    expect(await requestPersistence(storage(false, true))).toBe('persisted');
    expect(await requestPersistence(storage(false, false))).toBe('denied');
  });
});
