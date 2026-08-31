<script setup lang="ts">
// PlacesThemeMenu.vue — the map toolbar's "Map theme" pill button + dropdown popover (4
// presets + two custom color pickers). Ported section-by-section from Vue2 src/views/Photos/
// PhotosPlacesView.vue:907-947 (template); the color values/resolveMapTheme semantics were
// implemented alongside this component in src/photos/util/placesMapThemes.ts — this component
// only consumes MAP_THEME_PRESETS + swatchColors, it doesn't redefine color values or need
// resolveMapTheme/mapThemeStyleVars (those are for PlacesMap.vue to render the map itself;
// this component only draws the preview swatches). Styles follow photos-places.scss:964-1025.
//
// Write convention (matching the pattern already established elsewhere): props.selection must
// never be mutated in place — always emit update:selection with a whole new replacement
// object. Picking a preset: emit a new selection (only mapTheme changes) + emit
// update:open(false) to close the popover. The color pickers' @input: emit a new selection
// (mapTheme forced to 'custom' + the corresponding color field updated, the other color field
// left as-is), without closing the popover — following Vue2's :940/:944
// `@input="mapTheme = 'custom'"`, the color picker itself carries no accompanying close
// action. Whether store.setMapTheme/setCustomColors are actually called to persist is decided
// by the container once it receives these two emits (reads can connect directly to the store,
// writes go through emit).
//
// Where `isLight` comes from: the caller (the container) computes the boolean and passes it
// in — this component doesn't depend on any store/composable directly, staying a pure props/emit
// presentational component. A later pass changed the caller-side signal source
// from the global `useThemeStore()` back to Photos' own private `usePhotosTheme()` (a deliberate
// revert of an earlier decision to "read from global" — see PhotosPlaces.vue's `isLight`
// computed and placesMapThemes.ts's own header comment for the full account); that
// change only happens inside the caller, this component's own prop contract (`isLight: boolean`)
// is completely unchanged and doesn't need to follow.
//
// Overlay convention (the same pattern already established for PlacesFilterMenu.vue): open is
// a prop, with a document-level mousedown (closes on an outside click) + keydown (closes on
// Escape), attached/detached by a watch(open), without using stopImmediatePropagation.
// onDocKeydown's only early return is "skip non-Escape keys" — this component only manages a
// single open state, so there's no second branch to early-return from; this isn't the
// early-return bug seen elsewhere where two overlays sharing one predicate function miss
// checking a second branch — that scenario only arises once this component and
// PlacesFilterMenu are wired into the same container by later work, so the integration
// assertion for it belongs there.
//
// A later perf pass: the two `<input type="color">`s
// below are now UNCONTROLLED — no `:value` binding. Vue2's own fix (PR #106, git show
// 78cf3335) made these same two inputs uncontrolled for the identical reason: a `:value`
// binding ties the bound expression to this component's own render effect, so every `input`
// event fired while dragging the picker (many per second) would re-render this component on
// every one. `syncColorInputs()` (ported from Vue2's own method of the same name) seeds the
// inputs' `.value` imperatively instead, run once when the popover transitions open (Vue2's own
// `themeOpen(open) { if (open) this.$nextTick(this.syncColorInputs) }` watcher, ported
// verbatim below) — the popover's `v-if="open"` means the inputs don't exist in the DOM until
// then, hence the `nextTick()` wait for the DOM to catch up before the refs resolve.
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MAP_THEME_PRESETS, swatchColors } from '../util/placesMapThemes'

export interface MapThemeSelection {
  mapTheme: string // 'default' | 'ocean' | 'sand' | 'mono' | 'custom'
  customDotColor: string
  // Renamed from customGridColor — same reason Vue2 PR #106
  // sub-commit 3 renamed its own field of the same name (git show 78cf3335): this value feeds
  // the "City light color" picker below, which maps to the lit-city dot colour (`--map-dot`),
  // never a grid line. See placesMapThemes.ts's resolveMapTheme() for the mapping itself.
  customCityColor: string
}

const props = defineProps<{
  selection: MapThemeSelection
  isLight: boolean
  open: boolean
}>()
const emit = defineEmits<{
  (e: 'update:selection', next: MapThemeSelection): void
  (e: 'update:open', open: boolean): void
}>()

const { t } = useI18n()

const rootRef = ref<HTMLElement | null>(null)
const dotInputRef = ref<HTMLInputElement | null>(null)
const gridInputRef = ref<HTMLInputElement | null>(null)
// `gridInputRef`/`onGridInput` below are historic names, kept for continuity with Vue2's own
// `customGridColor` field — a later pass renamed the underlying data field to
// `customCityColor` (this picker feeds the lit-city dot colour, never a grid line; see
// `MapThemeSelection.customCityColor`'s own comment above), but the local ref/handler names here
// were left as-is and have since semantically drifted from what they actually do.

