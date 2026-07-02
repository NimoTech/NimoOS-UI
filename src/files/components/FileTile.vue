<script setup lang="ts">
import type { FileEntry } from '../stores/files'
import { iconNameFor, iconUrl } from '../util/icons'
import { dateFmt } from '../util/format'

const props = defineProps<{ entry: FileEntry }>()
const emit = defineEmits<{ (e: 'open', entry: FileEntry): void }>()
</script>

<template>
  <div class="file-tile" @click="emit('open', props.entry)">
    <img class="tile-icon" :src="iconUrl(iconNameFor(props.entry))" alt="" />
    <span class="tile-name">{{ props.entry.name }}</span>
    <span class="tile-date">{{ dateFmt(props.entry.date || '') }}</span>
  </div>
</template>

<style scoped>
.file-tile { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 8px; border-radius: 16px; cursor: pointer; color: var(--fg); background: transparent; border: 1px solid transparent; }
.file-tile:hover { background: var(--chip-bg, rgba(255,255,255,0.08)); }
.tile-icon { width: var(--app-size, 64px); height: var(--app-size, 64px); }
.tile-name { font-size: 13px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.tile-date { font-size: 11px; color: var(--fg-muted, #9aa4bf); }
</style>
