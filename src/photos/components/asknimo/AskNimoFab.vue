<!-- Floating orb FAB + mini edge-tab, with a per-instance SVG progress ring. Pixel source:
     Vue2 NimoOS-UI src/views/Photos/PhotosAskNimo.vue's FAB half (:1-96, :113-243) + photos.scss:784-951,
     4325-4353 (already ported) + this plan's Task 5 ring-transition/token additions.
     No <style> block: every visual is already governed by parity scss (Constraints #12). -->
<script lang="ts">
// Preflight F-02: this counter MUST live in a plain (non-setup) <script> block. A `<script
// setup>` block is re-run as the component's setup() function body on every mount, so a `let`
// declared there resets to 0 for every instance -- this block, by contrast, executes exactly
// once when the module is first imported, giving every mounted instance a genuinely unique id.
// Mirrors Vue2's own `_uid`-suffixed gradient ids (PhotosAskNimo.vue:17,54's comment flags this
// exact spot as needing a self-maintained id on the Vue3 port).
let fabInstanceCounter = 0
export function nextFabInstanceId(): string {
  return `nimoFabRing-${fabInstanceCounter++}`
}
</script>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimelineStore } from '../../stores/timeline'
import { useAskNimo } from '../../composables/useAskNimo'
import PhotosIcon from '../PhotosIcon.vue'
import type { TaskBusPayload } from '../../util/taskBus'

const instanceId = nextFabInstanceId()

const { t } = useI18n()
const timeline = useTimelineStore()
const nimo = useAskNimo()

const tasks = computed(() => timeline.tasks as TaskBusPayload[])
const hasTasks = computed(() => tasks.value.length > 0)
const hasError = computed(() => tasks.value.some((task) => !!task.error))
// Preflight F-10: colors resolve through .photos-root private tokens (T5 adds these), never
// literal hex in the .vue file -- CLAUDE.md's theme rule applies to <style> blocks AND inline
// SVG presentation attributes alike, so these are set via `style` (which participates in the
// CSS cascade and resolves custom properties) rather than the `stop-color`/`stroke` XML
// attributes (which do not). The track color is Vue2's literal `rgba(255,255,255,0.08)`
// (PhotosAskNimo.vue:22,59) re-expressed through the existing `--ink` RGB-triple token (see
// photos.scss:53/111's own "rgba(var(--ink), X) == old rgba(255,255,255,X) in dark" comment).
const ringStopStyle = computed(() => ({
  from: { stopColor: hasError.value ? 'var(--nimo-ring-err-from)' : 'var(--nimo-ring-from)' },
  to: { stopColor: hasError.value ? 'var(--nimo-ring-err-to)' : 'var(--nimo-ring-to)' },
}))
const ringTrackStyle = { stroke: 'rgba(var(--ink), 0.08)' }

// Byte-exact port of PhotosAskNimo.vue:140-148's ring geometry. The mini tab uses its OWN
// smaller ring (miniRingSize 22 / radius 9), separate from the full FAB's r=20 ring -- these
// are not the same circle scaled, so both sets of geometry are kept side by side rather than
// collapsed into one shared constant.
const RING_R = 20
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R
const MINI_RING_SIZE = 22
const MINI_RING_R = MINI_RING_SIZE / 2 - 2
const MINI_RING_CIRCUMFERENCE = 2 * Math.PI * MINI_RING_R

