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
  }).catch(() => null);
  return databasePromise;
}

async function transact(storeName, mode, operation) {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  }).catch(() => null);
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
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB read aborted"));
  });
}

function writeRecords(database, storeName, records) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    for (const record of records) store.put(record);
    transaction.oncomplete = () => resolve(records.length);
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB write failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB write aborted"));
  });
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

export async function importStudyBackup(backup) {
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) throw new Error("备份文件必须是 JSON 对象。");
  if (backup.format !== BACKUP_FORMAT) throw new Error("这不是百草园学习记录备份。");
  if (backup.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new Error(`暂不支持备份版本 ${backup.schemaVersion}。`);
  if (!backup.stores || typeof backup.stores !== "object" || Array.isArray(backup.stores)) throw new Error("备份缺少 stores 数据。");

  const database = await openDatabase();
  if (!database) throw new Error("当前浏览器不支持本地学习记录数据库。");
  const imported = {};
  for (const [storeName, keyPath] of STORE_DEFINITIONS) {
    const records = backup.stores[storeName] ?? [];
    if (!Array.isArray(records)) throw new Error(`${storeName} 必须是数组。`);
    for (const record of records) {
      if (!record || typeof record !== "object" || Array.isArray(record) || !Object.hasOwn(record, keyPath)) {
        throw new Error(`${storeName} 中存在缺少 ${keyPath} 的记录。`);
      }
    }
    imported[storeName] = await writeRecords(database, storeName, records);
  }

  if (backup.localPreferences && typeof backup.localPreferences === "object" && !Array.isArray(backup.localPreferences)) {
    for (const [key, value] of Object.entries(backup.localPreferences)) {
      if (key.startsWith("kaoyan.") && typeof value === "string") localStorage.setItem(key, value);
    }
  }
  return imported;
}
