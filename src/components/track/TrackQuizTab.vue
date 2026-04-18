<template>
  <div class="tab-content quiz-content">

    <!-- 表紙フェーズ -->
    <template v-if="quizPhase === 'cover'">
      <div class="quiz-header">
        <div class="quiz-header-actions" style="margin-left: auto">
          <div class="quiz-shuffle-row quiz-shuffle-inline">
            <Checkbox v-model="quizStore.shuffle" :binary="true" inputId="shuffleCover" />
            <label for="shuffleCover" class="quiz-shuffle-label">シャッフル</label>
          </div>
          <Button icon="pi pi-trash" text rounded size="small" severity="danger" class="quiz-clear-btn" @click="$emit('confirm-clear')" />
        </div>
      </div>
      <div class="quiz-cover">
        <i class="pi pi-lightbulb quiz-cover-icon" />
        <p class="quiz-cover-title">テスト</p>
        <p class="quiz-cover-desc">問題の種類を選んでテストを始めましょう</p>
        <Message v-if="quizGenError" severity="error" :closable="false" class="quiz-gen-error">{{ quizGenError }}</Message>
      </div>
      <div class="quiz-difficulty-btns">
        <button
          v-for="d in ['low', 'medium', 'high']"
          :key="d"
          class="quiz-difficulty-card"
          :class="[`quiz-difficulty-card--${d}`, difficultyStats[d].perfect && 'quiz-difficulty-card--perfect']"
          @click="$emit('start-quiz', d)"
        >
          <span class="quiz-difficulty-card__label">{{ DIFFICULTY_LABELS[d] }}</span>
          <span v-if="!difficultyStats[d].hasQuestions" class="quiz-difficulty-card__status quiz-difficulty-card__status--none">
            <i class="pi pi-plus-circle" />未作成
          </span>
          <span v-else-if="difficultyStats[d].perfect" class="quiz-difficulty-card__status quiz-difficulty-card__status--perfect">
            <i class="pi pi-star-fill" />全問正解！
          </span>
          <span v-else class="quiz-difficulty-card__status quiz-difficulty-card__status--score">
            {{ difficultyStats[d].correct }} / {{ difficultyStats[d].total }}問正解
          </span>
        </button>
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
        <div class="quiz-header-actions">
          <Button icon="pi pi-home" text rounded size="small" severity="secondary" @click="$emit('exit-cover')" />
        </div>
        <div class="quiz-progress">
          <span class="quiz-progress-text">{{ quizIndex + 1 }} / {{ quizQuestions.length }}</span>
          <div class="quiz-progress-bar">
            <div class="quiz-progress-fill" :style="{ width: ((quizIndex + 1) / quizQuestions.length * 100) + '%' }" />
          </div>
        </div>
      </div>
      <div class="quiz-card">
        <p class="quiz-question">{{ currentQuestion.question }}</p>
        <div v-if="currentQuestion.hint" class="quiz-hint-wrap">
          <button class="quiz-hint-toggle" @click="$emit('toggle-hint')">
            <i :class="hintOpen ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
            ヒント
          </button>
          <Transition name="hint">
            <p v-if="hintOpen" class="quiz-hint-body">{{ currentQuestion.hint }}</p>
          </Transition>
        </div>
      </div>
      <div class="quiz-input">
        <InputText v-model="userAnswerModel" class="quiz-input" placeholder="答えを入力してください" @keyup.enter="userAnswerModel.trim() && $emit('submit-answer')" />
        <Button label="回答する" class="quiz-submit-btn" :disabled="!userAnswerModel.trim()" @click="$emit('submit-answer')" />
      </div>
    </template>

    <!-- 正誤フェーズ -->
    <template v-else-if="quizPhase === 'feedback'">
      <div class="quiz-header">
        <div class="quiz-header-actions">
          <Button icon="pi pi-home" text rounded size="small" severity="secondary" @click="$emit('exit-cover')" />
        </div>
        <div class="quiz-progress">
          <span class="quiz-progress-text">{{ quizIndex + 1 }} / {{ quizQuestions.length }}</span>
          <div class="quiz-progress-bar">
            <div class="quiz-progress-fill" :style="{ width: ((quizIndex + 1) / quizQuestions.length * 100) + '%' }" />
          </div>
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
            <Checkbox v-model="acceptAsCorrectModel" :binary="true" inputId="acceptCorrect" :disabled="acceptValidating" @update:modelValue="val => val ? $emit('accept-correct') : $emit('revert-correct')" />
            <label for="acceptCorrect" class="accept-correct-label">この答えを正解とする</label>
            <ProgressSpinner v-if="acceptValidating" style="width: 18px; height: 18px" />
          </div>
          <div v-if="acceptReason" class="accept-reason" :class="acceptAsCorrectModel ? 'accept-reason--ok' : 'accept-reason--ng'">
            <i :class="acceptAsCorrectModel ? 'pi pi-check-circle' : 'pi pi-times-circle'" />
            {{ acceptReason }}
          </div>
        </div>
      </div>
      <div class="quiz-input">
        <Button :label="quizIndex + 1 < quizQuestions.length ? '次の問題へ' : '結果を見る'" class="quiz-submit-btn" @click="$emit('next-question')" />
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
        <Button label="もう一度挑戦する" icon="pi pi-refresh" class="quiz-submit-btn" @click="$emit('retry')" />
        <Button v-if="correctCount === quizQuestions.length" label="別の問題にチャレンジ" icon="pi pi-sparkles" severity="secondary" class="quiz-submit-btn" @click="$emit('regenerate')" />
        <Button label="表紙に戻る" icon="pi pi-home" severity="secondary" class="quiz-submit-btn" @click="$emit('exit-cover')" />
        <Button label="テストをクリア" icon="pi pi-trash" severity="danger" text class="quiz-submit-btn" @click="$emit('confirm-clear')" />
      </div>
    </template>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'

