<template>
  <Teleport to="body">
    <Transition name="viewer">
      <div v-if="visible" class="viewer-overlay">

        <!-- ツールバー -->
        <div class="viewer-toolbar">
          <button class="viewer-btn" @click="zoomOut" :disabled="scale <= MIN_SCALE">
            <i class="pi pi-minus" />
          </button>
          <span class="zoom-label">{{ Math.round(scale * 100) }}%</span>
          <button class="viewer-btn" @click="zoomIn" :disabled="scale >= MAX_SCALE">
            <i class="pi pi-plus" />
          </button>
          <span v-if="images.length > 1" class="page-label">{{ currentIndex + 1 }} / {{ images.length }}</span>
          <button class="viewer-btn viewer-close" @click="close">
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- 画像エリア -->
        <div
          class="viewer-stage"
          @touchstart.passive="onTouchStart"
          @touchmove.prevent="onTouchMove"
          @touchend="onTouchEnd"
          @click.self="close"
        >
          <img
            :src="currentSrc"
            class="viewer-image"
            :style="{
              transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
              transition: isGesturing ? 'none' : 'transform 0.2s ease',
            }"
            draggable="false"
          />
        </div>

      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  visible:    { type: Boolean, required: true },
  images:     { type: Array, default: () => [] },
  startIndex: { type: Number, default: 0 },
})
const emit = defineEmits(['close'])

const MIN_SCALE = 1
const MAX_SCALE = 8
const ZOOM_STEP = 0.5
const SWIPE_THRESHOLD = 60

const currentIndex = ref(0)
const currentSrc = computed(() => props.images[currentIndex.value] ?? '')

const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const isGesturing = ref(false)

watch(() => props.visible, (v) => {
  if (v) { currentIndex.value = props.startIndex; reset() }
})

function reset() {
  scale.value = 1
  tx.value = 0
  ty.value = 0
}

function close() {
  emit('close')
}

function goPrev() {
  if (currentIndex.value > 0) { currentIndex.value--; reset() }
}
function goNext() {
  if (currentIndex.value < props.images.length - 1) { currentIndex.value++; reset() }
}

// ───── ボタンズーム ─────
function zoomIn() {
  setScale(scale.value + ZOOM_STEP)
}
function zoomOut() {
  setScale(scale.value - ZOOM_STEP)
}
function setScale(s) {
  scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
  if (scale.value === MIN_SCALE) { tx.value = 0; ty.value = 0 }
}

// ───── タッチ ─────
let initialPinchDist = 0
let initialScale = 1
let lastTapMs = 0

let panActive = false
let panStartX = 0
let panStartY = 0
let panOriginTx = 0
let panOriginTy = 0

let swipeStartX = 0
let swipeStartY = 0

function dist(touches) {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function onTouchStart(e) {
  if (e.touches.length === 2) {
    isGesturing.value = true
    initialPinchDist = dist(e.touches)
    initialScale = scale.value
    panActive = false
  } else if (e.touches.length === 1) {
    swipeStartX = e.touches[0].clientX
    swipeStartY = e.touches[0].clientY
    if (scale.value > MIN_SCALE) {
      panActive = true
      panStartX = e.touches[0].clientX
      panStartY = e.touches[0].clientY
      panOriginTx = tx.value
      panOriginTy = ty.value
    } else {
      panActive = false
    }
  }
}

function onTouchMove(e) {
  if (e.touches.length === 2) {
    const d = dist(e.touches)
    scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, initialScale * (d / initialPinchDist)))
  } else if (e.touches.length === 1 && panActive) {
    tx.value = panOriginTx + (e.touches[0].clientX - panStartX)
    ty.value = panOriginTy + (e.touches[0].clientY - panStartY)
  }
}

function onTouchEnd(e) {
  isGesturing.value = false
  panActive = false

  if (scale.value <= MIN_SCALE) { tx.value = 0; ty.value = 0 }

  if (e.changedTouches.length === 1) {
    const dx = e.changedTouches[0].clientX - swipeStartX
    const dy = e.changedTouches[0].clientY - swipeStartY

    // スワイプで前後ナビゲーション（scale=1のときのみ）
    if (scale.value <= MIN_SCALE && Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext(); else goPrev()
      lastTapMs = 0
      return
    }

    // ダブルタップ検出
    const now = Date.now()
    if (now - lastTapMs < 280) {
      scale.value > 1 ? reset() : setScale(2.5)
      lastTapMs = 0
    } else {
      lastTapMs = now
    }
  }
}
</script>

<style scoped>
.viewer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  flex-direction: column;
  touch-action: none;
}

/* ツールバー */
.viewer-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.6);
  flex-shrink: 0;
}

.viewer-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
}

.viewer-btn:active {
  background: rgba(255, 255, 255, 0.25);
}

.viewer-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.viewer-close {
  margin-left: auto;
}

.zoom-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  min-width: 44px;
  text-align: center;
}

.page-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  margin-left: 8px;
}

/* 画像ステージ */
.viewer-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.viewer-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  transform-origin: center center;
  will-change: transform;
}

/* トランジション */
.viewer-enter-active,
.viewer-leave-active {
  transition: opacity 0.2s ease;
}
.viewer-enter-from,
.viewer-leave-to {
  opacity: 0;
}
</style>
