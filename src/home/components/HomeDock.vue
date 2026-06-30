<template>
  <nav ref="root" class="dock" :class="{ expanded: dock.expanded.value }" aria-label="Dock"
    @pointermove="onMove" @pointerleave="reset"
    @pointerdown.capture="onDragStart"
  >
    <div class="dock-main">
      <div class="dock-zone" data-zone="fav">
        <DockApp v-for="k in dock.favKeys.value" :key="k" :app-key="k" />
      </div>
      <span class="dock-sep" />
      <div v-show="dock.expanded.value" class="dock-zone dock-more" data-zone="more">
        <DockApp v-for="k in dock.moreKeys.value" :key="k" :app-key="k" />
      </div>
      <button class="dock-app dock-toggle" :aria-expanded="dock.expanded.value" @click="dock.toggleExpanded()">
        <span class="dock-ic ic-all">▦</span><span class="dock-label">{{ dock.expanded.value ? '完成' : '所有应用' }}</span>
      </button>
    </div>
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
import DockApp from './DockApp.vue'
import { useDock } from '../composables/useDock'
import { useAppsStore } from '../stores/apps'
import { magScale } from '../grid/dockMath'

const dock = useDock()
const apps = useAppsStore()
const root = ref<HTMLElement | null>(null)

// ── magnification ────────────────────────────────────────────────────────────
function onMove(e: PointerEvent) {
  if (drag.active) return // skip mag while dragging
  root.value?.querySelectorAll<HTMLElement>('.dock-app:not(.dock-dragging) .dock-ic').forEach((ic) => {
    const r = ic.getBoundingClientRect()
    ic.style.setProperty('--mag', magScale(e.clientX - (r.left + r.width / 2)).toFixed(3))
  })
}
function reset() { root.value?.querySelectorAll<HTMLElement>('.dock-ic').forEach((ic) => ic.style.setProperty('--mag', '1')) }

// ── drag state ───────────────────────────────────────────────────────────────
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

  // Capture pointer on the nav so we keep getting events when pointer leaves children
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

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
 * Strategy: find all visible dock-app buttons with data-app, pick nearest midpoint.
 * The zone is determined by which data-zone ancestor the nearest item lives in.
 */
function computeDropTarget(clientX: number, _clientY: number): { toZone: 'fav' | 'more'; beforeKey: string | null } {
  if (!root.value) return { toZone: 'more', beforeKey: null }

  const favZone = root.value.querySelector<HTMLElement>('[data-zone="fav"]')
  const moreZone = root.value.querySelector<HTMLElement>('[data-zone="more"]')

  // Collect all app buttons (excluding the dragged one) with their midpoints and zone
  interface Candidate { key: string; midX: number; zone: 'fav' | 'more' }
  const candidates: Candidate[] = []

  const collectFrom = (zone: HTMLElement | null, zoneName: 'fav' | 'more') => {
    if (!zone) return
    zone.querySelectorAll<HTMLElement>('.dock-app[data-app]').forEach((btn) => {
      if (btn.dataset.app === drag.key) return
      const r = btn.getBoundingClientRect()
      candidates.push({ key: btn.dataset.app!, midX: r.left + r.width / 2, zone: zoneName })
    })
  }
  collectFrom(favZone, 'fav')
  collectFrom(moreZone, 'more')

  if (candidates.length === 0) {
    // No other items — decide by horizontal position relative to zones
    const favRect = favZone?.getBoundingClientRect()
    const moreRect = moreZone?.getBoundingClientRect()
    if (moreRect && clientX > moreRect.left) return { toZone: 'more', beforeKey: null }
    return { toZone: 'fav', beforeKey: null }
  }

  // Find the candidate whose midpoint is closest horizontally
  let best: Candidate | null = null
  let bestDist = Infinity
  for (const c of candidates) {
    const d = Math.abs(clientX - c.midX)
    if (d < bestDist) { bestDist = d; best = c }
  }

  if (!best) return { toZone: 'more', beforeKey: null }

  // Insert before the best candidate if drop is to its left, after if to its right
  const beforeKey = clientX < best.midX ? best.key : null
  // If we're inserting "after last", beforeKey=null; zone is from best candidate
  // But if clientX > best.midX and best is last in its zone, beforeKey is null
  // Determine zone: where the drop landed — if moreZone exists and clientX is past fav boundary, prefer more
  const moreRect = moreZone?.getBoundingClientRect()
  const favRect = favZone?.getBoundingClientRect()

  let toZone: 'fav' | 'more'
  if (moreRect && moreZone?.style.display !== 'none' && clientX >= moreRect.left) {
    toZone = 'more'
  } else if (favRect && clientX <= (favRect.right ?? Infinity)) {
    toZone = 'fav'
  } else {
    toZone = best.zone
  }

  // Compute beforeKey within the target zone
  const zoneKeys = toZone === 'fav' ? dock.favKeys.value : dock.moreKeys.value
  // Find nearest item in target zone by midX
  const zoneCandidates = candidates.filter((c) => c.zone === toZone)
  if (zoneCandidates.length === 0) return { toZone, beforeKey: null }

  let zoneBest = zoneCandidates[0]
  let zoneBestDist = Math.abs(clientX - zoneBest.midX)
  for (const c of zoneCandidates) {
    const d = Math.abs(clientX - c.midX)
    if (d < zoneBestDist) { zoneBestDist = d; zoneBest = c }
  }

  const finalBeforeKey = clientX < zoneBest.midX ? zoneBest.key : null

  return { toZone, beforeKey: finalBeforeKey }
}

defineExpose({ root })
</script>
<style scoped>
.dock { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 30; }
.dock-main { display: flex; align-items: flex-end; gap: 10px; padding: 8px 14px; background: rgba(30,34,40,.6); backdrop-filter: blur(20px); border-radius: 22px; }
.dock-zone { display: flex; align-items: flex-end; gap: 10px; }
.dock-sep { width: 1px; align-self: stretch; background: rgba(255,255,255,.18); margin: 0 2px; }
.dock-toggle .ic-all { font-size: 18px; }
/* drag ghost: sized to match dock icons, positioned within dock coordinate space */
.dock-ghost {
  position: absolute;
  pointer-events: none;
  z-index: 100;
  opacity: .85;
}
.dock-ghost .dock-ic {
  width: var(--app-size, 48px);
  height: var(--app-size, 48px);
  display: grid;
  place-items: center;
  background: rgba(255,255,255,.1);
  border-radius: 24%;
}
.dock-ghost .dock-ic.has-img { background: none; }
.dock-ghost .dock-ic img { width: 100%; height: 100%; object-fit: cover; border-radius: 24%; }
.dock-ghost .dock-ic :deep(svg) { width: 58%; height: 58%; fill: none; stroke: currentColor; stroke-width: 1.6; }
</style>
