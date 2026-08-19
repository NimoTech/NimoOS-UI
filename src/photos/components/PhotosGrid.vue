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
//  3. P1 scope cut: selectbar rendered ONLY delete + cancel at the time (favorite/
//     add-to-album/ask-nimo deferred to P3/P4/SP8). Update: add-to-album shipped in
//     P4 (Task 9, PhotosSelectionToolbar.vue) — Ask Nimo still deferred to SP8.
//     No FilterBar, no upload empty-state button, no search-mode empty state
//     (Vuex `isSearchMode` dependency dropped).
//  4. i18n: `$t('English source')` -> `t('photosXxx')` (Task 4 key table).
//  5. (superseded by #6 below) Styling was originally rebuilt on New-UI's own tokens,
//     with the per-tile checkbox restyled as a native `.tile-check`/`.tile-check-box`
//     <input> (Files-region pattern) and the favorite star as a single always-shown
//     top-right toggle button.
//  6. Task 6 (grid rewrite): re-skinned wholesale to Vue2 pixel/DOM parity, superseding #5 —
//     column/tile/scrubber/month-head CSS now comes ONLY from
//     src/photos/styles/vue2-parity/photos.scss (ported verbatim from NimoOS-UI's
//     photos.scss; this component's own style block shrinks to the handful of rules
//     that stylesheet cannot cover — see that style block's own header comment). The
//     checkbox is back to Vue2's `.tile-checkbox` div (click-to-toggle, no native
//     <input>), and the favorite star splits into Vue2's two elements: a decorative
//     bottom-left `.tile-fav` (shown only when favorited AND not selecting, no click
//     handler) and an always-present, hover-only top-right `.tile-act` inside
//     `.tile-actions` (the actual click target). `columnsFor`/`estimateSectionBodyHeight`
//     (src/photos/util/gridMetrics.ts) were rewritten to match: density is now a fixed
//     column-count lookup (10/7/4), not a container-width-derived auto-fill/minmax count.
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import type { Month, Photo } from '../util/assetToPhoto'
import { computeFrameFromX } from '../util/hoverScrub'
import { matchesTab } from '../util/tabFilter'
import { tabCountOf } from '../util/timelineBuckets'
import {
  columnsFor, estimateSectionBodyHeight, tabHasDirectoryEstimate,
} from '../util/gridMetrics'
import { usePhotosFavorites } from '../stores/favorites'
import VideoHoverPreview from './VideoHoverPreview.vue'
import PhotosIcon from './PhotosIcon.vue'

// P6b-T9 (deviation log 14): the Places photo view (D10 minimal cross-store surface, browse-only,
// no multi-select/batch ops) is the 3rd consumer, but it doesn't need the checkbox — the previous two
// consumers (Photos.vue/PhotosFavorites.vue) both need selection state, so the hardcoded `.tile-checkbox`
// render never had a "don't want it" case before. Add a `selectable` (default true) gate; the default
// guarantees zero behavior change for the existing two consumers, so their call sites don't need updating one by one.
// Acceptance Fix-1 (owner finding, Plans G+H): the Favorites view is the 4th consumer, and
// unlike the previous three it has no right-edge timeline scrubber at all in Vue2 --
// Vue2 PhotosFavoritesView.vue builds its own bespoke `.lib-*` grid markup, never mounting
// this shared component in the first place, so there is no Vue2 scrubber to port for it.
// A `showScrubber` (default true) gate keeps the other three consumers (Photos.vue,
// PhotosPlaceAssets.vue) byte-identical while letting Favorites opt out.
const props = withDefaults(defineProps<{
  months: Month[]
  tab?: string
  density?: string
  selected?: Array<string | number>
  selectable?: boolean
  showScrubber?: boolean
}>(), {
  tab: 'all',
  density: 'comfortable',
  selected: () => [],
  selectable: true,
  showScrubber: true,
})

const emit = defineEmits<{
  (e: 'open', photo: Photo, list: undefined, startMs: number): void
  (e: 'toggle-select', id: string | number): void
  // Bucket mode: the grid knows which months are on screen, the parent owns the
  // store. Emitting keeps this component usable by the two consumers that have
  // no buckets at all (favorites, place assets).
  (e: 'need-bucket', key: string): void
}>()

