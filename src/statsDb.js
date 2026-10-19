import { coverageFromFinds, mergeCoverage } from "./setCoverage";

const DB_NAME = "setWithFriendsStats";
const DB_VERSION = 2;
const STORE_NAME = "normalModeFinds";
const COVERAGE_STORE = "setCoverage";

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("by_durationMs", "durationMs");
        }
        if (!db.objectStoreNames.contains(COVERAGE_STORE)) {
          const coverage = db.createObjectStore(COVERAGE_STORE, {
            keyPath: "key",
          });
          const legacyFinds = request.transaction
            .objectStore(STORE_NAME)
            .getAll();
          legacyFinds.onsuccess = () => {
            for (const entry of coverageFromFinds(legacyFinds.result).values()) {
              coverage.put(entry);
            }
          };
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

async function withStore(mode, run, storeName = STORE_NAME) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = run(store);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(request.result);
  });
}

export async function addFind(record) {
  return withStore("readwrite", (store) =>
    store.add({ ...record, studyState: "unreviewed" }),
  );
}

export async function getAllFinds() {
  const finds = await withStore("readonly", (store) => store.getAll());
  return finds.slice().sort((a, b) => a.time - b.time);
}

export async function getSetCoverage() {
  return withStore("readonly", (store) => store.getAll(), COVERAGE_STORE);
}

export async function saveSetCoverage(entries) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COVERAGE_STORE, "readwrite");
    const store = tx.objectStore(COVERAGE_STORE);
    // Deduplicate this batch, then merge inside the transaction so another
    // tab seeing a set cannot overwrite its previously found status.
    for (const entry of mergeCoverage(new Map(), entries).values()) {
      const request = store.get(entry.key);
      request.onsuccess = () => {
        store.put({
          ...entry,
          found: Boolean(entry.found || request.result?.found),
        });
      };
    }
    tx.onerror = tx.onabort = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

export async function clearStats() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, COVERAGE_STORE], "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.objectStore(COVERAGE_STORE).clear();
    tx.onerror = tx.onabort = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

export async function updateFindStudyState(id, studyState) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (record) store.put({ ...record, studyState });
    };
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}
