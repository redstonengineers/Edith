/** Almacén local mínimo (IndexedDB) para el modo sin conexión: copia de lecturas y cola de envíos pendientes. */
const DB = 'edith-offline'; const STORES = ['cache', 'outbox'] as const;
export type Store = (typeof STORES)[number];

let opened: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  opened ??= new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('IndexedDB no disponible'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'k' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return opened;
}
async function op<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((res, rej) => { const t = db.transaction(store, mode); const r = fn(t.objectStore(store)); t.oncomplete = () => res(r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
}
export const idb = {
  get: <T,>(store: Store, k: string) => op<{ k: string } & T | undefined>(store, 'readonly', (s) => s.get(k)),
  put: <V extends { k: string }>(store: Store, v: V) => op(store, 'readwrite', (s) => s.put(v)),
  del: (store: Store, k: string) => op(store, 'readwrite', (s) => s.delete(k)),
  all: <T,>(store: Store) => op<({ k: string } & T)[]>(store, 'readonly', (s) => s.getAll()),
  clear: (store: Store) => op(store, 'readwrite', (s) => s.clear()),
};
