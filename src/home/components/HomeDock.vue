<template>
  <nav ref="root" class="dock" :class="{ expanded: dock.expanded.value }" :aria-label="t('dockAria')"
    @pointerdown.capture="onDragStart"
  >
    <div class="dock-main">
      <div class="dock-zone" data-zone="fav">
        <DockApp v-for="k in favVisible" :key="k" :app-key="k" :style="shiftStyle('fav', k)" />
      </div>
      <span v-if="!isMobile" class="dock-sep" />
      <div v-if="!isMobile" class="dock-zone dock-more" data-zone="more" :inert="!dock.expanded.value || undefined">
        <DockApp v-for="k in dock.moreKeys.value" :key="k" :app-key="k" :style="shiftStyle('more', k)" />
      </div>
      <button class="dock-app dock-toggle" :aria-expanded="isMobile ? sheetOpen : dock.expanded.value" @click="onToggle">
        <span class="dock-ic ic-all"><svg class="icon" viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/></svg></span><span class="dock-label">{{ (isMobile ? sheetOpen : dock.expanded.value) ? t('dockDone') : t('dockAllApps') }}</span>
      </button>
    </div>
    <!-- Mobile "all apps": multi-row grid drawer (desktop still expands horizontally in more zone).
         Teleport to body: .dock's backdrop-filter would hijack fixed positioning base to Dock itself. -->
    <Teleport to="body">
      <div v-if="isMobile && sheetOpen" class="allapps-overlay" @click.self="sheetOpen = false">
        <div class="allapps-sheet" role="dialog" :aria-label="t('dockAllApps')" @click="sheetOpen = false">
          <DockApp v-for="k in allKeys" :key="k" :app-key="k" />
        </div>
      </div>
    </Teleport>
    <!-- floating drag ghost -->
    <div v-if="drag.active" class="dock-ghost" :style="drag.ghostStyle" aria-hidden="true">
      <span class="dock-ic" :class="drag.ghostCls">
        <img v-if="drag.ghostIcon" :src="drag.ghostIcon" alt="" />
        <span v-else v-html="drag.ghostGlyph" />
      </span>
    </div>
  </nav>
</template>
<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import DockApp from './DockApp.vue'
import { useDock } from '../composables/useDock'
import { useAppsStore } from '../stores/apps'
import { useIsMobile } from '../composables/useIsMobile'
import { dropTargetIn, slotShifts, type DockSlot, type DockGeometry, type DropDecision } from '../grid/dockMath'
// The dock's fisheye magnification, switched off at the owner's request and kept
// rather than deleted so it can be restored. theme.css still carries the rule that
// consumes --mag; with nothing writing it the fallback of 1 is identity, so the
// effect is off without that file being touched.
// import { magScale } from '../grid/dockMath'

const { t } = useI18n()
const dock = useDock()
const apps = useAppsStore()
const root = ref<HTMLElement | null>(null)

// ── Mobile: fixed 5 slots (4 favorites + all apps), all apps pops multi-row drawer ────────────────
const isMobile = useIsMobile()
const sheetOpen = ref(false)
const favVisible = computed(() => (isMobile.value ? dock.favKeys.value.slice(0, 4) : dock.favKeys.value))
const allKeys = computed(() => [...dock.favKeys.value, ...dock.moreKeys.value])
function onToggle() {
  if (isMobile.value) { sheetOpen.value = !sheetOpen.value; return }
  dock.toggleExpanded()
}

// ── Magnification (switched off; see the note on the magScale import) ─────────
// function onMove(e: PointerEvent) {
//   if (drag.active) return // skip mag while dragging
//   root.value?.querySelectorAll<HTMLElement>('.dock-app:not(.dock-dragging) .dock-ic').forEach((ic) => {
//     const r = ic.getBoundingClientRect()
//     ic.style.setProperty('--mag', magScale(e.clientX - (r.left + r.width / 2)).toFixed(3))
//   })
// }
// function reset() { root.value?.querySelectorAll<HTMLElement>('.dock-ic').forEach((ic) => ic.style.setProperty('--mag', '1')) }

// ── Drag state ───────────────────────────────────────────────────────────────
const DRAG_THRESHOLD = 5

interface DragState {
  active: boolean
  key: string
  startX: number
  startY: number
  offX: number  // clientX offset within the icon
  offY: number  // clientY offset within the icon
  pointerId: number
  ghostStyle: Record<string, string>
  ghostCls: string
  ghostIcon: string | null
  ghostGlyph: string
  toZone: 'fav' | 'more' | null
  beforeKey: string | null
  fromZone: 'fav' | 'more' | null
  holeIndex: number
}

