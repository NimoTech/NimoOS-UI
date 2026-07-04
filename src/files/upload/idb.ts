export const DB_NAME = 'nimo_files_upload'
const DB_VERSION = 1
const QUEUE_STORE = 'queue'
const BLOB_STORE = 'blobs'

let dbPromise: Promise<IDBDatabase> | null = null

/** Reset cached connection — only call this in tests. */
export function _resetForTest(): void {
  dbPromise = null
}

function hasStores(db: IDBDatabase): boolean {
  return db.objectStoreNames.contains(QUEUE_STORE) && db.objectStoreNames.contains(BLOB_STORE)
}

// Open at the given version, creating our stores in onupgradeneeded.
function openAtVersion(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, version)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => {
      const db = req.result
      // Self-heal: a prior open without an upgrade handler could leave the DB at this
      // version with our stores missing; onupgradeneeded won't fire again at the same
      // version so every read/write would throw forever. Detect and reopen at the next
      // version to force store creation.
      if (!hasStores(db)) {
        const nextVersion = db.version + 1
        db.close()
        resolve(openAtVersion(nextVersion))
        return
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
  })
}

export function openUploadDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = openAtVersion(DB_VERSION).catch((e) => {
    // Don't cache a rejected promise — allow a later retry to re-open.
    dbPromise = null
    throw e
  })
  return dbPromise
}

function tx(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openUploadDB().then((db) => db.transaction(storeName, mode).objectStore(storeName))
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putQueueItem(item: Record<string, unknown>): Promise<void> {
  const store = await tx(QUEUE_STORE, 'readwrite')
  await wrap(store.put(item))
}

export async function getAllQueueItems(): Promise<any[]> {
  const store = await tx(QUEUE_STORE, 'readonly')
  return wrap(store.getAll())
}

export async function removeQueueItem(id: string): Promise<void> {
  const store = await tx(QUEUE_STORE, 'readwrite')
  await wrap(store.delete(id))
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function dataUrlToBlob(dataUrl: string, type: string): Blob {
  const arr = dataUrl.split(',')
  const bstr = atob(arr[1])
  const n = bstr.length
  const u8arr = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i)
  }
  return new Blob([u8arr], { type })
}

export async function putBlob(id: string, blob: Blob): Promise<void> {
  const dataUrl = await blobToDataUrl(blob)
  const store = await tx(BLOB_STORE, 'readwrite')
  await wrap(store.put({ id, dataUrl, type: blob.type }))
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  const store = await tx(BLOB_STORE, 'readonly')
  const rec = await wrap<{ id: string; dataUrl: string; type: string } | undefined>(store.get(id))
  return rec ? dataUrlToBlob(rec.dataUrl, rec.type) : undefined
}

export async function removeBlob(id: string): Promise<void> {
  const store = await tx(BLOB_STORE, 'readwrite')
  await wrap(store.delete(id))
}

export async function removeItemAndBlob(id: string): Promise<void> {
  await removeQueueItem(id)
  await removeBlob(id)
}

export async function pruneOld(cutoffMs: number): Promise<number> {
  const all = await getAllQueueItems()
  let removed = 0
  for (const it of all) {
    // Missing/0 createdAt = "unknown age" → do NOT prune. Only prune items with an
    // explicit createdAt predating the cutoff.
    if (typeof it.createdAt === 'number' && it.createdAt > 0 && it.createdAt < cutoffMs) {
      await removeItemAndBlob(it.id)
      removed++
    }
  }
  return removed
}
