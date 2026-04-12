<script setup>
import { ref, onMounted } from 'vue'
import { App as CapApp } from '@capacitor/app'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import HomeView from './views/HomeView.vue'
import SettingsView from './views/SettingsView.vue'
import OAuthCallbackView from './views/OAuthCallbackView.vue'
import TrackDetailView from './views/TrackDetailView.vue'

const homeView = ref(null)
const selectedTrack = ref(null)
const selectedAlbumTracks = ref([])
const autoplay = ref(false)
const oauthCode = ref(null)
const settingsOpen = ref(false)

// Web（開発時）: URLにcodeがある場合
const searchParams = new URLSearchParams(window.location.search)
if (searchParams.has('code')) {
  oauthCode.value = searchParams.get('code')
}

onMounted(() => {
  // ネイティブ（Android）: カスタムスキームURLで起動された場合
  CapApp.addListener('appUrlOpen', (event) => {
    const url = new URL(event.url)
    const code = url.searchParams.get('code')
    if (code) {
      oauthCode.value = code
    }
  })
})

function onAuthenticated() {
  oauthCode.value = null
  settingsOpen.value = false
  history.replaceState(null, '', '/')
}

function selectTrack({ track, albumTracks, autoplay: ap = false }) {
  selectedTrack.value = track
  selectedAlbumTracks.value = albumTracks
  autoplay.value = ap
}

function backToList() {
  selectedTrack.value = null
  selectedAlbumTracks.value = []
}
</script>

<template>
  <div class="app-shell">
    <header v-if="!selectedTrack && !oauthCode" class="app-header">
      <span class="app-title">Song Educator</span>
      <div class="buttons">
        <Button icon="pi pi-refresh" text rounded @click="homeView?.load()" />
        <Button icon="pi pi-bars" text rounded @click="settingsOpen = true" />
      </div>
    </header>

    <main class="app-main">
      <OAuthCallbackView v-if="oauthCode" :code="oauthCode" @authenticated="onAuthenticated" />
      <TrackDetailView v-else-if="selectedTrack" :track="selectedTrack" :album-tracks="selectedAlbumTracks" :autoplay="autoplay" @back="backToList" @select-track="selectTrack" />
      <HomeView v-else ref="homeView" @select-track="selectTrack" />
    </main>

    <Drawer v-model:visible="settingsOpen" header="設定" position="right" style="width: min(400px, 100vw)">
      <SettingsView />
    </Drawer>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 16px;
  height: 52px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-toolbar-background);
}

.app-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.app-main {
  flex: 1;
  overflow-y: auto;
}
</style>
