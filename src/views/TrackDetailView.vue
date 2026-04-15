<template>
  <div class="track-detail">

    <!-- ===== 上部固定エリア ===== -->
    <div class="sticky-top">
      <!-- ヘッダー -->
      <div class="detail-header">
        <Button icon="pi pi-arrow-left" text rounded @click="$emit('back')" />
        <span class="header-title">{{ meta.title }}</span>
      </div>

      <!-- タブナビ -->
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
      <!-- 基本情報 -->
      <div v-show="activeTab === 'info'" class="tab-content">
        <div class="albumTitle">
          <div v-if="meta.pictures?.length" class="artwork-wrap">
            <img v-for="(src, i) in meta.pictures" :key="i" :src="src" class="artwork" :alt="`artwork ${i + 1}`" />
          </div>
          <div v-else class="artwork-wrap">
            <div class="artwork-placeholder"><i class="pi pi-music" /></div>
          </div>
          <span class="album-title">{{ meta.title }}</span>
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
      <!-- <div v-show="activeTab === 'lyrics'" class="tab-content">
        <div v-if="meta.lyrics" class="text-block lyrics-block">{{ meta.lyrics }}</div>
        <div v-else class="text-empty">歌詞データがありません</div>
      </div> -->

      <!-- 画像 -->
      <div v-show="activeTab === 'images'" class="tab-content">
        <div v-if="meta.extraPictures?.length" class="image-grid">
          <img v-for="(src, i) in meta.extraPictures" :key="i" :src="src" class="extra-image" :alt="`image ${i + 1}`" @click="openViewer(src)" />
        </div>
        <div v-else class="text-empty">追加画像がありません</div>
      </div>

      <!-- ImageViewer -->
      <ImageViewer :visible="viewerVisible" :src="viewerSrc" @close="viewerVisible = false" />

      <!-- 解説 -->
      <!-- <div v-show="activeTab === 'notes'" class="tab-content">
        <div v-if="meta.transcribedTextPreview" class="text-block text-preview md-preview" v-html="parsedTranscribedText"></div>
        <div v-else class="text-empty">解説データがありません</div>
      </div> -->

      <!-- ビジュアル -->
      <div v-show="activeTab === 'lyrics'" class="tab-content visual-content">
        <template v-if="meta.lyrics">
          <!-- 歌詞本体 -->
          <div class="visual-body" :style="visualCssVars" v-html="visualBodyHtml" @click="onVisualClick" ref="visualBodyRef" />
          <!-- ツールチップ -->
          <Teleport to="body">
            <div v-if="tooltip.visible" class="visual-tooltip" :style="tooltip.style">
              <div class="visual-tooltip-title">{{ tooltip.title }}</div>
              <div>{{ tooltip.body }}</div>
            </div>
          </Teleport>
          <!-- idle: 生成ボタンオーバーレイ -->
          <div v-if="visualPhase === 'idle'" class="visual-overlay">
            <Message v-if="visualError" severity="error" :closable="false" class="visual-error">{{ visualError }}</Message>
            <Button icon="pi pi-sparkles" class="visual-gen-btn" @click="generateVisual" />
          </div>
          <!-- generating: スピナーオーバーレイ -->
          <div v-else-if="visualPhase === 'generating'" class="visual-overlay">
            <ProgressSpinner style="width: 48px; height: 48px" />
          </div>
          <!-- ready: ツールバー -->
          <div v-else-if="visualPhase === 'ready'" class="visual-toolbar">
            <Button icon="pi pi-refresh" label="再生成" text size="small" @click="generateVisual" />
            <Button icon="pi pi-trash" label="破棄" text size="small" severity="secondary" @click="discardVisual" />
          </div>
        </template>
        <!-- 歌詞なし -->
        <template v-else>
          <div class="visual-idle">
            <i class="pi pi-palette visual-idle-icon" />
            <p class="visual-idle-desc">歌詞データがありません</p>
          </div>
        </template>
      </div>

      <!-- テスト -->
      <div v-show="activeTab === 'quiz'" class="tab-content quiz-content">

        <!-- 表紙フェーズ -->
        <template v-if="quizPhase === 'cover'">
          <div class="quiz-header">
            <div class="quiz-header-actions" style="margin-left: auto">
              <div class="quiz-shuffle-row quiz-shuffle-inline">
                <Checkbox v-model="quizStore.shuffle" :binary="true" inputId="shuffleCover" />
                <label for="shuffleCover" class="quiz-shuffle-label">シャッフル</label>
              </div>
              <Button icon="pi pi-trash" text rounded size="small" severity="danger" class="quiz-clear-btn" @click="confirmClearQuiz" />
            </div>
          </div>
          <div class="quiz-cover">
            <i class="pi pi-lightbulb quiz-cover-icon" />
            <p class="quiz-cover-title">テスト</p>
            <p class="quiz-cover-desc">問題の種類を選んでテストを始めましょう</p>
            <Message v-if="quizGenError" severity="error" :closable="false" class="quiz-gen-error">{{ quizGenError }}</Message>
          </div>
          <div class="quiz-difficulty-btns">
            <Button
              v-for="d in ['low', 'medium', 'high']"
              :key="d"
              :label="DIFFICULTY_LABELS[d]"
              :severity="{ low: 'info', medium: 'success', high: 'warn' }[d]"
              class="quiz-submit-btn"
              @click="startQuiz(d)"
            />
          </div>
        </template>

        <!-- 生成中フェーズ -->
        <template v-else-if="quizPhase === 'generating'">
          <div class="quiz-generating">
            <ProgressSpinner style="width: 48px; height: 48px" />
            <p class="quiz-generating-text">AIが問題を作成しています…</p>
          </div>
        </template>

        <!-- 問題フェーズ -->
        <template v-else-if="quizPhase === 'question'">
          <div class="quiz-header">
            <div class="quiz-progress">
              <span class="quiz-progress-text">{{ quizIndex + 1 }} / {{ quizQuestions.length }}</span>
              <div class="quiz-progress-bar">
                <div class="quiz-progress-fill" :style="{ width: ((quizIndex + 1) / quizQuestions.length * 100) + '%' }" />
              </div>
            </div>
            <div class="quiz-header-actions">
              <div class="quiz-shuffle-row quiz-shuffle-inline">
                <Checkbox v-model="quizStore.shuffle" :binary="true" inputId="shuffleQ" />
                <label for="shuffleQ" class="quiz-shuffle-label">シャッフル</label>
              </div>
              <Button icon="pi pi-home" text rounded size="small" severity="secondary" @click="exitToCover" />
              <Button icon="pi pi-trash" text rounded size="small" severity="danger" class="quiz-clear-btn" @click="confirmClearQuiz" />
            </div>
          </div>
          <div class="quiz-card">
            <p class="quiz-question">{{ currentQuestion.question }}</p>
            <div v-if="currentQuestion.hint" class="quiz-hint-wrap">
              <button class="quiz-hint-toggle" @click="hintOpen = !hintOpen">
                <i :class="hintOpen ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
                ヒント
              </button>
              <Transition name="hint">
                <p v-if="hintOpen" class="quiz-hint-body">{{ currentQuestion.hint }}</p>
              </Transition>
            </div>
          </div>
          <div class="quiz-input">
            <InputText v-model="userAnswer" class="quiz-input" placeholder="答えを入力してください" @keyup.enter="userAnswer.trim() && submitAnswer()" />
            <Button label="回答する" class="quiz-submit-btn" :disabled="!userAnswer.trim()" @click="submitAnswer" />
          </div>
        </template>

        <!-- 正誤フェーズ -->
        <template v-else-if="quizPhase === 'feedback'">
          <div class="quiz-header">
            <div class="quiz-progress">
              <span class="quiz-progress-text">{{ quizIndex + 1 }} / {{ quizQuestions.length }}</span>
              <div class="quiz-progress-bar">
                <div class="quiz-progress-fill" :style="{ width: ((quizIndex + 1) / quizQuestions.length * 100) + '%' }" />
              </div>
            </div>
            <div class="quiz-header-actions">
              <div class="quiz-shuffle-row quiz-shuffle-inline">
                <Checkbox v-model="quizStore.shuffle" :binary="true" inputId="shuffleF" />
                <label for="shuffleF" class="quiz-shuffle-label">シャッフル</label>
              </div>
              <Button icon="pi pi-home" text rounded size="small" severity="secondary" @click="exitToCover" />
              <Button icon="pi pi-trash" text rounded size="small" severity="danger" class="quiz-clear-btn" @click="confirmClearQuiz" />
            </div>
          </div>
          <div class="quiz-card">
            <p class="quiz-question">{{ currentQuestion.question }}</p>
            <div class="quiz-feedback" :class="quizResults[quizIndex].correct ? 'feedback-correct' : 'feedback-wrong'">
              <div class="feedback-icon">
                <i :class="quizResults[quizIndex].correct ? 'pi pi-check-circle' : 'pi pi-times-circle'" />
              </div>
              <p class="feedback-label">{{ quizResults[quizIndex].correct ? '正解！' : '不正解' }}</p>
              <div class="feedback-detail">
                <div class="feedback-row">
                  <span class="feedback-tag">あなたの答え</span>
                  <span class="feedback-user-answer" :class="quizResults[quizIndex].correct ? 'feedback-user-answer--correct' : 'feedback-user-answer--wrong'">{{ quizResults[quizIndex].userAnswer }}</span>
                </div>
                <div v-if="!quizResults[quizIndex].correct" class="feedback-row">
                  <span class="feedback-tag">正解</span>
                  <span class="feedback-correct-answer">{{ (currentQuestion.answers ?? [currentQuestion.answer]).join(' / ') }}</span>
                </div>
              </div>
              <p v-if="currentQuestion.hint" class="feedback-hint">{{ currentQuestion.hint }}</p>
              <div v-if="!quizResults[quizIndex].correct || quizResults[quizIndex].manuallyAccepted" class="accept-correct-row">
                <Checkbox v-model="acceptAsCorrect" :binary="true" inputId="acceptCorrect" :disabled="acceptValidating" @update:modelValue="val => val ? handleAcceptAsCorrect() : revertAcceptAsCorrect()" />
                <label for="acceptCorrect" class="accept-correct-label">この答えを正解とする</label>
                <ProgressSpinner v-if="acceptValidating" style="width: 18px; height: 18px" />
              </div>
              <div v-if="acceptReason" class="accept-reason" :class="acceptAsCorrect ? 'accept-reason--ok' : 'accept-reason--ng'">
                <i :class="acceptAsCorrect ? 'pi pi-check-circle' : 'pi pi-times-circle'" />
                {{ acceptReason }}
              </div>
            </div>
          </div>
          <div class="quiz-input">
            <Button :label="quizIndex + 1 < quizQuestions.length ? '次の問題へ' : '結果を見る'" class="quiz-submit-btn" @click="nextQuestion" />
          </div>
        </template>

        <!-- リザルトフェーズ -->
        <template v-else-if="quizPhase === 'result'">
          <div class="quiz-result">
            <div class="result-score-wrap">
              <div class="result-score">
                <span class="result-score-num">{{ correctCount }}</span>
                <span class="result-score-total"> / {{ quizQuestions.length }}</span>
              </div>
              <p class="result-score-label">
                <template v-if="correctCount === quizQuestions.length">全問正解！すばらしい！</template>
                <template v-else-if="correctCount >= quizQuestions.length * 0.7">よくできました！</template>
                <template v-else-if="correctCount >= quizQuestions.length * 0.4">もう少しです！</template>
                <template v-else>復習してみましょう！</template>
              </p>
            </div>
            <div class="result-list">
              <div v-for="(r, i) in quizResults" :key="i" class="result-item" :class="r.correct ? 'result-item-correct' : 'result-item-wrong'">
                <i :class="r.correct ? 'pi pi-check' : 'pi pi-times'" class="result-item-icon" />
                <div class="result-item-body">
                  <p class="result-item-q">{{ quizQuestions[quizOrder[i]].question }}</p>
                  <p class="result-item-ans">
                    あなたの答え: <strong :class="r.correct ? 'result-ans-correct' : 'result-ans-wrong'">{{ r.userAnswer }}</strong>
                  </p>
                  <p v-if="!r.correct" class="result-item-ans">
                    正解: <strong>{{ (quizQuestions[quizOrder[i]].answers ?? [quizQuestions[quizOrder[i]].answer]).join(' / ') }}</strong>
                  </p>
                </div>
              </div>
            </div>
            <Button label="もう一度挑戦する" icon="pi pi-refresh" class="quiz-submit-btn" @click="retryQuiz" />
            <Button v-if="correctCount === quizQuestions.length" label="別の問題にチャレンジ" icon="pi pi-sparkles" severity="secondary" class="quiz-submit-btn" @click="regenerateQuiz" />
            <Button label="表紙に戻る" icon="pi pi-home" severity="secondary" class="quiz-submit-btn" @click="exitToCover" />
            <Button label="テストをクリア" icon="pi pi-trash" severity="danger" text class="quiz-submit-btn" @click="confirmClearQuiz" />
          </div>
        </template>

      </div>
    </template>

    <!-- テストクリア確認モーダル -->
    <Dialog v-model:visible="clearConfirmVisible" modal :closable="false" :style="{ width: '280px' }" header="テストをクリア">
      <p class="clear-confirm-msg">この曲のテスト問題と進捗をすべて削除します。<br>よろしいですか？</p>
      <template #footer>
        <Button label="キャンセル" text @click="clearConfirmVisible = false" />
        <Button label="クリア" severity="danger" icon="pi pi-trash" @click="executeClearQuiz" />
      </template>
    </Dialog>

    <!-- ===== 下部固定プレイヤー ===== -->
    <div class="player-bar" :class="{ 'player-bar--hidden': keyboardVisible }">
      <audio ref="audioEl" :src="meta.audioUrl" preload="metadata" :loop="repeatEnabled" v-if="meta.audioUrl" @timeupdate="onTimeUpdate" @loadedmetadata="onLoaded" @ended="playing = false" />
      <Button :icon="playing ? 'pi pi-pause' : 'pi pi-play'" rounded text class="play-btn" :disabled="!meta.audioUrl" @click="togglePlay" />
      <div class="player-progress">
        <span class="player-time">{{ formatTime(currentTime) }}</span>
        <Slider v-model="seekValue" :max="100" class="progress-slider" @change="onSeek" :disabled="!meta.audioUrl" />
        <span class="player-time">{{ formatTime(duration) }}</span>
        <div class="repeat-toggle" :class="{ active: repeatEnabled, disabled: !meta.audioUrl }">
          <label class="repeat-label" for="repeatToggle" aria-label="Toggle Repeat">
            <i class="pi pi-sync" />
          </label>
          <ToggleSwitch v-model="repeatEnabled" :disabled="!meta.audioUrl" inputId="repeatToggle" class="repeat-switch-hidden" />
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Slider from 'primevue/slider'
import ToggleSwitch from 'primevue/toggleswitch'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import { marked } from 'marked'
import { fetchTrackMetadata } from '../services/trackMetadata'
import { getCached, setCached } from '../services/prefetchCache'
import ImageViewer from '../components/ImageViewer.vue'
import { useTrackMetadataStore } from '../stores/trackMetadataStore'
import { useQuizStore } from '../stores/quizStore'
import { useVisualStore } from '../stores/visualStore'
import { generateQuizQuestions, validateAcceptAnswer, generateVisualHtml, buildPlainVisualHtml } from '../services/claudeApi'
const metaStore = useTrackMetadataStore()
const quizStore = useQuizStore()
const visualStore = useVisualStore()

