<template>
  <div class="player-bar" :class="{ 'player-bar--hidden': keyboardVisible }">
    <audio
      ref="audioEl"
      :src="audioUrl"
      preload="metadata"
      :loop="repeatEnabled"
      v-if="audioUrl"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoaded"
      @ended="onEnded"
    />
    <audio v-if="autoNextEnabled && nextAudioUrl" :src="nextAudioUrl" preload="auto" style="display:none" />
    <Button :icon="playing ? 'pi pi-pause' : 'pi pi-play'" rounded text class="play-btn" :disabled="!audioUrl" @click="togglePlay" />
    <div class="auto-next-toggle" :class="{ active: autoNextEnabled, disabled: !audioUrl }">
      <label class="auto-next-label" for="autoNextToggle" aria-label="Toggle Auto Next">
        <i class="pi pi-forward" />
      </label>
      <ToggleSwitch v-model="autoNextEnabled" :disabled="!audioUrl" inputId="autoNextToggle" class="repeat-switch-hidden" />
    </div>
    <div class="player-progress">
      <span class="player-time">{{ formatTime(currentTime) }}</span>
      <Slider v-model="seekValue" :max="100" class="progress-slider" @change="onSeek" :disabled="!audioUrl" />
      <span class="player-time">{{ formatTime(duration) }}</span>
      <div class="repeat-toggle" :class="{ active: repeatEnabled, disabled: !audioUrl }">
        <label class="repeat-label" for="repeatToggle" aria-label="Toggle Repeat">
          <i class="pi pi-sync" />
        </label>
        <ToggleSwitch v-model="repeatEnabled" :disabled="!audioUrl" inputId="repeatToggle" class="repeat-switch-hidden" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import ToggleSwitch from 'primevue/toggleswitch'
import { useAudioPlayer } from '../../composables/useAudioPlayer'

const props = defineProps({
  audioUrl: { type: String, default: null },
  nextAudioUrl: { type: String, default: null },
  autoplay: { type: Boolean, default: false },
  keyboardVisible: { type: Boolean, default: false },
})

const emit = defineEmits(['playing-changed', 'next-track'])

const autoplayRef = { value: props.autoplay }
const autoNextEnabled = ref(false)

const {
  audioEl, playing, repeatEnabled, currentTime, duration, seekValue,
  formatTime, togglePlay, onLoaded, onTimeUpdate, onSeek, reset,
} = useAudioPlayer({ autoplay: autoplayRef })

watch(autoNextEnabled, (v) => { if (v) repeatEnabled.value = false })
watch(repeatEnabled, (v) => { if (v) autoNextEnabled.value = false })

function onEnded() {
  playing.value = false
  if (autoNextEnabled.value) emit('next-track')
}

defineExpose({ playing, reset })
</script>

<style scoped>
.player-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  padding-bottom: calc(6px + env(safe-area-inset-bottom));
  background: var(--p-content-background);
  border-top: 1px solid var(--p-content-border-color);
  transition: transform 0.15s ease;
}

.player-bar--hidden {
  transform: translateY(100%);
}

.play-btn {
  flex-shrink: 0;
}

.auto-next-toggle {
  opacity: 0.45;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.auto-next-toggle.active {
  color: var(--p-primary-color);
  opacity: 1;
}

.auto-next-toggle.disabled {
  opacity: 0.45;
}

.auto-next-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
}

.repeat-toggle {
  opacity: 0.45;
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
}

.repeat-toggle.active {
  color: var(--p-primary-color);
  opacity: 1;
}

.repeat-toggle.disabled {
  opacity: 0.45;
}

.repeat-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
}

.repeat-switch-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  clip: rect(0 0 0 0);
  overflow: hidden;
  white-space: nowrap;
}

.player-progress {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.progress-slider {
  flex: 1;
}

.player-time {
  font-size: 12px;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
  min-width: 32px;
}
</style>
