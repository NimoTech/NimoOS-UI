<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FileEntry } from '../stores/files'
import FileRow from './FileRow.vue'

const props = defineProps<{ entries: FileEntry[]; sort: string; order: string }>()
const emit = defineEmits<{ (e: 'open', entry: FileEntry): void; (e: 'reorder', sort: string): void }>()
const { t } = useI18n()

const COLS = [
  { key: 'name', label: 'filesColName', cls: 'col-name' },
  { key: 'format', label: 'filesColType', cls: 'col-format' },
  { key: 'date', label: 'filesColDate', cls: 'col-date' },
  { key: 'size', label: 'filesColSize', cls: 'col-size' },
]
function arrow(key: string) { return props.sort === key ? (props.order === 'asc' ? ' ▲' : ' ▼') : '' }
</script>

<template>
  <div class="file-listview">
    <div class="file-listhead">
      <span
        v-for="c in COLS"
        :key="c.key"
        :class="['head-cell', c.cls]"
        @click="emit('reorder', c.key)"
      >{{ t(c.label) }}{{ arrow(c.key) }}</span>
    </div>
    <FileRow v-for="entry in props.entries" :key="entry.path" :entry="entry" @open="emit('open', $event)" />
  </div>
</template>

<style scoped>
.file-listhead { display: flex; align-items: center; gap: 12px; padding: 6px 12px; font-size: 12px; color: var(--fg-muted, #9aa4bf); border-bottom: 1px solid var(--card-border, rgba(255,255,255,0.08)); }
.head-cell { cursor: pointer; user-select: none; }
.col-name { flex: 1 1 auto; margin-left: 40px; }
.col-format { flex: 0 0 48px; }
.col-date { flex: 0 0 160px; }
.col-size { flex: 0 0 80px; text-align: right; }
</style>
