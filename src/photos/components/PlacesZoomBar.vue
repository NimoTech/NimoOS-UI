<script setup lang="ts">
// P6a-T8 (SP7-P6a 地点·地图主视图): PlacesZoomBar.vue —— 地图左侧垂直缩放滑杆。
// 逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue:952-970(模板)、
// :666-692(zoombarSetFromEvent / onZoombarDown|Move|Up 拖拽换算与 pointer capture)、
// photos-places.scss:234-284(样式)。
//
// 本组件不持有 scale 状态——只吃 T7 usePlacesView 派生的 zoomFrac,拖拽/按钮结果一律
// emit 给 T11 容器,由它接线到 zoomBy/setScale/reset。onDown/onMove/onUp 直接用
// e.currentTarget 取轨道元素(与 Vue2 :677/:686 的 setPointerCapture/releasePointerCapture
// 读法一致),不额外建模板 ref——因为监听器本身就绑在 .zb-track 上,e.currentTarget 恒等于
// Vue2 `this.$refs.zoomTrack`,只是同一元素的两种取法,不是行为改动。
//
// Shadowing cleanup (Plan E Task 3, 2026-08-15): this component's entire `<style scoped>`
// block has been deleted. Every rule it carried was a byte-for-byte or same-resolved-value
// duplicate of `src/photos/styles/vue2-parity/photos-places.scss:234-284` (`.map-zoombar`
// family) — the old rationale below (kept for history) mapped Vue2's local
// `rgba(var(--ink), α)` idiom onto three new global theme.css tokens (`--zb-hover-bg`/
// `--zb-track-bg`/`--zb-thumb-shadow`) because "this repo has no --ink RGB-triple token" — but
// that's only true of the *global* token set. `.photos-root` (photos.scss:53/88) already
// defines a local `--ink` for exactly this purpose, and parity's own `.zb-btn:hover`/
// `.zb-track`/`.zb-thumb` rules already consume it directly. Since this component always
// renders inside `.photos-root`, the scoped rules were shadowing parity's correct local-token
// values with global-token values via `[data-v-xxxx]` specificity — same bug pattern as
// PhotosFilterChip.vue's 2026-08-13 fix round. `.map-zoombar`'s own background/border and
// `.zb-fill`/`.zb-thumb`'s accent-driven parts already used shared or identical literals, so
// nothing here was salvageable as a real deviation; deleting the block lets parity govern
// 100% of `.map-zoombar`. `--zb-hover-bg`/`--zb-track-bg`/`--zb-thumb-shadow` in theme.css were
// unused by any component at the time (grep-confirmed) — left in place then, as that task's
// scope was the four component files, not theme.css pruning; the follow-up noted in that task's
// report has since happened: Plan H Task 15 (2026-08-17) deleted all three token definitions
// from theme.css as confirmed dead.
//
// Historical rationale (superseded, kept only so the "why was this token created" question
// doesn't need re-litigating from theme.css alone):
//  1. Vue2's `.zb-btn:hover`/`.zb-track` background is `rgba(var(--ink), 0.08/0.12)` — alpha
//     copied exactly from Vue2's 0.08/0.12; RGB instead took this repo's `--fg`'s real
//     decomposed value.
//  2. `.zb-thumb`'s `background: #fff` and the second box-shadow layer `rgba(0,0,0,0.4)` — these
//     two values never changed across Vue2's two themes (theme-invariant).
//  3. `.map-zoombar`'s `background: var(--float-bg)` — `--float-bg` had actually already been
//     defined in photos.scss's `.photos-root` local token table; it was never "missing from this
//     repo".
//
// Task 5 (Plan E #106 perf architecture port, 2026-08-15): `dotColor` used to feed the root
// element's `--accent` via `:style="{ '--accent': dotColor }"` — a template binding, which ties
// every colour pick to this component's own render effect (reading a prop in the template ties
// it to that effect). Vue2's own applyMapVars() (PhotosPlacesView.vue :419-433) wrote to BOTH
// `$refs.svg` and `$refs.zoombar` imperatively for exactly this reason; this component's half of
// that same mechanism is ported here — `rootRef` + a `watch()` (a separate reactive effect from
// the render effect) + `style.setProperty`, so `dotColor` changes no longer re-render this
// component's own template at all, only repaint via CSS custom property inheritance.
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MAX_SCALE } from '../util/placesMap'

