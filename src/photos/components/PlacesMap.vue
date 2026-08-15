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
//
// Task 5 (Plan E #106 perf architecture port, 2026-08-15): two changes ported from
// Vue2 NimoOS-UI PR #106's own perf sub-commit (git show 78cf3335) — this component's
// share of the "dragging a color picker no longer repaints the whole map" fix (the other
// share — the colour-input uncontrolled + debounced-persist half — lives in
// PlacesThemeMenu.vue/places.ts):
//  a. The land-dot matrix used to be an inline `<circle v-for>` in THIS component's own
//     template. It's now `<PlacesWorldDots :dots="dots" />` (T5 new file) — a real
//     child component boundary, not scoped-CSS-only isolation, so Vue's prop-diffing
//     bails on re-rendering it whenever this component's own render effect re-runs
//     (pin hover/active state, pan/zoom) but `dots` itself hasn't changed reference.
//  b. `themeVars` used to be bound via `:style="themeVars"` directly on the <svg> —
//     that binding made every colour pick a dependency of THIS component's own render
//     effect (since <script setup>'s render function is one effect; reading a prop in
//     the template ties it to that same effect), forcing a full re-render (rebuilding
//     the pins layer, and previously the 2500-circle dots layer too) on every
//     `input` event fired while dragging the picker. `themeVars` is now applied
//     imperatively via `applyMapVars()` — a `watch()` is a SEPARATE reactive effect
//     from the render effect, so reading `props.themeVars` there no longer ties colour
//     changes to this component's render at all; it becomes a pure CSS custom-property
//     write with zero Vue work, mirroring Vue2's own `applyMapVars()` method
//     ($refs.svg + style.setProperty, driven by a `currentTheme` watcher).
import { computed, onMounted, ref, watch } from 'vue'
import { MAP_H, MAP_W } from '../util/worldMap'
import { buildPins, visitedDots, type Pin, type Place } from '../util/placesMap'
import PlacesWorldDots from './PlacesWorldDots.vue'

