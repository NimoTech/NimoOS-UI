<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import ViewerShell from './ViewerShell.vue'
import { renderMarkdown } from './renderMarkdown'
import { coerceContent } from './codeContent'
import { useToast } from '../../stores/toast'
import type { FileEntry } from '../stores/files'

const props = defineProps<{ item: FileEntry; list: FileEntry[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'download', entry: FileEntry): void }>()
const { t } = useI18n()
const toast = useToast()
const html = ref('')

onMounted(async () => {
  try {
    // Controller-verified (same as Task 6 CodeViewer): /v1/file/content is a
    // standard envelope whose `data` is the raw content STRING — but read
    // defensively in case the endpoint ever returns the typed `{content}` shape.
    const raw = await service.file.getContent(props.item.path)
    const text = coerceContent(typeof raw === 'string' ? raw : (raw as { content?: unknown })?.content ?? raw)
    html.value = renderMarkdown(text)
  } catch {
    toast.show(t('filesViewerReadFailed'))
  }
})
</script>

<template>
  <ViewerShell :title="props.item.name" downloadable @close="emit('close')" @download="emit('download', props.item)">
    <div class="md-scroll">
      <!-- 只读渲染:renderMarkdown 已 html:false 过滤内嵌 HTML,v-html 安全 -->
      <article class="md-body" v-html="html"></article>
    </div>
  </ViewerShell>
</template>

<style scoped>
.md-scroll { width: 100%; height: 100%; overflow: auto; display: flex; justify-content: center; }
.md-body { max-width: 820px; width: 100%; padding: 32px 28px; line-height: 1.7; color: var(--fg, #fff); }
.md-body :deep(h1), .md-body :deep(h2), .md-body :deep(h3) { margin: 1.2em 0 0.5em; font-weight: 700; }
.md-body :deep(h1) { font-size: 1.7em; border-bottom: 1px solid var(--card-border, rgba(255,255,255,0.2)); padding-bottom: 0.3em; }
.md-body :deep(code) { background: var(--inner-bg); padding: 0.15em 0.4em; border-radius: 4px; font-family: Consolas, monospace; }
.md-body :deep(pre) { background: var(--card-bg); padding: 14px 16px; border-radius: 10px; overflow-x: auto; }
.md-body :deep(pre) code { background: none; padding: 0; }
.md-body :deep(a) { color: var(--accent, #8ab4ff); }
.md-body :deep(table) { border-collapse: collapse; }
.md-body :deep(th), .md-body :deep(td) { border: 1px solid var(--card-border, rgba(255,255,255,0.2)); padding: 6px 12px; }
.md-body :deep(blockquote) { border-left: 3px solid var(--accent, #8ab4ff); margin: 1em 0; padding-left: 1em; color: var(--fg-muted, rgba(255,255,255,0.74)); }
</style>
