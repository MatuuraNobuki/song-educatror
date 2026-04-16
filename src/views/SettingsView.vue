<template>
  <div class="settings">
    <div class="section">
      <p class="section-title">Dropbox 連携</p>

      <div class="fields">
        <div class="field">
          <label for="appKey">App Key</label>
          <InputText id="appKey" v-model="appKey" placeholder="App Key を入力" fluid />
        </div>
        <div class="field">
          <label for="appSecret">App Secret</label>
          <Password
            id="appSecret"
            v-model="appSecret"
            placeholder="App Secret を入力"
            :feedback="false"
            toggleMask
            fluid
          />
        </div>
      </div>

      <Button label="保存" icon="pi pi-save" severity="secondary" @click="saveCredentials" />
    </div>

    <Divider />

    <div class="section">
      <template v-if="authenticated">
        <div class="status connected">
          <i class="pi pi-check-circle" />
          <span>Dropbox に接続済み</span>
        </div>
        <Button
          label="切断"
          icon="pi pi-times"
          severity="danger"
          outlined
          @click="disconnect"
        />
      </template>
      <template v-else>
        <div class="status disconnected">
          <i class="pi pi-times-circle" />
          <span>未接続</span>
        </div>
        <Button
          label="Dropbox で認証"
          icon="pi pi-cloud"
          :disabled="!appKey"
          @click="authorize"
        />
      </template>
    </div>

    <Divider />

    <div class="section">
      <p class="section-title">Claude AI</p>
      <div class="fields">
        <div class="field">
          <label for="claudeApiKey">API キー</label>
          <Password
            id="claudeApiKey"
            v-model="claudeApiKey"
            placeholder="sk-ant-... を入力"
            :feedback="false"
            toggleMask
            fluid
          />
        </div>
      </div>
      <Button
        label="保存"
        icon="pi pi-save"
        severity="secondary"
        @click="saveClaudeApiKey"
      />
    </div>

    <Divider />

    <div class="section">
      <p class="section-title">ファイルパス</p>
      <div class="fields">
        <div class="field">
          <label for="filePath">Dropbox ファイルパス</label>
          <InputText
            id="filePath"
            v-model="filePath"
            placeholder="/フォルダ/ファイル.txt"
            fluid
          />
        </div>
      </div>
      <Button label="保存" icon="pi pi-save" severity="secondary" @click="saveFilePath" />
    </div>

    <Toast />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import {
  loadCredentials,
  saveCredentials as persistCredentials,
  isAuthenticated,
  clearAuth,
  startAuthFlow,
  loadFilePath,
  saveFilePath as persistFilePath,
} from '../services/dropboxAuth'
import { loadApiKey, saveApiKey } from '../services/ai/client'

const toast = useToast()

const appKey = ref('')
const appSecret = ref('')
const authenticated = ref(false)
const filePath = ref('')
const claudeApiKey = ref('')

onMounted(() => {
  const creds = loadCredentials()
  appKey.value = creds.appKey
  appSecret.value = creds.appSecret
  authenticated.value = isAuthenticated()
  filePath.value = loadFilePath()
  claudeApiKey.value = loadApiKey()
})

function saveCredentials() {
  persistCredentials(appKey.value.trim(), appSecret.value.trim())
  toast.add({ severity: 'success', summary: '保存しました', life: 2000 })
}

async function authorize() {
  try {
    persistCredentials(appKey.value.trim(), appSecret.value.trim())
    await startAuthFlow()
  } catch (e) {
    toast.add({ severity: 'error', summary: '認証エラー', detail: e.message, life: 4000 })
  }
}

function saveClaudeApiKey() {
  saveApiKey(claudeApiKey.value.trim())
  toast.add({ severity: 'success', summary: '保存しました', life: 2000 })
}


function saveFilePath() {
  persistFilePath(filePath.value.trim())
  toast.add({ severity: 'success', summary: '保存しました', life: 2000 })
}

function disconnect() {
  clearAuth()
  authenticated.value = false
  toast.add({ severity: 'info', summary: '切断しました', life: 2000 })
}
</script>

<style scoped>
.settings {
  padding: 24px 16px;
  max-width: 480px;
  margin: 0 auto;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--p-text-muted-color);
  margin: 0 0 16px;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label {
  font-size: 14px;
  font-weight: 500;
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.status.connected {
  color: var(--p-green-500);
}

.status.disconnected {
  color: var(--p-text-muted-color);
}

.status i {
  font-size: 18px;
}
</style>