// Progress ring formula: per plan's documented extrapolation of the baseline research report's
// §1.6 algorithm (NimoTaskBar.vue's taskGroups, ported byte-exact in NimoTaskBar.vue's own
// computed) -- that report only writes out the per-type-group version; this FAB ring is a
// single ring for ALL tasks combined, so the same "only status!=='done' tasks count, total-based
// tasks average by sum(current)/sum(total), progress-only tasks average by mean(progress)"
// rule is applied with all running tasks folded into one group instead of grouped by type. This
// is an accepted approximation (already ledgered in the self-review, pending maintainer
// re-confirmation), not a from-scratch invention.
const overallProgress = computed(() => {
  const running = tasks.value.filter((task) => task.status !== 'done')
  if (running.length === 0) return tasks.value.length > 0 ? 1 : 0
  let curSum = 0, totSum = 0, progSum = 0, withTotal = 0
  for (const task of running) {
    if (typeof task.total === 'number' && task.total > 0) {
      curSum += task.current || 0
      totSum += task.total
      withTotal += 1
    } else {
      progSum += task.progress || 0
    }
  }
  if (totSum > 0) return curSum / totSum
  const remaining = running.length - withTotal
  return remaining > 0 ? progSum / remaining : 0
})
const dashoffset = computed(() => RING_CIRCUMFERENCE * (1 - overallProgress.value))
const miniDashoffset = computed(() => MINI_RING_CIRCUMFERENCE * (1 - overallProgress.value))

// Preflight F-09: drag-to-move, ported verbatim from Vue2 PhotosAskNimo.vue:180-243
// (startDragFab/startDragMini/onFabClick/onMiniClick). Threshold distinguishes a drag from a
// click; only a genuine drag persists via setFabPosition/setMiniY. `dragging` mirrors Vue2's
// own `dragging` data field (PhotosAskNimo.vue:116), which drives the `.is-dragging` CSS state
// (cursor: grabbing, scale bump, stronger shadow -- photos.scss:817-823) -- it is a pure visual
// flag, orthogonal to the `dragMoved`/click-short-circuit bookkeeping below.
const dragging = ref(false)
let dragMoved = false
let dragStartX = 0
let dragStartY = 0
let dragOriginRight = 0
let dragOriginBottom = 0
let onFabMove: ((e: MouseEvent) => void) | null = null
let onFabUp: (() => void) | null = null

function startDragFab(e: MouseEvent): void {
  if (e.button !== 0) return
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragOriginRight = nimo.fabRight.value
  dragOriginBottom = nimo.fabBottom.value
  dragMoved = false
  onFabMove = (ev: MouseEvent) => {
    const dx = ev.clientX - dragStartX
    const dy = ev.clientY - dragStartY
    if (!dragMoved && Math.abs(dx) + Math.abs(dy) < 5) return
    dragMoved = true
    dragging.value = true
    const right = Math.max(8, Math.min(window.innerWidth - 120, dragOriginRight - dx))
    const bottom = Math.max(8, Math.min(window.innerHeight - 60, dragOriginBottom - dy))
    // Re-check N-5 ③: mid-drag frames only update the visible ref (setFabPositionLocal), never
    // localStorage -- matches Vue2 PhotosAskNimo.vue's _dragOnMove, which only assigns
    // `this.fabRight`/`this.fabBottom` (plain reactive assignment). The persisting write happens
    // exactly once below, in onFabUp, mirroring Vue2's _dragOnUp localStorage.setItem calls.
    nimo.setFabPositionLocal(Math.round(right), Math.round(bottom))
  }
  onFabUp = () => {
    if (onFabMove) window.removeEventListener('mousemove', onFabMove)
    if (onFabUp) window.removeEventListener('mouseup', onFabUp)
    onFabMove = null
    onFabUp = null
    if (dragMoved) {
      nimo.setFabPosition(Math.round(nimo.fabRight.value), Math.round(nimo.fabBottom.value))
      // Review fix (minor #3): Vue2 PhotosAskNimo.vue:203 defers clearing `dragging` by one
      // tick (setTimeout 0) rather than clearing it synchronously here -- this keeps
      // `.is-dragging`'s `transition: none` (photos.scss:817-823) in effect through the
      // synthetic click event that immediately follows mouseup, so the FAB's position snap
      // doesn't pick up a stray transition on that one frame.
      setTimeout(() => { dragging.value = false }, 0)
    } else {
      dragging.value = false
    }
  }
  window.addEventListener('mousemove', onFabMove)
  window.addEventListener('mouseup', onFabUp)
}

