<template>
  <div class="track-detail">

    <!-- ===== 上部固定エリア ===== -->
    <div class="sticky-top">
      <!-- ヘッダー -->
      <div class="detail-header">
        <Button icon="pi pi-arrow-left" text rounded @click="$emit('back')" />
        <span class="header-title">{{ meta.title }}</span>
      </div>

      <!-- 音楽プレイヤー (audioUrl が揃ってから表示) -->
      <div class="player-bar">
        <audio ref="audioEl" :src="meta.audioUrl" preload="metadata"
        v-if="meta.audioUrl"
          @timeupdate="onTimeUpdate" @loadedmetadata="onLoaded" @ended="playing = false" />
        <Button
          :icon="playing ? 'pi pi-pause' : 'pi pi-play'"
          rounded
          text
          class="play-btn"
          :disabled="!meta.audioUrl"
          @click="togglePlay"
        />
        <div class="player-progress">
          <span class="player-time">{{ formatTime(currentTime) }}</span>
          <Slider v-model="seekValue" :max="100" class="progress-slider" @change="onSeek" :disabled="!meta.audioUrl" />
          <span class="player-time">{{ formatTime(duration) }}</span>
        </div>
      </div>

      <!-- タブナビ -->
      <div v-if="textReady" class="tab-nav">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="tab-btn"
          :class="{ active: activeTab === tab.value }"
          @click="activeTab = tab.value"
        >{{ tab.label }}</button>
      </div>
    </div>

    <!-- ===== スクロールコンテンツ ===== -->
    <div v-if="!textReady && !error" class="loading">
      <ProgressSpinner style="width: 40px; height: 40px" />
    </div>

    <Message v-if="error && !textReady" severity="error" :closable="false">{{ error }}</Message>

    <template v-if="textReady">
      <!-- 基本情報 -->
      <div v-show="activeTab === 'info'" class="tab-content">
        <div v-if="meta.pictures?.length" class="artwork-wrap">
          <img v-for="(src, i) in meta.pictures" :key="i" :src="src" class="artwork" :alt="`artwork ${i + 1}`" />
        </div>
        <div v-else class="artwork-wrap">
          <div class="artwork-placeholder"><i class="pi pi-music" /></div>
        </div>
        <div class="meta-card">
          <div class="meta-row">
            <span class="meta-label">Artist</span>
            <span class="meta-value">{{ meta.artist ?? '—' }}</span>
          </div>
          <Divider />
          <div class="meta-row">
            <span class="meta-label">Album</span>
            <span class="meta-value">{{ meta.album ?? '—' }}</span>
          </div>
          <Divider />
          <div class="meta-row">
            <span class="meta-label">Track #</span>
            <span class="meta-value">{{ meta.trackNumber ?? '—' }}</span>
          </div>
          <Divider />
          <div class="meta-row">
            <span class="meta-label">Date</span>
            <span class="meta-value">{{ meta.date ?? '—' }}</span>
          </div>
        </div>
      </div>

      <!-- 歌詞 -->
      <div v-show="activeTab === 'lyrics'" class="tab-content">
        <div v-if="meta.lyrics" class="text-block lyrics-block">{{ meta.lyrics }}</div>
        <div v-else class="text-empty">歌詞データがありません</div>
      </div>

      <!-- 画像 -->
      <div v-show="activeTab === 'images'" class="tab-content">
        <div v-if="meta.extraPictures?.length" class="image-grid">
          <img
            v-for="(src, i) in meta.extraPictures"
            :key="i"
            :src="src"
            class="extra-image"
            :alt="`image ${i + 1}`"
            @click="openViewer(src)"
          />
        </div>
        <div v-else class="text-empty">追加画像がありません</div>
      </div>

      <!-- ImageViewer -->
      <ImageViewer :visible="viewerVisible" :src="viewerSrc" @close="viewerVisible = false" />

      <!-- 解説 -->
      <div v-show="activeTab === 'notes'" class="tab-content">
        <div v-if="meta.transcribedTextPreview" class="text-block text-preview md-preview" v-html="parsedTranscribedText"></div>
        <div v-else class="text-empty">解説データがありません</div>
      </div>
    </template>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Slider from 'primevue/slider'
import { marked } from 'marked'
import { fetchTrackMetadata } from '../services/trackMetadata'
import ImageViewer from '../components/ImageViewer.vue'
import { useTrackMetadataStore } from '../stores/trackMetadataStore'
const metaStore = useTrackMetadataStore()

const props = defineProps({
  track: { type: Object, required: true },
})
defineEmits(['back'])

const tabs = [
  { value: 'info',   label: '基本情報' },
  { value: 'lyrics', label: '歌詞' },
  { value: 'images', label: '画像' },
  { value: 'notes',  label: '解説' },
]

const meta = ref({})
const textReady = ref(false)
const error = ref(null)
const activeTab = ref('info')

// ImageViewer
const viewerVisible = ref(false)
const viewerSrc = ref('')

function openViewer(src) {
  viewerSrc.value = src
  viewerVisible.value = true
}

// プレイヤー
const audioEl = ref(null)
const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const seekValue = ref(0)

function togglePlay() {
  if (!audioEl.value) return
  if (playing.value) {
    audioEl.value.pause()
    playing.value = false
  } else {
    audioEl.value.play()
    playing.value = true
  }
}

function onLoaded() {
  duration.value = audioEl.value?.duration ?? 0
}

function onTimeUpdate() {
  if (!audioEl.value) return
  currentTime.value = audioEl.value.currentTime
  if (duration.value > 0) {
    seekValue.value = (audioEl.value.currentTime / duration.value) * 100
  }
}

