<script setup lang="ts">
import type { FileEntry } from '../stores/files'
import { iconNameFor, iconUrl } from '../util/icons'
import { renderSize, dateFmt } from '../util/format'

const props = defineProps<{ entry: FileEntry }>()
const emit = defineEmits<{ (e: 'open', entry: FileEntry): void }>()
</script>

<template>
  <div class="file-row" @click="emit('open', props.entry)">
    <img class="file-icon" :src="iconUrl(iconNameFor(props.entry))" alt="" />
    <span class="file-name">{{ props.entry.name }}</span>
    <span class="file-format">{{ props.entry.is_dir ? '' : (props.entry.name.split('.').length > 1 ? props.entry.name.split('.').pop() : '') }}</span>
    <span class="file-date">{{ dateFmt(props.entry.date || '') }}</span>
    <span class="file-size">{{ props.entry.is_dir ? '' : renderSize(props.entry.size ?? 0) }}</span>
  </div>
</template>

<style scoped>
.file-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 12px; cursor: pointer; color: var(--fg); }
.file-row:hover { background: var(--chip-bg, rgba(255,255,255,0.06)); }
.file-icon { width: 28px; height: 28px; flex: 0 0 auto; }
.file-name { flex: 1 1 auto; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-format { flex: 0 0 48px; font-size: 12px; color: var(--fg-muted, #9aa4bf); text-transform: uppercase; }
.file-date { flex: 0 0 160px; font-size: 12px; color: var(--fg-muted, #9aa4bf); }
.file-size { flex: 0 0 80px; font-size: 12px; color: var(--fg-muted, #9aa4bf); text-align: right; }
</style>
