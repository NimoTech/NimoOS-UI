<script setup lang="ts">
// Ported (Options API -> <script setup> Composition API, logic unchanged unless
// noted) from Vue2 NimoOS-UI src/views/Photos/PhotosGrid.vue (348 lines).
// See .superpowers/sdd/task-7-brief.md for the full port-delta checklist:
//  1. thumbnailSrc/hoverVideoSrc go through `service.photos.thumbnailUrl/previewUrl`
//     (shared package), never hand-built `/v1/...` strings.
//  2. Hover sprite: `service.photos.spriteMeta(id)` resolves `{ frames, durationMs,
//     frameW, frameH }` directly (no Vue2 loadSpriteMeta {ok,stale,url} envelope) —
//     this component owns the hoverToken staleness guard itself: capture the token
//     before the await, compare after, discard without writing state if stale.
//     Network errors close the preview. `spriteUrl` for the overlay/strip comes
//     from `service.photos.spriteUrl(id)`. 300ms enter-debounce, rAF-throttled
//     mousemove, 600ms-idle -> 400ms/frame auto-advance, leave/unmount bump the
//     token — all copied verbatim.
//  3. P1 scope cut: selectbar renders ONLY delete + cancel (favorite/add-to-album/
//     ask-nimo return in P3/P4/SP8). No FilterBar, no upload empty-state button,
//     no search-mode empty state (Vuex `isSearchMode` dependency dropped).
//  4. i18n: `$t('English source')` -> `t('photosXxx')` (Task 4 key table).
//  5. Styling rebuilt on New-UI tokens; fixed video-chrome colors (badge bg/fg)
//     carry `theme-exception` comments, same precedent as MediaViewer/ViewerShell.
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { Month, Photo } from '../util/assetToPhoto'
import { computeFrameFromX } from '../util/hoverScrub'
import { matchesTab } from '../util/tabFilter'
import VideoHoverPreview from './VideoHoverPreview.vue'

const props = withDefaults(defineProps<{
  months: Month[]
  tab?: string
  density?: string
  selected?: Array<string | number>
}>(), {
  tab: 'all',
  density: 'comfortable',
  selected: () => [],
})

const emit = defineEmits<{
  (e: 'open', photo: Photo, list: undefined, startMs: number): void
  (e: 'toggle-select', id: string | number): void
}>()

const { t } = useI18n()

// ─── DOM refs ────────────────────────────────────────────────────────────
const wrapRef = ref<HTMLElement | null>(null)
const scrubberRef = ref<HTMLElement | null>(null)
const tickRefs = ref<Array<HTMLElement | null>>([])
function setTickRef(el: Element | null, i: number) { tickRefs.value[i] = el as HTMLElement | null }
// `ref="hoverPreviewRef"` sits inside v-for (ref_for) so at runtime Vue
// collects it as an ARRAY of instances, not a single instance — the type
// must admit that shape or callers reading .value would be lying to
// themselves. Normalized in onTileClick exactly like Vue2 did:
// `[].concat(this.$refs.hoverPreview || [])[0]` (NimoOS-UI/src/views/Photos/PhotosGrid.vue:263).
const hoverPreviewRef = ref<InstanceType<typeof VideoHoverPreview> | InstanceType<typeof VideoHoverPreview>[] | null>(null)

// ─── month scrubber ──────────────────────────────────────────────────────
const activeMonth = ref('')
const TICK_STEP = 55
const TICK_PAD = 12

const filteredMonths = computed(() => (props.months || []).map(m => ({
  ...m,
  filtered: m.photos.filter(p => matchesTab(p, props.tab)),
})))

const selecting = computed(() => props.selected.length > 0)

const scrubberTicks = computed(() => {
  const ticks: Array<{ label: string; major: boolean; key: string }> = []
  const seenYears = new Set<string>()
  ;(props.months || []).forEach(m => {
    // Skip groups without a YYYY-MM key (synthetic single groups), which have
    // no month tick and must not crash the split below.
    if (!m.key || m.key === 'unknown' || m.key === 'search' || !m.key.includes('-')) return
    const [year, mo] = m.key.split('-')
    if (!seenYears.has(year)) {
      seenYears.add(year)
      ticks.push({ label: year, major: true, key: `y-${year}` })
    }
    const abbr = new Date(+year, +mo - 1).toLocaleString('en', { month: 'short' })
    ticks.push({ label: abbr, major: false, key: m.key })
  })
  return ticks
})

