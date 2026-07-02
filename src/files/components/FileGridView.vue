<script setup lang="ts">
import type { FileEntry } from '../stores/files'
import FileTile from './FileTile.vue'
const props = defineProps<{ entries: FileEntry[] }>()
const emit = defineEmits<{ (e: 'open', entry: FileEntry): void }>()
</script>

<template>
  <div class="file-grid">
    <FileTile v-for="entry in props.entries" :key="entry.path" :entry="entry" @open="emit('open', $event)" />
  </div>
</template>

<style scoped>
.file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 14px; }
</style>
