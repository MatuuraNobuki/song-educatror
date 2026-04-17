const DB_NAME = 'song-educator'
const STORE = 'albumArt'
const VERSION = 1

let dbPromise = null

function getDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION)
      req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE)
      req.onsuccess = (e) => resolve(e.target.result)
      req.onerror = (e) => reject(e.target.error)
    })
  }
  return dbPromise
}

export async function saveBlobs(path, blobs) {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blobs, path)
    tx.oncomplete = resolve
    tx.onerror = (e) => reject(e.target.error)
  })
}

export async function loadBlobs(path) {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(path)
    req.onsuccess = (e) => resolve(e.target.result ?? [])
    req.onerror = (e) => reject(e.target.error)
  })
}

export async function deleteBlobs(path) {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(path)
    tx.oncomplete = resolve
    tx.onerror = (e) => reject(e.target.error)
  })
}

export async function clearAllBlobs() {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = resolve
    tx.onerror = (e) => reject(e.target.error)
  })
}