const activeIdx = computed(() => scrubberTicks.value.findIndex(tk => tk.key === activeMonth.value))
const scrubberInnerHeight = computed(() => `${scrubberTicks.value.length * TICK_STEP + TICK_PAD * 2}px`)

function tickTop(i: number): string { return `${TICK_PAD + (i + 0.5) * TICK_STEP}px` }

function ensureActiveVisible() {
  const el = scrubberRef.value
  if (!el || activeIdx.value < 0) return
  const tick = tickRefs.value[activeIdx.value]
  if (!tick) return
  const top = tick.offsetTop
  const view = el.clientHeight
  const cur = el.scrollTop
  // jsdom (test env) doesn't implement Element.scrollTo — guard so tests that
  // exercise this path don't spam unhandled-rejection noise; real browsers always have it.
  if (typeof el.scrollTo !== 'function') return
  if (top < cur + 24) el.scrollTo({ top: Math.max(0, top - 24), behavior: 'smooth' })
  else if (top > cur + view - 24) el.scrollTo({ top: top - view + 24, behavior: 'smooth' })
}
watch(activeIdx, () => { void nextTick().then(ensureActiveVisible) })

function jumpTo(key: string) {
  const el = document.getElementById(`m-${key}`)
  if (el && wrapRef.value && typeof wrapRef.value.scrollTo === 'function') {
    wrapRef.value.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
  }
}

function onScroll() {
  const wrap = wrapRef.value
  if (!wrap) return
  const heads = wrap.querySelectorAll('.month-head')
  const wrapTop = wrap.getBoundingClientRect().top
  let active = activeMonth.value
  heads.forEach(h => {
    const top = h.getBoundingClientRect().top - wrapTop
    if (top <= 60) active = (h.parentElement?.id || '').replace('m-', '')
  })
  activeMonth.value = active
}

// ─── selection ───────────────────────────────────────────────────────────
function isSelected(id: string | number): boolean { return props.selected.includes(id) }
function toggleSelect(id: string | number) { emit('toggle-select', id) }

function onTileClick(p: Photo) {
  if (selecting.value) { toggleSelect(p.id); return }
  let startMs = 0
  if (p.isVideo && hoveredVideo.value === p && previewVisible.value) {
    // ref_for -> array at runtime; normalize like Vue2's
    // `[].concat(this.$refs.hoverPreview || [])[0]`.
    const raw = hoverPreviewRef.value
    const inst = Array.isArray(raw) ? raw[0] : raw
    if (inst) startMs = Math.floor(inst.currentPreviewTimeMs())
  }
  emit('open', p, undefined, startMs)
}

function thumbnailSrc(id: string | number): string { return service.photos.thumbnailUrl(id, 'small') }
function onThumbError(e: Event) { (e.target as HTMLElement).style.visibility = 'hidden' }

// ─── video hover preview ─────────────────────────────────────────────────
const hoveredVideo = ref<Photo | null>(null)
const previewVisible = ref(false)
const currentFrame = ref(0)
const spriteUrl = ref('')
const spriteFrameCount = ref(10)
const spriteFrameW = ref(240)
const spriteFrameH = ref(135)
const spriteDurationMs = ref(0)
const scrubRatio = ref(-1)

let hoverTimer: ReturnType<typeof setTimeout> | undefined
let hoverToken = 0 // monotonically increasing; used to discard stale in-flight sprite requests
let tileRect: DOMRect | null = null
let autoTimer: ReturnType<typeof setInterval> | undefined
let lastMoveAt = 0
let moveRaf = 0
let pendingX = 0

const hoverVideoSrc = computed(() => hoveredVideo.value ? service.photos.previewUrl(hoveredVideo.value.id) : '')

function startAutoAdvance() {
  stopAutoAdvance()
  if (spriteFrameCount.value <= 1) return
  autoTimer = setInterval(() => {
    if (Date.now() - lastMoveAt < 600) return // user is scrubbing, yield
    currentFrame.value = (currentFrame.value + 1) % spriteFrameCount.value
  }, 400)
}
function stopAutoAdvance() {
  clearInterval(autoTimer)
  autoTimer = undefined
}

