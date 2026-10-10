import type { SaveStorage } from './backend.js';

/** A save kept in memory only: tests, and a browser that refuses storage. */
export function memoryStorage(initial: string | null = null): SaveStorage & { text: string | null } {
  const store = {
    text: initial,
    async load() {
      return store.text;
    },
    async save(text: string) {
      store.text = text;
    },
  };
  return store;
}

/**
 * IndexedDB when the browser allows it, memory when it refuses (some private
 * windows): the game still plays, it just won't be there after a reload.
 */
export function browserStorage(slot = 'slot-1'): SaveStorage & { persistent(): boolean } {
  const memory = memoryStorage();
  let db: SaveStorage | null = typeof indexedDB === 'undefined' ? null : indexedDbStorage(slot);
  const fallBack = (error: unknown) => {
    console.warn('[solo] IndexedDB is not available; this game will not be saved', error);
    db = null;
  };
  return {
    persistent: () => db !== null,
    async load() {
      if (db) {
        try {
          return await db.load();
        } catch (error) {
          fallBack(error);
        }
      }
      return memory.load();
    },
    async save(text) {
      await memory.save(text);
      if (db) {
        try {
          await db.save(text);
        } catch (error) {
          fallBack(error);
        }
      }
    },
  };
}

/**
 * A save in the browser's IndexedDB: one record per slot. A put is atomic, so a
 * save is either the old one or the new one, never half of each.
 */
export function indexedDbStorage(slot = 'slot-1', database = 'dark-corner-solo'): SaveStorage {
  let opened: Promise<IDBDatabase> | null = null;
  const open = () =>
    (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('saves');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  const run = <T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>) =>
    open().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const tx = db.transaction('saves', mode);
          const request = act(tx.objectStore('saves'));
          tx.oncomplete = () => resolve(request.result);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        }),
    );
  return {
    async load() {
      const text = await run<unknown>('readonly', (store) => store.get(slot));
      return typeof text === 'string' ? text : null;
    },
    async save(text: string) {
      await run('readwrite', (store) => store.put(text, slot));
    },
  };
}