let dragOriginY = 0
let onMiniMove: ((e: MouseEvent) => void) | null = null
let onMiniUp: (() => void) | null = null

function startDragMini(e: MouseEvent): void {
  if (e.button !== 0) return
  dragStartY = e.clientY
  dragOriginY = nimo.miniY.value
  dragMoved = false
  onMiniMove = (ev: MouseEvent) => {
    const dy = ev.clientY - dragStartY
    if (!dragMoved && Math.abs(dy) < 4) return
    dragMoved = true
    dragging.value = true
    const y = Math.max(8, Math.min(window.innerHeight - 60, dragOriginY - dy))
    nimo.setMiniYLocal(Math.round(y)) // Re-check N-5 ③: same "local during drag, persist once at drop" split as the FAB above.
  }
  onMiniUp = () => {
    if (onMiniMove) window.removeEventListener('mousemove', onMiniMove)
    if (onMiniUp) window.removeEventListener('mouseup', onMiniUp)
    onMiniMove = null
    onMiniUp = null
    if (dragMoved) {
      nimo.setMiniY(Math.round(nimo.miniY.value))
      // Review fix (minor #3): same deferred-clear as onFabUp above (Vue2 PhotosAskNimo.vue:232).
      setTimeout(() => { dragging.value = false }, 0)
    } else {
      dragging.value = false
    }
  }
  window.addEventListener('mousemove', onMiniMove)
  window.addEventListener('mouseup', onMiniUp)
}

// Review fix (IMPORTANT #3): restores Vue2 PhotosAskNimo.vue:211-213's toggle() semantics for
// the FAB click -- popup open -> close it; popup closed -> open it with a blank prefill. The
// previous unconditional `nimo.openWith('')` regressed this to "always (re)open", which also
// had the side effect of wiping any prefill/context chips already staged in the popup whenever
// the FAB was clicked while it was already open.
function openFab(): void {
  if (dragMoved) { dragMoved = false; return }
  if (nimo.popupOpen.value) {
    nimo.closePopup()
  } else {
    nimo.openWith('')
  }
}
// Re-check N-5 ②: Vue2 PhotosAskNimo.vue:34 has `@mousedown.stop` on the dismiss "x" button --
// this template's dismiss() is only bound to @click, but the button itself also sits inside the
// .nimo-fab that has @mousedown="startDragFab" -- without stopping propagation here, pressing
// and slightly moving on the x button would kick off a whole-FAB drag instead of just dismissing.
//
// Review fix (deliberate deviation from Vue2, ruled correct): the template's "x" also carries
// `@click.stop`, which Vue2's own dismiss button does NOT have (PhotosAskNimo.vue:31-38 only
// stops the mousedown). `dismiss()` only flips `fabDismissed` -- it never touches `popupOpen` --
// so without `.stop` here, the click would still bubble up to `openFab()`'s now-restored toggle
// semantics (Vue2 PhotosAskNimo.vue:211-213) and flip the popup open/closed as a side effect of
// dismissing the FAB to its mini edge-tab, a spurious side effect Vue2 itself never has (there,
// dismiss and the popup's own open state are the same click target's concern, not two competing
// handlers on nested elements). See the "closes without reopening the popup" test below.
function dismiss(): void {
  nimo.dismissFab()
}
function restore(): void {
  if (dragMoved) { dragMoved = false; return }
  nimo.restoreFab()
}

onBeforeUnmount(() => {
  if (onFabMove) window.removeEventListener('mousemove', onFabMove)
  if (onFabUp) window.removeEventListener('mouseup', onFabUp)
  if (onMiniMove) window.removeEventListener('mousemove', onMiniMove)
  if (onMiniUp) window.removeEventListener('mouseup', onMiniUp)
})
</script>

