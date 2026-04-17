<template>
  <div class="tab-content visual-content">
    <template v-if="hasLyrics">
      <div class="visual-body" :style="visualCssVars" v-html="visualBodyHtml" @click="onVisualClickWrapper" ref="visualBodyRef" />
      <Teleport to="body">
        <div v-if="tooltip.visible" class="visual-tooltip" :style="tooltip.style">
          <div class="visual-tooltip-title">{{ tooltip.title }}</div>
          <div>{{ tooltip.body }}</div>
        </div>
      </Teleport>
      <div class="visual-overlay">
        <Message v-if="visualError" severity="error" :closable="false" class="visual-error">{{ visualError }}</Message>
        <div class="visual-speeddial-container">
          <SpeedDial
            :model="visualSpeedDialItems"
            direction="up"
            :showIcon="['pi ', visualPhase === 'generating' ? 'pi-spin pi-spinner' : 'pi-plus']"
            class="visual-speeddial"
            :disabled="visualPhase === 'generating'"
          />
        </div>
      </div>
    </template>
    <template v-else>
      <div class="visual-idle">
        <i class="pi pi-palette visual-idle-icon" />
        <p class="visual-idle-desc">歌詞データがありません</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import Message from 'primevue/message'
import SpeedDial from 'primevue/speeddial'
import { useVisualTooltip } from '../../composables/useVisualTooltip'

const props = defineProps({
  hasLyrics: { type: Boolean, default: false },
  visualBodyHtml: { type: String, default: '' },
  visualCssVars: { type: Object, default: () => ({}) },
  visualTooltipData: { type: Object, default: () => ({}) },
  visualPhase: { type: String, default: 'idle' },
  visualError: { type: String, default: null },
})

const emit = defineEmits(['generate', 'discard'])

const { visualBodyRef, tooltip, onVisualClick, registerTouchHandler, setTooltipData } = useVisualTooltip()

watch(visualBodyRef, (el) => {
  registerTouchHandler(el, props.visualTooltipData)
})

watch(() => props.visualTooltipData, (data) => {
  setTooltipData(data)
})

const visualSpeedDialItems = computed(() => {
  console.log(props.visualPhase);
  if (props.visualPhase === 'idle') {
    return [{ label: '生成', icon: 'pi pi-sparkles', command: () => emit('generate') }]
  }
  if (props.visualPhase === 'ready') {
    return [
      { label: '再生成', icon: 'pi pi-refresh', command: () => emit('generate') },
      { label: '破棄', icon: 'pi pi-trash', command: () => emit('discard') },
    ]
  }
  return []
})

// onVisualClick を template から呼べるよう公開
function onVisualClickWrapper(e) {
  onVisualClick(e, props.visualTooltipData)
}
</script>

<style scoped>
.tab-content {
  display: flex;
  flex-direction: column;
  height: 89%;
  justify-content: space-between;
  padding-bottom: 8px;
  overflow-y: scroll;
  overflow-x: hidden;
}

.visual-content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 147px);
  padding: 0;
  position: relative;
}

.visual-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px 24px;
  text-align: center;
}

.visual-idle-icon {
  font-size: 48px;
  color: var(--p-primary-color);
  opacity: 0.6;
}

.visual-idle-desc {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.6;
  margin: 0 0 4px;
}

.visual-error {
  width: 100%;
  font-size: 13px;
}

.visual-overlay {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  z-index: 10;
}

.visual-speeddial-container {
  position: relative;
}

.visual-speeddial {
  position: static;
}

.visual-body {
  flex: 1;
  overflow-y: auto;
  background-color: var(--color-bg, #f0f5f0);
  color: var(--color-text, #2a3a2a);
  font-size: 16px;
  line-height: 1.9;
}

:deep(.intro-note) {
  background: var(--color-intro-bg, #d7ead7);
  border-left: 4px solid var(--color-accent, #2e7d32);
  margin: 0 0 8px 0;
  padding: 18px 20px 16px 20px;
  font-size: 13.5px;
  color: var(--color-text-sub, #4a6a4a);
  line-height: 1.7;
}

:deep(.lyric-block) {
  background: var(--color-block-bg, #fff);
  margin: 0 0 2px 0;
  padding: 22px 24px 18px 24px;
  border-bottom: 1px solid var(--color-bg2, #e4ede4);
}

:deep(.lyric-block.chorus) {
  background: var(--color-chorus-bg, #c8e6c9);
  border-left: 4px solid var(--color-accent, #2e7d32);
}

:deep(.block-label) {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--color-accent2, #81c784);
  text-transform: uppercase;
  margin-bottom: 10px;
}

:deep(.lyric-block.chorus .block-label) {
  color: var(--color-accent, #2e7d32);
}

:deep(.lyric-line) {
  display: block;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 0.03em;
  margin-bottom: 2px;
  padding: 1px 0;
}

:deep(.annotated) {
  cursor: pointer;
  border-bottom: 2px solid var(--color-underline, #2e7d32);
  padding-bottom: 1px;
  color: var(--color-accent, #2e7d32);
  font-weight: 600;
  transition: background 0.15s;
  border-radius: 2px;
}

:deep(.annotated:active),
:deep(.annotated.active) {
  background: var(--color-accent3, #a5d6a7);
  color: var(--color-text, #2a3a2a);
}

:deep(.page-footer) {
  text-align: center;
  padding: 30px 20px 10px 20px;
  font-size: 12px;
  color: var(--color-text-sub, #4a6a4a);
  opacity: 0.7;
  letter-spacing: 0.06em;
}

:deep(.page-footer span) {
  display: inline-block;
  border-top: 1px solid var(--color-accent2, #81c784);
  padding-top: 12px;
  min-width: 140px;
}

.visual-tooltip {
  position: fixed;
  z-index: 9999;
  background: var(--color-tooltip-bg, #1b5e20);
  color: var(--color-tooltip-text, #f1f8e9);
  font-size: 13px;
  line-height: 1.65;
  padding: 12px 15px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}

.visual-tooltip-title {
  font-weight: 700;
  font-size: 12px;
  color: var(--color-accent3, #a5d6a7);
  letter-spacing: 0.08em;
  margin-bottom: 5px;
  text-transform: uppercase;
}
</style>