const { t } = useI18n()

// Favorites is global cross-cutting state (unlike the view-level emit split for open/toggle-select) —
// the grid consumes the store directly, no new emit. Star visibility/is-fav checks always go through
// fav.isFav(id) value comparison, never object identity (P1 iron rule: the timeline's silent refresh
// rebuilds the Photo object on the same keyed node, so identity comparison would misfire).
const fav = usePhotosFavorites()

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

// Task 6: the column COUNT is now a fixed lookup per density (gridMetrics.ts's
// columnsFor) — container width no longer decides how many columns there are. It
// still decides how WIDE each of those fixed columns is (tileEdge), which is what
// an unloaded month's estimated row height is built from, so this measurement
// stays. Read from the scroll wrap; measured at mount, and re-measured whenever
// the month set changes (see the windowing watch below) — there is no resize
// listener, so a bare window resize with the same set of months does not re-measure.
const wrapWidth = ref(0)
function measureWrap() { wrapWidth.value = wrapRef.value?.clientWidth ?? 0 }

// Bucket-backed months carry real directory counts (count/videoCount/ocrCount)
// — tabCountOf derives the current tab's expected size from them, matching
// matchesTab()'s photo/video/ocr split exactly (tabFilter.ts). This is what
// fixes the "ghost month" bug: a month whose assets are all documents used to
// estimate `count - videoCount` on the photo tab (a lie once OCR is factored
// in) and render a section that always showed 0 real items.
function skeletonCountOf(m: Month & { filtered: Photo[] }): number {
  if (m.count != null) {
    return tabCountOf({ count: m.count, videoCount: m.videoCount ?? 0, ocrCount: m.ocrCount ?? 0 }, props.tab)
  }
  // Synthetic groups (favorites, place assets) and legacy timeline groups carry
  // no directory counts and are always already in hand — their real length is
  // the honest estimate, and using 0 would collapse their placeholder.
  return m.loaded === false ? 0 : Math.max(0, m.filtered.length)
}
// Is the directory's count meaningful for the current tab? On a tab it cannot
// size (OCR) an unloaded month's count would print as 0 items, which is a guess
// dressed up as a fact — the head shows the title alone until the month loads.
function showCount(m: Month & { filtered: Photo[] }): boolean {
  return isLoaded(m) || tabHasDirectoryEstimate(props.tab)
}
// A month is worth a container if it has tiles to show OR a non-zero estimate to
// stand in for. Without the second half, bucket mode's first paint would fall
// through to the empty state and no anchor would exist to scroll to.
function hasContent(m: Month & { filtered: Photo[] }): boolean {
  if (m.filtered.length > 0 || skeletonCountOf(m) > 0) return true
  // Whole-branch review fix (Important 6): on a tab the directory cannot size,
  // an unloaded month scores 0 — and dropping its container made the tab a dead
  // end, because the container is the only thing the observer can watch, so
  // `need-bucket` was never emitted and the tab claimed the library had no
  // documents forever. Keep the container: the month loads, and then drops out
  // again by the first clause above if it really has nothing for this tab.
  return m.loaded === false && !tabHasDirectoryEstimate(props.tab)
}
const anyContent = computed(() => filteredMonths.value.some(hasContent))
function sectionBodyHeight(m: Month & { filtered: Photo[] }): number {
  const itemCount = skeletonCountOf(m)
  if (itemCount > 0) {
    return estimateSectionBodyHeight(itemCount, wrapWidth.value, props.density)
  }
  // Unloaded, on a tab with no directory dimension (Important 6). One row of
  // tiles is a deliberate stand-in, not an estimate of anything: it gives the
  // section enough height that only a handful of months sit inside the
  // observer's window at a time, so this tab pages in progressively like every
  // other tab instead of firing a request for the whole directory at once.
  if (m.loaded === false && !tabHasDirectoryEstimate(props.tab)) {
    return estimateSectionBodyHeight(columnsFor(props.density), wrapWidth.value, props.density)
  }
  return 0
}
function isLoaded(m: Month & { filtered: Photo[] }): boolean {
  return m.loaded !== false
}

