<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onBeforeUnmount } from 'vue'
import { useViewer } from './useViewer'
import { useFileOps } from '../composables/useFileOps'
import type { PanelType } from './panelMap'
import type { FileEntry } from '../stores/files'

const v = useViewer()
const ops = useFileOps()
const registry: Record<PanelType, ReturnType<typeof defineAsyncComponent>> = {
  'image-viewer': defineAsyncComponent(() => import('./ImageViewer.vue')),
  'code-editor': defineAsyncComponent(() => import('./CodeViewer.vue')),
  'video-player': defineAsyncComponent(() => import('./MediaViewer.vue')),
  'markdown': defineAsyncComponent(() => import('./MarkdownViewer.vue')),
  'pdf-viewer': defineAsyncComponent(() => import('./PdfViewer.vue')),
  'doc-viewer': defineAsyncComponent(() => import('./DocViewer.vue')),
}
const current = computed(() => (v.panelType.value ? registry[v.panelType.value] : null))

function onDownload(entry?: FileEntry) {
  const items = [entry ?? v.currentItem.value].filter(Boolean) as FileEntry[]
  if (items.length) ops.download(items)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && v.open.value) v.close()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Transition name="c-zoom-in">
    <component
      :is="current"
      v-if="v.open.value && current && v.currentItem.value"
      :item="v.currentItem.value"
      :list="v.list.value"
      @close="v.close()"
      @download="onDownload"
    />
  </Transition>
</template>
