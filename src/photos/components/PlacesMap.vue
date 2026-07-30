<script setup lang="ts">
// P6a-T6 (SP7-P6a 地点·地图主视图): PlacesMap.vue —— 地点页的 SVG 地图舞台。
// 逐段照 Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue:972-1011(模板)、
// photos-places.scss:333-436(样式,跳过死码 :340-345 的 .world-graticule/
// .world-equator——Vue2 模板从没画过经纬线;也跳过 :437+ 的 .map-tip,那属于容器
// 层,不在这段结构规格里)。
//
// 本组件是纯渲染 + 纯 emit:不含任何手势逻辑——wheel / pointerdown/move/up 一律由
// T7 的 composable 出 handler,T11 容器接线到某个外层元素上;本组件只绑
// @click / @mouseenter / @mouseleave 到 .geo-pin,并 defineExpose 出 svgEl 给
// T7 做坐标换算与 pointer capture。
//
// 偏离登记:
//  1. font-family 用 var(--font)——Vue2 的 var(--font-display) 在本仓不存在,
//     PlacesRail.vue/PersonHero.vue 等既有 Photos 组件已一律用 --font 代替
//     (非颜色的结构 token 替换,不是颜色近似)。
//  2. transition-group 的"隐藏态"类名:Vue2 是 .pin-merge-enter,Vue3 改名
//     .pin-merge-enter-from(enter-active/enter-to、leave-active/leave-to 两版
//     同名不变)。照抄 Vue2 类名会让入场缩放动画静默失效——见样式块内该规则上方注释。
import { computed, ref } from 'vue'
import { MAP_H, MAP_W } from '../util/worldMap'
import { buildPins, visitedDots, type Pin, type Place } from '../util/placesMap'

const props = defineProps<{
  places: Place[] // 已过滤的地点(不吃 rail 的搜索词,同 Vue2 :229/:237)
  activeId: string | null
  view: { tx: number, ty: number, scale: number } // T7 的变换态
  themeVars: Record<string, string> // T10 resolveMapTheme() 的产物,直接摊到 <svg> 的 :style
}>()

const emit = defineEmits<{
  (e: 'pick-pin', pin: Pin, ev: MouseEvent): void
  (e: 'hover-pin', pin: Pin, ev: MouseEvent): void
  (e: 'hover-clear'): void
}>()

const svgEl = ref<SVGSVGElement | null>(null)

// PhotosPlacesView.vue:228-278 的等价物,直接消费 T2 已落地并过评审的纯函数。
const dots = computed(() => visitedDots(props.places))
const pins = computed(() => buildPins(props.places, props.view.scale, props.activeId))

// PhotosPlacesView.vue 的 gridTransform 计算属性(命名沿用 Vue2,尽管它变换的是
// 整块地图内容,不只是网格——历史命名,不重造)。
const gridTransform = computed(() => `translate(${props.view.tx} ${props.view.ty}) scale(${props.view.scale})`)

function pickPin(p: Pin, ev: MouseEvent): void {
  emit('pick-pin', p, ev)
}
function setHover(p: Pin, ev: MouseEvent): void {
  emit('hover-pin', p, ev)
}
function clearHover(): void {
  emit('hover-clear')
}

defineExpose({ svgEl })
</script>

<template>
  <svg
    ref="svgEl"
    class="map-canvas"
    :viewBox="`0 0 ${MAP_W} ${MAP_H}`"
    preserveAspectRatio="xMidYMid meet"
    :style="themeVars"
  >
    <g :transform="gridTransform">
      <g>
        <circle
          v-for="(d, i) in dots" :key="i"
          :class="['world-dot', { 'is-visited': d.visited }]"
          :cx="d.x" :cy="d.y" r="1.3"
        />
      </g>
      <transition-group tag="g" name="pin-merge" class="pins-layer">
        <g
          v-for="p in pins" :key="p.id"
          class="geo-pin"
          :class="{ 'is-active': p.active, 'is-recent': p.recent, 'is-cluster': p.cluster }"
          :transform="`translate(${p.x}, ${p.y})`"
          @click="pickPin(p, $event)"
          @mouseenter="setHover(p, $event)"
          @mouseleave="clearHover"
        >
          <circle class="pin-hit" cx="0" cy="0" :r="p.hitR" />
          <g class="pin-scale">
            <circle v-if="p.active && !p.cluster" class="pin-pulse" cx="0" cy="0" :r="p.r" />
            <circle class="pin-bg" cx="0" cy="0" :r="p.r" />
            <circle v-if="!p.cluster" class="pin-core" cx="0" cy="0" :r="p.r * 0.55" />
          </g>
          <text
            v-if="p.active && !p.cluster" class="geo-pin-label"
            x="0" :y="p.r + 11 / view.scale"
            :style="{ fontSize: `${11 / view.scale}px`, strokeWidth: 3.4 / view.scale }"
          >{{ p.city }}</text>
        </g>
      </transition-group>
    </g>
  </svg>
