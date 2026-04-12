import { defineStore } from 'pinia'

export const useQuizStore = defineStore('quiz', {
  state: () => ({
    // `${path_lower}:${difficulty}` → QuizQuestion[]
    questions: {},
    // `${path_lower}:${difficulty}` → { phase, index, results, order }
    progress: {},
    // グローバル設定
    shuffle: false,
  }),
  actions: {
    _key(path, difficulty) {
      return `${path}:${difficulty}`
    },
    setQuestions(path, difficulty, questions) {
      const key = this._key(path, difficulty)
      this.questions[key] = questions
      delete this.progress[key]
    },
    getQuestions(path, difficulty) {
      return this.questions[this._key(path, difficulty)] ?? null
    },
    setProgress(path, difficulty, progress) {
      this.progress[this._key(path, difficulty)] = progress
    },
    getProgress(path, difficulty) {
      return this.progress[this._key(path, difficulty)] ?? null
    },
    clearProgress(path, difficulty) {
      delete this.progress[this._key(path, difficulty)]
    },
    addAnswer(path, difficulty, questionIndex, answer) {
      const q = this.questions[this._key(path, difficulty)]?.[questionIndex]
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
    removeAnswer(path, difficulty, questionIndex, answer) {
      const q = this.questions[this._key(path, difficulty)]?.[questionIndex]
      if (!q || !Array.isArray(q.answers)) return
      const norm = (s) => s.trim().replace(/\s+/g, '').toLowerCase()
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      q.answers = q.answers.filter(a => norm(a) !== norm(answer))
    },
    removeTrack(path) {
      // 該当トラックの全難易度データを削除
      const prefix = `${path}:`
      for (const key of Object.keys(this.questions)) {
        if (key.startsWith(prefix) || key === path) delete this.questions[key]
      }
      for (const key of Object.keys(this.progress)) {
        if (key.startsWith(prefix) || key === path) delete this.progress[key]
      }
    },
    hasDifficulty(path, difficulty) {
      const q = this.questions[this._key(path, difficulty)]
      return Array.isArray(q) && q.length > 0
    },
    prune(activePaths) {
      const pathSet = new Set(activePaths)
      const belongsToActive = (key) => {
        const colonIdx = key.lastIndexOf(':')
        const path = colonIdx > -1 ? key.slice(0, colonIdx) : key
        return pathSet.has(path)
      }
      for (const key of Object.keys(this.questions)) {
        if (!belongsToActive(key)) delete this.questions[key]
      }
      for (const key of Object.keys(this.progress)) {
        if (!belongsToActive(key)) delete this.progress[key]
      }
    },
  },
  persist: true,
})
