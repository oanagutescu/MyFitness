'use strict';

/**
 * Small IndexedDB wrapper for storing fitness sessions.
 */
const DB_NAME = 'myfitness-db';
const DB_VERSION = 2;
const STORE_SESSIONS = 'sessions';
const STORE_WELLNESS = 'wellness';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('by_date', 'date', { unique: false });
        store.createIndex('by_type', 'type', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_WELLNESS)) {
        db.createObjectStore(STORE_WELLNESS, { keyPath: 'date' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });

  return dbPromise;
}

async function addSession(session) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SESSIONS);
    const request = store.add(session);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function updateSession(session) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SESSIONS);
    const request = store.put(session);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteSession(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SESSIONS);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getAllSessions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readonly');
    const store = tx.objectStore(STORE_SESSIONS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function getSessionsByDate(date) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readonly');
    const store = tx.objectStore(STORE_SESSIONS);
    const index = store.index('by_date');
    const request = index.getAll(date);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function putWellness(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WELLNESS, 'readwrite');
    const store = tx.objectStore(STORE_WELLNESS);
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteWellness(date) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WELLNESS, 'readwrite');
    const store = tx.objectStore(STORE_WELLNESS);
    const request = store.delete(date);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getAllWellness() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WELLNESS, 'readonly');
    const store = tx.objectStore(STORE_WELLNESS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function getWellnessByDate(date) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_WELLNESS, 'readonly');
    const store = tx.objectStore(STORE_WELLNESS);
    const request = store.get(date);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

window.FitnessDB = {
  openDB,
  addSession,
  updateSession,
  deleteSession,
  getAllSessions,
  getSessionsByDate,
  putWellness,
  deleteWellness,
  getAllWellness,
  getWellnessByDate,
};
