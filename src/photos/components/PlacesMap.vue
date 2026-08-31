<script setup lang="ts">
// PlacesMap.vue — the places page's SVG map stage.
// Ported section-by-section from Vue2 src/views/Photos/PhotosPlacesView.vue:972-1011
// (template), photos-places.scss:333-436 (styles, skipping the dead .world-graticule/
// .world-equator code at :340-345 — Vue2's template never actually drew graticule lines; also
// skipping .map-tip at :437+, which belongs to the container layer, out of scope for this
// component's structure).
//
// This component is pure rendering + pure emit: it contains no gesture logic at all —
// wheel / pointerdown/move/up handlers all come from a separate composable, wired by the
// container onto some outer element; this component only binds
// @click / @mouseenter / @mouseleave to .geo-pin, and defineExposes svgEl so that composable
// can do coordinate conversion and pointer capture.
//
// Deviations from Vue2:
//  1. font-family uses var(--font) — Vue2's var(--font-display) doesn't exist in this repo;
//     existing Photos components like PlacesRail.vue/PersonHero.vue already uniformly
//     substitute --font instead (a structural, non-color token substitution, not a color
//     approximation).
//  2. transition-group's "hidden state" class name: Vue2 uses .pin-merge-enter, Vue3 renamed
//     it .pin-merge-enter-from (enter-active/enter-to and leave-active/leave-to keep the same
//     names in both versions). Copying Vue2's class name verbatim would leave the entrance
//     scale animation silently broken — see the comment above that rule in the style block.
//
// A later perf pass ported two changes from
// the Vue 2 panel's PR #106's own perf sub-commit (git show 78cf3335) — this component's
// share of the "dragging a color picker no longer repaints the whole map" fix (the other
// share — the colour-input uncontrolled + debounced-persist half — lives in
// PlacesThemeMenu.vue/places.ts):
//  a. The land-dot matrix used to be an inline `<circle v-for>` in THIS component's own
//     template. It's now `<PlacesWorldDots :dots="dots" />` (a new file) — a real
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
  places: Place[] // Already-filtered places (doesn't consume the rail's search term, same as Vue2 :229/:237)
  activeId: string | null
  view: { tx: number, ty: number, scale: number } // The pan/zoom transform state, owned by the gesture composable
  // Output of resolveMapTheme()+mapThemeStyleVars(). No longer bound into the template via
  // :style — applyMapVars() (below) writes it onto the <svg> as imperative CSS custom properties;
  // the code that reads it is a separate watch() side effect, not this component's own render
  // function, so a colour change no longer triggers a re-render of this component (see the big
  // comment above).
  themeVars: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'pick-pin', pin: Pin, ev: MouseEvent): void
  (e: 'hover-pin', pin: Pin, ev: MouseEvent): void
  (e: 'hover-clear'): void
}>()

const svgEl = ref<SVGSVGElement | null>(null)

// Equivalent of PhotosPlacesView.vue:228-278, directly consuming the already-built and
// reviewed pure functions.
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

// PhotosPlacesView.vue's gridTransform computed (name kept from Vue2, even though it
// transforms the whole map content, not just a grid — a historical name, not worth renaming).
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
/* Shadowing cleanup: `.map-canvas`/`.map-canvas:active` deleted —
   byte-identical duplicate of `photos-places.scss:350-355`. Most of the rest of this file's
   style block is intentionally left untouched: PlacesMap.test.ts pins a large fraction of it
   directly against this file's own raw `<style>` text (the `.pin-merge-*` transition/transform
   pair — including the Vue2→Vue3 enter-from/leave-to rename — and `.pin-scale`'s geometry
   declarations — the `.world-dot` fallback token this comment used to also cite has since moved
   to PlacesWorldDots.vue's own `<style scoped>`, see the perf-pass note below).

   The original color choice here was later formally overturned: the seven `--pin-*` tokens this
   comment used to describe (`--pin-bg`/`--pin-stroke`/`--pin-active-bg`/`--pin-cluster-stroke`/
   `--pin-cluster-hover-bg`/`--pin-pulse`/`--pin-glow`) carried BLUE values (migrated as-then-were
   during an earlier fix pass, see photos.scss's own now-removed comment on them) — a
   deviation from Vue2, which uses the PURPLE accent family for pins — an alpha-varying color
   built from `--accent-rgb`, plus flat `var(--accent)` for solid strokes/cores
   (photos-places.scss:367-437, byte-transcribed into this repo's own parity
   `photos-places.scss` already). Those `--pin-*`-consuming local rules below (this component's
   own `<style scoped>`, registered after the parity stylesheet in every host page's import
   order) SHADOWED parity's correct purple rules at a cascade tie — the exact same
   "component-scoped style outvotes parity on every tie" hazard flagged throughout this whole
   file family. Deleted the color-only rules outright below (parity is a byte-identical, full
   property superset for every one of them once color matches — verified line-by-line, see each
   deletion site) so parity's own accent-rgb-based/`var(--accent)` rules govern directly,
   restoring Vue2's purple. The seven tokens themselves, now with zero remaining consumers
   anywhere in this repo (grep-confirmed), were removed from `photos.scss` entirely rather than
   kept dormant — see that file's own comment on the removal. `.geo-pin .pin-pulse` is TRIMMED rather than
   deleted (only its `fill: var(--pin-pulse)` line removed) — its `animation`/`transform-origin`/
   `transform-box` lines stay local so this component's own scoped `@keyframes mapPulse` below
   keeps a live, same-block reference; the `fill` property alone now cascades from parity's
   identical selector (CSS resolves fill/other properties independently, per-property, not
   per-rule — a partial local rule is completely normal). Vue2 ground truth confirmed to have NO
   light-theme-specific override for any of this (grep-verified against the Vue 2 panel's
   photos-places.scss — accent purple is theme-constant there, no `.is-light` branch touches the
   pin family at all), matching this file's own dark/light-invariant `var(--accent)` usage below.

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

   Perf-architecture port: the `.world-dot`/
   `.world-dot.is-visited` rules that used to live here (fallback-token comment and all) have
   moved to PlacesWorldDots.vue's own `<style scoped>` block — the land-dot `<circle>`s they
   target now render inside THAT component's own template, not this one's, since Vue's
   `<style scoped>` only attaches a component's own scope-hash attribute to elements its own
   template creates (a child component's internal elements never inherit the parent's scope
   hash). Leaving the rules here after the elements moved out would have silently stopped them
   from matching anything — same specificity, same values, just relocated to the file that now
   owns the elements. `themeVars`'s consumption also changed shape in this pass: it's no longer
   bound via `:style="themeVars"` on the <svg> (a template binding, which ties every colour pick
   to this component's own render effect) — it's applied imperatively by `applyMapVars()` in the
   script block above, run from a `watch()` (a separate reactive effect from the render effect)
   so a colour change no longer re-renders this component (or the now-separate
   PlacesWorldDots child) at all, only repaints via CSS. */