const props = defineProps<{
  places: Place[] // 已过滤的地点(不吃 rail 的搜索词,同 Vue2 :229/:237)
  activeId: string | null
  view: { tx: number, ty: number, scale: number } // T7 的变换态
  // Output of T10's resolveMapTheme()+mapThemeStyleVars(). No longer bound into the template via
  // :style — applyMapVars() (below) writes it onto the <svg> as imperative CSS custom properties;
  // the code that reads it is a separate watch() side effect, not this component's own render
  // function, so a colour change no longer triggers a re-render of this component (Task 5
  // deviation-log item b, see the big comment above).
  themeVars: Record<string, string>
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

// Vue3 equivalent of Vue2's applyMapVars() (:419-433): writes the <svg>'s style imperatively,
// never through a template :style binding — see the big comment above, item b. The conditional
// handling of `--map-dot-bg` copies mapThemeStyleVars()'s own output contract exactly: that key
// only appears in `vars` when dotBg is non-null, so when the dark-theme branch omits it, it must
// be explicitly removed via removeProperty to clear out whatever value was left from the
// previous call (doing nothing here would be wrong — switching from "a light theme with dotBg"
// back to a dark theme would leave the land-dot lattice stuck on the previous light fallback
// value).
function applyMapVars(vars: Record<string, string>): void {
  const svg = svgEl.value
  if (!svg) return
  svg.style.background = vars.background ?? ''
  svg.style.setProperty('--map-dot', vars['--map-dot'] ?? '')
  svg.style.setProperty('--map-grid', vars['--map-grid'] ?? '')
  if (vars['--map-dot-bg']) svg.style.setProperty('--map-dot-bg', vars['--map-dot-bg'])
  else svg.style.removeProperty('--map-dot-bg')
}
// Fills in the initial value once on mount (the watch below isn't `immediate`), then writes
// again on every subsequent themeVars change (the watch is a separate side effect, not coupled
// to this component's render function — see the big comment above, item b).
onMounted(() => applyMapVars(props.themeVars))
watch(() => props.themeVars, applyMapVars)

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
  >
    <g :transform="gridTransform">
      <PlacesWorldDots :dots="dots" />
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
/* Shadowing cleanup (Plan E Task 4, 2026-08-15): `.map-canvas`/`.map-canvas:active` deleted —
   byte-identical duplicate of `photos-places.scss:350-355`. Most of the rest of this file's
   style block is intentionally left untouched: PlacesMap.test.ts pins a large fraction of it
   directly against this file's own raw `<style>` text (the `.pin-merge-*` transition/transform
   pair — including the Vue2→Vue3 enter-from/leave-to rename — `.pin-scale`'s geometry
   declarations, and `.geo-pin:hover`'s `var(--pin-glow)` reference — the `.world-dot` fallback
   token this comment used to also cite has since moved to PlacesWorldDots.vue's own
   `<style scoped>`, see Task 5 note below). Review I3 correction (Plan E final-fix): the
   comment that used to sit here claimed the pin/dot color chain (`--pin-bg`/`--pin-stroke`/
   `--pin-active-bg`/`--pin-cluster-stroke`/`--pin-cluster-hover-bg`/`--pin-pulse`/`--pin-glow`)
   was fed at runtime via the `themeVars` prop — that was false. `applyMapVars()` (script block
   above) only ever writes `background`, `--map-dot`, `--map-grid`, and conditionally
   `--map-dot-bg`; it never touches any `--pin-*` custom property. The pin chain is read
   statically below (`.geo-pin .pin-bg { fill: var(--pin-bg); … }` etc.) straight off whichever
   `--pin-*` values are in scope on `.photos-root`/`.photos-root.is-light` (now defined in
   `photos.scss`, migrated there from global `theme.css` by this same review item — see that
   file's comment) — a plain CSS cascade read, not a JS-driven one. The per-`data-map-mode`
   swatches (atlas/heatmap) genuinely ARE parity's own static literals, overriding these tokens
   at higher specificity via `.app[data-map-mode="atlas"] .geo-pin .pin-bg` and its heatmap
   counterpart in `photos-places.scss` — those two sentences got conflated in the old comment.
   Animation values verified byte-exact against Vue2/parity:
   `.pin-pulse`'s `animation: mapPulse 2.4s ease-out infinite` and its `@keyframes mapPulse`
   (scale 0.7→2.4, opacity 0.6→0) match photos-places.scss:414-420 exactly;
   `.pin-merge-enter-active/.pin-merge-leave-active .pin-scale`'s
   `transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s` and the
   enter-from/leave-to `transform: scale(0.25); opacity: 0;` match :409-417 exactly. Both
   `@keyframes` names (`mapPulse` here, `pulseDot` in PlaceVisitHistory.vue) legitimately
   coexist with parity's identically-named global keyframes — this file's `<style scoped>`
   block is compiler-hashed, so keyframes-guard.test.ts's global-uniqueness check exempts it
   (see that file's own header comment on why scoped blocks can't actually collide at runtime).

   Task 5 (Plan E, PR 106 perf architecture port, 2026-08-15): the `.world-dot`/
   `.world-dot.is-visited` rules that used to live here (fallback-token comment and all) have
   moved to PlacesWorldDots.vue's own `<style scoped>` block — the land-dot `<circle>`s they
   target now render inside THAT component's own template, not this one's, since Vue's
   `<style scoped>` only attaches a component's own scope-hash attribute to elements its own
   template creates (a child component's internal elements never inherit the parent's scope
   hash). Leaving the rules here after the elements moved out would have silently stopped them
   from matching anything — same specificity, same values, just relocated to the file that now
   owns the elements. `themeVars`'s consumption also changed shape this task: it's no longer
   bound via `:style="themeVars"` on the <svg> (a template binding, which ties every colour pick
   to this component's own render effect) — it's applied imperatively by `applyMapVars()` in the
   script block above, run from a `watch()` (a separate reactive effect from the render effect)
   so a colour change no longer re-renders this component (or the now-separate
   PlacesWorldDots child) at all, only repaints via CSS. */

/* Pins. `.geo-pin` (base cursor/transition) and `.geo-pin .pin-hit` are deleted here —
   byte-identical duplicates of `photos-places.scss:375-383`; neither is read by any test. */
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
