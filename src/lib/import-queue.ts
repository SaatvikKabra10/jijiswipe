export type ImportQueueJob = {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number;
};

const DATABASE = "jijiswipe-imports";
const STORE = "jobs";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Import storage could not be opened."));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Import storage could not be updated."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Import storage could not be updated."));
  });
}

export async function listImportJobs() {
  const jobs = await run<ImportQueueJob[]>("readonly", (store) => store.getAll());
  return jobs.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addImportJobs(jobs: ImportQueueJob[]) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    jobs.forEach((job) => store.put(job));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Photos could not be queued."));
  });
  database.close();
}

export function removeImportJob(id: string) {
  return run("readwrite", (store) => store.delete(id));
}
