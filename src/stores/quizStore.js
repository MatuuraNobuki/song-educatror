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
    addAnswer(path, questionIndex, answer) {
      const q = this.questions[path]?.[questionIndex]
      if (!q) return
      if (!Array.isArray(q.answers)) {
        q.answers = [q.answers ?? q.answer]
      }
      const norm = (s) => s.trim().replace(/\s+/g, '').toLowerCase()
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      if (!q.answers.some(a => norm(a) === norm(answer))) {
        q.answers.push(answer)
      }
    },
    removeAnswer(path, questionIndex, answer) {
      const q = this.questions[path]?.[questionIndex]
      if (!q || !Array.isArray(q.answers)) return
      const norm = (s) => s.trim().replace(/\s+/g, '').toLowerCase()
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      q.answers = q.answers.filter(a => norm(a) !== norm(answer))
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
