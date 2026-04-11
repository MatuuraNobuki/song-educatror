<template>
  <div class="app-footer">
    <TabMenu :model="navItems" v-model:activeIndex="activeIndex" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import TabMenu from 'primevue/tabmenu'

const props = defineProps({
  activeTab: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['change-tab'])

const navItems = [
  { icon: 'pi pi-home', key: 'home' },
  { icon: 'pi pi-book', key: 'learn' },
  { icon: 'pi pi-play', key: 'practice' },
  { icon: 'pi pi-cog', key: 'settings' },
]

const activeIndex = computed({
  get: () => navItems.findIndex((item) => item.key === props.activeTab),
  set: (index) => emit('change-tab', navItems[index].key),
})
</script>

<style scoped>
.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);
}

.app-footer :deep(.p-tabmenu) {
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-bottom: none;
}

.app-footer :deep(.p-tabmenu-tablist) {
  border-radius: 0;
  display: flex;
  justify-content: space-between;
}

.app-footer :deep(.p-tabmenu-item) {
  flex: 1;
}

.app-footer :deep(.p-tabmenu-item-link) {
  padding: 14px 0;
  justify-content: center;
  gap: 0;
  width: 100%;
}

.app-footer :deep(.p-tabmenuitem-label) {
  display: none;
}

.app-footer :deep(.p-tabmenu-item-icon) {
  font-size: 18px;
  margin: 0;
}
</style>
