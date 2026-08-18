<script setup lang="ts">
// Task 5 (Plan E #106 perf architecture port, 2026-08-15): the land-dot matrix of the
// Places map — ~2500 <circle> nodes. Ported from Vue2 NimoOS-UI's own
// src/views/Photos/PlacesWorldDots.vue (git show 78cf3335, PR #106's perf sub-commit),
// which extracted this exact same `<g><circle v-for>…</g>` block out of the monolithic
// PhotosPlacesView.vue for the same reason.
//
// Vue2's root bug: with the dots inlined in PhotosPlacesView's own template, ANY
// reactive value that component's render function touched (dragging the map-theme
// colour picker fired one `input` event per mouse-move) forced Vue to rebuild + diff
// all ~2500 circle vnodes on every event — freezing the UI while dragging.
//
// This component's Vue3 equivalent of the fix: PlacesMap.vue (T6, this task) now
// renders `<PlacesWorldDots :dots="dots" />` instead of the inline v-for. Because this
// is a *separate* component instance with a single `dots` prop, Vue's default
// prop-diffing bails on re-rendering it whenever PlacesMap's own template re-runs but
// the `dots` computed's return value hasn't changed reference (colour picks, pin
// hover/active state, pan/zoom all leave `props.places` — and therefore `dots` —
// untouched). This component's own render effect only re-runs when the dot set itself
// changes (i.e. when `places` actually changes).
//
// Props-only contract (brief-mandated, ported from Vue2's own `props: { dots: {
// type: Array, required: true } }`): `dots` is the ONLY prop, and this component reads
// no store/composable/global reactive state of its own — nothing else exists here for
// an unrelated reactive change to accidentally couple into.
//
// Shape: matches `visitedDots()`'s own return type (src/photos/util/placesMap.ts) —
// `{ x, y, visited }` (plus `lon`/`lat`, unused here; the prop type below only lists
// the fields this component's template actually reads).
defineProps<{
  dots: Array<{ x: number, y: number, visited?: boolean }>
}>()
</script>

<template>
  <g>
    <circle
      v-for="(d, i) in dots" :key="i"
      :class="['world-dot', { 'is-visited': d.visited }]"
      :cx="d.x" :cy="d.y" r="1.3"
    />
  </g>
</template>

<style scoped>
/* Moved here from PlacesMap.vue (Task 5, Plan E): these two rules target the
   `.world-dot` circles, which now render inside THIS component's own template rather
   than PlacesMap.vue's. Vue's `<style scoped>` only attaches a component's own
   scope-hash attribute to elements that component's own template creates — a child
   component's internal elements never inherit the parent's scope hash (only the
   child's root node does, via attribute fallthrough) — so leaving these two rules in
   PlacesMap.vue after the dots moved out would have silently stopped them from
   matching anything. Values are unchanged from PlacesMap.vue's own copy (verified
   pixel-identical: same fallback token indirection, same comment content, just
   relocated to the file that now owns the elements they style). See
   src/photos/util/placesMapThemes.ts's own comment on `--map-dot-bg` for why the
   `--map-dot-bg` var this component's fallback references is fed here at all — it's
   injected onto the ancestor <svg> by PlacesMap.vue's `applyMapVars()` (imperative
   CSS custom property, not a prop), and ordinary CSS custom-property inheritance
   carries it down into this child component's own DOM regardless of the component
   boundary — inheritance is a DOM/CSSOM mechanism, unrelated to Vue's scoped-style
   attribute mechanism above. */
.world-dot {
  fill: var(--map-dot-bg, var(--map-dot-bg-fallback));
  transition: fill 0.2s;
}
/* The `var(--accent)` fallback on --map-dot is actually unreachable: Vue2 :974 injects --map-dot
   unconditionally (unlike --map-dot-bg, which is only injected when dotBg is truthy), so this
   fallback path never actually gets exercised in Vue2 — logged, value left unchanged (review
   judged this low-impact, logging is sufficient). Same log item carried over verbatim; moving
   the rule to this file doesn't change that judgment. */
.world-dot.is-visited {
  fill: var(--map-dot, var(--accent));
  transition: fill 0.2s;
}
</style>