const props = defineProps({
  quizStore: { type: Object, required: true },
  trackPath: { type: String, required: true },
  quizPhase: { type: String, required: true },
  quizIndex: { type: Number, required: true },
  quizOrder: { type: Array, required: true },
  quizQuestions: { type: Array, required: true },
  currentQuestion: { type: Object, default: null },
  quizResults: { type: Array, required: true },
  correctCount: { type: Number, required: true },
  quizGenError: { type: String, default: null },
  hintOpen: { type: Boolean, default: false },
  userAnswer: { type: String, default: '' },
  acceptAsCorrect: { type: Boolean, default: false },
  acceptValidating: { type: Boolean, default: false },
  acceptReason: { type: String, default: null },
  DIFFICULTY_LABELS: { type: Object, required: true },
})

const emit = defineEmits([
  'start-quiz', 'exit-cover', 'confirm-clear',
  'toggle-hint', 'submit-answer', 'next-question',
  'accept-correct', 'revert-correct',
  'retry', 'regenerate',
  'update:userAnswer', 'update:acceptAsCorrect',
])

const difficultyStats = computed(() => {
  return Object.fromEntries(['low', 'medium', 'high'].map(d => {
    const questions = props.quizStore.getQuestions(props.trackPath, d)
    if (!questions || questions.length === 0) return [d, { hasQuestions: false, correct: 0, total: 0, perfect: false }]
    const total = questions.length
    const correct = (props.quizStore.answeredCorrect[`${props.trackPath}:${d}`] ?? []).length
    return [d, { hasQuestions: true, correct, total, perfect: correct >= total }]
  }))
})

const userAnswerModel = computed({
  get: () => props.userAnswer,
  set: (v) => emit('update:userAnswer', v),
})

const acceptAsCorrectModel = computed({
  get: () => props.acceptAsCorrect,
  set: (v) => emit('update:acceptAsCorrect', v),
})
</script>

<style scoped>
.tab-content {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-bottom: 8px;
  overflow-x: hidden;
}

.quiz-content {
  height: calc(100vh - 147px);
  padding: 16px;
  gap: 16px;
  overflow-y: auto;
}

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

.quiz-difficulty-btns {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
}

.quiz-difficulty-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 16px;
  border-radius: 3px;
  border: 1.5px solid var(--p-content-border-color);
  background: var(--p-content-background);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
}

.quiz-difficulty-card:hover {
  background: var(--p-content-hover-background);
}

.quiz-difficulty-card--low { border-left: 4px solid var(--p-blue-400); }
.quiz-difficulty-card--medium { border-left: 4px solid var(--p-green-500); }
.quiz-difficulty-card--high { border-left: 4px solid var(--p-orange-400); }

.quiz-difficulty-card--perfect {
  background: color-mix(in srgb, var(--p-yellow-400) 12%, transparent);
  border-color: color-mix(in srgb, var(--p-yellow-400) 60%, transparent);
}

.quiz-difficulty-card__label {
  color: var(--p-text-color);
}

.quiz-difficulty-card__status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
}

.quiz-difficulty-card__status--none {
  color: var(--p-text-muted-color);
}

.quiz-difficulty-card__status--score {
  color: var(--p-text-muted-color);
}

.quiz-difficulty-card__status--perfect {
  color: var(--p-yellow-500);
  font-weight: 700;
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

/* シャッフル */
.quiz-shuffle-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quiz-shuffle-row :deep(.p-checkbox) {
  width: 14px;
  height: 14px;
}

.quiz-shuffle-row :deep(.p-checkbox-box) {
  width: 14px;
  height: 14px;
}

.quiz-shuffle-row :deep(.p-checkbox-icon) {
  font-size: 10px;
  width: 10px;
  height: 10px;
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

/* ヘッダー */
.quiz-header {
  width: 100%;
  display: flex;
  flex-direction: row;
  gap: 10px;
  justify-content: space-between;
}

.quiz-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.quiz-clear-btn {
  margin-left: 4px;
}

/* プログレス */
.quiz-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 0;
  width: 90%;
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

/* カード */
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
  white-space: pre-wrap;
}

.quiz-hint-wrap {
  border: 1px solid var(--p-content-border-color);
  border-radius: 3px;
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

/* 入力 */
.quiz-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.quiz-submit-btn {
  width: 100%;
}

/* フィードバック */
.quiz-feedback {
  border-radius: 3px;
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
  border-radius: 3px;
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

/* 正解追認 */
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
  border-radius: 3px;
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

/* クリア確認 */
.clear-confirm-msg {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--p-text-color);
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
  border-radius: 3px;
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
  border-radius: 3px;
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
</style>