// ─── month-section windowing ────────────────────────────────────────────
// Far-away months keep their container (anchors and scroll length depend on
// it) but drop their tiles, so the DOM stays a constant size no matter how
// far the user scrolls. Which months count as near is left to the browser:
// rootMargin gives it two viewports of slack in both directions.
const WINDOW_MARGIN = '200% 0px'
const activeKeys = ref<Set<string>>(new Set())
// Measured heights survive a section being torn down, so a placeholder can
// keep the exact height its tiles had — this is what stops the scrollbar
// from jumping. Not reactive: it is only read while rendering a section that
// just changed.
const measuredHeights = new Map<string, number>()
let observer: IntersectionObserver | null = null
const windowingActive = ref(false)

function keyOf(el: Element): string { return (el.id || '').replace(/^m-/, '') }

function onIntersect(entries: IntersectionObserverEntry[]) {
  // Whole-branch review fix (minor 9): windowing switches on here, on the first
  // notification, not in onMounted. Flipping it at mount meant one painted frame
  // where windowing was on but activeKeys was still empty, so consumers that
  // already hold every photo (favorites, place assets) flashed grey shimmer over
  // photos they could have painted immediately.
  windowingActive.value = true
  const next = new Set(activeKeys.value)
  for (const entry of entries) {
    const key = keyOf(entry.target)
    if (!key) continue
    if (entry.isIntersecting) {
      next.add(key)
    } else {
      // Whole-branch review fix (Important 3): measure the section BODY, never
      // the whole `.month-group`. The group's height includes `.month-head`,
      // while the height is applied to `.month-placeholder`, which is the head's
      // *sibling* — storing the group height made every collapsed section a
      // head taller than it was hydrated, and because a re-sync re-delivers
      // `isIntersecting: false` for sections that are already collapsed, each
      // re-sync added another head on top of the last (a ratchet, i.e. exactly
      // the scrollbar jump the placeholder exists to prevent).
      //
      // The `.grid` lookup is also the "was it hydrated?" guard: the body only
      // exists in the DOM while the tiles are mounted, so an already-collapsed
      // section finds nothing and keeps the height it was measured at.
      const body = (entry.target as HTMLElement).querySelector('.grid') as HTMLElement | null
      const h = body?.offsetHeight ?? 0
      if (h > 0) measuredHeights.set(key, h)
      next.delete(key)
    }
  }
  activeKeys.value = next
}

// Whole-branch review fix (Important 2): asking for a bucket is level-triggered,
// not edge-triggered. "This month is inside the window and still has no assets"
// is a state, and the events that produce it do not always come with an
// intersection boundary being crossed:
//  - a write patches the directory while the month is on screen (a photo is
//    uploaded and indexed, or deleted elsewhere): its cache is invalidated,
//    `loaded` flips back to false and the tiles the user is looking at are
//    replaced by a skeleton — with no boundary crossed, the old enter-only emit
//    never re-requested and the shimmer stayed until the user scrolled two
//    viewports away and back;
//  - a bucket fetch fails while the month is on screen: it never left the
//    window, so there is no "scroll back to it" to retry on.
// Re-emitting is free: the store dedupes per key (_bucketInflight, and
// bucketAssets.has for an already-loaded month).
function requestPendingBuckets() {
  for (const m of filteredMonths.value) {
    // Only bucket-backed months have something to fetch; a synthetic group
    // (favorites, place assets) has loaded === undefined and must never emit.
    if (m.loaded === false && activeKeys.value.has(m.key)) emit('need-bucket', m.key)
  }
}
// `activeKeys` is replaced wholesale on every notification batch (a new Set even
// when the membership is unchanged), so a repeated "still intersecting" or a
// re-sync also re-evaluates the pending set. `props.months` covers the directory
// side: any store write that invalidates a cache produces a new array.
watch([activeKeys, () => props.months], requestPendingBuckets)

