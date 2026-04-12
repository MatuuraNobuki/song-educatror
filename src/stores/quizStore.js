import { defineStore } from 'pinia'

export const useQuizStore = defineStore('quiz', {
  state: () => ({
    // path_lower → QuizQuestion[]
    questions: {},
    // path_lower → { phase, index, results, order }
    progress: {},
    // グローバル設定
    shuffle: false,
  }),
  actions: {
    setQuestions(path, questions) {
      this.questions[path] = questions
      // 問題が差し替わったら進捗はリセット
      delete this.progress[path]
    },
    getQuestions(path) {
      return this.questions[path] ?? null
    },
    setProgress(path, progress) {
      this.progress[path] = progress
    },
    getProgress(path) {
      return this.progress[path] ?? null
    },
    clearProgress(path) {
      delete this.progress[path]
    },
    removeTrack(path) {
      delete this.questions[path]
      delete this.progress[path]
    },
    prune(activePaths) {
      const pathSet = new Set(activePaths)
      for (const key of Object.keys(this.questions)) {
        if (!pathSet.has(key)) delete this.questions[key]
      }
      for (const key of Object.keys(this.progress)) {
        if (!pathSet.has(key)) delete this.progress[key]
      }
    },
  },
  persist: true,
})
