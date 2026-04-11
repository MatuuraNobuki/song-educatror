<template>
  <div class="callback">
    <ProgressSpinner v-if="loading" />
    <div v-else-if="error" class="result error">
      <i class="pi pi-times-circle" />
      <p>{{ error }}</p>
    </div>
    <div v-else class="result success">
      <i class="pi pi-check-circle" />
      <p>認証が完了しました</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import { handleCallback } from '../services/dropboxAuth'

const props = defineProps({ code: { type: String, required: true } })
const emit = defineEmits(['authenticated'])

const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    await handleCallback(props.code)
    loading.value = false
    emit('authenticated')
  } catch (e) {
    error.value = e.message
    loading.value = false
  }
})
</script>

<style scoped>
.callback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 16px;
}

.result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  font-size: 16px;
}

.result i {
  font-size: 48px;
}

.result.success i { color: var(--p-green-500); }
.result.error i   { color: var(--p-red-500); }
</style>