function syncObserver() {
  // Drop measured heights for months that no longer exist (directory refresh
  // removed them) — otherwise they'd sit in the map for the component's
  // whole lifetime.
  const currentKeys = new Set(filteredMonths.value.map((m) => m.key))
  for (const key of measuredHeights.keys()) {
    if (!currentKeys.has(key)) measuredHeights.delete(key)
  }
  if (!observer) return
  observer.disconnect()
  // Scan for `.month-group` and match by id string rather than
  // document.getElementById or a CSS id-selector: @vue/test-utils mounts
  // components detached from the live document (getElementById only ever
  // searches the document tree), and month keys like "2026-08" would need
  // escaping to be a valid CSS id-selector token in the first place.
  const root = wrapRef.value
  if (!root) return
  const wanted = new Set(filteredMonths.value.filter(hasContent).map((m) => `m-${m.key}`))
  root.querySelectorAll('.month-group').forEach((el) => {
    if (wanted.has(el.id)) observer!.observe(el)
  })
}

function isWindowed(m: Month & { filtered: Photo[] }): boolean {
  // No IntersectionObserver in the environment (jsdom, or an older browser)
  // -> render everything, exactly the pre-windowing behaviour. Every test in
  // this file that does NOT install FakeIO relies on this fallback.
  if (!windowingActive.value) return true
  return activeKeys.value.has(m.key)
}
function placeholderHeight(m: Month & { filtered: Photo[] }): number | null {
  const h = measuredHeights.get(m.key)
  return h != null && h > 0 ? h : null
}

const selecting = computed(() => props.selected.length > 0)

