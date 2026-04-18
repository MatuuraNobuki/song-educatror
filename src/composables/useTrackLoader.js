import { ref, computed, reactive } from 'vue'
import { fetchTrackMetadata } from '../services/trackMetadata'
import { getCached, setCached } from '../services/prefetchCache'
import { useTrackMetadataStore } from '../stores/trackMetadataStore'

const audioUrlCache = reactive({})     // path → Dropbox URL（blob取得完了まで）
const audioBlobUrlCache = reactive({}) // path → blob: URL（フル音声データ）

export function useTrackLoader(props, { getPlaying }) {
  const metaStore = useTrackMetadataStore()
  const meta = ref({})
  const textReady = ref(false)
  const error = ref(null)

  const currentIndex = computed(() => props.albumTracks.findIndex(t => t.id === props.track.id))
  const prevTrack = computed(() => {
    if (!props.albumTracks.length) return null
    const i = currentIndex.value
    return props.albumTracks[(i - 1 + props.albumTracks.length) % props.albumTracks.length]
  })
  const nextTrack = computed(() => {
    if (!props.albumTracks.length) return null
    const i = currentIndex.value
    return props.albumTracks[(i + 1) % props.albumTracks.length]
  })

  const nextAudioUrl = computed(() => {
    if (!nextTrack.value) return null
    const path = nextTrack.value.path_lower
    return audioBlobUrlCache[path] ?? audioUrlCache[path] ?? null
  })

  async function fetchAndCacheAudioBlob(path, audioUrl) {
    if (audioBlobUrlCache[path]) return
    try {
      const res = await fetch(audioUrl)
      const blob = await res.blob()
      audioBlobUrlCache[path] = URL.createObjectURL(blob)
    } catch (e) {
      // Dropbox URLへのフォールバックは audioUrlCache が担う
    }
  }

  function prefetchAdjacentTracks() {
    // 前の曲: テキストメタのみ（未キャッシュ時のみ）
    if (prevTrack.value) {
      const path = prevTrack.value.path_lower
      if (!metaStore.cache[path]) {
        fetchTrackMetadata(path)
          .then(data => {
            metaStore.set(path, data)
            setCached(path, data)
          })
          .catch(() => {})
      }
    }

    // 次の曲: 常にフレッシュ取得（画像blob + 音声blob確保）
    if (nextTrack.value) {
      const path = nextTrack.value.path_lower
      fetchTrackMetadata(path)
        .then(data => {
          metaStore.set(path, data)
          setCached(path, data)
          if (data.audioUrl) {
            audioUrlCache[path] = data.audioUrl
            fetchAndCacheAudioBlob(path, data.audioUrl)
          }
        })
        .catch(() => {})
    }
  }

  async function loadTrack(pathLower) {
    meta.value = {}
    textReady.value = false
    error.value = null

    // 1. IndexedDB プリフェッチキャッシュを確認
    const prefetched = await getCached(pathLower)
    if (prefetched) {
      const pictures = metaStore.getPictures(pathLower)
      meta.value = {
        ...prefetched,
        pictures: pictures.length ? pictures : prefetched.pictures,
        audioUrl: audioBlobUrlCache[pathLower] ?? prefetched.audioUrl,
      }
      textReady.value = true
      fetchTrackMetadata(pathLower)
        .then(fresh => {
          const blobUrl = audioBlobUrlCache[pathLower]
          const audioUrl = blobUrl ?? meta.value.audioUrl ?? fresh.audioUrl
          meta.value = { ...fresh, audioUrl }
          metaStore.set(pathLower, fresh)
          setCached(pathLower, fresh)
        })
        .catch(() => {})
      prefetchAdjacentTracks()
      return
    }

    // 2. インメモリキャッシュ（Pinia）でテキスト系を即反映
    const inMemory = metaStore.cache[pathLower]
    if (inMemory) {
      Object.assign(meta.value, {
        ...inMemory,
        pictures: metaStore.getPictures(pathLower),
      })
      textReady.value = true
    }

    // 3. ネットワークフェッチ
    try {
      const fetched = await fetchTrackMetadata(pathLower)
      meta.value = fetched
      metaStore.set(pathLower, fetched)
      textReady.value = true
      setCached(pathLower, fetched)
    } catch (e) {
      if (!textReady.value) error.value = e.message
    }

    prefetchAdjacentTracks()
  }

  return { meta, textReady, error, loadTrack, prevTrack, nextTrack, nextAudioUrl }
}
