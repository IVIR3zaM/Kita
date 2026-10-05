// The only module that touches IndexedDB. Thin shell: no domain logic.
const DB_NAME = 'kita';
const DB_VERSION = 1;
const SETTINGS = 'settings';
const WEEKS = 'weeks';
const SETTINGS_KEY = 'settings';
const LANG_KEY = 'lang';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS);
      if (!db.objectStoreNames.contains(WEEKS)) db.createObjectStore(WEEKS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get(store, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put(store, key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadSettings() {
  return (await get(SETTINGS, SETTINGS_KEY)) ?? null;
}

export async function saveSettings(settings) {
  return put(SETTINGS, SETTINGS_KEY, settings);
}

export async function loadWeek(weekKey) {
  return (await get(WEEKS, weekKey)) ?? null;
}

export async function saveWeek(weekKey, week) {
  return put(WEEKS, weekKey, week);
}

export async function loadLang() {
  return (await get(SETTINGS, LANG_KEY)) ?? null;
}

export async function saveLang(lang) {
  return put(SETTINGS, LANG_KEY, lang);
}