const drag = reactive<DragState>({
  active: false,
  key: '',
  startX: 0,
  startY: 0,
  offX: 0,
  offY: 0,
  pointerId: -1,
  ghostStyle: {},
  ghostCls: '',
  ghostIcon: null,
  ghostGlyph: '',
  toZone: null,
  beforeKey: null,
  fromZone: null,
  holeIndex: 0,
})

// Slot geometry, measured once when the drag activates. Deliberately not part of
// `drag`: nothing renders from it, so it has no business being reactive.
let geom: DockGeometry | null = null

function onDragStart(e: PointerEvent) {
  // Only initiate in expanded mode
  if (!dock.expanded.value) return
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.dock-app[data-app]')
  if (!btn) return
  const key = btn.dataset.app!

  // Intentionally not calling setPointerCapture: during capture, click is dispatched to nav
  // instead of icon, expanded state clicks can't open apps. Only take over after crossing drag threshold (see onDragMove).

  const ic = btn.querySelector<HTMLElement>('.dock-ic')
  const icRect = ic?.getBoundingClientRect() ?? btn.getBoundingClientRect()

  drag.key = key
  // The icon's own slot is the hole its zone reflows around; the other zone gets an
  // appended spare, which slotShifts models as a hole at the end.
  drag.fromZone = dock.favKeys.value.includes(key) ? 'fav' : 'more'
  drag.holeIndex = (drag.fromZone === 'fav' ? dock.favKeys.value : dock.moreKeys.value).indexOf(key)
  drag.startX = e.clientX
  drag.startY = e.clientY
  drag.offX = e.clientX - icRect.left
  drag.offY = e.clientY - icRect.top
  drag.pointerId = e.pointerId
  drag.active = false // not active until threshold crossed

  // Pre-compute ghost visuals
  const meta = apps.app(key)
  drag.ghostCls = meta?.icon ? 'has-img' : (meta?.cls ?? '')
  drag.ghostIcon = meta?.icon ?? null
  drag.ghostGlyph = meta?.glyph ? `<svg class="icon" viewBox="0 0 24 24">${meta.glyph}</svg>` : ''

  window.addEventListener('pointermove', onDragMove, { passive: true })
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragCancel)
  window.addEventListener('resize', onResize)
}

function onDragMove(e: PointerEvent) {
  if (e.pointerId !== drag.pointerId) return
  const dx = e.clientX - drag.startX
  const dy = e.clientY - drag.startY

  if (!drag.active) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    drag.active = true
    // Only real drag captures pointer for nav, pointer can leave child elements during drag without losing events (pure click doesn't reach here)
    root.value?.setPointerCapture(drag.pointerId)
    // hide the source element while dragging
    const src = root.value?.querySelector<HTMLElement>(`.dock-app[data-app="${drag.key}"]`)
    if (src) src.style.opacity = '0'
    // Measure now, before any icon offset has been applied yet, and never again
    // for the rest of this drag (see measureGeometry / dropTargetIn).
    geom = measureGeometry()
  }

  // Position ghost: fixed, offset relative to dock rect so it appears at correct position
  // (engine 1109-1111: dock has transform translateX(-50%), so we must use dockRect.left)
  const dockRect = root.value?.getBoundingClientRect() ?? { left: 0, top: 0 }
  drag.ghostStyle = {
    left: (e.clientX - drag.offX - dockRect.left) + 'px',
    top: (e.clientY - drag.offY - dockRect.top) + 'px',
  }

  // Resolved from the snapshot, which the drop reuses verbatim, so the preview
  // cannot disagree with the outcome. (`target`, not `t` — `t` is the translator.)
  const target = resolveDrop(e.clientX)
  drag.toZone = target.toZone
  drag.beforeKey = target.beforeKey
}

function onDragEnd(e: PointerEvent) {
  if (e.pointerId !== drag.pointerId) return
  cleanupDragListeners()

  if (!drag.active) {
    // Threshold never crossed — normal click, no suppression needed
    resetDragState()
    return
  }

  // Restore source opacity
  const src = root.value?.querySelector<HTMLElement>(`.dock-app[data-app="${drag.key}"]`)
  if (src) src.style.opacity = ''

  // Determine drop target: which zone and which beforeKey. Same snapshot the last
  // preview used, so the icon lands exactly where its offset preview showed it going.
  const { toZone, beforeKey } = resolveDrop(e.clientX)

  dock.reorder(drag.key, toZone, beforeKey)

  // Suppress the upcoming click that pointer devices fire after pointerup
  dock.justDragged.value = true
  setTimeout(() => { dock.justDragged.value = false }, 0)

  resetDragState()
}

