<template>
  <div class="track-detail">

    <!-- ===== 上部固定エリア ===== -->
    <div class="sticky-top">
      <div class="detail-header">
        <Button icon="pi pi-arrow-left" text rounded @click="$emit('back')" />
        <span class="header-title">{{ meta.title }}</span>
        <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmDeleteTrackData" />
      </div>
      <div v-if="textReady" class="tab-nav">
        <button v-for="tab in tabs" :key="tab.value" class="tab-btn" :class="{ active: activeTab === tab.value }" @click="activeTab = tab.value">{{ tab.label }}</button>
      </div>
    </div>

    <!-- ===== スクロールコンテンツ ===== -->
    <div v-if="!textReady && !error" class="loading">
      <ProgressSpinner style="width: 40px; height: 40px" />
    </div>

    <Message v-if="error && !textReady" severity="error" :closable="false">{{ error }}</Message>

    <template v-if="textReady">
      <div v-show="activeTab === 'info'">
        <TrackInfoTab :meta="meta" />
      </div>

      <div v-show="activeTab === 'images'">
        <TrackImagesTab :extra-pictures="meta.extraPictures" @open-viewer="openViewer" />
      </div>

      <ImageViewer :visible="viewerVisible" :images="meta.extraPictures ?? []" :start-index="viewerIndex" @close="viewerVisible = false" />

      <div v-show="activeTab === 'lyrics'">
        <TrackVisualTab
          :has-lyrics="!!meta.lyrics"
          :visual-body-html="visualBodyHtml"
          :visual-css-vars="visualCssVars"
          :visual-tooltip-data="visualTooltipData"
          :visual-phase="visualPhase"
          :visual-error="visualError"
          @generate="generateVisual"
          @discard="discardVisual"
        />
      </div>

      <div v-show="activeTab === 'quiz'">
        <TrackQuizTab
          :quiz-store="quizStore"
          :track-path="track.path_lower"
          :quiz-phase="quizPhase"
          :quiz-index="quizIndex"
          :quiz-order="quizOrder"
          :quiz-questions="quizQuestions"
          :current-question="currentQuestion"
          :quiz-results="quizResults"
          :correct-count="correctCount"
          :quiz-gen-error="quizGenError"
          :hint-open="hintOpen"
          :user-answer="userAnswer"
          :accept-as-correct="acceptAsCorrect"
          :accept-validating="acceptValidating"
          :accept-reason="acceptReason"
          :DIFFICULTY_LABELS="DIFFICULTY_LABELS"
          @start-quiz="startQuiz"
          @exit-cover="exitToCover"
          @confirm-clear="confirmClearQuiz"
          @toggle-hint="hintOpen = !hintOpen"
          @submit-answer="submitAnswer"
          @next-question="nextQuestion"
          @accept-correct="handleAcceptAsCorrect"
          @revert-correct="revertAcceptAsCorrect"
          @retry="retryQuiz"
          @regenerate="regenerateQuiz"
          @update:userAnswer="userAnswer = $event"
          @update:acceptAsCorrect="acceptAsCorrect = $event"
        />
      </div>
    </template>

    <Toast />
    <ConfirmDialog :pt="{ root: { style: 'max-width: 300px; margin: 0 16px' } }" />

    <!-- テストクリア確認モーダル -->
    <Dialog v-model:visible="clearConfirmVisible" modal :closable="false" :style="{ width: '280px' }" header="テストをクリア">
      <p class="clear-confirm-msg">この曲のテスト問題と進捗をすべて削除します。<br>よろしいですか？</p>
      <template #footer>
        <Button label="キャンセル" text @click="clearConfirmVisible = false" />
        <Button label="クリア" severity="danger" icon="pi pi-trash" @click="executeClearQuiz" />
      </template>
    </Dialog>

    <!-- ===== 下部固定プレイヤー ===== -->
    <PlayerBar
      ref="playerBarRef"
      :audio-url="meta.audioUrl"
      :next-audio-url="nextAudioUrl"
      :autoplay="props.autoplay"
      :keyboard-visible="keyboardVisible"
      @next-track="goToNextTrack"
    />

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Dialog from 'primevue/dialog'
import ConfirmDialog from 'primevue/confirmdialog'
import Toast from 'primevue/toast'
import ImageViewer from '../components/ImageViewer.vue'
import PlayerBar from '../components/track/PlayerBar.vue'
import TrackInfoTab from '../components/track/TrackInfoTab.vue'
import TrackImagesTab from '../components/track/TrackImagesTab.vue'
import TrackVisualTab from '../components/track/TrackVisualTab.vue'
import TrackQuizTab from '../components/track/TrackQuizTab.vue'
import { useTrackLoader } from '../composables/useTrackLoader'
import { useQuizSession } from '../composables/useQuizSession'
import { useVisualStore } from '../stores/visualStore'
import { useTrackMetadataStore } from '../stores/trackMetadataStore'
import { useQuizStore } from '../stores/quizStore'
import { generateVisualHtml, buildPlainVisualHtml } from '../services/ai/generateVisual'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'

