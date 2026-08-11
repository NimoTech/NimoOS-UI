<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import type { FileEntry } from '../stores/files'
import { columnsFor, chunkRows, computeVisibleRange } from '../util/gridVirtual'
import { rectsFromGeometry } from '../util/gridGeometry'
import type { ItemRect } from '../util/marquee'
import FileTile from './FileTile.vue'

const props = defineProps<{ entries: FileEntry[]; selectedPaths?: Set<string> }>()
const emit = defineEmits<{
  (e: 'open', entry: FileEntry): void
  (e: 'select', payload: { entry: FileEntry; mode: 'toggle' | 'range' }): void
  (e: 'contextmenu', payload: { entry: FileEntry; event: MouseEvent }): void
  (e: 'open-batch', batchId: string, entryPath: string): void
}>()

// Must stay in lockstep with the .file-grid CSS at the bottom of this file.
const MIN_COL = 120
const GAP = 14
const BUFFER_ROWS = 3
// Used until a real row has been rendered and measured: one tile (14px padding
// + 64px icon + 6px gap + ~18px label + 14px padding) plus GAP.
const FALLBACK_ROW_HEIGHT = 130

const root = ref<HTMLElement | null>(null)
const rowsWrap = ref<HTMLElement | null>(null)
const containerWidth = ref(0)
const rowHeight = ref(FALLBACK_ROW_HEIGHT)
const scrollTop = ref(0)
const viewportHeight = ref(0)

const cols = computed(() => columnsFor(containerWidth.value, MIN_COL, GAP))
const colWidth = computed(() =>
  containerWidth.value > 0 ? (containerWidth.value - GAP * (cols.value - 1)) / cols.value : MIN_COL,
)
const rows = computed(() => chunkRows(props.entries, cols.value))
const range = computed(() =>
  computeVisibleRange({
    scrollTop: scrollTop.value,
    viewportHeight: viewportHeight.value,
    rowHeight: rowHeight.value,
    rowCount: rows.value.length,
    buffer: BUFFER_ROWS,
  }),
)
const visibleRows = computed(() => rows.value.slice(range.value.start, range.value.end))
const padTop = computed(() => range.value.start * rowHeight.value)
const padBottom = computed(() => Math.max(0, (rows.value.length - range.value.end) * rowHeight.value))

// The nearest scrollable ancestor -- Files.vue's .files-listwrap in practice
// (it took over scrolling from AreaShell's .area-body once .files-layout was
// height-capped), but resolved rather than hard-coded so a different host
// still works.
function findScrollParent(el: HTMLElement | null): HTMLElement | Window {
  let node = el?.parentElement ?? null
  while (node) {
    const overflow = getComputedStyle(node).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return node
    node = node.parentElement
  }
  return window
}
let scroller: HTMLElement | Window = window
let rafId = 0

function readScroll() {
  const el = root.value
  if (!el) return
  const isWindow = scroller === window
  const gridTop = el.getBoundingClientRect().top
  const viewTop = isWindow ? 0 : (scroller as HTMLElement).getBoundingClientRect().top
  const viewH = isWindow ? window.innerHeight : (scroller as HTMLElement).clientHeight
  // How far the grid's top has travelled above the scroll viewport's top.
  scrollTop.value = Math.max(0, viewTop - gridTop)
  viewportHeight.value = viewH
}

function onScroll() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    readScroll()
  })
}

function measure() {
  const el = root.value
  if (!el) return
  containerWidth.value = el.clientWidth
  const firstRow = rowsWrap.value?.firstElementChild as HTMLElement | null
  if (firstRow && firstRow.offsetHeight > 0) rowHeight.value = firstRow.offsetHeight + GAP
  readScroll()
}

let ro: ResizeObserver | null = null

onMounted(async () => {
  scroller = findScrollParent(root.value)
  measure()
  // The first row only exists after a render, and its height is what every
  // later calculation is based on -- measure again once it is there.
  await nextTick()
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => measure())
    if (root.value) ro.observe(root.value)
  }
  scroller.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', measure)
})

onUnmounted(() => {
  ro?.disconnect()
  scroller.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', measure)
  if (rafId) cancelAnimationFrame(rafId)
})

// Re-measure when the listing changes: navigating into an empty folder and back
// leaves rowsWrap without a first row to measure until now.
watch(
  () => props.entries.length,
  async () => {
    await nextTick()
    measure()
  },
)

// Every entry gets a rect, not just the rendered ones -- see gridGeometry.ts.
function itemRects(): ItemRect[] {
  const el = root.value
  const box = el ? el.getBoundingClientRect() : { left: 0, top: 0 }
  return rectsFromGeometry({
    paths: props.entries.map((e) => e.path),
    cols: cols.value,
    colWidth: colWidth.value,
    rowHeight: rowHeight.value,
    gap: GAP,
    originLeft: box.left,
    originTop: box.top,
  })
}

// Scrolling to an off-screen item cannot go through scrollIntoView: there is no
// element to scroll to. Compute the row offset instead.
function scrollToPath(path: string): void {
  const i = props.entries.findIndex((e) => e.path === path)
  const el = root.value
  if (i < 0 || !el) return
  const row = Math.floor(i / cols.value)
  if (scroller === window) {
    const target = el.getBoundingClientRect().top + window.scrollY + row * rowHeight.value
    window.scrollTo({ top: Math.max(0, target - window.innerHeight / 2) })
    return
  }
  const s = scroller as HTMLElement
  s.scrollTop = Math.max(0, s.scrollTop + (row * rowHeight.value - scrollTop.value) - s.clientHeight / 2)
}

defineExpose({ itemRects, scrollToPath })
</script>

<template>
  <div ref="root" class="file-grid-root">
    <div class="grid-spacer-top" :style="{ height: padTop + 'px' }"></div>
    <div ref="rowsWrap">
      <!-- Keyed by path, NOT by row index: Vue's keyed diff then destroys and
           recreates cards rather than recycling instances across different
           entries, so the thumbnail cross-talk the Vue2 virtualization had to
           guard against cannot arise here. -->
      <div v-for="(row, ri) in visibleRows" :key="range.start + ri" class="file-grid">
        <FileTile
          v-for="entry in row"
          :key="entry.path"
          :entry="entry"
          :selected="props.selectedPaths?.has(entry.path)"
          @open="emit('open', $event)"
          @select="emit('select', $event)"
          @contextmenu="emit('contextmenu', $event)"
          @open-batch="(id: string, p: string) => emit('open-batch', id, p)"
        />
      </div>
    </div>
    <div class="grid-spacer-bottom" :style="{ height: padBottom + 'px' }"></div>
  </div>
</template>

<style scoped>
/* Column geometry is duplicated in gridVirtual's MIN_COL/GAP constants above --
   keep both sides in step if either changes. */
.file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 14px; margin-bottom: 14px; }
.file-grid:last-child { margin-bottom: 0; }
</style>