function onDragCancel(e: PointerEvent) {
  if (e.pointerId !== drag.pointerId) return
  cleanupDragListeners()
  const src = root.value?.querySelector<HTMLElement>(`.dock-app[data-app="${drag.key}"]`)
  if (src) src.style.opacity = ''
  resetDragState()
}

function cleanupDragListeners() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragCancel)
  window.removeEventListener('resize', onResize)
}

function resetDragState() {
  drag.active = false
  drag.key = ''
  drag.pointerId = -1
  drag.ghostStyle = {}
  drag.toZone = null
  drag.beforeKey = null
  drag.fromZone = null
  drag.holeIndex = 0
  geom = null
}

/**
 * Reads every slot midpoint out of the DOM, dragged icon excluded.
 *
 * Call this only when the icons are not currently offset (`drag.toZone === null`).
 * A CSS transform leaves layout flow untouched, but `getBoundingClientRect` still
 * reports the transformed box, so a live `shiftStyle` offset moves the midpoints
 * this function reports exactly as the old in-flow placeholder did — measuring
 * with an offset in place is the feedback loop the snapshot exists to break.
 *
 * The dragged item is excluded but still occupies its own slot (it is hidden with
 * opacity, not display), so the remaining midpoints are the ones the user sees.
 */
function measureGeometry(): DockGeometry {
  const el = root.value
  if (!el) return { sepMidX: null, favSlots: [], moreSlots: [] }

  const sepRect = el.querySelector<HTMLElement>('.dock-sep')?.getBoundingClientRect()
  const slots = (zone: string): DockSlot[] => {
    const out: DockSlot[] = []
    el.querySelectorAll<HTMLElement>(`[data-zone="${zone}"] .dock-app[data-app]`).forEach((btn) => {
      if (btn.dataset.app === drag.key) return
      const r = btn.getBoundingClientRect()
      out.push({ key: btn.dataset.app!, midX: r.left + r.width / 2 })
    })
    return out
  }

  return {
    sepMidX: sepRect ? (sepRect.left + sepRect.right) / 2 : null,
    favSlots: slots('fav'),
    moreSlots: slots('more'),
  }
}

function resolveDrop(clientX: number): DropDecision {
  return geom ? dropTargetIn(clientX, geom) : { toZone: 'more', beforeKey: null }
}

/**
 * A viewport resize is the one thing that can invalidate the snapshot mid-drag.
 * Clear the preview first so every icon offset drops back to zero, and only
 * re-measure once Vue has flushed that reset.
 */
function onResize() {
  if (!drag.active) return
  drag.toZone = null
  drag.beforeKey = null
  void nextTick(() => { if (drag.active) geom = measureGeometry() })
}

/** The icons still on the ground in a zone: everything but the one being dragged. */
function zoneKeys(zone: 'fav' | 'more'): string[] {
  const all = zone === 'fav' ? favVisible.value : dock.moreKeys.value
  return all.filter((k) => k !== drag.key)
}

/**
 * The hole this zone reflows around. In the zone the icon came from it is the
 * icon's own former index; in the other zone it is the appended spare at the end.
 */
function holeFor(zone: 'fav' | 'more'): number {
  return zone === drag.fromZone ? drag.holeIndex : zoneKeys(zone).length
}

/**
 * Slot pitch in pixels, read from the snapshot rather than recomputed from
 * --app-size: the <= 720px media query overrides the zone's gap to 8px, so the
 * app-size * 1.3 that holds on a wide window is wrong on a narrow one.
 */
function pitchFor(zone: 'fav' | 'more'): number {
  const slots = zone === 'fav' ? geom?.favSlots : geom?.moreSlots
  if (slots && slots.length >= 2) return slots[1].midX - slots[0].midX
  const src = root.value?.querySelector<HTMLElement>(`.dock-app[data-app="${drag.key}"]`)
  return (src?.getBoundingClientRect().width ?? 0) * 1.3
}

/**
 * The transform that moves one icon aside. Returns undefined when no drag is live
 * so the element carries no inline style at rest.
 */