const props = defineProps<{
  zoomFrac: number
  /** T10 地图主题的强调色,喂给 --accent 局部覆盖——D5 地图主题的一部分,不算违反 token 铁律。 */
  dotColor: string
}>()

const rootRef = ref<HTMLElement | null>(null)
function applyAccent(color: string): void {
  rootRef.value?.style.setProperty('--accent', color)
}
onMounted(() => applyAccent(props.dotColor))
watch(() => props.dotColor, applyAccent)

const emit = defineEmits<{
  (e: 'zoom-by', factor: number): void
  (e: 'set-scale', scale: number): void
  (e: 'reset'): void
}>()

const { t } = useI18n()

// Vue2 :674-679/:684-691 的 _zoomDrag。
let dragging = false

// Vue2 :666-673. t = clamp((clientY - rect.top) / rect.height, 0, 1);
// scale = MAX_SCALE - t * (MAX_SCALE - 1) —— 顶(t=0)= MAX_SCALE,底(t=1)= 1。
function setFromEvent(e: PointerEvent): void {
  const track = e.currentTarget as HTMLElement
  const rect = track.getBoundingClientRect()
  // 评审 M4:Vue2 没有这条守卫,但 rect.height === 0(轨道尚未布局/被隐藏)会让下面的除法
  // 产出 NaN,一路传导到 usePlacesView 的 view.scale/tx/ty 三个字段,而 applyZoom 里
  // `clamped === old` 因 NaN !== NaN 恒不短路,写入即成事实;reset() 走 animateView 做插值,
  // 从 NaN 起点算出的每一步都还是 NaN——连复位键也救不回来,只能重挂组件。这里提前 return
  // 拦住这个不可恢复态,不让 NaN 有机会写进 view。
  if (!rect.height) return
  const tFrac = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
  emit('set-scale', MAX_SCALE - tFrac * (MAX_SCALE - 1))
}

function onDown(e: PointerEvent): void {
  dragging = true
  setFromEvent(e)
  const track = e.currentTarget as HTMLElement & { setPointerCapture?: (id: number) => void }
  if (track.setPointerCapture)
    track.setPointerCapture(e.pointerId)
}

function onMove(e: PointerEvent): void {
  if (dragging)
    setFromEvent(e)
}

// Vue2 :684-691. releasePointerCapture 包 try/catch——丢失的 pointerup 会让 capture 泄漏。
function onUp(e: PointerEvent): void {
  dragging = false
  const track = e.currentTarget as HTMLElement & { releasePointerCapture?: (id: number) => void }
  if (track.releasePointerCapture) {
    try {
      track.releasePointerCapture(e.pointerId)
    }
    catch {
      /* noop */
    }
  }
}

function zoomIn(): void {
  emit('zoom-by', 1.5)
}
function zoomOut(): void {
  emit('zoom-by', 1 / 1.5)
}
function resetView(): void {
  emit('reset')
}
</script>

<template>
  <div ref="rootRef" class="map-zoombar">
    <button class="zb-btn" :title="t('photosPlacesZoomIn')" @click="zoomIn">
      +
    </button>
    <div
      class="zb-track"
      @pointerdown="onDown" @pointermove="onMove"
      @pointerup="onUp" @pointercancel="onUp"
    >
      <div class="zb-fill" :style="{ height: `${zoomFrac * 100}%` }" />
      <div class="zb-thumb" :style="{ bottom: `${zoomFrac * 100}%` }" />
    </div>
    <button class="zb-btn" :title="t('photosPlacesZoomOut')" @click="zoomOut">
      −
    </button>
    <button class="zb-btn zb-reset" :title="t('photosPlacesResetView')" @click="resetView">
      ⤢
    </button>
  </div>
</template>

<!-- No <style scoped> block: every rule this component needs is governed by
     src/photos/styles/vue2-parity/photos-places.scss:234-284 (`.map-zoombar` family),
     which this component's root DOM always renders under `.photos-root` (re-skin
     doctrine: component <style scoped> near zero — see PhotosSelectionToolbar.vue /
     PhotosFilterChip.vue for the same pattern). See the script-block comment above
     for what used to live here and why it was deleted rather than kept as a survivor. -->