function onVideoEnter(p: Photo, e: MouseEvent) {
  clearTimeout(hoverTimer)
  stopAutoAdvance() // avoid a leftover interval when rapidly switching tiles
  const target = e.currentTarget as HTMLElement
  const token = ++hoverToken // this hover session's token
  hoverTimer = setTimeout(async () => {
    if (token !== hoverToken) return // already left/switched during the debounce
    tileRect = target.getBoundingClientRect() // only used for mouse-X -> frame math
    hoveredVideo.value = p
    currentFrame.value = 0
    scrubRatio.value = -1
    spriteDurationMs.value = p.durationMs || 0 // placeholder from the tile's known duration
    previewVisible.value = true
    try {
      const meta = await service.photos.spriteMeta(p.id)
      if (token !== hoverToken) return // ★ slow reply arrived after the user left -> discard, never write shared state
      spriteFrameCount.value = meta.frames
      spriteFrameW.value = meta.frameW
      spriteFrameH.value = meta.frameH
      if (meta.durationMs > 0) spriteDurationMs.value = meta.durationMs // follow the playhead's time text
      spriteUrl.value = service.photos.spriteUrl(p.id) // overlay background / strip hit
      startAutoAdvance()
    } catch {
      if (token !== hoverToken) return
      previewVisible.value = false
      hoveredVideo.value = null
    }
  }, 300) // 300ms debounce so a quick sweep across the grid doesn't hit /sprite per tile
}

function onVideoMove(e: MouseEvent) {
  lastMoveAt = Date.now() // semantics unchanged: auto-advance yield check must be immediate, not rAF-delayed
  if (!tileRect || !hoveredVideo.value) return
  pendingX = e.clientX
  if (moveRaf) return // already queued this animation frame, coalesce into the next one
  moveRaf = requestAnimationFrame(() => {
    moveRaf = 0
    if (!tileRect || !hoveredVideo.value) return // left/switched before the rAF fired
    currentFrame.value = computeFrameFromX(pendingX, tileRect.left, tileRect.width, spriteFrameCount.value)
    const w = tileRect.width
    scrubRatio.value = w > 0 ? Math.min(Math.max((pendingX - tileRect.left) / w, 0), 1) : 0
  })
}

function onVideoLeave() {
  clearTimeout(hoverTimer)
  stopAutoAdvance()
  hoverToken++ // ★ invalidate any in-flight request
  cancelAnimationFrame(moveRaf)
  moveRaf = 0
  previewVisible.value = false
  hoveredVideo.value = null
  spriteUrl.value = ''
}

onMounted(() => {
  const first = filteredMonths.value.find(m => (m.filtered || []).length > 0)
  if (first) activeMonth.value = first.key
  onScroll()
})
onBeforeUnmount(() => {
  stopAutoAdvance()
  clearTimeout(hoverTimer)
  hoverToken++ // invalidate any in-flight sprite request so it can't set state after unmount
  cancelAnimationFrame(moveRaf)
  moveRaf = 0
})
</script>