/* Pins. `.geo-pin` (base cursor/transition) and `.geo-pin .pin-hit` are deleted here —
   byte-identical duplicates of `photos-places.scss:375-383`; neither is read by any test.
   `.geo-pin:hover` (the `--pin-glow` glow filter) and `.geo-pin .pin-bg` (the base
   `--pin-bg`/`--pin-stroke` fill/stroke) are ALSO deleted here now — both were pure color-only
   local rules shadowing parity's own accent-rgb-based equivalents at a cascade tie
   (see this file's header comment above). Parity's `.photos-root .geo-pin:hover`/
   `.photos-root .geo-pin .pin-bg` (photos-places.scss:367,390-394) are a byte-identical property
   superset (same `stroke-width: 1.2`, same shape) once color governs from there, so nothing is
   lost by removing the local duplicates outright. */
.geo-pin .pin-core {
  fill: var(--accent);
}
.geo-pin.is-recent .pin-core {
  fill: var(--place-current-trip);
}
/* `.geo-pin.is-active .pin-bg` deleted — was `fill: var(--pin-active-bg); stroke:
   var(--accent); stroke-width: 2;`, shadowing parity's `.photos-root .geo-pin.is-active .pin-bg`
   (photos-places.scss:401-405), which already declares the identical `stroke`/`stroke-width` plus
   the correct purple accent-rgb-based fill (alpha 0.30). Same "byte-identical superset, safe to
   delete the local duplicate outright" reasoning as `.pin-bg` above. */
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
/* Aggregated multi-city cluster bubble.
   `.geo-pin.is-cluster .pin-bg` (was `fill: var(--pin-active-bg); stroke:
   var(--pin-cluster-stroke); stroke-width: 1.6;`) and `.geo-pin.is-cluster:hover .pin-bg` (was
   `fill: var(--pin-cluster-hover-bg);`) are both deleted — parity's
   `.photos-root .geo-pin.is-cluster .pin-bg`/`:hover .pin-bg` (photos-places.scss:424-431) are a
   byte-identical property superset (same lavender stroke literal/`stroke-width: 1.6` for the
   base rule) once color governs from there, same reasoning as the deletions above. */
.geo-pin.is-cluster.is-active .pin-bg {
  stroke: var(--accent);
  stroke-width: 2.4;
}
.geo-pin .pin-pulse {
  /* `fill: var(--pin-pulse);` removed (was the blue-family token) — the rest of this rule
     (animation/transform-origin/transform-box) stays local so this component's own scoped
     `@keyframes mapPulse` below keeps a live, same-`<style scoped>`-block reference; CSS resolves
     `fill` independently, per-property, so it now cascades cleanly from parity's identical
     selector (`.photos-root .geo-pin .pin-pulse`, photos-places.scss:436-441, an accent-rgb-based
     fill at alpha 0.25) without needing a local color declaration at all. */
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
  /* theme-exception: fixed white fill — this text sits on top of an arbitrary map background
     color (4 presets plus a custom color, light or dark), not on an app theme surface, so it
     must stay readable across every theme and every map color scheme. Precedent:
     PhotosMiniMap.vue's .dot-person uses a fixed white outline the same way. --on-accent isn't
     used here since it's a dark navy that would become invisible on a dark map. */
  fill: rgba(255, 255, 255, 0.85);
  text-anchor: middle;
  paint-order: stroke;
  /* theme-exception: fixed dark outline, same reasoning as above — works together with the
     fill to keep contrast, independent of the theme. */
  stroke: rgba(10, 10, 12, 0.85);
  stroke-linejoin: round;
  pointer-events: none;
}
</style>