const props = defineProps({
  track: { type: Object, required: true },
  albumTracks: { type: Array, default: () => [] },
  autoplay: { type: Boolean, default: false },
})
const emit = defineEmits(['back', 'select-track'])

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

function navigateTo(track) {
  if (!track) return
  emit('select-track', { track, albumTracks: props.albumTracks, autoplay: true })
}

const tabs = [
  { value: 'info', label: '基本情報' },
  { value: 'lyrics', label: '歌詞' },
  { value: 'images', label: '画像' },
  { value: 'quiz', label: 'テスト' },
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
const repeatEnabled = ref(false)
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
  if (props.autoplay) {
    audioEl.value.play()
    playing.value = true
  }
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

async function loadTrack(pathLower) {
  // プレイヤーリセット
  if (audioEl.value) audioEl.value.pause()
  playing.value = false
  currentTime.value = 0
  duration.value = 0
  seekValue.value = 0
  // コンテンツリセット
  meta.value = {}
  textReady.value = false
  error.value = null
  activeTab.value = 'info'
  visualError.value = null
  visualPhase.value = visualStore.get(pathLower) ? 'ready' : 'idle'

  // 1. IndexedDB プリフェッチキャッシュを確認（ヒット時は即反映して autoplay 可能に）
  const prefetched = await getCached(pathLower)
  if (prefetched) {
    meta.value = prefetched
    textReady.value = true
    // バックグラウンドでネットワーク再フェッチ（audioUrl 更新）
    fetchTrackMetadata(pathLower)
      .then((fresh) => {
        // 再生中は audioUrl を差し替えない（再生が中断されるため）
        const audioUrl = playing.value ? meta.value.audioUrl : fresh.audioUrl
        meta.value = { ...fresh, audioUrl }
        metaStore.set(pathLower, fresh)
        setCached(pathLower, fresh)
      })
      .catch(() => { })
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

function prefetchAdjacentTracks() {
  const adjacent = [prevTrack.value, nextTrack.value].filter(Boolean)
  for (const track of adjacent) {
    const path = track.path_lower
    // インメモリキャッシュにあれば IndexedDB に書くだけ
    if (metaStore.cache[path]) {
      getCached(path).then((hit) => {
        if (!hit) setCached(path, metaStore.cache[path])
      })
      continue
    }
    // 未取得ならバックグラウンドフェッチ
    fetchTrackMetadata(path)
      .then((data) => {
        metaStore.set(path, data)
        setCached(path, data)
      })
      .catch(() => { })
  }
}

// ===== キーボード検知 =====
const keyboardVisible = ref(false)

function onViewportResize() {
  if (!window.visualViewport) return
  // visual viewport がwindow高さより150px以上小さければキーボード表示中とみなす
  keyboardVisible.value = window.innerHeight - window.visualViewport.height > 150
}

onMounted(() => {
  loadTrack(props.track.path_lower)
  window.visualViewport?.addEventListener('resize', onViewportResize)
})

watch(() => props.track, (newTrack) => loadTrack(newTrack.path_lower))

onUnmounted(() => {
  if (audioEl.value) audioEl.value.pause()
  meta.value.pictures?.forEach((url) => URL.revokeObjectURL(url))
  meta.value.extraPictures?.forEach((url) => URL.revokeObjectURL(url))
  window.visualViewport?.removeEventListener('resize', onViewportResize)
})

// ===== ビジュアル =====
// 'idle' | 'generating' | 'ready'
const visualPhase = ref('idle')
const visualError = ref(null)
const visualBodyRef = ref(null)

const visualData = computed(() =>
  visualStore.get(props.track.path_lower) ?? (meta.value.lyrics ? buildPlainVisualHtml(meta.value) : null)
)
const visualCssVars = computed(() => {
  const vars = visualData.value?.cssVars ?? {}
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v]))
})
const visualBodyHtml = computed(() => visualData.value?.bodyHtml ?? '')
const visualTooltipData = computed(() => visualData.value?.tooltipData ?? {})

