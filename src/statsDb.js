const DB_NAME = "setWithFriendsStats";
const DB_VERSION = 1;
const STORE_NAME = "normalModeFinds";

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
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

async function withStore(mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
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

export async function clearFinds() {
  return withStore("readwrite", (store) => store.clear());
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
