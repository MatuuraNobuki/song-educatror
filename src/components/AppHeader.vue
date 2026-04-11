<template>
  <Toolbar class="app-header">
    <template #start>
      <span class="app-title">Song Educator</span>
    </template>
  </Toolbar>
</template>

<script setup>
import Toolbar from 'primevue/toolbar'
</script>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
}

.app-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
</style>
