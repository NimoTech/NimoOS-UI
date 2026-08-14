<script setup lang="ts">
// Task 10 (SP7-P6a places/map main view): PlacesThemeMenu.vue — map toolbar "map theme" button +
// dropdown (4 presets + custom color pickers). Ported segment-by-segment from Vue2 NimoOS-UI
// src/views/Photos/PhotosPlacesView.vue:907-947 (template); color values/resolveMapTheme semantics
// already landed in that task to src/photos/util/placesMapThemes.ts, this component only consumes
// MAP_THEME_PRESETS + swatchColors, does not redefine colors or need resolveMapTheme/mapThemeStyleVars
// (those are PlacesMap.vue's for the map itself; this only draws preview swatches). Styling per photos-places.scss:964-1025.
//
// Write protocol (same as T9/T5/T8): props.selection must never mutate in place — always emit
// update:selection with the entire replaced new object. Pick preset: emit new selection (mapTheme
// only) + emit update:open(false) to close the layer. Color picker @input: emit new selection
// (mapTheme forced to 'custom' + corresponding color field updated, other unchanged), don't close
// the layer — per Vue2 :940/:944 `@input="mapTheme = 'custom'"`, the picker has no close action.
// Whether to actually call store.setMapTheme/setCustomColors to persist is T11 container's decision
// after catching these emits (brief rule 1: read can hit store, write goes via emit).
//
// isLight source (D5 signal replacement relative to Vue2): do not read the photos-private store,
// instead the caller (T11 container) passes it in by computing `theme === 'light'` from the
// reactive theme ref in global src/stores/theme.ts (that store is already reactive, no need for
// new MutationObserver — this component does not directly depend on any store, staying a pure
// props/emit presentational component).
//
// Floating layer spec (same pattern as T9 PlacesFilterMenu.vue): open is a prop, document-level
// mousedown (close on click outside) + keydown (close on Esc), watch(open) to attach/detach
// listeners, no stopImmediatePropagation. The only early exit in onDocKeydown is "skip non-Escape
// keys" — this component only manages one open state with no second branch to exit from, unlike
// the P5-T10 bug where two floating layers share a judgment function that missed the second
// branch's early exit; that scenario only emerges when T11 puts this component and PlacesFilterMenu
// into a container together; integration assertions belong to T11.
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MAP_THEME_PRESETS, swatchColors } from '../util/placesMapThemes'

export interface MapThemeSelection {
  mapTheme: string // 'default' | 'ocean' | 'sand' | 'mono' | 'custom'
  customDotColor: string
  customGridColor: string
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

function toggleOpen(): void {
  emit('update:open', !props.open)
}

// Vue2 :919 `@click="mapTheme = t.id; themeOpen = false"`.
function pickPreset(id: string): void {
  emit('update:selection', { ...props.selection, mapTheme: id })
  emit('update:open', false)
}

// Vue2 :940 `@input="mapTheme = 'custom'"` (v-model already handles writing the new
// customDotColor value, here two things emit together as one integral replacement object).
function onDotInput(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  emit('update:selection', { ...props.selection, mapTheme: 'custom', customDotColor: value })
}
// Vue2 :944, same as above but with customGridColor.
function onGridInput(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  emit('update:selection', { ...props.selection, mapTheme: 'custom', customGridColor: value })
}

// ── Floating layer spec: when open, attach document-level mousedown/keydown; watch(open) attaches/detaches ──────
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
          <svg
            v-if="selection.mapTheme === preset.id" class="mtp-check" data-test="mtm-check"
            viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--accent-text)"
            stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
          ><path d="m5 12 5 5L20 7" /></svg>
        </button>
      </div>

      <h6 class="mtp-title-custom">{{ t('photosPlacesMapThemeCustom') }}</h6>
      <label class="mtp-color-row">
        <span>{{ t('photosPlacesLandDotColor') }}</span>
        <input type="color" data-test="mtm-dot-input" :value="selection.customDotColor" @input="onDotInput">
      </label>
      <label class="mtp-color-row">
        <span>{{ t('photosPlacesCityLightColor') }}</span>
        <input type="color" data-test="mtm-grid-input" :value="selection.customGridColor" @input="onGridInput">
      </label>
    </div>
  </div>
</template>

<style scoped>
.mtm-anchor { position: relative; }

.map-chip {
  background: transparent;
  border: none;
  font: inherit; font-size: 12px; font-weight: 500;
  color: var(--fg-muted);
  padding: 5px 12px;
  border-radius: 99px;
  cursor: pointer;
}
.map-chip:hover { color: var(--fg); }
.mtm-chip-icon { vertical-align: -1px; }

/* Pop-up chrome (background/shadow): same decision as T9 PlacesFilterMenu.vue's .map-filter-pop —
   using this repo's standard "opaque floating menu/panel" tokens (--popup-bg + --card-shadow-hi),
   not precisely copying Vue2 photos-places.scss:969/974's gray background (--surface-2) + black
   shadow. Based on spec D3 and precedents (ContextMenu.vue/Dialog.vue/AlertDialog.vue/
   ClusterActionDialog.vue/AlbumPickerDialog.vue/PersonHero.vue dropdowns), detailed reasoning in
   PlacesFilterMenu.vue's decision comment; here reaffirming conclusion and maintaining consistency. */
.map-theme-pop {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 260px;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 12px;
  z-index: 30;
  box-shadow: var(--card-shadow-hi);
}
.map-theme-pop h6 {
  font-size: 10.5px;
  color: var(--fg-subtle);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 8px;
  font-weight: 600;
  line-height: 1.3;
}
.map-theme-pop .mtp-title-custom { margin-top: 14px; }

.map-theme-pop .mtp-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.map-theme-pop .mtp-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  color: var(--fg);
  font: inherit; font-size: 12px;
  cursor: pointer;
  text-align: left;
}
/* Vue2 doesn't give .mtp-item its own :hover (scss :986-996 only gives .is-active special
   background) — new per this repo's desktop convention (same as PlacesFilterMenu.vue :330). */
.map-theme-pop .mtp-item:hover { background: var(--chip-bg); }
.map-theme-pop .mtp-item.is-active {
  background: var(--accent-soft);
  border-color: var(--accent);
}
/* Variant has its own :hover (specificity (0,3,1) > base (0,2,1)): pointer on selected item
   won't lose base hover background — same cascade handling as PlacesFilterMenu.vue. */
.map-theme-pop .mtp-item.is-active:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.map-theme-pop .mtp-swatch {
  width: 24px; height: 24px;
  border-radius: 5px;
  border: 1px solid var(--card-border);
  flex-shrink: 0;
  position: relative;
}
.map-theme-pop .mtp-dot {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 4px; height: 4px;
  border-radius: 99px;
}
.map-theme-pop .mtp-body { flex: 1; display: flex; flex-direction: column; }
.map-theme-pop .mtp-name { font-weight: 500; }
.map-theme-pop .mtp-desc { font-size: 10.5px; color: var(--fg-subtle); margin-top: 1px; }
.map-theme-pop .mtp-color-row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 11.5px; color: var(--fg-muted);
  padding: 6px 0;
}
.map-theme-pop .mtp-color-row input[type="color"] {
  width: 36px; height: 24px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: transparent;
  padding: 0;
  cursor: pointer;
}
</style>
