import Dexie, { type EntityTable, type Version } from 'dexie';
import type { ClientRecord, Profile } from '../invoice/profile';
import type { Invoice } from '../invoice/schema';

export const DB_NAME = 'invoice-tool';

export interface MetaEntry {
  key: string;
  value: unknown;
}

export interface DbVersion {
  version: number;
  stores: Record<string, string | null>;
  upgrade?: Parameters<Version['upgrade']>[0];
}

/**
 * Every schema version, oldest first. Never edit a released entry: append a new version with an `upgrade`
 * that migrates existing rows, and bump `SCHEMA_VERSION` in the invoice schema if documents change.
 */
export const DB_VERSIONS: readonly DbVersion[] = [
  {
    version: 1,
    stores: {
      profile: 'id',
      clients: 'id, name, updatedAt',
      invoices: 'id, number, date, status, updatedAt',
      meta: 'key',
    },
  },
];

export class InvoiceDb extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  clients!: EntityTable<ClientRecord, 'id'>;
  invoices!: EntityTable<Invoice, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;

  constructor(name = DB_NAME, versions: readonly DbVersion[] = DB_VERSIONS) {
    super(name);
    for (const v of versions) {
      const stage = this.version(v.version).stores(v.stores);
      if (v.upgrade) stage.upgrade(v.upgrade);
    }
  }
}

let instance: InvoiceDb | undefined;

/** The app's database (browser only). */
export function getDb(): InvoiceDb {
  instance ??= new InvoiceDb();
  return instance;
}

export type PersistStatus = 'persisted' | 'denied' | 'unsupported';

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistence(
  storage: StorageManager | undefined = globalThis.navigator?.storage,
): Promise<PersistStatus> {
  if (!storage?.persist || !storage.persisted) return 'unsupported';
  if (await storage.persisted()) return 'persisted';
  return (await storage.persist()) ? 'persisted' : 'denied';
}
