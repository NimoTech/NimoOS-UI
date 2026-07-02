<script setup lang="ts">
import type { FileEntry } from '../stores/files'
import { dateFmt } from '../util/format'
import FileThumb from './FileThumb.vue'
import FavoriteStar from './FavoriteStar.vue'

const props = defineProps<{ entry: FileEntry }>()
const emit = defineEmits<{ (e: 'open', entry: FileEntry): void }>()
</script>

<template>
  <div class="file-tile" @click="emit('open', props.entry)">
    <FavoriteStar class="tile-star" :path="props.entry.path" :name="props.entry.name" />
    <FileThumb class="tile-icon" :entry="props.entry" />
    <span class="tile-name">{{ props.entry.name }}</span>
    <span class="tile-date">{{ dateFmt(props.entry.date || '') }}</span>
  </div>
</template>

<style scoped>
.file-tile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 8px; border-radius: 16px; cursor: pointer; color: var(--fg); background: transparent; border: 1px solid transparent; }
.file-tile:hover { background: var(--chip-bg, rgba(255,255,255,0.08)); }
.tile-icon { width: var(--app-size, 64px); height: var(--app-size, 64px); }
.tile-name { font-size: 13px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.tile-date { font-size: 11px; color: var(--fg-muted, #9aa4bf); }
.tile-star { position: absolute; top: 6px; right: 6px; }
.file-tile :deep(.favorite-star) { opacity: 0; transition: opacity .12s; }
.file-tile:hover :deep(.favorite-star), .file-tile :deep(.favorite-star.active) { opacity: 1; }
</style>