// ツールチップ
const tooltip = reactive({ visible: false, title: '', body: '', style: {} })
const activeAnnotated = ref(null)

function showTooltip(el, clientX, clientY) {
  const key = el.dataset.key
  const data = visualTooltipData.value[key]
  if (!data) return
  tooltip.title = data.title
  tooltip.body = data.body
  activeAnnotated.value?.classList.remove('active')
  el.classList.add('active')
  activeAnnotated.value = el
  const tw = Math.min(320, window.innerWidth * 0.88)
  const th = 120
  let left = clientX - tw / 2
  let top = clientY - th - 16
  if (left < 8) left = 8
  if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8
  if (top < 8) top = clientY + 24
  if (top + th > window.innerHeight - 8) top = clientY - th - 8
  if (top < 8) top = 8
  tooltip.style = { left: left + 'px', top: top + 'px', maxWidth: tw + 'px' }
  tooltip.visible = true
}

function hideTooltip() {
  tooltip.visible = false
  activeAnnotated.value?.classList.remove('active')
  activeAnnotated.value = null
}

function onVisualClick(e) {
  const ann = e.target.closest?.('.annotated')
  if (ann) {
    activeAnnotated.value === ann ? hideTooltip() : showTooltip(ann, e.clientX, e.clientY)
    e.stopPropagation()
  } else {
    hideTooltip()
  }
}