<template>
  <div>
    <!-- Review fix (IMPORTANT #1): Vue2 wraps this whole full/mini pair in
         `<transition name="nimo-fab-swap">` (PhotosAskNimo.vue:3-68) -- the brief's Step-3
         snippet dropped this wrapper even though the CSS was already ported (photos.scss:871-880),
         leaving that CSS permanently dead. Wired back in; the *-enter-from Vue3 shim these rules
         need is added alongside the verbatim Vue2 *-enter selectors in photos.scss, following the
         same precedent as PlacesMap.vue's .pin-merge-enter-from / PhotoLightbox.vue's
         .lb-swap-*-enter-from. -->
    <transition name="nimo-fab-swap">
    <button
      v-if="!nimo.fabDismissed.value" key="full" type="button" class="nimo-fab" :class="{ 'is-dragging': dragging }"
      :style="{ right: nimo.fabRight.value + 'px', bottom: nimo.fabBottom.value + 'px' }"
      @mousedown="startDragFab" @click="openFab"
    >
      <span class="nimo-fab-orb-wrap">
        <span class="nimo-orb" :style="{ width: '34px', height: '34px' }" />
        <svg v-if="hasTasks" class="nimo-fab-ring" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
          <defs>
            <linearGradient :id="instanceId" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" :style="ringStopStyle.from" />
              <stop offset="100%" :style="ringStopStyle.to" />
            </linearGradient>
          </defs>
          <circle cx="22" cy="22" :r="RING_R" fill="none" :style="ringTrackStyle" stroke-width="2" />
          <circle
            cx="22" cy="22" :r="RING_R" fill="none" :stroke="`url(#${instanceId})`" stroke-width="2"
            stroke-linecap="round" :stroke-dasharray="RING_CIRCUMFERENCE" :stroke-dashoffset="dashoffset"
            transform="rotate(-90 22 22)"
          />
        </svg>
      </span>
      <span>{{ t('photosAskNimo') }}</span>
      <span class="nimo-fab-x" :title="t('photosNimoHideHint')" @mousedown.stop @click.stop="dismiss">
        <PhotosIcon name="x" :size="11" />
      </span>
    </button>
    <button
      v-else key="mini" type="button" class="nimo-fab-mini" :class="{ 'is-dragging': dragging }"
      :style="{ bottom: nimo.miniY.value + 'px' }" :title="t('photosNimoDragHint')"
      @mousedown="startDragMini" @click="restore"
    >
      <span class="nimo-fab-mini-orb-wrap">
        <PhotosIcon name="chevL" :size="14" />
        <svg
          v-if="hasTasks" class="nimo-fab-mini-ring" :width="MINI_RING_SIZE" :height="MINI_RING_SIZE"
          :viewBox="`0 0 ${MINI_RING_SIZE} ${MINI_RING_SIZE}`" aria-hidden="true"
        >
          <defs>
            <linearGradient :id="`${instanceId}-mini`" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" :style="ringStopStyle.from" />
              <stop offset="100%" :style="ringStopStyle.to" />
            </linearGradient>
          </defs>
          <circle :cx="MINI_RING_SIZE / 2" :cy="MINI_RING_SIZE / 2" :r="MINI_RING_R" fill="none" :style="ringTrackStyle" stroke-width="2" />
          <circle
            :cx="MINI_RING_SIZE / 2" :cy="MINI_RING_SIZE / 2" :r="MINI_RING_R" fill="none" :stroke="`url(#${instanceId}-mini)`"
            stroke-width="2" stroke-linecap="round" :stroke-dasharray="MINI_RING_CIRCUMFERENCE" :stroke-dashoffset="miniDashoffset"
            :transform="`rotate(-90 ${MINI_RING_SIZE / 2} ${MINI_RING_SIZE / 2})`"
          />
        </svg>
      </span>
    </button>
    </transition>
  </div>
</template>
