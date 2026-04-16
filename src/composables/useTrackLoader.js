import { ref, computed } from 'vue'
import { fetchTrackMetadata } from '../services/trackMetadata'
import { getCached, setCached } from '../services/prefetchCache'
import { useTrackMetadataStore } from '../stores/trackMetadataStore'

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

  function prefetchAdjacentTracks() {
    const adjacent = [prevTrack.value, nextTrack.value].filter(Boolean)
    for (const track of adjacent) {
      const path = track.path_lower
      if (metaStore.cache[path]) {
        getCached(path).then(hit => {
          if (!hit) setCached(path, metaStore.cache[path])
        })
        continue
      }
      fetchTrackMetadata(path)
        .then(data => {
          metaStore.set(path, data)
          setCached(path, data)
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
      meta.value = prefetched
      textReady.value = true
      fetchTrackMetadata(pathLower)
        .then(fresh => {
          const audioUrl = getPlaying() ? meta.value.audioUrl : fresh.audioUrl
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
      Object.assign(meta.value, inMemory)
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

  return { meta, textReady, error, loadTrack, prevTrack, nextTrack }
}
