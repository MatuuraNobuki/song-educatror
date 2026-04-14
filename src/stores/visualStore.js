import { defineStore } from 'pinia'

const MAX_ENTRIES = 10

export const useVisualStore = defineStore('visual', {
  state: () => ({
    // 挿入順を保持するためのキー配列（古い順）
    keys: [],
    // path_lower → HTML文字列
    htmlMap: {},
  }),
  actions: {
    set(path, html) {
      if (this.htmlMap[path]) {
        // 既存エントリを最新に移動
        this.keys = this.keys.filter(k => k !== path)
      } else if (this.keys.length >= MAX_ENTRIES) {
        // 古いエントリを削除
        const oldest = this.keys.shift()
        delete this.htmlMap[oldest]
      }
      this.keys.push(path)
      this.htmlMap[path] = html
    },
    get(path) {
      return this.htmlMap[path] ?? null
    },
    remove(path) {
      this.keys = this.keys.filter(k => k !== path)
      delete this.htmlMap[path]
    },
  },
  persist: true,
})
