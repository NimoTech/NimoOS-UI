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
// 偏离登记(颜色 token):
//  1. Vue2 `.zb-btn:hover`/`.zb-track` 底色是 `rgba(var(--ink), 0.08/0.12)`——本仓没有
//     `--ink` 这个 RGB 三元组 token,新增两个精确命名的 token(`--zb-hover-bg`/
//     `--zb-track-bg`,见 theme.css/THEMING.md)。alpha 精确复刻 Vue2 的 0.08/0.12;RGB
//     改取本仓 `--fg` 的真实分解值,不照抄 Vue2 light 主题里 `--ink` 的 `(35,37,43)`
//     ——那本身只是 Vue2 注释自称的"AI --text-primary 近似",不是设计精确值。同类换基色
//     先例见 theme.css `--pin-cluster-stroke`。
//  2. `.zb-thumb` 的 `background: #fff` 与 box-shadow 第二层 `rgba(0,0,0,0.4)`——Vue2
//     自己的深浅两套主题里这两个值从未变化。前者标 theme-exception(把手固定白,常见
//     slider handle 惯例);后者新增 theme-invariant token `--zb-thumb-shadow`(两套主题
//     块同值,先例见 `--place-current-trip`)。
//  3. `.map-zoombar` 的 `background: var(--float-bg)` 是新增 token,精确复刻 Vue2
//     photos.scss:49/84 的字面量(本仓之前没有等价的"浮动工具条底"token);
//     `border: 1px solid var(--line)` 按既定映射表改用 `var(--card-border)`。
import { useI18n } from 'vue-i18n'
import { MAX_SCALE } from '../util/placesMap'

defineProps<{
  zoomFrac: number
  /** T10 地图主题的强调色,喂给 --accent 局部覆盖——D5 地图主题的一部分,不算违反 token 铁律。 */
  dotColor: string
}>()

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
  <div class="map-zoombar" :style="{ '--accent': dotColor }">
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

<style scoped>
.map-zoombar {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
  background: var(--float-bg);
  backdrop-filter: blur(14px);
  border: 1px solid var(--card-border);
  border-radius: 99px;
}
.map-zoombar .zb-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--fg-muted);
  cursor: pointer;
  font-size: 16px;
  font-weight: 300;
  border-radius: 50%;
  transition: background 0.2s, color 0.2s;
}
.map-zoombar .zb-btn:hover { background: var(--zb-hover-bg); color: var(--fg); }
.map-zoombar .zb-reset { font-size: 12px; }
.map-zoombar .zb-track {
  position: relative;
  width: 6px;
  height: 120px;
  margin: 2px 0;
  border-radius: 99px;
  background: var(--zb-track-bg);
  cursor: pointer;
  touch-action: none;
}
.map-zoombar .zb-fill {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  border-radius: 99px;
  background: var(--accent, #8950F2);
  pointer-events: none;
}
.map-zoombar .zb-thumb {
  position: absolute;
  left: 50%;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  margin-bottom: -7px;
  border-radius: 50%;
  /* theme-exception: 把手固定白色不随主题走,Vue2 两套主题下从未改过这个值,是常见 slider handle 惯例 */
  background: #fff;
  box-shadow: 0 0 0 3px var(--accent, #8950F2), 0 1px 4px var(--zb-thumb-shadow);
  pointer-events: none;
}
</style>
