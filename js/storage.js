// Persistence: small JSON in localStorage, uploaded images/PDFs in IndexedDB.

const PREFIX = 'violinTeacher.';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
      const req = indexedDB.open('violin-teacher', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('files');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction('files', mode);
    const req = fn(t.objectStore('files'));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
  }));
}

export const files = {
  put: (id, blob) => tx('readwrite', (s) => s.put(blob, id)).catch(() => null),
  get: (id) => tx('readonly', (s) => s.get(id)).catch(() => null),
  delete: (id) => tx('readwrite', (s) => s.delete(id)).catch(() => null),
};
