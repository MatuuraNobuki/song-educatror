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
          @click="activeTab = tab.value; tab.value === 'quiz' && initQuizPhase()"
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

      <!-- テスト -->
      <div v-show="activeTab === 'quiz'" class="tab-content quiz-content">

        <!-- 未作成フェーズ -->
        <template v-if="quizPhase === 'empty'">
          <div class="quiz-empty">
            <i class="pi pi-lightbulb quiz-empty-icon" />
            <p class="quiz-empty-title">テスト問題がまだありません</p>
            <p class="quiz-empty-desc">楽曲の情報をもとにオリジナルの問題を作成します</p>
            <Message v-if="quizGenError" severity="error" :closable="false" class="quiz-gen-error">{{ quizGenError }}</Message>
            <Button
              label="問題を作成する"
              icon="pi pi-sparkles"
              class="quiz-submit-btn"
              @click="startGenerateQuiz"
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
          <div class="quiz-shuffle-row quiz-shuffle-inline">
            <Checkbox v-model="quizStore.shuffle" :binary="true" inputId="shuffleQ" />
            <label for="shuffleQ" class="quiz-shuffle-label">シャッフル</label>
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
            <InputText
              v-model="userAnswer"
              class="quiz-input"
              placeholder="答えを入力してください"
              @keyup.enter="userAnswer.trim() && submitAnswer()"
            />
            <Button
              label="回答する"
              class="quiz-submit-btn"
              :disabled="!userAnswer.trim()"
              @click="submitAnswer"
            />
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
            <div class="quiz-shuffle-row quiz-shuffle-inline">
              <Checkbox v-model="quizStore.shuffle" :binary="true" inputId="shuffleF" />
              <label for="shuffleF" class="quiz-shuffle-label">シャッフル</label>
            </div>
          </div>
          <div class="quiz-card">
            <p class="quiz-question">{{ currentQuestion.question }}</p>
            <div
              class="quiz-feedback"
              :class="quizResults[quizIndex].correct ? 'feedback-correct' : 'feedback-wrong'"
            >
              <div class="feedback-icon">
                <i :class="quizResults[quizIndex].correct ? 'pi pi-check-circle' : 'pi pi-times-circle'" />
              </div>
              <p class="feedback-label">{{ quizResults[quizIndex].correct ? '正解！' : '不正解' }}</p>
              <div v-if="!quizResults[quizIndex].correct" class="feedback-detail">
                <div class="feedback-row">
                  <span class="feedback-tag">あなたの答え</span>
                  <span class="feedback-user-answer">{{ quizResults[quizIndex].userAnswer }}</span>
                </div>
                <div class="feedback-row">
                  <span class="feedback-tag">正解</span>
                  <span class="feedback-correct-answer">{{ currentQuestion.answer }}</span>
                </div>
              </div>
              <p v-if="currentQuestion.hint" class="feedback-hint">{{ currentQuestion.hint }}</p>
            </div>
            <Button
              :label="quizIndex + 1 < quizQuestions.length ? '次の問題へ' : '結果を見る'"
              class="quiz-submit-btn"
              @click="nextQuestion"
            />
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
              <div
                v-for="(r, i) in quizResults"
                :key="i"
                class="result-item"
                :class="r.correct ? 'result-item-correct' : 'result-item-wrong'"
              >
                <i :class="r.correct ? 'pi pi-check' : 'pi pi-times'" class="result-item-icon" />
                <div class="result-item-body">
                  <p class="result-item-q">{{ quizQuestions[quizOrder[i]].question }}</p>
                  <p v-if="!r.correct" class="result-item-ans">
                    正解: <strong>{{ quizQuestions[quizOrder[i]].answer }}</strong>
                  </p>
                </div>
              </div>
            </div>
            <Button
              label="もう一度挑戦する"
              icon="pi pi-refresh"
              class="quiz-submit-btn"
              @click="retryQuiz"
            />
            <Button
              v-if="correctCount === quizQuestions.length"
              label="別の問題にチャレンジ"
              icon="pi pi-sparkles"
              severity="secondary"
              class="quiz-submit-btn"
              @click="regenerateQuiz"
            />
          </div>
        </template>

      </div>
    </template>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Slider from 'primevue/slider'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import { marked } from 'marked'
