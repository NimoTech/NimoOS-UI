<script setup lang="ts">
import ViewerShell from './ViewerShell.vue'
import type { FileEntry } from '../stores/files'
const props = defineProps<{ item: FileEntry; list: FileEntry[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'download'): void }>()
</script>
<template>
  <ViewerShell :title="props.item.name" downloadable @close="emit('close')" @download="emit('download')">
    <div style="padding:24px">media placeholder: {{ props.item.name }}</div>
  </ViewerShell>
</template>
