<template>
  <div class="folder-tile-wrap">
    <span class="folder-tile" aria-hidden="true"><i /><i /><i /><i /></span>
    <span class="app-label">{{ item.key }}</span>
  </div>
</template>
<script setup lang="ts">
import type { LayoutItem } from '../grid/types'
defineProps<{ item: LayoutItem }>()
</script>
<style scoped>
.folder-tile-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 100%; }
.folder-tile { width: var(--app-size, 48px); height: var(--app-size, 48px); display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 3px; padding: 6px; background: rgba(255,255,255,.08); border-radius: 22%; box-sizing: border-box; }
.folder-tile i { background: linear-gradient(145deg, #9fd0ff, #4c8dff); border-radius: 4px; }
.app-label { font-size: 11px; opacity: .85; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