function onSeek(value) {
  if (!audioEl.value || duration.value === 0) return
  audioEl.value.currentTime = (value / 100) * duration.value
}

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const parsedTranscribedText = computed(() =>
  meta.value.transcribedTextPreview ? marked.parse(meta.value.transcribedTextPreview) : ''
)

onMounted(async () => {
  // キャッシュがあればテキスト系を即反映
  const cached = metaStore.cache[props.track.path_lower]
  if (cached) {
    Object.assign(meta.value, cached)
    textReady.value = true
  }

  // audioUrl・画像は常時フェッチ
  try {
    const fetched = await fetchTrackMetadata(props.track.path_lower)
    meta.value = fetched
    metaStore.set(props.track.path_lower, fetched)
    textReady.value = true
  } catch (e) {
    if (!textReady.value) error.value = e.message
    // キャッシュがある場合はテキストを表示し続ける（音声は利用不可）
  }
})

onUnmounted(() => {
  if (audioEl.value) audioEl.value.pause()
  meta.value.pictures?.forEach((url) => URL.revokeObjectURL(url))
  meta.value.extraPictures?.forEach((url) => URL.revokeObjectURL(url))
})
</script>

<style scoped>
.track-detail {
  padding-bottom: 24px;
  height: 100%;
}

/* ===== 上部固定エリア ===== */
.sticky-top {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--p-content-background);
  border-bottom: 1px solid var(--p-content-border-color);
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 8px 4px;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* プレイヤーバー */
.player-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-top: 1px solid var(--p-content-border-color);
}

.play-btn {
  flex-shrink: 0;
}

.player-progress {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.progress-slider {
  flex: 1;
}

.player-time {
  font-size: 12px;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
  min-width: 32px;
}

/* タブナビ */
.tab-nav {
  display: flex;
  border-top: 1px solid var(--p-content-border-color);
}

.tab-btn {
  flex: 1;
  padding: 10px 4px;
  font-size: 13px;
  font-weight: 500;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--p-text-muted-color);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.tab-btn:hover {
  color: var(--p-text-color);
}

.tab-btn.active {
  color: var(--p-primary-color);
  border-bottom-color: var(--p-primary-color);
}

/* ===== コンテンツエリア ===== */
.loading {
  display: flex;
  justify-content: center;
  padding: 60px;
}

.tab-content {
  display: flex;
  flex-direction: column;
  height: 80%;
  justify-content: space-between;
  padding-bottom: 8px;
  overflow-y: scroll;
}

/* アートワーク */
.artwork-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 16px 16px 12px;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.artwork-scroll::-webkit-scrollbar {
  display: none;
}

.artwork-wrap {
  display: flex;
  justify-content: center;
  padding:50px 16px ;
}

.artwork {
  width: 250px;
  height: 250px;
  object-fit: cover;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  flex-shrink: 0;
  scroll-snap-align: start;
}

.artwork-placeholder {
  width: 250px;
  height: 250px;
  border-radius: 12px;
  background: var(--p-content-hover-background);
  display: flex;
  align-items: center;
  justify-content: center;
}

.artwork-placeholder i {
  font-size: 56px;
  color: var(--p-text-muted-color);
}

/* メタ情報カード */
.meta-card {
  margin: 0 16px 16px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 4px 16px;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.meta-label {
  font-size: 13px;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
  width: 72px;
}

.meta-value {
  font-size: 14px;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* テキスト */
.text-block {
  margin: 16px 16px 0;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  background: var(--p-content-hover-background);
  border-radius: 8px;
  padding: 12px;
}

.lyrics-block {
  font-size: 10px;
  line-height: 1.9;
}

.text-preview {
  font-size: 10px;
}

.md-preview {
  white-space: normal;
}

.md-preview :deep(h1),
.md-preview :deep(h2),
.md-preview :deep(h3),
.md-preview :deep(h4) {
  margin: 0.6em 0 0.3em;
  line-height: 1.3;
}

.md-preview :deep(p) { margin: 0.4em 0; }

.md-preview :deep(ul),
.md-preview :deep(ol) {
  padding-left: 1.4em;
  margin: 0.4em 0;
}

.md-preview :deep(code) {
  font-family: monospace;
  background: var(--p-content-border-color);
  border-radius: 4px;
  padding: 0.1em 0.3em;
  font-size: 0.9em;
}

.md-preview :deep(pre) {
  background: var(--p-content-border-color);
  border-radius: 6px;
  padding: 10px 12px;
  overflow-x: auto;
}

.md-preview :deep(pre code) { background: none; padding: 0; }

.md-preview :deep(blockquote) {
  border-left: 3px solid var(--p-primary-color);
  margin: 0.4em 0;
  padding: 0.2em 0 0.2em 0.8em;
  color: var(--p-text-muted-color);
}

.md-preview :deep(hr) {
  border: none;
  border-top: 1px solid var(--p-content-border-color);
  margin: 0.8em 0;
}

.md-preview :deep(a) { color: var(--p-primary-color); }

.text-empty {
  margin: 24px 16px;
  font-size: 14px;
  color: var(--p-text-muted-color);
  text-align: center;
}

/* 追加画像グリッド */
.image-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.extra-image {
  width: 100%;
  border-radius: 10px;
  object-fit: contain;
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
  cursor: zoom-in;
  active-opacity: 0.8;
}
.p-divider{
  margin: 0.1rem;
}
.meta-card{
  border: none;
  margin-bottom: 0;
}
</style>