// Vue3 equivalent of Vue2's syncColorInputs() (:436-441): an unbound color picker can only get
// its initial value via an imperative assignment.
function syncColorInputs(): void {
  if (dotInputRef.value) dotInputRef.value.value = props.selection.customDotColor
  if (gridInputRef.value) gridInputRef.value.value = props.selection.customCityColor
}
// Vue2's themeOpen watcher (:351-354), semantics ported verbatim: seeds the initial value only
// the moment `open` flips from false to true — not `immediate` (the popover starts closed by
// default; the real usage path always starts with open === false, so there's nothing to sync on
// mount; the only scenario needing sync-on-mount-with-open===true is a test mounting directly
// with open: true, which isn't representative of real interaction and needs no special handling).
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) nextTick(syncColorInputs)
  },
)

function toggleOpen(): void {
  emit('update:open', !props.open)
}

// Vue2 :919's `@click="mapTheme = t.id; themeOpen = false"`.
function pickPreset(id: string): void {
  emit('update:selection', { ...props.selection, mapTheme: id })
  emit('update:open', false)
}

// Vue2 :940's `@input="mapTheme = 'custom'"` (v-model already handles writing customDotColor
// to its new value; here both things are emitted together as one whole replacement object).
function onDotInput(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  emit('update:selection', { ...props.selection, mapTheme: 'custom', customDotColor: value })
}
// Vue2 :944, same as above, swapped in customCityColor.
function onGridInput(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  emit('update:selection', { ...props.selection, mapTheme: 'custom', customCityColor: value })
}

// ── Overlay convention: attach document-level mousedown/keydown handlers while open is true,
// attached/detached by a watch(open) ─────────
function onDocMousedown(e: MouseEvent): void {
  const target = e.target as Node
  if (rootRef.value && !rootRef.value.contains(target)) emit('update:open', false)
}
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  emit('update:open', false)
}
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener('mousedown', onDocMousedown)
      document.addEventListener('keydown', onDocKeydown)
    }
    else {
      document.removeEventListener('mousedown', onDocMousedown)
      document.removeEventListener('keydown', onDocKeydown)
    }
  },
  { immediate: true },
)
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <div ref="rootRef" class="mtm-anchor" data-test="mtm-root">
    <button type="button" class="map-chip" data-test="mtm-chip" @click.stop="toggleOpen">
      <svg class="mtm-chip-icon" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.8a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-.8-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-.8c.6.5 1.3.9 2 1.2L10 21h4l.5-2.5c.7-.3 1.4-.7 2-1.2l2.4.8 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
      </svg>
      {{ t('photosPlacesMapTheme') }}
      <svg class="mtm-chip-icon" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
    </button>

    <div v-if="open" class="map-theme-pop" data-test="mtm-pop">
      <h6>{{ t('photosPlacesMapThemePresets') }}</h6>
      <div class="mtp-list">
        <button
          v-for="preset in MAP_THEME_PRESETS" :key="preset.id" type="button"
          :class="['mtp-item', { 'is-active': selection.mapTheme === preset.id }]"
          data-test="mtm-preset" :data-theme-id="preset.id"
          @click="pickPreset(preset.id)"
        >
          <span class="mtp-swatch" data-test="mtm-swatch" :style="{ backgroundColor: swatchColors(preset, isLight).bg }">
            <span class="mtp-dot" :style="{ background: swatchColors(preset, isLight).dot }" />
          </span>
          <span class="mtp-body">
            <span class="mtp-name">{{ t(preset.nameKey) }}</span>
            <span class="mtp-desc">{{ t(preset.descKey) }}</span>
          </span>
          <!-- `--accent-text` (global, theme.css) swapped for
               `--accent-hi` — Vue2's own exact value here (PhotosPlacesView.vue:1014,
               `<PhotosIcon ... color="var(--accent-hi)">`), and already Photos-local
               (photos.scss:31, theme-invariant — Photos' own accent family is intentionally
               NOT overridden by `.photos-root.is-light`, same as this rule's `.is-active`
               background/border tokens). `--accent-text` tracked the wrong signal entirely
               (a global, app-wide-theme-following, unrelated blue) and wasn't even the right
               Vue2 value to begin with. -->
          <svg
            v-if="selection.mapTheme === preset.id" class="mtp-check" data-test="mtm-check"
            viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--accent-hi)"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
          ><path d="m5 12 5 5L20 7" /></svg>
        </button>
      </div>

      <h6 class="mtp-title-custom">{{ t('photosPlacesMapThemeCustom') }}</h6>
      <label class="mtp-color-row">
        <span>{{ t('photosPlacesLandDotColor') }}</span>
        <input ref="dotInputRef" type="color" data-test="mtm-dot-input" @input="onDotInput">
      </label>
      <label class="mtp-color-row">
        <span>{{ t('photosPlacesCityLightColor') }}</span>
        <input ref="gridInputRef" type="color" data-test="mtm-grid-input" @input="onGridInput">
      </label>
    </div>
  </div>