function shiftStyle(zone: 'fav' | 'more', key: string): Record<string, string> | undefined {
  if (!drag.active) return undefined
  const keys = zoneKeys(zone)
  const insertAt = drag.toZone !== zone
    ? null
    : drag.beforeKey == null ? keys.length : Math.max(0, keys.indexOf(drag.beforeKey))
  const shift = slotShifts(keys, holeFor(zone), insertAt).find((s) => s.key === key)
  if (!shift) return undefined
  return { transform: `translateX(${shift.slots * pitchFor(zone)}px)` }
}

defineExpose({ root })
</script>
<style scoped>
/* ── Dock container: glass pill, bottom-center ── */
.dock {
  position: fixed; z-index: 20; left: 50%; bottom: max(20px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  display: flex; max-width: calc(100vw - 40px);
  padding: 14px 22px;
  border: 1px solid var(--dock-border); border-radius: var(--dock-radius, 26px);
  background: var(--dock-bg); box-shadow: var(--dock-shadow); backdrop-filter: var(--blur);
}
.dock-main { display: flex; align-items: flex-end; }
/* Gap scales proportionally with icon size (0.3×64px≈19px, adjusted 2026-07-18 for tighter spacing); ≤720px media query caps at 8px */
.dock-zone { display: flex; align-items: flex-end; gap: calc(var(--app-size, 64px) * 0.3); }
/* "More apps" zone: collapses to zero width, expands on .expanded */
.dock-more {
  max-width: 0; opacity: 0; overflow: hidden; pointer-events: none;
  transition: max-width .38s var(--ease, ease), opacity .26s var(--ease, ease);
}
.dock.expanded .dock-more { max-width: 82vw; opacity: 1; overflow: visible; pointer-events: auto; }
.dock-sep { width: 1px; align-self: stretch; margin: 4px 10px; background: var(--dock-border); }
.dock-toggle { margin-left: 10px; }
/* Drag ghost — mapped from prototype .dock-ph (dashed placeholder) */
.dock-ghost {
  position: absolute; pointer-events: none; z-index: 100; opacity: .85;
  align-self: flex-end;
  border-radius: var(--icon-radius, 31%);
  background: var(--drop-bg, rgba(255, 255, 255, .14));
  border: 1px dashed var(--dock-border);
}
.dock-ghost .dock-ic {
  display: grid; place-items: center;
  width: var(--app-size, 48px); height: var(--app-size, 48px);
  border-radius: var(--icon-radius, 31%);
}
.dock-ghost .dock-ic.has-img { background: none; }
.dock-ghost .dock-ic img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.dock-ghost .dock-ic :deep(svg) { width: 58%; height: 58%; fill: none; stroke: currentColor; stroke-width: 1.6; }
/* The reflow's animation. The transform is written inline per icon by shiftStyle;
   this only supplies the easing. Icons keep their DOM order and slide — reordering
   the DOM mid-gesture would make Vue rebuild the nodes and lose the animation. */
.dock-zone :deep(.dock-app) { transition: transform .18s var(--ease, ease); }
@media (prefers-reduced-motion: reduce) {
  .dock-zone :deep(.dock-app) { transition: none; }
}
/* ── Responsive ≤720px ── */
@media (max-width: 720px) {
  .dock { left: 12px; right: 12px; transform: none; max-width: none; }
  .dock-main { justify-content: center; }
  .dock-zone { gap: 8px; }
  .dock.expanded .dock-more { flex-wrap: wrap; justify-content: center; }
  /* .dock-label lives in DockApp.vue scoped, so we target it via :deep.
     Only hide labels on Dock bar — all-apps drawer (.allapps-sheet) must show app names */
  .dock-main :deep(.dock-label) { display: none; }
}

/* ── Mobile "all apps" drawer: glass backdrop, 4-column multi-row grid, scroll-within tall ── */
.allapps-overlay {
  position: fixed; inset: 0; z-index: 60;
  background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
  display: flex; align-items: flex-end; justify-content: center;
}
.allapps-sheet {
  width: 100%; margin: 0 12px calc(104px + env(safe-area-inset-bottom));
  max-height: 62vh; overflow-y: auto;
  display: grid; grid-template-columns: repeat(4, 1fr); justify-items: center; gap: 16px 8px;
  padding: 18px 12px;
  border: 1px solid var(--dock-border); border-radius: var(--dock-radius, 26px);
  background: var(--dock-bg); box-shadow: var(--dock-shadow); backdrop-filter: var(--blur);
}
</style>
