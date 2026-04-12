<template>
  <div class="home">
    <div v-if="!authenticated" class="empty-state">
      <i class="pi pi-cloud" />
      <p>設定から Dropbox に接続してください</p>
    </div>

    <div v-else-if="!filePath" class="empty-state">
      <i class="pi pi-folder" />
      <p>設定でファイルパスを指定してください</p>
    </div>

    <template v-else>
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

      <div v-if="loading" class="loading">
        <ProgressSpinner style="width: 40px; height: 40px" />
      </div>

      <template v-if="!loading && !error">
        <template v-for="[album, albumTracks] in groupedTracks" :key="album">
          <div class="album-header" @click="toggleAlbum(album)">
            <i class="pi pi-disc album-icon" />
            <span class="album-name">{{ album }}</span>
            <span class="album-count">{{ albumTracks.length }}</span>
            <i :class="['pi', collapsedAlbums.has(album) ? 'pi-chevron-right' : 'pi-chevron-down', 'album-chevron']" />
          </div>
          <div v-if="!collapsedAlbums.has(album)" class="track-list">
            <div v-for="track in albumTracks" :key="track.id" class="track-row" @click="$emit('select-track', { track, albumTracks })">
              <span class="track-number">{{ trackNum(metadata[track.id]?.trackNumber) }}</span>
              <div class="track-info">
                <span class="track-name">{{ metadata[track.id]?.title ?? stripExt(track.name) }}</span>
              </div>
            </div>
          </div>
        </template>

        <div v-if="!tracks.length" class="empty-state">
          <i class="pi pi-inbox" />
          <p>MP3 ファイルが見つかりませんでした</p>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
defineEmits(['select-track'])
defineExpose({ load })

import { ref, reactive, computed, onMounted } from 'vue'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { isAuthenticated, loadFilePath } from '../services/dropboxAuth'
import { listAllTracks } from '../services/dropboxFiles'
import { fetchTrackMetadata } from '../services/trackMetadata'
import { useTrackMetadataStore } from '../stores/trackMetadataStore'

const metaStore = useTrackMetadataStore()

const authenticated = ref(false)
const filePath = ref('')
const tracks = ref([])
const loading = ref(false)
const error = ref(null)
const metadata = reactive({})
const collapsedAlbums = ref(new Set())

const groupedTracks = computed(() => {
  const groups = new Map()
  for (const track of tracks.value) {
    const meta = metadata[track.id]
    if (!meta) continue  // メタデータ未取得はスキップ
    const album = meta.album || '(アルバム不明)'
    if (!groups.has(album)) groups.set(album, [])
    groups.get(album).push(track)
  }
  for (const albumTracks of groups.values()) {
    albumTracks.sort((a, b) => parseTrackNum(metadata[a.id]?.trackNumber) - parseTrackNum(metadata[b.id]?.trackNumber))
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})

function toggleAlbum(album) {
  const s = new Set(collapsedAlbums.value)
  s.has(album) ? s.delete(album) : s.add(album)
  collapsedAlbums.value = s
}

function parseTrackNum(val) {
  return parseInt(String(val ?? '').split('/')[0]) || 999
}

function trackNum(val) {
  const n = parseInt(String(val ?? '').split('/')[0])
  return isNaN(n) ? '' : n
}

function stripExt(name) {
  return name.replace(/\.[^.]+$/, '')
}

onMounted(() => {
  authenticated.value = isAuthenticated()
  filePath.value = loadFilePath()
  if (authenticated.value && filePath.value) load()
})

async function load() {
  loading.value = true
  error.value = null
  tracks.value = []
  Object.keys(metadata).forEach(k => delete metadata[k])
  collapsedAlbums.value = new Set()
  try {
    tracks.value = await listAllTracks(filePath.value)

    // キャッシュ済みはストアから即反映、未キャッシュのみフェッチ
    const missing = []
    for (const track of tracks.value) {
      const cached = metaStore.cache[track.path_lower]
      if (cached) {
        metadata[track.id] = cached
      } else {
        missing.push(track)
      }
    }

    // 現在のリストにないパスをストアから削除
    metaStore.prune(tracks.value.map(t => t.path_lower))

    fetchAllMetadata(missing)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const CONCURRENCY = 3

async function fetchAllMetadata(trackList) {
  let i = 0
  async function next() {
    if (i >= trackList.length) return
    const track = trackList[i++]
    try {
      const meta = await fetchTrackMetadata(track.path_lower)
      metaStore.set(track.path_lower, meta)
      metadata[track.id] = metaStore.cache[track.path_lower]
    } catch {
      metadata[track.id] = {}
    }
    await next()
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, next))
}
</script>

<style scoped>
.home {
  padding: 16px;
}

.track-count {
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-bottom: 8px;
}

.album-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 6px 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
  border-bottom: 2px solid var(--p-primary-color);
  margin-top: 12px;
  cursor: pointer;
  user-select: none;
}

.album-header:first-of-type {
  margin-top: 0;
}

.album-icon {
  font-size: 13px;
  color: var(--p-primary-color);
  flex-shrink: 0;
}

.album-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-count {
  font-size: 11px;
  font-weight: 400;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}

.album-chevron {
  font-size: 11px;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}

.track-list {
  display: flex;
  flex-direction: column;
  padding-left: 8px;
}

.track-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 6px;
  border-bottom: 1px solid var(--p-content-border-color);
  cursor: pointer;
  transition: background 0.15s;
}

.track-row:hover {
  background: var(--p-content-hover-background);
}

.track-number {
  font-size: 12px;
  color: var(--p-text-muted-color);
  width: 24px;
  text-align: right;
  flex-shrink: 0;
}

.track-info {
  flex: 1;
  overflow: hidden;
}

.track-name {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 16px;
  color: var(--p-text-muted-color);
}

.empty-state i {
  font-size: 40px;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}
</style>
