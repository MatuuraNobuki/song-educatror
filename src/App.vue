<script setup>
import { ref, onMounted } from 'vue'
import { App as CapApp } from '@capacitor/app'
import { ToastService } from 'primevue'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import HomeView from './views/HomeView.vue'
import SettingsView from './views/SettingsView.vue'
import OAuthCallbackView from './views/OAuthCallbackView.vue'
import TrackDetailView from './views/TrackDetailView.vue'

const activeTab = ref('home')
const selectedTrack = ref(null)
const oauthCode = ref(null)

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
  activeTab.value = 'settings'
  history.replaceState(null, '', '/')
}

function selectTrack(track) {
  selectedTrack.value = track
}

function backToList() {
  selectedTrack.value = null
}
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <main class="app-main">
      <OAuthCallbackView v-if="oauthCode" :code="oauthCode" @authenticated="onAuthenticated" />
      <TrackDetailView v-else-if="selectedTrack" :track="selectedTrack" @back="backToList" />
      <HomeView v-else-if="activeTab === 'home'" @select-track="selectTrack" />
      <SettingsView v-else-if="activeTab === 'settings'" />
    </main>
    <AppFooter :active-tab="activeTab" @change-tab="activeTab = $event" />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}

.app-main {
  flex: 1;
  margin-top: 56px;
  margin-bottom: 60px;
  overflow-y: auto;
}
</style>
