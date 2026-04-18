<template>
  <div class="tab-content">
    <div class="albumTitle">
      <div v-if="meta.pictures?.length" class="artwork-wrap">
        <img v-for="(src, i) in meta.pictures" :key="i" :src="src" class="artwork" :alt="`artwork ${i + 1}`" />
      </div>
      <div v-else class="artwork-wrap">
        <div class="artwork-placeholder"><i class="pi pi-music" /></div>
      </div>
      <span class="album-title">{{ meta.title }}</span>
    </div>
    <div class="meta-card">
      <div class="meta-row">
        <span class="meta-label">Artist</span>
        <span class="meta-value">{{ meta.artist ?? '—' }}</span>
      </div>
      <Divider />
      <div class="meta-row">
        <span class="meta-label">Album</span>
        <span class="meta-value">{{ meta.album ?? '—' }}</span>
      </div>
      <Divider />
      <div class="meta-row">
        <span class="meta-label">Track #</span>
        <span class="meta-value">{{ meta.trackNumber ?? '—' }}</span>
      </div>
      <Divider />
      <div class="meta-row">
        <span class="meta-label">Date</span>
        <span class="meta-value">{{ meta.date ?? '—' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import Divider from 'primevue/divider'

defineProps({
  meta: { type: Object, required: true },
})
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

.artwork-wrap {
  display: flex;
  justify-content: center;
  padding: 30px 16px;
}

.albumTitle {
  text-align: center;
}

.artwork {
  width: 350px;
  height: 350px;
  object-fit: cover;
  border-radius: 3px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
  scroll-snap-align: start;
}

.artwork-placeholder {
  width: 350px;
  height: 350px;
  border-radius: 3px;
  background: var(--p-content-hover-background);
  display: flex;
  align-items: center;
  justify-content: center;
}

.artwork-placeholder i {
  font-size: 56px;
  color: var(--p-text-muted-color);
}

.meta-card {
  margin: 0 16px 16px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 3px;
  padding: 4px 16px;
  border: none;
  margin-bottom: 0;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.meta-label {
  font-size: 13px;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
  width: 72px;
}

.meta-value {
  font-size: 14px;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-title {
  text-align: center;
  font-weight: bold;
}

.p-divider {
  margin: 0.1rem;
}
</style>