const props = defineProps({
  track: { type: Object, required: true },
  albumTracks: { type: Array, default: () => [] },
  autoplay: { type: Boolean, default: false },
})
const emit = defineEmits(['back', 'select-track'])

function goToNextTrack() {
  const tracks = props.albumTracks
  if (!tracks.length) return
  const idx = tracks.findIndex(t => t.path_lower === props.track.path_lower)
  if (idx === -1 || idx >= tracks.length - 1) return
  emit('select-track', { track: tracks[idx + 1], albumTracks: tracks, autoplay: true })
}

const playerBarRef = ref(null)
const visualStore = useVisualStore()
const trackMetadataStore = useTrackMetadataStore()
const _quizStoreForDelete = useQuizStore()
const confirm = useConfirm()
const toast = useToast()

// ===== トラック読み込み =====
const { meta, textReady, error, loadTrack, nextAudioUrl } = useTrackLoader(props, {
  getPlaying: () => playerBarRef.value?.playing.value ?? false,
})

const tabs = [
  { value: 'info', label: '基本情報' },
  { value: 'lyrics', label: '歌詞' },
  { value: 'images', label: '画像' },
  { value: 'quiz', label: 'テスト' },
]
const activeTab = ref('info')

// ImageViewer
const viewerVisible = ref(false)
const viewerIndex = ref(0)
function openViewer(index) {
  viewerIndex.value = index
  viewerVisible.value = true
}

// ===== キーボード検知 =====
const keyboardVisible = ref(false)
function onViewportResize() {
  if (!window.visualViewport) return
  keyboardVisible.value = window.innerHeight - window.visualViewport.height > 150
}

onMounted(() => {
  loadTrack(props.track.path_lower)
  window.visualViewport?.addEventListener('resize', onViewportResize)
})

watch(() => props.track, (newTrack) => {
  loadTrack(newTrack.path_lower)
  activeTab.value = 'info'
})

onUnmounted(() => {
  playerBarRef.value?.reset()
  window.visualViewport?.removeEventListener('resize', onViewportResize)
})

// ===== ビジュアル =====
const visualPhase = ref(visualStore.get(props.track.path_lower) ? 'ready' : 'idle')
const visualError = ref(null)

const visualData = computed(() =>
  visualStore.get(props.track.path_lower) ?? (meta.value.lyrics ? buildPlainVisualHtml(meta.value) : null)
)
const visualCssVars = computed(() => {
  const vars = visualData.value?.cssVars ?? {}
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v]))
})
const visualBodyHtml = computed(() => visualData.value?.bodyHtml ?? '')
const visualTooltipData = computed(() => visualData.value?.tooltipData ?? {})

async function generateVisual() {
  visualError.value = null
  visualPhase.value = 'generating'
  try {
    const data = await generateVisualHtml(meta.value)
    visualStore.set(props.track.path_lower, data)
    visualPhase.value = 'ready'
  } catch (e) {
    visualError.value = e.message
    visualPhase.value = 'idle'
  }
}

function discardVisual() {
  visualStore.remove(props.track.path_lower)
  visualPhase.value = 'idle'
  visualError.value = null
}

watch(() => props.track, () => {
  visualError.value = null
  visualPhase.value = visualStore.get(props.track.path_lower) ? 'ready' : 'idle'
})

function confirmDeleteTrackData() {
  confirm.require({
    message: 'この曲のクイズ・歌詞ビジュアル・メタデータをすべて削除します。この操作は元に戻せません。',
    header: `「${meta.value.title ?? props.track.name}」のデータを削除しますか？`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: '削除する',
    rejectLabel: 'キャンセル',
    acceptSeverity: 'danger',
    accept() {
      try {
        const path = props.track.path_lower
        _quizStoreForDelete.removeTrack(path)
        visualStore.remove(path)
        trackMetadataStore.remove(path)
        visualPhase.value = 'idle'
        visualError.value = null
        toast.add({ severity: 'success', summary: 'データを削除しました', life: 3000 })
      } catch (e) {
        console.error('[deleteTrackData]', e)
      }
    },
  })
}

// ===== クイズ =====
const {
  quizStore,
  quizPhase, quizDifficulty, quizIndex, quizOrder, hintOpen,
  userAnswer, quizResults, quizGenError,
  acceptAsCorrect, acceptValidating, acceptReason,
  clearConfirmVisible,
  quizQuestions, currentQuestion, correctCount,
  DIFFICULTY_LABELS,
  applyShuffleToRemaining,
  startQuiz, exitToCover,
  submitAnswer, handleAcceptAsCorrect, revertAcceptAsCorrect,
  nextQuestion,
  confirmClearQuiz, executeClearQuiz,
  retryQuiz, regenerateQuiz,
} = useQuizSession(props, { meta, visualTooltipData })

watch(() => quizStore.shuffle, applyShuffleToRemaining)
</script>

<style scoped>
.track-detail {
  padding-bottom: 64px;
  height: 100%;
}

/* 上部固定エリア */
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
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

/* ローディング */
.loading {
  display: flex;
  justify-content: center;
  padding: 60px;
}

/* クリア確認 */
.clear-confirm-msg {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--p-text-color);
}
</style>