// touchstart は passive: false が必要なので手動登録
watch(visualBodyRef, (el) => {
  if (!el) return
  el.addEventListener('touchstart', (e) => {
    const ann = e.target.closest?.('.annotated')
    if (ann) {
      const t = e.touches[0]
      activeAnnotated.value === ann ? hideTooltip() : showTooltip(ann, t.clientX, t.clientY)
      e.preventDefault()
      e.stopPropagation()
    } else {
      hideTooltip()
    }
  }, { passive: false })
})

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
  hideTooltip()
}

// トラック変更時にフェーズをリセット（既存データがあれば即ready）
watch(() => props.track, () => {
  visualError.value = null
  visualPhase.value = visualStore.get(props.track.path_lower) ? 'ready' : 'idle'
  hideTooltip()
})

// ===== クイズ =====
// 'cover' | 'generating' | 'question' | 'feedback' | 'result'
const quizPhase = ref('cover')
const quizDifficulty = ref('low') // 'low' | 'medium' | 'high'
const quizIndex = ref(0)
const quizOrder = ref([])
const hintOpen = ref(false)   // 出題順（インデックス配列）
const userAnswer = ref('')
const quizResults = ref([])
const quizGenError = ref(null)
const acceptAsCorrect = ref(false)
const acceptValidating = ref(false)
const acceptReason = ref(null)   // 許容・棄却どちらの理由も格納

