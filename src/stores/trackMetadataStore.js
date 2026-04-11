import { defineStore } from 'pinia'

// 画像 (pictures, extraPictures) と audioUrl は除外して永続化
const TEXT_FIELDS = ['title', 'artist', 'album', 'date', 'trackNumber', 'lyrics', 'transcribedTextPreview']

function pickTextFields(meta) {
  const out = {}
  for (const f of TEXT_FIELDS) out[f] = meta[f] ?? null
  return out
}

export const useTrackMetadataStore = defineStore('trackMetadata', {
  state: () => ({
    // path_lower → { title, artist, album, date, trackNumber, lyrics, transcribedTextPreview }
    cache: {},
  }),
  actions: {
    set(path, meta) {
      this.cache[path] = pickTextFields(meta)
    },
    /** 現在のトラックリストにないパスのキャッシュを削除 */
    prune(activePaths) {
      const pathSet = new Set(activePaths)
      for (const key of Object.keys(this.cache)) {
        if (!pathSet.has(key)) delete this.cache[key]
      }
    },
  },
  persist: true,
})
