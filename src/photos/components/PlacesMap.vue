<script setup lang="ts">
// P6a-T6 (SP7-P6a places/map main view): PlacesMap.vue — places page's SVG map stage.
// Ported segment-by-segment from Vue2 NimoOS-UI src/views/Photos/PhotosPlacesView.vue:972-1011
// (template) and photos-places.scss:333-436 (styling, skipping dead code :340-345
// .world-graticule/.world-equator — Vue2 template never drew lat/lon lines; also skipping
// :437+ .map-tip, which belongs to the container layer, not in this structure spec).
//
// This component is pure render + pure emit: contains no gesture logic — wheel/pointerdown/move/up
// all come from T7's composable handlers, wired by T11 container to some outer element; this
// component only binds @click / @mouseenter / @mouseleave to .geo-pin and defineExpose's svgEl
// to T7 for coordinate conversion and pointer capture.
//
// Deviations logged:
//  1. font-family uses var(--font) — Vue2's var(--font-display) doesn't exist here;
//     existing Photos components like PlacesRail.vue/PersonHero.vue already use --font universally
//     (structural token replacement, not color approximation).
//  2. transition-group "hidden state" class name: Vue2 is .pin-merge-enter, Vue3 renamed
//     .pin-merge-enter-from (enter-active/enter-to and leave-active/leave-to stay the same in both).
//     Copying the Vue2 class name would leave the pop-in scale animation silently dead — see the
//     comment above that rule in the styles block.
import { computed, ref } from 'vue'
import { MAP_H, MAP_W } from '../util/worldMap'
import { buildPins, visitedDots, type Pin, type Place } from '../util/placesMap'

const props = defineProps<{
  places: Place[] // already-filtered places (doesn't consume rail's search term, same as Vue2 :229/:237)
  activeId: string | null
  view: { tx: number, ty: number, scale: number } // T7's transform state
  themeVars: Record<string, string> // T10's resolveMapTheme() output, spread directly onto <svg> :style
}>()

const emit = defineEmits<{
  (e: 'pick-pin', pin: Pin, ev: MouseEvent): void
  (e: 'hover-pin', pin: Pin, ev: MouseEvent): void
  (e: 'hover-clear'): void
}>()

const svgEl = ref<SVGSVGElement | null>(null)

// Equivalent of PhotosPlacesView.vue:228-278, directly consuming the pure function T2 landed and reviewed.
const dots = computed(() => visitedDots(props.places))
const pins = computed(() => buildPins(props.places, props.view.scale, props.activeId))

// gridTransform computed property from PhotosPlacesView.vue (naming preserved from Vue2 even though it
// transforms the entire map content, not just the grid — historical naming, not recreated).
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

/* Land dot grid: --map-dot-bg / --map-dot these two variables are injected by T10 into <svg>
   inline style themselves, not theme tokens defined here — this gives fallback values; fallback
   must also be tokenized. Review I1: --map-dot-bg fallback **cannot** use --fg-faint (dark 0.52
   bright enough to eclipse is-visited dots, light is opaque warm gray, laid on map's black canvas
   becomes opaque color block) — use dedicated --map-dot-bg-fallback instead (theme-invariant,
   precisely reproduces Vue2 scss:347 literal, see theme.css same-name token comment). */
.world-dot {
  fill: var(--map-dot-bg, var(--map-dot-bg-fallback));
  transition: fill 0.2s;
}
/* --map-dot fallback var(--accent) is actually unreachable: Vue2 :974 injects --map-dot
   unconditionally (unlike --map-dot-bg which only injects if dotBg is true), so this fallback path
   never ran in Vue2 — logged but not changed (review judged low impact, registration only). */
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
  /* theme-exception: fixed white fill — this text sits on any map background (4 presets +
     custom colors, varying depth), not on app theme surface, must stay readable across themes
     and map color schemes. Precedent: PhotosMiniMap.vue's .dot-person fixed white stroke.
     Not using --on-accent, it's deep blue-green, invisible on dark map. */
  fill: rgba(255, 255, 255, 0.85);
  text-anchor: middle;
  paint-order: stroke;
  /* theme-exception: fixed dark stroke, same reason as above — together with fill maintains
     contrast, theme-independent. */
  stroke: rgba(10, 10, 12, 0.85);
  stroke-linejoin: round;
  pointer-events: none;
}
</style>