// ストアから現在難易度の問題一覧を取得
const quizQuestions = computed(() => quizStore.getQuestions(props.track.path_lower, quizDifficulty.value) ?? [])
const currentQuestion = computed(() => quizQuestions.value[quizOrder.value[quizIndex.value]])
const correctCount = computed(() => quizResults.value.filter(r => r.correct).length)

const DIFFICULTY_LABELS = { low: '穴埋め', medium: '単語回答', high: '文章回答' }

/** シャッフルON/OFFに応じた出題順インデックス配列を生成 */
function generateOrder(length) {
  const indices = Array.from({ length }, (_, i) => i)
  if (quizStore.shuffle) {
    for (let i = length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
  }
  return indices
}

/** 現在の進捗をストアに保存 */
function saveProgress() {
  quizStore.setProgress(props.track.path_lower, quizDifficulty.value, {
    phase: quizPhase.value,
    index: quizIndex.value,
    results: quizResults.value,
    order: quizOrder.value,
  })
}

/** 新規セッションを開始（順序を生成して最初から） */
function startNewSession() {
  quizIndex.value = 0
  userAnswer.value = ''
  quizResults.value = []
  quizGenError.value = null
  hintOpen.value = false
  quizOrder.value = generateOrder(quizQuestions.value.length)
  quizPhase.value = 'question'
  saveProgress()
}


async function startGenerateQuiz(previousQuestions = null) {
  quizGenError.value = null
  quizPhase.value = 'generating'
  try {
    const visualHtml = visualStore.get(props.track.path_lower)
    const metaForQuiz = visualHtml ? { ...meta.value, visualHtml } : meta.value
    const questions = await generateQuizQuestions(metaForQuiz, previousQuestions, quizDifficulty.value)
    quizStore.setQuestions(props.track.path_lower, quizDifficulty.value, questions)
    startNewSession()
  } catch (e) {
    quizGenError.value = e.message
    quizPhase.value = 'cover'
  }
}

/** 表紙の難易度ボタンを押したとき */
function startQuiz(difficulty) {
  quizDifficulty.value = difficulty
  if (quizStore.hasDifficulty(props.track.path_lower, difficulty)) {
    startNewSession()
  } else {
    startGenerateQuiz()
  }
}

/** 問題途中から表紙へ戻る */
function exitToCover() {
  quizPhase.value = 'cover'
  quizIndex.value = 0
  userAnswer.value = ''
  quizResults.value = []
  hintOpen.value = false
  quizOrder.value = []
  acceptAsCorrect.value = false
  acceptReason.value = null
}

/** シャッフルON/OFF切り替え時に未回答部分だけ再配置 */
function applyShuffleToRemaining() {
  if (quizPhase.value !== 'question' && quizPhase.value !== 'feedback') return
  // フィードバック中は現在の問題も「表示済み」なので +1
  const answeredCount = quizIndex.value + 1
  const answered = quizOrder.value.slice(0, answeredCount)
  const remaining = quizOrder.value.slice(answeredCount)
  if (quizStore.shuffle) {
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[remaining[i], remaining[j]] = [remaining[j], remaining[i]]
    }
  } else {
    remaining.sort((a, b) => a - b)
  }
  quizOrder.value = [...answered, ...remaining]
  saveProgress()
}

