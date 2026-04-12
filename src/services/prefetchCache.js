const SESSION_KEY = 'prefetch-session-id'
const DB_NAME = 'song-educator-prefetch'
const STORE_NAME = 'metadata'

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

let dbPromise = null
function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

// ページロード時に旧セッションデータを一括削除
let cleanupDone = false
async function ensureClean() {
  if (cleanupDone) return
  cleanupDone = true
  const isNewSession = !sessionStorage.getItem(SESSION_KEY)
  getSessionId()
  if (isNewSession) {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  }
}

async function blobUrlToStorable(url) {
  const res = await fetch(url)
  const data = await res.arrayBuffer()
  const mimeType = res.headers.get('content-type') || 'image/jpeg'
  return { data, mimeType }
}

export async function setCached(pathLower, metadata) {
  await ensureClean()
  try {
    const [pictureData, extraPictureData] = await Promise.all([
      Promise.all((metadata.pictures ?? []).map(blobUrlToStorable)),
      Promise.all((metadata.extraPictures ?? []).map(blobUrlToStorable)),
    ])
    const record = {
      key: pathLower,
      sessionId: getSessionId(),
      data: {
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        date: metadata.date,
        trackNumber: metadata.trackNumber,
        lyrics: metadata.lyrics,
        transcribedTextPreview: metadata.transcribedTextPreview,
        audioUrl: metadata.audioUrl,
        pictureData,
        extraPictureData,
      },
    }
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(record)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.warn('[prefetchCache] setCached failed:', e)
  }
}

export async function getCached(pathLower) {
  await ensureClean()
  try {
    const db = await openDb()
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(pathLower)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    if (!record || record.sessionId !== getSessionId()) return null
    const { data } = record
    return {
      ...data,
      pictures: (data.pictureData ?? []).map(
        (p) => URL.createObjectURL(new Blob([p.data], { type: p.mimeType }))
      ),
      extraPictures: (data.extraPictureData ?? []).map(
        (p) => URL.createObjectURL(new Blob([p.data], { type: p.mimeType }))
      ),
      pictureData: undefined,
      extraPictureData: undefined,
    }
  } catch (e) {
    console.warn('[prefetchCache] getCached failed:', e)
    return null
  }
}
