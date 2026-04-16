import { ref, computed } from 'vue'
import { useQuizStore } from '../stores/quizStore'
import { useVisualStore } from '../stores/visualStore'
import { generateQuizQuestions } from '../services/ai/generateQuiz'
import { validateAcceptAnswer } from '../services/ai/validateAnswer'
import { normalize } from '../utils/normalize'

export function useQuizSession(props, { meta, visualTooltipData }) {
  const quizStore = useQuizStore()
  const visualStore = useVisualStore()

  // 'cover' | 'generating' | 'question' | 'feedback' | 'result'
  const quizPhase = ref('cover')
  const quizDifficulty = ref('low')
  const quizIndex = ref(0)
  const quizOrder = ref([])
  const hintOpen = ref(false)
  const userAnswer = ref('')
  const quizResults = ref([])
  const quizGenError = ref(null)
  const acceptAsCorrect = ref(false)
  const acceptValidating = ref(false)
  const acceptReason = ref(null)
  const clearConfirmVisible = ref(false)

  const quizQuestions = computed(() => quizStore.getQuestions(props.track.path_lower, quizDifficulty.value) ?? [])
  const currentQuestion = computed(() => quizQuestions.value[quizOrder.value[quizIndex.value]])
  const correctCount = computed(() => quizResults.value.filter(r => r.correct).length)

  const DIFFICULTY_LABELS = { low: '穴埋め', medium: '単語回答', high: '文章回答' }

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

  function saveProgress() {
    quizStore.setProgress(props.track.path_lower, quizDifficulty.value, {
      phase: quizPhase.value,
      index: quizIndex.value,
      results: quizResults.value,
      order: quizOrder.value,
    })
  }

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
      const tooltipData = visualTooltipData.value
      const metaForQuiz = {
        ...meta.value,
        ...(Object.keys(tooltipData).length ? { tooltipData } : {}),
      }
      const questions = await generateQuizQuestions(metaForQuiz, previousQuestions, quizDifficulty.value)
      quizStore.setQuestions(props.track.path_lower, quizDifficulty.value, questions)
      startNewSession()
    } catch (e) {
      quizGenError.value = e.message
      quizPhase.value = 'cover'
    }
  }

  function startQuiz(difficulty) {
    quizDifficulty.value = difficulty
    if (quizStore.hasDifficulty(props.track.path_lower, difficulty)) {
      startNewSession()
    } else {
      startGenerateQuiz()
    }
  }

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

  function applyShuffleToRemaining() {
    if (quizPhase.value !== 'question' && quizPhase.value !== 'feedback') return
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

  function submitAnswer() {
    const q = currentQuestion.value
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

  return {
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
  }
}