watch(() => quizStore.shuffle, applyShuffleToRemaining)

function normalize(str) {
  return str
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // 全角英数→半角
}

function submitAnswer() {
  const q = currentQuestion.value
  // answers配列優先、古いanswer単体フィールドも互換対応
  const answers = Array.isArray(q.answers) ? q.answers : [q.answers ?? q.answer]
  const correct = answers.some(a => normalize(userAnswer.value) === normalize(a))
  quizResults.value.push({ correct, userAnswer: userAnswer.value, answers })
  if (correct) {
    const questionIndex = quizOrder.value[quizIndex.value]
    if (quizStore.markCorrect(props.track.path_lower, quizDifficulty.value, questionIndex)) {
      quizStore.addCorrects(props.track.path_lower, quizDifficulty.value, 1)
    }
  }
  acceptAsCorrect.value = false
  acceptReason.value = null
  quizPhase.value = 'feedback'
  saveProgress()
}

async function handleAcceptAsCorrect() {
  acceptValidating.value = true
  acceptReason.value = null
  try {
    const q = currentQuestion.value
    const existingAnswers = Array.isArray(q.answers) ? q.answers : [q.answers ?? q.answer]
    const result = await validateAcceptAnswer(q.question, existingAnswers, userAnswer.value, {
      hint: q.hint,
      transcribedText: meta.value.transcribedTextPreview,
    })
    if (result.accepted) {
      const questionIndex = quizOrder.value[quizIndex.value]
      quizStore.addAnswer(props.track.path_lower, quizDifficulty.value, questionIndex, userAnswer.value)
      quizResults.value[quizIndex.value] = { ...quizResults.value[quizIndex.value], correct: true, manuallyAccepted: true }
      if (quizStore.markCorrect(props.track.path_lower, quizDifficulty.value, questionIndex)) {
        quizStore.addCorrects(props.track.path_lower, quizDifficulty.value, 1)
      }
      acceptReason.value = result.reason ?? null
      saveProgress()
    } else {
      acceptAsCorrect.value = false
      acceptReason.value = result.reason ?? '正解として認められませんでした。'
    }
  } catch (e) {
    acceptAsCorrect.value = false
    acceptReason.value = e.message
  } finally {
    acceptValidating.value = false
  }
}

function revertAcceptAsCorrect() {
  const questionIndex = quizOrder.value[quizIndex.value]
  quizStore.removeAnswer(props.track.path_lower, quizDifficulty.value, questionIndex, userAnswer.value)
  quizResults.value[quizIndex.value] = { ...quizResults.value[quizIndex.value], correct: false, manuallyAccepted: false }
  quizStore.unmarkCorrect(props.track.path_lower, quizDifficulty.value, questionIndex)
  quizStore.addCorrects(props.track.path_lower, quizDifficulty.value, -1)
  acceptReason.value = null
  saveProgress()
}

function nextQuestion() {
  if (quizIndex.value + 1 >= quizQuestions.value.length) {
    quizPhase.value = 'result'
  } else {
    quizIndex.value++
    userAnswer.value = ''
    hintOpen.value = false
    quizPhase.value = 'question'
  }
  saveProgress()
}

const clearConfirmVisible = ref(false)

function confirmClearQuiz() {
  clearConfirmVisible.value = true
}

function executeClearQuiz() {
  clearConfirmVisible.value = false
  quizStore.removeTrack(props.track.path_lower)
  quizStore.clearCorrectCounts(props.track.path_lower)
  quizPhase.value = 'cover'
  quizIndex.value = 0
  quizOrder.value = []
  quizResults.value = []
  quizGenError.value = null
  acceptAsCorrect.value = false
  acceptReason.value = null
}

function retryQuiz() {
  quizStore.clearProgress(props.track.path_lower, quizDifficulty.value)
  startNewSession()
}

function regenerateQuiz() {
  const previous = quizStore.getQuestions(props.track.path_lower, quizDifficulty.value) ?? []
  quizStore.removeTrack(props.track.path_lower)
  quizGenError.value = null
  startGenerateQuiz(previous)
}
</script>

<style scoped>
.track-detail {
  padding-bottom: 64px;
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
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  padding-bottom: calc(6px + env(safe-area-inset-bottom));
  background: var(--p-content-background);
  border-top: 1px solid var(--p-content-border-color);
  transition: transform 0.15s ease;
}

.player-bar--hidden {
  transform: translateY(100%);
}

.play-btn {
  flex-shrink: 0;
}

.repeat-toggle {
  opacity: 0.45;
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
}

.repeat-toggle.active {
  color: var(--p-primary-color);
  opacity: 1;
}

.repeat-toggle.disabled {
  opacity: 0.45;
}

.repeat-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
}

.repeat-switch-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  clip: rect(0 0 0 0);
  overflow: hidden;
  white-space: nowrap;
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
  height: 89%;
  justify-content: space-between;
  padding-bottom: 8px;
  overflow-y: scroll;
  overflow-x: hidden
}
.tab-content {
  justify-content: space-between;
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
  padding: 30px 16px;
}
.albumTitle{
  text-align: center;
}
.artwork {
  width: 350px;
  height: 350px;
  object-fit: cover;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
  scroll-snap-align: start;
}