</template>

<style scoped>
/* Shadowing cleanup: parity `photos-places.scss:964-1025`
   (`.map-theme-pop` family) now governs almost every rule this component used to duplicate,
   for the same reason as PlacesFilterMenu.vue's identical cleanup (see that
   file's header comment for the full argument — same shadowing pattern, same chrome
   ruling, same hover-lock convention, not repeated verbatim here). Three things survive: */

/* Non-color structural necessity, no parity counterpart (same category as
   PlacesFilterMenu.vue's `.pfm-anchor`/`.pfm-chip-icon`). */
.mtm-anchor { position: relative; }
.mtm-chip-icon { vertical-align: -1px; }

/* `.mtp-dot` had NO geometry at all anywhere in
   this repo (grep-confirmed against parity's own photos-places.scss, which only styles
   `.mtp-swatch` itself) — only its `background` was ever bound (`:style="{ background:
   swatchColors(...).dot }"` in the template above), so with no width/height/shape it rendered
   as an invisible zero-size inline span: the reported "preset swatches render as
   near-empty dark squares (no visible dot)" report. Vue2 draws this same dot via an INLINE
   style object, not a CSS class at all (the Vue 2 panel's PhotosPlacesView.vue:1005, `<span :style="{
   position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width:
   '4px', height: '4px', borderRadius: '99px', background: ... }" />`) — no parity selector
   exists for New-UI's own `.mtp-dot` class to fall back to, so every non-color geometry
   property below is transcribed from that inline object (this component's `:style` binding on
   the same element only supplies `background`, matching Vue2's own split between the
   class/CSS-supplied geometry and the per-instance color). `.mtp-swatch`'s own parity rule
   already declares `position: relative` (photos-places.scss's own `.mtp-swatch`), which this
   absolutely-positioned dot needs as its containing block. */
.mtp-dot {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 4px; height: 4px;
  border-radius: 99px;
}

/* Surface-treatment ruling — REVERSED, same
   reversal as PlacesFilterMenu.vue's `.map-filter-pop` (see that file's full citation for the
   complete account): --popup-bg/--card-border/--card-shadow-hi are *global* New-UI tokens
   that only follow the app-wide `[data-theme]` attribute, never Photos' own private
   `.photos-root.is-light` toggle — this popover stayed dark under "Photos-light +
   app-global-dark", a reported "Map theme chips stay dark" defect. Restored to
   parity's own literal values: flat `--surface-2` + `--line` border + Vue2's own literal drop
   shadow (see that declaration's own theme-exception comment just below for the exact value,
   theme-invariant in Vue2 too so a plain literal is the precise parity value, not an
   approximation) — background/border are both Photos-local, is-light-aware tokens. */
.map-theme-pop {
  background: var(--surface-2);
  border: 1px solid var(--line);
  /* theme-exception: Vue2's own literal drop shadow (photos-places.scss, black at 60% alpha) —
     theme-invariant in Vue2 itself (same value in both of Photos' own themes), not a token
     substitution. */
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
}

/* New-UI-only hover affordance (verified absent from Vue2/parity: parity's own `.mtp-item`
   carries no `:hover` rule at all, only `.is-active`) + its cssCascade hover-lock variant,
   value copied from parity's own `.mtp-item.is-active` so hovering the active preset never
   flips its color. PlacesThemeMenu.test.ts's `winningHoverBackground` assertion pins this
   pair to this file's own `<style>` text (same convention as PlacesFilterMenu.test.ts), so
   it stays local rather than moving to parity. `--chip-bg` (global) was corrected
   to local `--surface-2`, same is-light rationale as `.map-theme-pop` above. */
.map-theme-pop .mtp-item:hover { background: var(--surface-2); }
.map-theme-pop .mtp-item.is-active:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
}

/* New-UI markup uses `<span class="mtp-body"><span class="mtp-name">…</span><span
   class="mtp-desc">…</span></span>` (inline elements); Vue2's own template
   (PhotosPlacesView.vue:1006-1011) uses `<div class="mtp-body"><div class="mtp-name">…
   </div><div class="mtp-desc">…</div></div>` — block elements that stack vertically for
   free. Parity's `.mtp-body { flex: 1; }` (photos-places.scss:1010) is a faithful port of
   Vue2's own rule (verified: Vue2 has no `display`/`flex-direction` on this selector
   either), so it does *not* stack New-UI's `<span>`s — this is a genuine, New-UI-only
   layout necessity caused by the tag-type difference, not a value to delete in favor of
   parity. */
.map-theme-pop .mtp-body { display: flex; flex-direction: column; }
</style>
