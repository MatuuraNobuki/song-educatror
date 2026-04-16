import { defineStore } from 'pinia'

const TEXT_FIELDS = ['title', 'artist', 'album', 'date', 'trackNumber', 'lyrics', 'transcribedTextPreview']
const PICTURE_FIFO_LIMIT = 120

const pictureCache = new Map()
const pictureFifo = []

function pickTextFields(meta) {
  const out = {}
  for (const f of TEXT_FIELDS) out[f] = meta[f] ?? null
  return out
}

export const useTrackMetadataStore = defineStore('trackMetadata', {
  state: () => ({
    // path_lower -> { title, artist, album, date, trackNumber, lyrics, transcribedTextPreview }
    cache: {},
  }),
  actions: {
    set(path, meta) {
      this.cache[path] = pickTextFields(meta)
      this.setPictures(path, meta.pictures ?? [])
    },
    setPictures(path, pictures) {
      pictureCache.set(path, Array.isArray(pictures) ? [...pictures] : [])

      const existing = pictureFifo.indexOf(path)
      if (existing !== -1) pictureFifo.splice(existing, 1)
      pictureFifo.push(path)

      while (pictureFifo.length > PICTURE_FIFO_LIMIT) {
        const evictedPath = pictureFifo.shift()
        if (!evictedPath) continue
        const evictedPictures = pictureCache.get(evictedPath) ?? []
        evictedPictures.forEach((url) => URL.revokeObjectURL(url))
        pictureCache.delete(evictedPath)
      }
    },
    getPictures(path) {
      return pictureCache.get(path) ?? []
    },
    prune(activePaths) {
      const pathSet = new Set(activePaths)
      for (const key of Object.keys(this.cache)) {
        if (!pathSet.has(key)) delete this.cache[key]
      }

      for (let i = pictureFifo.length - 1; i >= 0; i--) {
        const path = pictureFifo[i]
        if (!pathSet.has(path)) {
          const pics = pictureCache.get(path) ?? []
          pics.forEach((url) => URL.revokeObjectURL(url))
          pictureCache.delete(path)
          pictureFifo.splice(i, 1)
        }
      }
    },
  },
  persist: {
    paths: ['cache'],
  },
})