.artwork-placeholder {
  width: 350px;
  height: 350px;
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

.md-preview :deep(p) {
  margin: 0.4em 0;
}

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

.md-preview :deep(pre code) {
  background: none;
  padding: 0;
}

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

.md-preview :deep(a) {
  color: var(--p-primary-color);
}

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
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  cursor: zoom-in;
}

.p-divider {
  margin: 0.1rem;
}

.meta-card {
  border: none;
  margin-bottom: 0;
}

/* ===== クイズ ===== */

/* 表紙 */
.quiz-cover {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px 24px;
  text-align: center;
}

.quiz-cover-icon {
  font-size: 48px;
  color: var(--p-primary-color);
  opacity: 0.6;
}

.quiz-cover-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.quiz-difficulty-btns {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
}

.quiz-cover-desc {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.6;
  margin: 0 0 4px;
}

.quiz-gen-error {
  width: 100%;
  font-size: 13px;
}

.quiz-shuffle-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quiz-shuffle-label {
  font-size: 14px;
  cursor: pointer;
  user-select: none;
}

.quiz-shuffle-inline {
  justify-content: flex-end;
  margin-bottom: 4px;
}

.quiz-shuffle-inline .quiz-shuffle-label {
  font-size: 12px;
  color: var(--p-text-muted-color);
}

/* 生成中 */
.quiz-generating {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 80px 24px;
}

.quiz-generating-text {
  font-size: 14px;
  color: var(--p-text-muted-color);
  margin: 0;
}

.quiz-content {
  padding: 16px;
  gap: 16px;
  overflow-y: auto;
}

.quiz-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  width: 50%;
}

.quiz-progress-text {
  font-size: 13px;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
  min-width: 44px;
}

.quiz-progress-bar {
  flex: 1;
  height: 6px;
  background: var(--p-content-hover-background);
  border-radius: 3px;
  overflow: hidden;
}

.quiz-progress-fill {
  height: 100%;
  background: var(--p-primary-color);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.quiz-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.quiz-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quiz-question {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.quiz-hint-wrap {
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  overflow: hidden;
}

.quiz-hint-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--p-text-muted-color);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}

.quiz-hint-toggle:hover {
  background: var(--p-content-hover-background);
}

.quiz-hint-body {
  margin: 0;
  padding: 8px 12px 10px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--p-text-color);
  background: var(--p-content-hover-background);
  border-top: 1px solid var(--p-content-border-color);
}

.hint-enter-active,
.hint-leave-active {
  transition: opacity 0.15s ease, max-height 0.2s ease;
  max-height: 120px;
  overflow: hidden;
}

.hint-enter-from,
.hint-leave-to {
  opacity: 0;
  max-height: 0;
}

.quiz-input {
  width: 100%;
}

.quiz-submit-btn {
  width: 100%;
}

/* フィードバック */
.quiz-feedback {
  border-radius: 12px;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.feedback-correct {
  background: color-mix(in srgb, var(--p-green-500) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--p-green-500) 40%, transparent);
}

.feedback-wrong {
  background: color-mix(in srgb, var(--p-red-500) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--p-red-500) 40%, transparent);
}

.feedback-icon i {
  font-size: 36px;
}

.feedback-correct .feedback-icon i {
  color: var(--p-green-500);
}

.feedback-wrong .feedback-icon i {
  color: var(--p-red-500);
}

.feedback-label {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.feedback-correct .feedback-label {
  color: var(--p-green-500);
}

.feedback-wrong .feedback-label {
  color: var(--p-red-500);
}

.feedback-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.feedback-row {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.feedback-tag {
  font-size: 11px;
  background: var(--p-content-border-color);
  border-radius: 4px;
  padding: 2px 7px;
  color: var(--p-text-muted-color);
}

.feedback-user-answer {
  font-size: 14px;
}

.feedback-user-answer--correct {
  color: var(--p-green-500);
}

.feedback-user-answer--wrong {
  color: var(--p-red-500);
  text-decoration: line-through;
}

.feedback-correct-answer {
  font-size: 14px;
  font-weight: 700;
}

.feedback-hint {
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin: 0;
}

.quiz-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.quiz-clear-btn {
  margin-left: 4px;
}

.clear-confirm-msg {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--p-text-color);
}

.accept-correct-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--p-content-border-color);
}

.accept-correct-label {
  font-size: 13px;
  color: var(--p-text-color);
  cursor: pointer;
  user-select: none;
}

.accept-reason {
  display: flex;
  text-align: left;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
}

.accept-reason--ok {
  background: color-mix(in srgb, var(--p-green-500) 12%, transparent);
  color: var(--p-green-600);
}

.accept-reason--ng {
  background: color-mix(in srgb, var(--p-red-500) 12%, transparent);
  color: var(--p-red-500);
}

.accept-reason .pi {
  flex-shrink: 0;
  margin-top: 2px;
}

