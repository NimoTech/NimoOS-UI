<template>
  <nav ref="root" class="dock" :class="{ expanded: dock.expanded.value }" :aria-label="t('dockAria')"
    @pointermove="onMove" @pointerleave="reset"
    @pointerdown.capture="onDragStart"
  >
    <div class="dock-main">
      <div class="dock-zone" data-zone="fav">
        <DockApp v-for="k in favVisible" :key="k" :app-key="k" />
      </div>
      <span v-if="!isMobile" class="dock-sep" />
      <div v-if="!isMobile" class="dock-zone dock-more" data-zone="more" :inert="!dock.expanded.value || undefined">
        <DockApp v-for="k in dock.moreKeys.value" :key="k" :app-key="k" />
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
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DockApp from './DockApp.vue'
import { useDock } from '../composables/useDock'
import { useAppsStore } from '../stores/apps'
import { useIsMobile } from '../composables/useIsMobile'
import { magScale } from '../grid/dockMath'

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

// ── Magnification ────────────────────────────────────────────────────────────
function onMove(e: PointerEvent) {
  if (drag.active) return // skip mag while dragging
  root.value?.querySelectorAll<HTMLElement>('.dock-app:not(.dock-dragging) .dock-ic').forEach((ic) => {
    const r = ic.getBoundingClientRect()
    ic.style.setProperty('--mag', magScale(e.clientX - (r.left + r.width / 2)).toFixed(3))
  })
}
function reset() { root.value?.querySelectorAll<HTMLElement>('.dock-ic').forEach((ic) => ic.style.setProperty('--mag', '1')) }

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
})

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
  }

  // Position ghost: fixed, offset relative to dock rect so it appears at correct position
  // (engine 1109-1111: dock has transform translateX(-50%), so we must use dockRect.left)
  const dockRect = root.value?.getBoundingClientRect() ?? { left: 0, top: 0 }
  drag.ghostStyle = {
    left: (e.clientX - drag.offX - dockRect.left) + 'px',
    top: (e.clientY - drag.offY - dockRect.top) + 'px',
  }
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

  // Determine drop target: which zone and which beforeKey
  const { toZone, beforeKey } = computeDropTarget(e.clientX, e.clientY)

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
}

function resetDragState() {
  drag.active = false
  drag.key = ''
  drag.pointerId = -1
  drag.ghostStyle = {}
}

/**
 * Given the drop position, find the target zone ('fav'|'more') and the key of the item
 * the dragged icon should be inserted before (null = end of zone).
 *
 * Zone decision: separator midpoint rule — drop left of sep midX → 'fav', right → 'more'.
 * beforeKey: find nearest item in the chosen zone by midX; insert-before if clientX < its
 * midX, else end (beforeKey = null).
 */
function computeDropTarget(clientX: number, _clientY: number): { toZone: 'fav' | 'more'; beforeKey: string | null } {
  if (!root.value) return { toZone: 'more', beforeKey: null }

  // Separator-midpoint zone decision
  const sep = root.value.querySelector<HTMLElement>('.dock-sep')
  const sepRect = sep?.getBoundingClientRect()
  const toZone: 'fav' | 'more' = (sepRect && clientX < (sepRect.left + sepRect.right) / 2) ? 'fav' : 'more'

  const favZone = root.value.querySelector<HTMLElement>('[data-zone="fav"]')
  const moreZone = root.value.querySelector<HTMLElement>('[data-zone="more"]')

  // Collect candidates in the chosen zone (excluding the item being dragged)
  interface Candidate { key: string; midX: number }
  const candidates: Candidate[] = []
  const targetZoneEl = toZone === 'fav' ? favZone : moreZone
  targetZoneEl?.querySelectorAll<HTMLElement>('.dock-app[data-app]').forEach((btn) => {
    if (btn.dataset.app === drag.key) return
    const r = btn.getBoundingClientRect()
    candidates.push({ key: btn.dataset.app!, midX: r.left + r.width / 2 })
  })

  if (candidates.length === 0) return { toZone, beforeKey: null }

  // Find nearest item in target zone by midX
  let best = candidates[0]
  let bestDist = Math.abs(clientX - best.midX)
  for (const c of candidates) {
    const d = Math.abs(clientX - c.midX)
    if (d < bestDist) { bestDist = d; best = c }
  }

  // Insert before best if drop is to its left, otherwise end of zone
  const beforeKey = clientX < best.midX ? best.key : null
  return { toZone, beforeKey }
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
