import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { sampleInvoice } from '../invoice/fixtures';
import { defaultProfile } from '../invoice/profile';
import { backupFileName, buildBackup, importBackup, markBackedUp, parseBackup } from './backup';
import { InvoiceDb } from './db';
import { getMeta, saveClient, saveInvoice, saveProfile } from './repo';

const NOW = '2026-09-28T10:00:00.000Z';
const LATER = '2026-09-29T10:00:00.000Z';
let n = 0;
const dbs: InvoiceDb[] = [];
const fresh = () => {
  const db = new InvoiceDb(`backup-${++n}`);
  dbs.push(db);
  return db;
};
afterEach(async () => {
  for (const db of dbs.splice(0)) {
    db.close();
    await db.delete();
  }
});

async function seeded() {
  const db = fresh();
  await saveProfile(
    db,
    { ...defaultProfile(NOW), supplier: { ...defaultProfile(NOW).supplier, name: 'Asha' } },
    NOW,
  );
  await saveClient(db, { ...sampleInvoice().client, id: 'c1', updatedAt: NOW }, NOW);
  await saveInvoice(db, sampleInvoice({ id: 'a' }), NOW);
  await saveInvoice(db, sampleInvoice({ id: 'b', number: 'INV/26-27/002' }), NOW);
  return db;
}

describe('backup round trip', () => {
  it('exports everything and restores it into an empty device', async () => {
    const source = await seeded();
    const json = JSON.stringify(await buildBackup(source, NOW));
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const target = fresh();
    expect(await importBackup(target, parsed.backup, 'replace')).toEqual({ invoices: 2, clients: 1 });
    expect((await target.profile.get('default'))?.supplier.name).toBe('Asha');
    expect(await target.invoices.count()).toBe(2);
  });

  it('merges by keeping the newer copy of each record', async () => {
    const source = await seeded();
    const backup = await buildBackup(source, NOW);
    const target = fresh();
    await target.invoices.put({ ...sampleInvoice({ id: 'a', notes: 'newer on device' }), updatedAt: LATER });
    await target.invoices.put({ ...sampleInvoice({ id: 'z' }), updatedAt: NOW });

    const counts = await importBackup(target, backup, 'merge');
    expect(counts.invoices).toBe(1); // only 'b'; 'a' on the device is newer
    expect((await target.invoices.get('a'))?.notes).toBe('newer on device');
    expect(await target.invoices.count()).toBe(3);
  });

  it('replace wipes existing data first', async () => {
    const backup = await buildBackup(await seeded(), NOW);
    const target = fresh();
    await target.invoices.put({ ...sampleInvoice({ id: 'z' }), updatedAt: LATER });
    await importBackup(target, backup, 'replace');
    expect(await target.invoices.get('z')).toBeUndefined();
  });

  it('resets the nudge counter when a backup is made', async () => {
    const db = await seeded();
    expect(await getMeta(db, 'invoicesSinceBackup')).toBe(2);
    await markBackedUp(db, NOW);
    expect(await getMeta(db, 'invoicesSinceBackup')).toBe(0);
    expect(await getMeta(db, 'lastBackupAt')).toBe(NOW);
    expect(backupFileName(NOW)).toBe('invoices-backup-2026-09-28.json');
  });
});

describe('parseBackup', () => {
  it('rejects non-JSON, foreign files, other versions and damaged data', async () => {
    expect(parseBackup('nope')).toEqual({ ok: false, error: 'This file isn’t valid JSON.' });
    expect(parseBackup('{"hello":1}')).toMatchObject({
      ok: false,
      error: 'This isn’t a backup file from this app.',
    });
    const good = await buildBackup(await seeded(), NOW);
    expect(parseBackup(JSON.stringify({ ...good, version: 99 }))).toMatchObject({
      ok: false,
      error: /different version/,
    });
    const damaged = { ...good, invoices: [{ ...good.invoices[0], advance: 10.5 }] };
    const result = parseBackup(JSON.stringify(damaged));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('invoices.0.advance');
  });
});