/* リザルト */
.quiz-result {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-score-wrap {
  text-align: center;
  padding: 28px 16px 20px;
  background: var(--p-content-hover-background);
  border-radius: 14px;
}

.result-score {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  margin-bottom: 8px;
}

.result-score-num {
  font-size: 56px;
  font-weight: 700;
  color: var(--p-primary-color);
  line-height: 1;
}

.result-score-total {
  font-size: 20px;
  color: var(--p-text-muted-color);
}

.result-score-label {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--p-content-border-color);
}

.result-item-correct {
  background: color-mix(in srgb, var(--p-green-500) 8%, transparent);
}

.result-item-wrong {
  background: color-mix(in srgb, var(--p-red-500) 8%, transparent);
}

.result-item-icon {
  font-size: 16px;
  margin-top: 2px;
  flex-shrink: 0;
}

.result-item-correct .result-item-icon {
  color: var(--p-green-500);
}

.result-item-wrong .result-item-icon {
  color: var(--p-red-500);
}

.result-item-body {
  flex: 1;
  min-width: 0;
}

.result-item-q {
  font-size: 13px;
  margin: 0 0 2px;
  line-height: 1.5;
}

.result-item-ans {
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin: 0;
}

.result-ans-correct {
  color: var(--p-green-500);
}

.result-ans-wrong {
  color: var(--p-red-500);
  text-decoration: line-through;
}

.quiz-header {
  width: 100%;
  display: flex;
  flex-direction: row;
  gap: 10px;
  justify-content: space-between;
}

.album-title {
  text-align: center;
  font-weight: bold;
}

/* ===== ビジュアル ===== */
.visual-content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 172px);
  padding: 0;
  position: relative;
}

.visual-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px 24px;
  text-align: center;
}

.visual-idle-icon {
  font-size: 48px;
  color: var(--p-primary-color);
  opacity: 0.6;
}

.visual-idle-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.visual-idle-desc {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.6;
  margin: 0 0 4px;
}

.visual-error {
  width: 100%;
  font-size: 13px;
}

.visual-gen-btn {
  border-radius: 50%;
  width: 50px;
  height: 50px;
  justify-content: center;
  box-shadow:0px 0px 10px #55555555 ;
}

.visual-overlay {
  position: absolute;
  bottom: 10px;
  right: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  z-index: 10;
}

.visual-generating {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 80px 24px;
}

.visual-generating-text {
  font-size: 14px;
  color: var(--p-text-muted-color);
  margin: 0;
}

.visual-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px;
  border-bottom: 1px solid var(--p-content-border-color);
  flex-shrink: 0;
}

.visual-body {
  flex: 1;
  overflow-y: auto;
  background-color: var(--color-bg, #f0f5f0);
  color: var(--color-text, #2a3a2a);
  font-size: 16px;
  line-height: 1.9;
}

:deep(.intro-note) {
  background: var(--color-intro-bg, #d7ead7);
  border-left: 4px solid var(--color-accent, #2e7d32);
  margin: 0 0 8px 0;
  padding: 18px 20px 16px 20px;
  font-size: 13.5px;
  color: var(--color-text-sub, #4a6a4a);
  line-height: 1.7;
}

:deep(.lyric-block) {
  background: var(--color-block-bg, #fff);
  margin: 0 0 2px 0;
  padding: 22px 24px 18px 24px;
  border-bottom: 1px solid var(--color-bg2, #e4ede4);
}

:deep(.lyric-block.chorus) {
  background: var(--color-chorus-bg, #c8e6c9);
  border-left: 4px solid var(--color-accent, #2e7d32);
}

:deep(.block-label) {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--color-accent2, #81c784);
  text-transform: uppercase;
  margin-bottom: 10px;
}

:deep(.lyric-block.chorus .block-label) {
  color: var(--color-accent, #2e7d32);
}

:deep(.lyric-line) {
  display: block;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 0.03em;
  margin-bottom: 2px;
  padding: 1px 0;
}

:deep(.annotated) {
  cursor: pointer;
  border-bottom: 2px solid var(--color-underline, #2e7d32);
  padding-bottom: 1px;
  color: var(--color-accent, #2e7d32);
  font-weight: 600;
  transition: background 0.15s;
  border-radius: 2px;
}

:deep(.annotated:active),
:deep(.annotated.active) {
  background: var(--color-accent3, #a5d6a7);
  color: var(--color-text, #2a3a2a);
}

:deep(.page-footer) {
  text-align: center;
  padding: 30px 20px 10px 20px;
  font-size: 12px;
  color: var(--color-text-sub, #4a6a4a);
  opacity: 0.7;
  letter-spacing: 0.06em;
}

:deep(.page-footer span) {
  display: inline-block;
  border-top: 1px solid var(--color-accent2, #81c784);
  padding-top: 12px;
  min-width: 140px;
}

.visual-tooltip {
  position: fixed;
  z-index: 9999;
  background: var(--color-tooltip-bg, #1b5e20);
  color: var(--color-tooltip-text, #f1f8e9);
  font-size: 13px;
  line-height: 1.65;
  padding: 12px 15px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.25);
  pointer-events: none;
}

.visual-tooltip-title {
  font-weight: 700;
  font-size: 12px;
  color: var(--color-accent3, #a5d6a7);
  letter-spacing: 0.08em;
  margin-bottom: 5px;
  text-transform: uppercase;
}
</style>
