<template>
  <div class="tab-content">
    <div v-if="extraPictures?.length" class="image-grid">
      <img
        v-for="(src, i) in extraPictures"
        :key="i"
        :src="src"
        class="extra-image"
        :alt="`image ${i + 1}`"
        @click="$emit('open-viewer', src)"
      />
    </div>
    <div v-else class="text-empty">追加画像がありません</div>
  </div>
</template>

<script setup>
defineProps({
  extraPictures: { type: Array, default: () => [] },
})
defineEmits(['open-viewer'])
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

.image-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.extra-image {
  width: 100%;
  border-radius: 10px;
  object-fit: contain;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  cursor: zoom-in;
}

.text-empty {
  margin: 24px 16px;
  font-size: 14px;
  color: var(--p-text-muted-color);
  text-align: center;
}
</style>
