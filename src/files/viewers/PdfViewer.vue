<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import * as pdfjsLib from 'pdfjs-dist'
// Vite: ?url gets worker resource URL, pass to pdfjs GlobalWorkerOptions.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import ViewerShell from './ViewerShell.vue'
import { service } from '@nimotech/nimoos-service'
import { fileExt } from '../util/ext'
import type { FileEntry } from '../stores/files'
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

const props = defineProps<{ item: FileEntry; list: FileEntry[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'download', entry: FileEntry): void }>()
const { t } = useI18n()
const isConvert = fileExt(props.item.name) !== 'pdf'

const state = ref<'loading' | 'ready' | 'error'>('loading')
const errorDetail = ref('')
const total = ref(0)
const zoom = ref(1)                        // Multiplier relative to "fit width"
const currentPage = ref(1)                 // Current page (updates as user scrolls)
const pageInput = ref(1)                   // Page number input box (manual page jump)
const pagesEl = ref<HTMLElement | null>(null)   // Scroll container for all pages' canvases in vertical layout

// Component may be unmounted during async load/render (user closes quickly) — abandon operations after unmount, destroy document.
let disposed = false
let inputFocused = false
let loadingTask: PDFDocumentLoadingTask | null = null
let pdfDoc: PDFDocumentProxy | null = null
let renderTasks: RenderTask[] = []
let pageCanvases: HTMLCanvasElement[] = []
// Render generation: zoom redraws all pages, old round self-exits after each await to avoid concurrent writes to same canvases.
let renderGen = 0

function isCancelled(e: unknown): boolean {
  return e instanceof Error && e.name === 'RenderingCancelledException'
}
function cancelTasks(): void {
  for (const tk of renderTasks) { try { tk.cancel() } catch { /* already finished */ } }
  renderTasks = []
}

onMounted(async () => {
  try {
    // Native .pdf → fetch directly; legacy Office → backend LibreOffice converts to PDF then fetch (getPreviewBytes).
    const buf = isConvert
      ? await service.file.getPreviewBytes(props.item.path)
      : await service.file.getBytes(props.item.path)
    if (disposed) return
    // cMapUrl/standardFontDataUrl point to pdfjs resources copied at build time (base=BASE_URL),
    // ensures CJK and other non-Latin encoded + non-embedded-font PDFs don't show boxes/garbled text.
    loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buf),
      cMapUrl: `${import.meta.env.BASE_URL}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${import.meta.env.BASE_URL}standard_fonts/`,
    })
    pdfDoc = await loadingTask.promise
    if (disposed) return
    total.value = pdfDoc.numPages
    state.value = 'ready'
    await nextTick()                                           // Wait for scroll container to mount (after v-show ready)
    await renderAll()
  } catch {
    if (disposed) return
    errorDetail.value = isConvert
      ? t('filesViewerConvertFailed')
      : t('filesViewerPdfLoadFailed')
    state.value = 'error'
  }
})

// Render all pages vertically; redraw all on zoom change (re-render clearer than CSS scale).
async function renderAll(): Promise<void> {
  const el = pagesEl.value
  if (!pdfDoc || !el) return
  const gen = ++renderGen
  cancelTasks()
  el.innerHTML = ''
  pageCanvases = []
  const containerW = el.clientWidth - 32
  for (let n = 1; n <= total.value; n++) {
    if (disposed || gen !== renderGen) return
    try {
      const pg = await pdfDoc.getPage(n)
      if (disposed || gen !== renderGen) return
      const base = pg.getViewport({ scale: 1 })
      const scale = Math.max(0.1, (containerW / base.width) * zoom.value)
      const viewport = pg.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.className = 'pdf-page-canvas'
      canvas.width = viewport.width
      canvas.height = viewport.height
      el.appendChild(canvas)
      pageCanvases.push(canvas)
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      const task = pg.render({ canvasContext: ctx, viewport, canvas })
      renderTasks.push(task)
      await task.promise
    } catch (e) {
      if (isCancelled(e)) return              // Cancelled by new zoom/unmount round → expected
      if (disposed || gen !== renderGen) return
      errorDetail.value = t('filesViewerPdfRenderFailed')
      state.value = 'error'
      return
    }
  }
}

