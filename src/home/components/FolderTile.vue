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
/* kind-folder flex column layout lives in global theme.css (.kind-folder rule) */
.folder-tile-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; height: 100%; }
/* .folder-tile glass + 2×2 grid lives in global theme.css; local scoped provides sizing context */
.folder-tile { width: 100%; height: 100%; }
/* .folder-tile i mini-cell coloring also lives in global theme.css */
.app-label { flex: 0 0 auto; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; font-size: clamp(12.5px, 1.05vw, 14.5px); font-weight: 500; line-height: 1.25; color: var(--label-color, var(--fg)); text-shadow: var(--label-shadow, none); }
</style>