<template>
  <div class="photos-grid-root">
    <div ref="wrapRef" class="photos-wrap scroll" @scroll="onScroll">
      <div v-if="filteredMonths.every(m => m.filtered.length === 0)" class="empty-state" data-test="empty-state">
        <div class="empty-state-title">{{ t('photosNoPhotos') }}</div>
        <div class="empty-state-desc">{{ t('photosNoPhotosHint') }}</div>
      </div>

      <template v-else>
        <!-- v-for + v-if on the SAME element would break in Vue3 (v-if now
             evaluates before v-for's scope var exists) — wrap with <template>
             so `m` stays in scope, matching Vue2's per-item v-if filtering. -->
        <template v-for="m in filteredMonths" :key="m.key">
          <div v-if="m.filtered.length > 0" :id="'m-' + m.key" class="month-group">
            <div class="month-head">
              <div class="month-title">{{ m.key === 'unknown' ? t('photosUnknownDate') : m.title }}</div>
              <div class="month-count">{{ t('photosItemsCount', { count: m.filtered.length }) }}</div>
            </div>
            <div class="grid" :data-density="density">
              <div
                v-for="p in m.filtered" :key="p.id"
                class="tile"
                :data-selected="isSelected(p.id)"
                @click="onTileClick(p)"
                @mouseenter="p.isVideo && onVideoEnter(p, $event)"
                @mousemove="p.isVideo && onVideoMove($event)"
                @mouseleave="p.isVideo && onVideoLeave()"
              >
                <img :src="thumbnailSrc(p.id)" alt="" loading="lazy" @error="onThumbError">
                <VideoHoverPreview
                  v-if="p.isVideo && hoveredVideo != null && hoveredVideo.id === p.id"
                  ref="hoverPreviewRef"
                  :visible="previewVisible"
                  :sprite-url="spriteUrl"
                  :frame-count="spriteFrameCount"
                  :frame-w="spriteFrameW"
                  :frame-h="spriteFrameH"
                  :current-frame="currentFrame"
                  :duration-ms="spriteDurationMs"
                  :video-src="hoverVideoSrc"
                  :scrub-ratio="scrubRatio"
                />
                <span class="tile-check">
                  <input
                    type="checkbox"
                    class="tile-check-box"
                    :checked="isSelected(p.id)"
                    @click.stop
                    @change="toggleSelect(p.id)"
                  />
                </span>
                <div v-if="p.isVideo" class="tile-vid">
                  <span class="vid-play">▶</span> {{ p.duration }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>

      <div style="height:80px"></div>
    </div>

    <div v-if="filteredMonths.some(m => m.filtered.length > 0)" ref="scrubberRef" class="scrubber">
      <div class="scrubber-inner" :style="{ height: scrubberInnerHeight }">
        <div
          v-for="(tk, i) in scrubberTicks" :key="tk.key"
          class="scrubber-tick" :ref="(el) => setTickRef(el as Element | null, i)"
          :data-major="tk.major" :data-active="tk.key === activeMonth"
          :style="{ top: tickTop(i), cursor: tk.major ? 'default' : 'pointer' }"
          @click="!tk.major && jumpTo(tk.key)"
        >{{ tk.label }}</div>
        <div v-if="activeIdx >= 0" class="scrubber-thumb" :style="{ top: tickTop(activeIdx) }">
          {{ scrubberTicks[activeIdx].label.slice(0, 3) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.photos-grid-root { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; }
.photos-wrap { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding-right: 68px; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 80px 20px; color: var(--fg-muted); text-align: center; }
.empty-state-title { font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-state-desc { font-size: 13px; }

.month-group { margin-bottom: 22px; }
.month-head { display: flex; align-items: baseline; gap: 8px; padding: 4px 2px 10px; }
.month-title { font-size: 15px; font-weight: 600; color: var(--fg); }
.month-count { margin-left: auto; font-size: 12px; color: var(--fg-muted); }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 4px; }
.grid[data-density="compact"] { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 2px; }
.grid[data-density="loose"] { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }

.tile { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: 8px; background: var(--chip-bg); cursor: pointer; }
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tile[data-selected="true"] { outline: 3px solid var(--accent); outline-offset: -3px; }

.tile-check { position: absolute; top: 6px; left: 6px; z-index: 2; }
.tile-check-box { opacity: 0; cursor: pointer; }
.tile:hover .tile-check-box, .tile[data-selected="true"] .tile-check-box { opacity: 1; }

.tile-vid {
  position: absolute; right: 6px; bottom: 6px; z-index: 2;
  display: flex; align-items: center; gap: 3px;
  padding: 1px 6px; border-radius: 999px; font-size: 10px;
  /* theme-exception: chrome badge fixed on top of the video thumbnail, needs
     constant contrast regardless of skin (same precedent as MediaViewer.vue /
     VideoHoverPreview.vue's .time/.bar chrome). */
  background: rgba(0, 0, 0, 0.55); color: #fff;
}
.vid-play { font-size: 8px; }

.scrubber {
  position: absolute; top: 0; right: 0; bottom: 0; width: 56px;
  overflow-y: auto; scrollbar-width: none;
}
.scrubber::-webkit-scrollbar { display: none; }
.scrubber-inner { position: relative; }
.scrubber-tick {
  position: absolute; right: 6px; transform: translateY(-50%);
  font-size: 10px; color: var(--fg-muted); white-space: nowrap;
}
.scrubber-tick[data-major="true"] { font-weight: 700; color: var(--fg); font-size: 11px; }
.scrubber-tick[data-active="true"] { color: var(--accent); }
.scrubber-thumb {
  position: absolute; right: 6px; transform: translateY(-50%);
  padding: 2px 7px; border-radius: 999px; font-size: 10px; font-weight: 600;
  background: var(--accent); color: var(--on-accent);
}
</style>