</template>

<style scoped>
.map-canvas {
  flex: 1;
  width: 100%;
  height: 100%;
  cursor: grab;
}
.map-canvas:active { cursor: grabbing; }

/* 陆地点阵:回落值走 token(这两个变量本身由 T10 注入到 <svg> 的 inline style 上,
   不是本组件定义的 theme token——这里只给回落值,回落值也要 token 化)。 */
.world-dot {
  fill: var(--map-dot-bg, var(--fg-faint));
  transition: fill 0.2s;
}
.world-dot.is-visited {
  fill: var(--map-dot, var(--accent));
  transition: fill 0.2s;
}

/* Pins */
.geo-pin {
  cursor: pointer;
  transition: filter 0.15s;
}
/* Invisible, screen-constant click target so small pins stay easy to hit. */
.geo-pin .pin-hit {
  fill: transparent;
  pointer-events: all;
}
.geo-pin:hover { filter: drop-shadow(0 0 14px var(--pin-glow)); }
.geo-pin .pin-bg {
  fill: var(--pin-bg);
  stroke: var(--pin-stroke);
  stroke-width: 1.2;
}
.geo-pin .pin-core {
  fill: var(--accent);
}
.geo-pin.is-recent .pin-core {
  fill: var(--place-current-trip);
}
.geo-pin.is-active .pin-bg {
  fill: var(--pin-active-bg);
  stroke: var(--accent);
  stroke-width: 2;
}
/* Inner group that carries the merge/split scale animation (kept separate
   from the outer translate transform so the two never fight). */
.pin-scale {
  transform-box: fill-box;
  transform-origin: center;
}
/* Merge / fission animation: bubbles pop in when they appear and shrink away
   when they merge into a neighbor.
   Vue2→Vue3 framework-difference fix: Vue2's "hidden state" class is named
   `.pin-merge-enter`; Vue3 renamed it `.pin-merge-enter-from` (enter-active/
   enter-to and leave-active/leave-to keep the same names in both versions).
   Porting the literal Vue2 class name here would leave this rule dead — the
   class Vue3 actually applies never matches it, so the pop-in animation would
   silently do nothing. */
.pin-merge-enter-active .pin-scale,
.pin-merge-leave-active .pin-scale {
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s;
}
.pin-merge-enter-from .pin-scale,
.pin-merge-leave-to .pin-scale {
  transform: scale(0.25);
  opacity: 0;
}
/* Aggregated multi-city cluster bubble */
.geo-pin.is-cluster .pin-bg {
  fill: var(--pin-active-bg);
  stroke: var(--pin-cluster-stroke);
  stroke-width: 1.6;
}
.geo-pin.is-cluster:hover .pin-bg {
  fill: var(--pin-cluster-hover-bg);
}
.geo-pin.is-cluster.is-active .pin-bg {
  stroke: var(--accent);
  stroke-width: 2.4;
}
.geo-pin .pin-pulse {
  fill: var(--pin-pulse);
  animation: mapPulse 2.4s ease-out infinite;
  transform-origin: center;
  transform-box: fill-box;
}
@keyframes mapPulse {
  0%   { transform: scale(0.7); opacity: 0.6; }
  100% { transform: scale(2.4); opacity: 0; }
}

.geo-pin-label {
  /* font-size & stroke-width are bound inline (scaled by 1/zoom) so the label
     stays a constant on-screen size instead of ballooning at high zoom. */
  font-family: var(--font);
  font-weight: 600;
  /* theme-exception: 固定白色填充——这段文字压在任意地图底色之上(4 套预设 + 自定义色,
     深浅不定),不是压在 app 主题表面上,必须跨主题、跨地图配色都保持可读。先例:
     PhotosMiniMap.vue 的 .dot-person 固定白描边。不用 --on-accent,它是深藏青,压在
     深色地图上会隐形 */
  fill: rgba(255, 255, 255, 0.85);
  text-anchor: middle;
  paint-order: stroke;
  /* theme-exception: 固定深色描边,同上一条理由——跟 fill 一起撑开对比度,不随主题走 */
  stroke: rgba(10, 10, 12, 0.85);
  stroke-linejoin: round;
  pointer-events: none;
}
</style>