import { fetchTrackMetadata } from '../services/trackMetadata'
import ImageViewer from '../components/ImageViewer.vue'
import { useTrackMetadataStore } from '../stores/trackMetadataStore'
import { useQuizStore } from '../stores/quizStore'
import { generateQuizQuestions } from '../services/claudeApi'
const metaStore = useTrackMetadataStore()
const quizStore = useQuizStore()

const props = defineProps({
  track: { type: Object, required: true },
})
defineEmits(['back'])

const tabs = [
  { value: 'info',   label: '基本情報' },
  { value: 'lyrics', label: '歌詞' },
  { value: 'images', label: '画像' },
  { value: 'notes',  label: '解説' },
  { value: 'quiz',   label: 'テスト' },
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

// ===== クイズ =====
// 'empty' | 'generating' | 'question' | 'feedback' | 'result'
const quizPhase = ref('empty')
const quizIndex = ref(0)
const quizOrder = ref([])
const hintOpen = ref(false)   // 出題順（インデックス配列）
const userAnswer = ref('')
const quizResults = ref([])
const quizGenError = ref(null)

// ストアから現在トラックの問題一覧を取得
const quizQuestions = computed(() => quizStore.getQuestions(props.track.path_lower) ?? [])
const currentQuestion = computed(() => quizQuestions.value[quizOrder.value[quizIndex.value]])
const correctCount = computed(() => quizResults.value.filter(r => r.correct).length)

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
  quizStore.setProgress(props.track.path_lower, {
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

// テストタブを開いたときにフェーズを初期化（保存済み進捗があれば復元）
function initQuizPhase() {
  const questions = quizStore.getQuestions(props.track.path_lower)
  if (!questions || questions.length === 0) {
    quizPhase.value = 'empty'
    return
  }
  const saved = quizStore.getProgress(props.track.path_lower)
  if (saved) {
    quizPhase.value = saved.phase
    quizIndex.value = saved.index
    quizResults.value = saved.results
    quizOrder.value = saved.order
  } else {
    startNewSession()
  }
}

async function startGenerateQuiz() {
  quizGenError.value = null
  quizPhase.value = 'generating'
  try {
    const questions = await generateQuizQuestions(meta.value)
    quizStore.setQuestions(props.track.path_lower, questions)
    startNewSession()
  } catch (e) {
    quizGenError.value = e.message
    quizPhase.value = 'empty'
  }
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
  return str.trim().replace(/\s+/g, '')
}

function submitAnswer() {
  const q = currentQuestion.value
  const correct = normalize(userAnswer.value) === normalize(q.answer)
  quizResults.value.push({ correct, userAnswer: userAnswer.value, answer: q.answer })
  quizPhase.value = 'feedback'
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

function retryQuiz() {
  quizStore.clearProgress(props.track.path_lower)
  startNewSession()
}

function regenerateQuiz() {
  quizStore.removeTrack(props.track.path_lower)
  quizGenError.value = null
  startGenerateQuiz()
}
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

/* ===== クイズ ===== */

/* 未作成 */
.quiz-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px 24px;
  text-align: center;
}

.quiz-empty-icon {
  font-size: 48px;
  color: var(--p-primary-color);
  opacity: 0.6;
}

.quiz-empty-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.quiz-empty-desc {
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
  width: 70%;
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

.quiz-question {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.6;
  margin: 0;
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
.quiz-header{
  width: 100%;
  display: flex;
  flex-direction: row;
  gap:10px;
  justify-content: space-between;
}
</style>
