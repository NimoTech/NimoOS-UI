<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import * as pdfjsLib from 'pdfjs-dist'
// Vite:?url 拿到 worker 资源地址,交给 pdfjs 的 GlobalWorkerOptions。
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import ViewerShell from './ViewerShell.vue'
import { service } from '@nimotech/nimoos-service'
import type { FileEntry } from '../stores/files'
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const props = defineProps<{ item: FileEntry; list: FileEntry[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'download', entry: FileEntry): void }>()
const { t } = useI18n()

const state = ref<'loading' | 'ready' | 'error'>('loading')
const page = ref(1)
const total = ref(0)
const canvas = ref<HTMLCanvasElement | null>(null)
const scroll = ref<HTMLElement | null>(null)

// 异步加载/渲染期间可能已被卸载(用户快速关闭)——卸载后放弃后续操作,销毁文档。
let disposed = false
let loadingTask: PDFDocumentLoadingTask | null = null
let pdfDoc: PDFDocumentProxy | null = null
let renderTask: RenderTask | null = null

onMounted(async () => {
  try {
    const buf = await service.file.getBytes(props.item.path)   // 真实路径,走共享 axios(401 自愈)
    if (disposed) return
    loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) })
    pdfDoc = await loadingTask.promise
    if (disposed) return
    total.value = pdfDoc.numPages
    state.value = 'ready'
    await nextTick()                                           // 等 canvas 挂载(v-show ready 后)
    await renderPage()
  } catch {
    if (disposed) return
    state.value = 'error'
  }
})

async function renderPage(): Promise<void> {
  if (!pdfDoc || !canvas.value || !scroll.value) return
  if (renderTask) { renderTask.cancel(); renderTask = null }
  const pg = await pdfDoc.getPage(page.value)
  if (disposed || !canvas.value) return
  const avail = scroll.value.clientWidth - 32
  const base = pg.getViewport({ scale: 1 })
  const scale = Math.max(0.2, Math.min(3, avail / base.width))
  const viewport = pg.getViewport({ scale })
  const c = canvas.value
  const ctx = c.getContext('2d')
  if (!ctx) return
  c.width = viewport.width
  c.height = viewport.height
  try {
    renderTask = pg.render({ canvasContext: ctx, viewport, canvas: c })
    await renderTask.promise
  } catch {
    /* 翻页取消上一次渲染会 reject(RenderingCancelledException)——忽略 */
  } finally {
    renderTask = null
  }
  if (scroll.value) scroll.value.scrollTop = 0
}

function prev(): void { if (page.value > 1) { page.value--; void renderPage() } }
function next(): void { if (page.value < total.value) { page.value++; void renderPage() } }

onBeforeUnmount(() => {
  disposed = true
  if (renderTask) { renderTask.cancel(); renderTask = null }
  // loadingTask.destroy() 会同时销毁文档与 worker;释放资源。
  if (loadingTask) { void loadingTask.destroy(); loadingTask = null; pdfDoc = null }
})
</script>

<template>
  <ViewerShell :title="props.item.name" downloadable @close="emit('close')" @download="emit('download', props.item)">
    <template #toolbar>
      <div v-if="state === 'ready' && total > 0" class="pdf-nav">
        <button type="button" class="pdf-btn" :disabled="page <= 1" @click="prev">‹</button>
        <span class="pdf-page">{{ page }} / {{ total }}</span>
        <button type="button" class="pdf-btn" :disabled="page >= total" @click="next">›</button>
      </div>
    </template>
    <div class="office-body">
      <div v-if="state === 'loading'" class="viewer-status">{{ t('filesViewerLoading') }}</div>
      <div v-else-if="state === 'error'" class="viewer-status">
        <p>{{ t('filesViewerError') }}</p>
        <button type="button" class="chip" @click="emit('download', props.item)">{{ t('filesViewerDownloadInstead') }}</button>
      </div>
      <div v-show="state === 'ready'" ref="scroll" class="pdf-scroll">
        <canvas ref="canvas" class="pdf-canvas"></canvas>
      </div>
    </div>
  </ViewerShell>
</template>

<style scoped>
.pdf-scroll {
  width: 100%; height: 100%; overflow: auto;
  display: flex; justify-content: center; align-items: flex-start;
  padding: 16px; background: rgba(0, 0, 0, 0.25);
}
.pdf-canvas { max-width: 100%; height: auto; box-shadow: 0 2px 16px rgba(0, 0, 0, 0.4); background: #fff; }
.pdf-nav { display: flex; align-items: center; gap: 10px; }
.pdf-btn {
  width: 30px; height: 30px; border: none; border-radius: 50%; cursor: pointer;
  background: rgba(255, 255, 255, 0.14); color: var(--fg, #fff); font-size: 18px; line-height: 1;
}
.pdf-btn:disabled { opacity: 0.35; cursor: default; }
.pdf-btn:not(:disabled):hover { background: rgba(255, 255, 255, 0.26); }
.pdf-page { font-size: 13px; min-width: 56px; text-align: center; font-variant-numeric: tabular-nums; }
</style>
