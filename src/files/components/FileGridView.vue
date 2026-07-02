<script setup lang="ts">
import type { FileEntry } from '../stores/files'
import FileTile from './FileTile.vue'
const props = defineProps<{ entries: FileEntry[]; selectedPaths?: Set<string> }>()
const emit = defineEmits<{
  (e: 'open', entry: FileEntry): void
  (e: 'select', payload: { entry: FileEntry; mode: 'toggle' | 'range' }): void
}>()
</script>

<template>
  <div class="file-grid">
    <FileTile
      v-for="entry in props.entries"
      :key="entry.path"
      :entry="entry"
      :selected="props.selectedPaths?.has(entry.path)"
      @open="emit('open', $event)"
      @select="emit('select', $event)"
    />
  </div>
</template>

<style scoped>
.file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 14px; }
</style>
