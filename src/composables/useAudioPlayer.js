import { ref } from 'vue'
import { formatTime } from '../utils/format'

export function useAudioPlayer({ autoplay } = {}) {
  const audioEl = ref(null)
  const playing = ref(false)
  const repeatEnabled = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const seekValue = ref(0)

  function togglePlay() {
    if (!audioEl.value) return
    if (playing.value) {
      audioEl.value.pause()
      playing.value = false
    } else {
      audioEl.value.play()
      playing.value = true
    }
  }

  function onLoaded() {
    duration.value = audioEl.value?.duration ?? 0
    if (autoplay?.value) {
      audioEl.value.play()
      playing.value = true
    }
  }

  function onTimeUpdate() {
    if (!audioEl.value) return
    currentTime.value = audioEl.value.currentTime
    if (duration.value > 0) {
      seekValue.value = (audioEl.value.currentTime / duration.value) * 100
    }
  }

  function onSeek(value) {
    if (!audioEl.value) return
    audioEl.value.currentTime = (value / 100) * duration.value
  }

  function reset() {
    if (audioEl.value) audioEl.value.pause()
    playing.value = false
    currentTime.value = 0
    duration.value = 0
    seekValue.value = 0
  }

  return {
    audioEl,
    playing,
    repeatEnabled,
    currentTime,
    duration,
    seekValue,
    formatTime,
    togglePlay,
    onLoaded,
    onTimeUpdate,
    onSeek,
    reset,
  }
}
