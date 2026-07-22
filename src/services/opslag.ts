// Lokale opslag met een asynchrone interface: IndexedDB met
// localStorage-fallback. Doordat de interface async is, kan een
// cloud-backend later dit bestand vervangen zonder het datamodel
// of de rest van de app te wijzigen.

const DB_NAAM = 'wiskundecoach';
const STORE = 'kv';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const verzoek = indexedDB.open(DB_NAAM, 1);
    verzoek.onupgradeneeded = () => {
      verzoek.result.createObjectStore(STORE);
    };
    verzoek.onsuccess = () => resolve(verzoek.result);
    verzoek.onerror = () => reject(verzoek.error);
  });
}

export async function haalOp<T>(sleutel: string): Promise<T | null> {
  try {
    const db = await openDatabase();
    return await new Promise<T | null>((resolve, reject) => {
      const transactie = db.transaction(STORE, 'readonly');
      const verzoek = transactie.objectStore(STORE).get(sleutel);
      verzoek.onsuccess = () => resolve((verzoek.result as T | undefined) ?? null);
      verzoek.onerror = () => reject(verzoek.error);
    });
  } catch {
    // Fallback mag zelf nooit gooien: corrupte of ontoegankelijke
    // localStorage-data behandelen we als "niets opgeslagen".
    try {
      const ruw = localStorage.getItem(sleutel);
      return ruw ? (JSON.parse(ruw) as T) : null;
    } catch {
      return null;
    }
  }
}

export async function bewaar<T>(sleutel: string, waarde: T): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transactie = db.transaction(STORE, 'readwrite');
      transactie.objectStore(STORE).put(waarde, sleutel);
      transactie.oncomplete = () => resolve();
      transactie.onerror = () => reject(transactie.error);
    });
  } catch {
    try {
      localStorage.setItem(sleutel, JSON.stringify(waarde));
    } catch {
      // Opslag vol of geblokkeerd: de app blijft werken, alleen zonder
      // bewaarde voortgang.
    }
  }
}