// Update current page as user scrolls (find page at position slightly below scroll). Don't override user input when input focused.
function onScroll(): void {
  const el = pagesEl.value
  if (!el || pageCanvases.length === 0) return
  const y = el.scrollTop + 60
  let cur = 1
  for (let i = 0; i < pageCanvases.length; i++) {
    if (pageCanvases[i].offsetTop <= y) cur = i + 1
    else break
  }
  currentPage.value = cur
  if (!inputFocused) pageInput.value = cur
}

function goToPage(n: number): void {
  const el = pagesEl.value
  if (!el || !total.value) return
  const clamped = Math.min(Math.max(1, Math.floor(n) || 1), total.value)
  const c = pageCanvases[clamped - 1]
  if (c) el.scrollTop = c.offsetTop - 8
  pageInput.value = clamped
}

function onInputFocus(): void { inputFocused = true }
function onInputBlur(): void { inputFocused = false; goToPage(pageInput.value) }

function zoomIn(): void { if (zoom.value < ZOOM_MAX) { zoom.value = Math.min(ZOOM_MAX, zoom.value + ZOOM_STEP); void renderAll() } }
function zoomOut(): void { if (zoom.value > ZOOM_MIN) { zoom.value = Math.max(ZOOM_MIN, zoom.value - ZOOM_STEP); void renderAll() } }

onBeforeUnmount(() => {
  disposed = true
  cancelTasks()
  // loadingTask.destroy() destroys both document and worker; frees resources.
  if (loadingTask) { void loadingTask.destroy(); loadingTask = null; pdfDoc = null }
})
</script>

<template>
  <ViewerShell :title="props.item.name" downloadable @close="emit('close')" @download="emit('download', props.item)">
    <template #toolbar>
      <div v-if="state === 'ready'" class="pdf-tools">
        <button type="button" class="pdf-btn" :disabled="zoom <= ZOOM_MIN" @click="zoomOut">−</button>
        <span class="pdf-zoom">{{ Math.round(zoom * 100) }}%</span>
        <button type="button" class="pdf-btn" :disabled="zoom >= ZOOM_MAX" @click="zoomIn">＋</button>
        <span v-if="total" class="pdf-pager">
          <input
            class="pdf-page-input"
            type="number"
            min="1"
            :max="total"
            v-model.number="pageInput"
            @focus="onInputFocus"
            @blur="onInputBlur"
            @keyup.enter="goToPage(pageInput)"
          />
          <span class="pdf-page-sep">/ {{ total }}</span>
        </span>
      </div>
    </template>
    <div class="office-body">
      <div v-if="state === 'loading'" class="viewer-status">{{ t(isConvert ? 'filesViewerConverting' : 'filesViewerLoading') }}</div>
      <div v-else-if="state === 'error'" class="viewer-status">
        <p>{{ t('filesViewerError') }}</p>
        <p v-if="errorDetail" class="detail">{{ errorDetail }}</p>
        <button type="button" class="chip" @click="emit('download', props.item)">{{ t('filesViewerDownloadInstead') }}</button>
      </div>
      <div v-show="state === 'ready'" ref="pagesEl" class="pdf-scroll" @scroll="onScroll"></div>
    </div>
  </ViewerShell>
</template>

<style scoped>
.pdf-scroll {
  position: relative;
  width: 100%; height: 100%; overflow: auto;
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  padding: 16px; background: var(--app-bg);
}
.pdf-scroll :deep(.pdf-page-canvas) {
  max-width: 100%; height: auto;
  box-shadow: var(--card-shadow-hi); background: #fff; /* theme-exception: PDF canvas always white for document readability regardless of theme */
}
.pdf-tools { display: flex; align-items: center; gap: 10px; }
.pdf-btn {
  width: 30px; height: 30px; border: none; border-radius: 50%; cursor: pointer;
  background: var(--tool-bg); color: var(--fg, #fff); font-size: 17px; line-height: 1;
}
.pdf-btn:disabled { opacity: 0.35; cursor: default; }
.pdf-btn:not(:disabled):hover { background: var(--tool-bg-hi); }
.pdf-zoom { font-size: 13px; min-width: 48px; text-align: center; font-variant-numeric: tabular-nums; }
.pdf-pager { display: flex; align-items: center; gap: 6px; margin-left: 4px; }
.pdf-page-input {
  width: 46px; height: 26px; text-align: center; border-radius: 6px;
  border: 1px solid var(--inner-border); background: var(--inner-bg);
  color: var(--fg, #fff); font-size: 13px; font-variant-numeric: tabular-nums;
}
.pdf-page-sep { font-size: 13px; opacity: 0.75; }
</style>
