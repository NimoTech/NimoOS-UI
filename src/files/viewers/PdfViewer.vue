<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import * as pdfjsLib from 'pdfjs-dist'
// Vite:?url 拿到 worker 资源地址,交给 pdfjs 的 GlobalWorkerOptions。
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
const zoom = ref(1)                        // 相对「适应宽度」的倍数
const currentPage = ref(1)                 // 随滚动更新的当前页
const pageInput = ref(1)                   // 页码输入框(手动跳页)
const pagesEl = ref<HTMLElement | null>(null)   // 竖排所有页 canvas 的滚动容器

// 异步加载/渲染期间可能已被卸载(用户快速关闭)——卸载后放弃后续操作,销毁文档。
let disposed = false
let inputFocused = false
let loadingTask: PDFDocumentLoadingTask | null = null
let pdfDoc: PDFDocumentProxy | null = null
let renderTasks: RenderTask[] = []
let pageCanvases: HTMLCanvasElement[] = []
// 渲染代次:缩放会重渲全部页,旧的一轮在每个 await 后自行退出,避免两轮并发写同一批 canvas。
let renderGen = 0

function isCancelled(e: unknown): boolean {
  return e instanceof Error && e.name === 'RenderingCancelledException'
}
function cancelTasks(): void {
  for (const tk of renderTasks) { try { tk.cancel() } catch { /* 已结束 */ } }
  renderTasks = []
}

onMounted(async () => {
  try {
    // 原生 .pdf → 直接取;旧版 Office → 后端 LibreOffice 转 PDF 后取(getPreviewBytes)。
    const buf = isConvert
      ? await service.file.getPreviewBytes(props.item.path)
      : await service.file.getBytes(props.item.path)
    if (disposed) return
    // cMapUrl/standardFontDataUrl 指向构建时拷入的 pdfjs 资源(base=/app/),
    // 保证 CJK 等非拉丁编码 + 未嵌入字体的 PDF 不显方框/乱码。
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
    await nextTick()                                           // 等滚动容器挂载(v-show ready 后)
    await renderAll()
  } catch {
    if (disposed) return
    errorDetail.value = isConvert
      ? '文档转换失败或超时,建议下载后用本地软件打开'
      : 'PDF 加载失败,文件可能已损坏或加密'
    state.value = 'error'
  }
})

// 竖排渲染全部页;缩放变化时整体重渲(re-render 比 CSS 缩放清晰)。
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
      if (isCancelled(e)) return              // 被新一轮缩放/卸载取消 → 预期
      if (disposed || gen !== renderGen) return
      errorDetail.value = 'PDF 渲染失败,文件可能损坏'
      state.value = 'error'
      return
    }
  }
}

// 随滚动更新当前页(取滚动位置略下方所落的页)。输入框聚焦时不覆盖用户输入。
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
  // loadingTask.destroy() 会同时销毁文档与 worker;释放资源。
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
  padding: 16px; background: rgba(0, 0, 0, 0.25);
}
.pdf-scroll :deep(.pdf-page-canvas) {
  max-width: 100%; height: auto;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.4); background: #fff;
}
.pdf-tools { display: flex; align-items: center; gap: 10px; }
.pdf-btn {
  width: 30px; height: 30px; border: none; border-radius: 50%; cursor: pointer;
  background: rgba(255, 255, 255, 0.14); color: var(--fg, #fff); font-size: 17px; line-height: 1;
}
.pdf-btn:disabled { opacity: 0.35; cursor: default; }
.pdf-btn:not(:disabled):hover { background: rgba(255, 255, 255, 0.26); }
.pdf-zoom { font-size: 13px; min-width: 48px; text-align: center; font-variant-numeric: tabular-nums; }
.pdf-pager { display: flex; align-items: center; gap: 6px; margin-left: 4px; }
.pdf-page-input {
  width: 46px; height: 26px; text-align: center; border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.1);
  color: var(--fg, #fff); font-size: 13px; font-variant-numeric: tabular-nums;
}
.pdf-page-sep { font-size: 13px; opacity: 0.75; }
</style>
