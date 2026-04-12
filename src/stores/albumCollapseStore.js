import { defineStore } from 'pinia'

export const useAlbumCollapseStore = defineStore('albumCollapse', {
  state: () => ({
    // 展開中のアルバム名一覧（初期値は空 = 全閉じ）
    expandedAlbums: [],
  }),
  actions: {
    isExpanded(album) {
      return this.expandedAlbums.includes(album)
    },
    toggle(album) {
      const idx = this.expandedAlbums.indexOf(album)
      if (idx === -1) {
        this.expandedAlbums.push(album)
      } else {
        this.expandedAlbums.splice(idx, 1)
      }
    },
    collapseAll() {
      this.expandedAlbums = []
    },
  },
  persist: true,
})