const scrubberTicks = computed(() => {
  const ticks: Array<{ label: string; major: boolean; key: string; disabled: boolean }> = []
  const seenYears = new Set<string>()
  // Read the same array the template's v-if reads, so a tick's disabled state can
  // never disagree with whether that month actually renders.
  for (const m of filteredMonths.value) {
    // Skip groups without a YYYY-MM key (synthetic single groups), which have
    // no month tick and must not crash the split below.
    if (!m.key || m.key === 'unknown' || m.key === 'search' || !m.key.includes('-')) continue
    const [year, mo] = m.key.split('-')
    if (!seenYears.has(year)) {
      seenYears.add(year)
      // Year ticks are never disabled — they are not click targets to begin with.
      ticks.push({ label: year, major: true, key: `y-${year}`, disabled: false })
    }
    const abbr = new Date(+year, +mo - 1).toLocaleString('en', { month: 'short' })
    ticks.push({ label: abbr, major: false, key: m.key, disabled: !hasContent(m) })
  }
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
  // Compare by stable id, not object identity (P1 iron rule): the timeline's 5s silent refresh
  // rebuilds the Photo object on the same keyed node (without triggering mouseleave), so hoveredVideo
  // still points at the old object while p is already the new one — `=== p` would misfire as
  // "not hovered" → startMs resets to 0 → the lightbox video restarts from the beginning instead of resuming from the hover position.
  if (p.isVideo && hoveredVideo.value?.id === p.id && previewVisible.value) {
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

// Vue2 `:data-previewing="hoveredVideo === p && previewVisible ? 'true' : null"`
// (photos.scss:387-388's `.tile[data-previewing="true"]` hides the bottom gradient
// + duration badge while the hover-scrub preview is showing them instead, same
// as YouTube). Matched by id, not object reference — same P1 rule as every other
// hoveredVideo comparison in this file (see onTileClick's comment): the timeline's
// quiet refresh rebuilds each Photo as a new object with the same id on the same
// keyed node, without firing mouseleave.
function isPreviewing(p: Photo): boolean {
  return p.isVideo === true && hoveredVideo.value != null && hoveredVideo.value.id === p.id && previewVisible.value
}

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

// The set of RENDERED containers changing invalidates both the width measurement
// and which elements the observer is watching.
//
// Whole-branch review fix (Critical 1): this used to watch every month key, but
// which containers exist is decided by `hasContent`, which is tab-dependent
// (skeletonItemCount reads the tab) while the month list is not. So a tab round
// trip — Photos -> Videos, which unmounts every month with videoCount 0, and back
// again, which mounts brand-new elements — never changed the watched string,
// nobody re-registered the new elements, and those months could never emit
// `need-bucket` again: permanent skeletons until a page reload. Watching the
// rendered set makes registration follow the elements that actually exist.
watch(() => filteredMonths.value.filter((m) => hasContent(m)).map((m) => m.key).join('|'), () => {
  void nextTick().then(() => { measureWrap(); syncObserver() })
})

onMounted(() => {
  measureWrap()
  const first = filteredMonths.value.find(hasContent)
  if (first) activeMonth.value = first.key
  onScroll()
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(onIntersect, { root: wrapRef.value, rootMargin: WINDOW_MARGIN })
    syncObserver()
  }
})
onBeforeUnmount(() => {
  stopAutoAdvance()
  clearTimeout(hoverTimer)
  hoverToken++ // invalidate any in-flight sprite request so it can't set state after unmount
  cancelAnimationFrame(moveRaf)
  moveRaf = 0
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <!-- Task 6 (grid rewrite): root is now `.content` — Vue2 PhotosGrid.vue's own root
       element (photos.scss:307's two-column grid `1fr 66px`), not a New-UI-only
       wrapper. `.photos-wrap` and `.scrubber` are its two grid-column children,
       siblings, not the old flex-column + absolutely-positioned overlay. -->
  <div class="content" :data-no-scrubber="!showScrubber || undefined">
    <div ref="wrapRef" class="photos-wrap scroll" @scroll="onScroll">
      <div v-if="!anyContent" class="empty-state" data-test="empty-state">
        <div class="empty-state-title">{{ t('photosNoPhotos') }}</div>
        <div class="empty-state-desc">{{ t('photosNoPhotosHint') }}</div>
      </div>

      <template v-else>
        <!-- v-for + v-if on the SAME element would break in Vue3 (v-if now
             evaluates before v-for's scope var exists) — wrap with <template>
             so `m` stays in scope, matching Vue2's per-item v-if filtering. -->
        <template v-for="m in filteredMonths" :key="m.key">
          <div v-if="hasContent(m)" :id="'m-' + m.key" class="month-group">
            <div class="month-head">
              <div class="month-title">{{ m.key === 'unknown' ? t('photosUnknownDate') : m.title }}</div>
              <!-- Vue2 PhotosGrid.vue:34 `· {{ m.loc }}` — always-empty placeholder in this
                   port (Month.loc is never populated by any producer here; see task-6-brief.md). -->
              <div class="month-loc">· {{ m.loc }}</div>
              <div v-if="showCount(m)" class="month-count">
                {{ t('photosItemsCount', { count: isLoaded(m) ? m.filtered.length : skeletonCountOf(m) }) }}
              </div>
            </div>
            <div v-if="isLoaded(m) && isWindowed(m)" class="grid" :data-density="density">
              <div
                v-for="p in m.filtered" :key="p.id"
                class="tile"
                :data-selected="isSelected(p.id)"
                :data-previewing="isPreviewing(p) ? 'true' : null"
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
                <div class="tile-overlay"></div>
                <div
                  v-if="selectable" class="tile-checkbox" role="checkbox" :aria-checked="isSelected(p.id)"
                  @click.stop="toggleSelect(p.id)"
                >
                  <PhotosIcon name="check" :size="12" :stroke-width="2.4" />
                </div>
                <!-- Decorative only (no click handler) — Vue2 PhotosGrid.vue:65-67 hides this
                     while selecting, in favor of the checkbox occupying the same corner-ish
                     real estate. The interactive toggle lives in `.tile-actions` below. -->
                <div v-if="fav.isFav(p.id) && !selecting" class="tile-fav">
                  <PhotosIcon name="star" :size="13" color="var(--star-fg, #ffd60a)" />
                </div>
                <div v-if="p.isVideo" class="tile-vid">
                  <PhotosIcon name="play" :size="10" />
                  {{ p.duration }}
                </div>
                <div class="tile-actions">
                  <button
                    type="button"
                    class="tile-act"
                    :data-on="fav.isFav(p.id)"
                    :aria-label="fav.isFav(p.id) ? t('photosUnfavorite') : t('photosFavorite')"
                    @click.stop="fav.toggle(p.id)"
                  >
                    <PhotosIcon
                      :name="fav.isFav(p.id) ? 'star' : 'starOutline'" :size="11"
                      :color="fav.isFav(p.id) ? 'var(--star-fg, #ffd60a)' : undefined"
                    />
                  </button>
                </div>
              </div>
            </div>
            <div
              v-else-if="isLoaded(m) && placeholderHeight(m) !== null"
              class="month-placeholder"
              data-test="month-placeholder"
              :style="{ height: placeholderHeight(m) + 'px' }"
            ></div>
            <!-- A zero-height shimmer would be a decoration nobody can see; the
                 head alone is the section's body-less state (see hasContent). -->
            <div
              v-else-if="sectionBodyHeight(m) > 0"
              class="month-skeleton"
              data-test="month-skeleton"
              :style="{ height: sectionBodyHeight(m) + 'px' }"
            ></div>
          </div>
        </template>
      </template>

      <div style="height:80px"></div>
    </div>

    <div v-if="anyContent && showScrubber" ref="scrubberRef" class="scrubber">
      <div class="scrubber-inner" :style="{ height: scrubberInnerHeight }">
        <div
          v-for="(tk, i) in scrubberTicks" :key="tk.key"
          class="scrubber-tick" :ref="(el) => setTickRef(el as Element | null, i)"
          :data-major="tk.major" :data-active="tk.key === activeMonth" :data-disabled="tk.disabled"
          :style="{ top: tickTop(i), cursor: (tk.major || tk.disabled) ? 'default' : 'pointer' }"
          @click="!tk.major && !tk.disabled && jumpTo(tk.key)"
        >{{ tk.label }}</div>
        <div v-if="activeIdx >= 0" class="scrubber-thumb" :style="{ top: tickTop(activeIdx) }">
          {{ scrubberTicks[activeIdx].label.slice(0, 3) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Task 6 (grid rewrite): the column/tile/scrubber/month-head visual contract that
   used to live in this file now comes from ONE source of truth —
   src/photos/styles/vue2-parity/photos.scss (ported verbatim from NimoOS-UI's
   photos.scss, imported globally by every view that mounts this component
   under `.photos-root` — see gridMetricsCssParity.test.ts, which scans THAT
   file, not this one). What's left below is only what that stylesheet does
   not (and should not) cover.

   `.month-skeleton`/`.month-placeholder` carry NO rule here at all, on
   purpose: Vue2 has zero CSS for either (photos.scss has no `.month-skeleton`/
   `.month-placeholder` selector — grep confirms it), so a purely transparent,
   height-only div is the correct parity, not an oversight to fill in. Both are
   New-UI-only windowing artifacts anyway (Vue2 collapses head+body into a
   single skeleton div per section; this component keeps a finer-grained
   placeholder-vs-skeleton split — see the windowing block in the script above).
   Inventing a shimmer here would be exactly the decoration the brief calls
   out not to add. */

/* Vue2's `.content` is a flex-item of `.main` (display:flex, photos.scss:203),
   which alone gives it a real computed height to size against. New-UI's view
   layer (Photos.vue / PhotosFavorites.vue / PhotosPlaceAssets.vue) wraps this
   component in one extra, non-flex/grid `position:relative` div between
   `.main` and here (`.photos-grid-slot` / `.place-grid-slot`), so `.content`'s
   own `flex:1` (parity scss) has nothing to flex against there. Pin the height
   explicitly instead so the two-column grid actually fills that slot — the
   slot itself is still a flex-item with a real used height, so `height:100%`
   resolves against it correctly. */
.content { height: 100%; }

/* Acceptance Fix-1: when the caller opts out of the scrubber (Favorites -- see the
   `showScrubber` prop comment above), the parity `.content` grid's fixed
   `1fr 66px` two-column track (photos.scss) would otherwise leave a permanent blank
   66px gutter where the scrubber column used to sit. This override has no Vue2
   counterpart to be byte-exact against (Vue2 never renders this shared component for
   Favorites at all), so it lives here rather than in the parity scss file. */
.content[data-no-scrubber] { grid-template-columns: 1fr; }

/* The Vue2 contract (photos.scss:103 `.photos-root, .photos-root * { scrollbar-width:
   none; ... }` + :314 `.photos-wrap::-webkit-scrollbar { width: 0 }`) is already
   globally covered onto `.photos-wrap` in the parity scss (`.photos-root *` covers any descendant).
   These two lines are a literal duplicate only because photosLayoutHeightCap.test.ts independently
   locks in the pre-existing contract that "this file's source must contain them" (an unrelated
   gate to this task) — keep them, don't delete; pure harmless redundancy. */
.photos-wrap { scrollbar-width: none; }
.photos-wrap::-webkit-scrollbar { display: none; }
</style>
