const DATABASE_NAME = "kaoyan-english-study";
const DATABASE_VERSION = 1;
const STORE_DEFINITIONS = [
  ["writingRecords", "id"],
  ["writingFeedback", "id"],
  ["writingReviewState", "entityId"],
  ["wordProgress", "wordId"],
  ["userNotes", "id"],
  ["meta", "key"],
];
const BACKUP_FORMAT = "baicaoyuan-study-backup";
const BACKUP_SCHEMA_VERSION = 1;

let databasePromise;

function openDatabase() {
  if (!("indexedDB" in globalThis)) return Promise.resolve(null);
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const [name, keyPath] of STORE_DEFINITIONS) {
        if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, { keyPath });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked by another open tab"));
  }).catch((error) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

async function transact(storeName, mode, operation) {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);
    let requestResult = null;
    request.onsuccess = () => { requestResult = request.result ?? null; };
    request.onerror = () => {};
    transaction.oncomplete = () => resolve(requestResult);
    transaction.onerror = () => reject(transaction.error ?? request.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function getReviewState(entityId) {
  return transact("writingReviewState", "readonly", (store) => store.get(entityId));
}

export function saveReviewState(entityId, status, contentVersion = null) {
  return transact("writingReviewState", "readwrite", (store) => store.put({
    entityId,
    status,
    contentVersion,
    updatedAt: new Date().toISOString(),
  }));
}

export function getWordProgress(wordId) {
  return transact("wordProgress", "readonly", (store) => store.get(wordId));
}

export function listWordProgress() {
  return transact("wordProgress", "readonly", (store) => store.getAll());
}

export async function saveWordProgress(wordId, changes = {}) {
  const current = await getWordProgress(wordId) ?? {};
  const record = {
    schemaVersion: 1,
    wordId,
    status: "new",
    stage: 0,
    lastRating: null,
    lastReviewedAt: null,
    dueDate: null,
    correctStreak: 0,
    lapses: 0,
    reviewCount: 0,
    starred: false,
    markedDifficult: false,
    personalMnemonic: "",
    personalNote: "",
    ...current,
    ...changes,
    wordId,
    updatedAt: new Date().toISOString(),
  };
  const savedKey = await transact("wordProgress", "readwrite", (store) => store.put(record));
  return savedKey == null ? null : record;
}

export function readPreference(key) {
  return transact("meta", "readonly", (store) => store.get(`preference:${key}`));
}

export function savePreference(key, value) {
  return transact("meta", "readwrite", (store) => store.put({
    key: `preference:${key}`,
    value,
    updatedAt: new Date().toISOString(),
  }));
}

function readAllRecords(database, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    let records = [];
    request.onsuccess = () => { records = request.result ?? []; };
    request.onerror = () => {};
    transaction.oncomplete = () => resolve(records);
    transaction.onerror = () => reject(transaction.error ?? request.error ?? new Error("IndexedDB read failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB read aborted"));
  });
}

function writeRecordsAtomically(database, recordsByStore) {
  return new Promise((resolve, reject) => {
    const storeNames = STORE_DEFINITIONS.map(([storeName]) => storeName);
    const transaction = database.transaction(storeNames, "readwrite");
    for (const storeName of storeNames) {
      const store = transaction.objectStore(storeName);
      for (const record of recordsByStore[storeName] ?? []) store.add(record);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB write failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB write aborted"));
  });
}

function validateBackup(backup) {
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) throw new Error("备份文件必须是 JSON 对象。");
  if (backup.format !== BACKUP_FORMAT) throw new Error("这不是百草园学习记录备份。");
  if (backup.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new Error(`暂不支持备份版本 ${backup.schemaVersion}。`);
  if (!backup.stores || typeof backup.stores !== "object" || Array.isArray(backup.stores)) throw new Error("备份缺少 stores 数据。");
  const recordsByStore = {};
  for (const [storeName, keyPath] of STORE_DEFINITIONS) {
    const records = backup.stores[storeName] ?? [];
    if (!Array.isArray(records)) throw new Error(`${storeName} 必须是数组。`);
    const keys = new Set();
    for (const record of records) {
      if (!record || typeof record !== "object" || Array.isArray(record) || !Object.hasOwn(record, keyPath)) {
        throw new Error(`${storeName} 中存在缺少 ${keyPath} 的记录。`);
      }
      const key = String(record[keyPath]);
      if (keys.has(key)) throw new Error(`${storeName} 中存在重复记录 ${key}。`);
      keys.add(key);
    }
    recordsByStore[storeName] = records;
  }
  return recordsByStore;
}

function localPreferences() {
  const result = {};
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("kaoyan.")) result[key] = localStorage.getItem(key);
    }
  } catch {}
  return result;
}

export async function exportStudyBackup() {
  const database = await openDatabase();
  const stores = {};
  if (database) {
    for (const [storeName] of STORE_DEFINITIONS) stores[storeName] = await readAllRecords(database, storeName);
  }
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    sourceOrigin: globalThis.location?.origin ?? null,
    stores,
    localPreferences: localPreferences(),
  };
}

export async function previewStudyBackup(backup) {
  const recordsByStore = validateBackup(backup);
  const database = await openDatabase();
  if (!database) throw new Error("当前浏览器不支持本地学习记录数据库。");
  const additionsByStore = {};
  const conflictsByStore = {};
  let additions = 0;
  let conflicts = 0;
  for (const [storeName, keyPath] of STORE_DEFINITIONS) {
    const localRecords = await readAllRecords(database, storeName);
    const localKeys = new Set(localRecords.map((record) => String(record[keyPath])));
    const storeAdditions = recordsByStore[storeName].filter((record) => !localKeys.has(String(record[keyPath])));
    const storeConflicts = recordsByStore[storeName].length - storeAdditions.length;
    additionsByStore[storeName] = storeAdditions;
    conflictsByStore[storeName] = storeConflicts;
    additions += storeAdditions.length;
    conflicts += storeConflicts;
  }

  return { recordsByStore, additionsByStore, conflictsByStore, additions, conflicts };
}

export async function importStudyBackup(backup) {
  const preview = await previewStudyBackup(backup);
  const database = await openDatabase();
  if (!database) throw new Error("当前浏览器不支持本地学习记录数据库。");
  await writeRecordsAtomically(database, preview.additionsByStore);

  let preferencesImported = 0;
  if (backup.localPreferences && typeof backup.localPreferences === "object" && !Array.isArray(backup.localPreferences)) {
    try {
      for (const [key, value] of Object.entries(backup.localPreferences)) {
        if (key.startsWith("kaoyan.") && typeof value === "string" && localStorage.getItem(key) == null) {
          localStorage.setItem(key, value);
          preferencesImported += 1;
        }
      }
    } catch {}
  }
  return {
    imported: Object.fromEntries(STORE_DEFINITIONS.map(([storeName]) => [storeName, preview.additionsByStore[storeName].length])),
    additions: preview.additions,
    conflictsPreserved: preview.conflicts,
    preferencesImported,
  };
}
