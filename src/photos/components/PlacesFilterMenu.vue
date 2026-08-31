<script setup lang="ts">
// PlacesFilterMenu.vue — the map toolbar's "Filters" pill button + dropdown popover (four
// filter sections: time range/minimum photo count/continent/current-trip-only + chip badge
// count + reset/done). Ported section-by-section from Vue2 src/views/Photos/
// PhotosPlacesView.vue:830-906 (template, the chip and popover live in the same
// position:relative container), :152-186 (the visually-derived filter state
// anyExtraFilter/extraFilterCount, already implemented as the extraFilterCount pure function
// in placesMap.ts, consumed directly here), :329-336 (document mousedown open/close
// detection), :441-449 (toggleRegion/clearFilters); styles follow photos-places.scss:199-231
// (chip part) and :854-963 (popover part).
//
// props.filter must never be mutated in place — always emit update:filter with a whole new
// replacement object (a hard rule here, pinned by a test asserting the other fields match
// what was passed in).
//
// Overlay convention (a lesson learned the hard way earlier, plus the precedent already
// established in this repo by ClusterActionDialog.vue): Escape goes through a document-level
// keydown handler, attached/detached by a watch(open), without using
// stopImmediatePropagation (that would keep other overlay listeners on the same document from
// receiving the event at all — ClusterActionDialog uses plain stopPropagation instead, which
// doesn't affect other listeners on the same node, so this component simply doesn't call
// either, which is safer). A document mousedown handler is also added to detect clicks
// outside the container ref — Vue2's own file uses this same pattern (:329-336), just without
// an Escape listener; that part is a New-UI-side addition to the overlay convention.
// onDocKeydown has only one early return (skip non-Escape keys) — this component only manages
// a single open state, so there's no "other branch" to early-return from; the early-return bug
// seen elsewhere happens when two overlays share one predicate function and miss checking the
// second branch — that scenario only arises once this component and the theme popover are
// wired into the same container by later work, so the integration assertion for it belongs
// there; this pass only notes the risk here.
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { extraFilterCount, regionLabelKey, type PlacesFilter, type RegionCount } from '../util/placesMap'

// Cross-checked against Vue2 :865, no discrepancy found.
const MIN_COUNT_STEPS = [0, 10, 50, 100, 200] as const

const props = defineProps<{
  filter: PlacesFilter
  regions: RegionCount[]
  open: boolean
}>()
const emit = defineEmits<{
  (e: 'update:filter', next: PlacesFilter): void
  (e: 'update:open', open: boolean): void
}>()

const { t } = useI18n()

const rootRef = ref<HTMLElement | null>(null)

// ── Chip badge/active state (Vue2 :176-186, already implemented as the extraFilterCount pure
// function) ────────
const extraCount = computed(() => extraFilterCount(props.filter))
const badgeCount = computed(() => extraCount.value + (props.filter.timeFilter !== 'all' ? 1 : 0))
const chipActive = computed(() => extraCount.value > 0 || props.filter.timeFilter !== 'all')

// Deviation 3: continent names go through regionLabelKey, translated if a key exists, falling
// back to the backend label if not.
function regionLabel(r: RegionCount): string {
  const key = regionLabelKey(r.id)
  return key ? t(key) : r.label
}

function toggleOpen(): void {
  emit('update:open', !props.open)
}

// Vue2 :849/:854 — the whole time filter falls back to "all time" when only one end is filled
// in; it's only 'custom' when both ends are filled.
//
// Deviation (found from real-device testing feedback; a Vue2 defect, fixed correctly per the
// hard rule and recorded here rather than copied as-is): Vue2's two `<input type="date">`
// elements don't constrain each other, so a user can pick an inverted range where the end is
// before the start — filterPlaces would then filter out zero results for an inverted range,
// and the user sees an empty map with no clue why (both inputs look filled in). This repo
// fixes it two ways: first, the template's two inputs get native `:max`/`:min` constraints on
// each other (the native date picker simply won't let you pick an invalid value through the
// picker itself); second, the `timeFilter` predicate here is tightened from "both ends filled"
// to "both ends filled and customEnd >= customStart" (a user could still type an invalid value
// by hand, which the native constraint can't stop) — an invalid range is treated as "the range
// isn't filled in yet" and falls into the existing `timeFilter = 'all'` branch, rather than
// adding a third semantic state. The date strings are the fixed-length 'YYYY-MM-DD' format, so
// lexicographic string comparison is equivalent to chronological comparison, no `new Date()`
// parsing needed. It's ">=" not ">" — the same day on both ends is a valid single-day range.
function setStart(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  const end = props.filter.customEnd
  emit('update:filter', {
    ...props.filter,
    customStart: value,
    timeFilter: (value && end && end >= value) ? 'custom' : 'all',
  })
}
// Same deviation as setStart above, with customStart/customEnd swapped.
function setEnd(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  const start = props.filter.customStart
  emit('update:filter', {
    ...props.filter,
    customEnd: value,
    timeFilter: (start && value && value >= start) ? 'custom' : 'all',
  })
}
function setMinCount(v: number): void {
  emit('update:filter', { ...props.filter, minCount: v })
}
function setRegion(id: string | null): void {
  emit('update:filter', { ...props.filter, regionFilter: id })
}
// Vue2 :441's toggleRegion — clicking again clears it, not a one-way assignment.
function toggleRegion(id: string): void {
  emit('update:filter', { ...props.filter, regionFilter: props.filter.regionFilter === id ? null : id })
}
function toggleRecentOnly(): void {
  emit('update:filter', { ...props.filter, recentOnly: !props.filter.recentOnly })
}
// Vue2 :442-449's clearFilters — all six fields reset to their defaults, not a partial change
// from the current filter.
function resetFilters(): void {
  emit('update:filter', {
    timeFilter: 'all',
    customStart: '',
    customEnd: '',
    minCount: 0,
    regionFilter: null,
    recentOnly: false,
  })
}
// Done only closes the popover, it doesn't carry a filter change.
function done(): void {
  emit('update:open', false)
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
  <div ref="rootRef" class="pfm-anchor" data-test="pfm-root">
    <button
      type="button"
      class="map-chip"
      :class="{ 'is-active': chipActive }"
      data-test="pfm-chip"
      @click.stop="toggleOpen"
    >
      <svg class="pfm-chip-icon" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 9v6l-4-2v-4z" /></svg>
      {{ t('photosPlacesFilters') }}
      <span v-if="badgeCount" class="pfm-badge" data-test="pfm-badge">· {{ badgeCount }}</span>
      <svg class="pfm-chip-icon" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
    </button>

    <div v-if="open" class="map-filter-pop" data-test="pfm-pop">
      <div class="mfp-section">
        <h6>{{ t('photosPlacesTimeRange') }}</h6>
        <div class="mfp-date-row">
          <input
            type="date" :value="filter.customStart" :max="filter.customEnd || undefined"
            data-test="pfm-date-start" @input="setStart"
          >
          <span class="mfp-date-sep">—</span>
          <input
            type="date" :value="filter.customEnd" :min="filter.customStart || undefined"
            data-test="pfm-date-end" @input="setEnd"
          >
        </div>
        <div class="mfp-date-sub">
          <span>{{ t('photosPlacesStartDate') }}</span><span>{{ t('photosPlacesEndDate') }}</span>
        </div>
      </div>

      <div class="mfp-section">
        <h6>{{ t('photosPlacesMinPhotos') }}</h6>
        <div class="mfp-count-row">
          <button
            v-for="v in MIN_COUNT_STEPS" :key="v" type="button"
            :class="{ 'is-active': filter.minCount === v }"
            data-test="pfm-mincount-btn"
            @click="setMinCount(v)"
          >
            {{ v === 0 ? t('photosPlacesAny') : t('photosPlacesAtLeast', { n: v }) }}
          </button>
        </div>
      </div>

      <div class="mfp-section">
        <h6>{{ t('photosPlacesRegion') }}</h6>
        <div class="mfp-region-row">
          <button type="button" :class="{ 'is-active': !filter.regionFilter }" data-test="pfm-region-all" @click="setRegion(null)">
            {{ t('photosPlacesAll') }}
          </button>
          <button
            v-for="r in regions" :key="r.id" type="button"
            :class="{ 'is-active': filter.regionFilter === r.id }"
            data-test="pfm-region-btn" :data-region-id="r.id"
            @click="toggleRegion(r.id)"
          >
            {{ regionLabel(r) }}
          </button>
        </div>
      </div>

      <div class="mfp-section">
        <label
          class="mfp-checkbox" :class="{ 'is-on': filter.recentOnly }"
          data-test="pfm-recent-checkbox"
          @click.prevent="toggleRecentOnly"
        >
          <span class="mfp-tick" data-test="pfm-tick">
            <!-- `--on-accent` banned here (same precedent as
                 PlaceDetailPanel.vue's `.btn-primary`) — it's calibrated against New-UI's
                 *global* accent, which follows the app-wide theme, while `.mfp-tick.is-on`'s
                 background is Photos' own FIXED local `--accent` (theme-invariant purple,
                 never overridden by `.photos-root.is-light`, photos.scss:28/100). A checkmark
                 over a constant-purple chip needs a constant light stroke in both Photos
                 themes, not a token that could resolve dark and vanish. -->
            <svg v-if="filter.recentOnly" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7" /></svg>
          </span>
          <input type="checkbox" :checked="filter.recentOnly" style="display:none" tabindex="-1">
          <span class="mfp-checkbox-label">{{ t('photosPlacesCurrentTripOnly') }}</span>
        </label>
      </div>

      <div class="mfp-foot">
        <button type="button" class="mfp-reset" data-test="pfm-reset" @click="resetFilters">
          {{ t('photosPlacesFilterReset') }}
        </button>
        <button type="button" class="mfp-done" data-test="pfm-done" @click="done">
          {{ t('photosPlacesFilterDone') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Shadowing cleanup: parity `photos-places.scss:199-231` (chip)
   + `:854-963` (popover) now governs almost every rule this component used to duplicate —
   the deleted rules were structurally identical to parity and only diverged by pointing at
   global New-UI theme tokens (--fg-muted/--card-border/--chip-bg/--accent-text/--on-accent
   etc.) instead of the local `.photos-root`-scoped Vue2-precise tokens (--text-2/--line/
   --surface-3/--accent-hi/literal "white") that parity itself consumes — same shadowing bug
   as PhotosFilterChip.vue's own earlier fix and PlacesRail.vue's own cleanup for the identical issue.
   The old per-rule "token mapping" comment this replaces was that earlier state's own
   self-documentation, not a design requirement, so it goes with the rules it justified.
   `.map-filter-pop .mfp-date-row input`'s `color-scheme: dark` omission has been
   transcribed upstream into parity itself instead of staying a local override — see that
   rule in photos-places.scss for the updated citation.
   What survives below, and why:
   1. `.pfm-anchor`/`.pfm-chip-icon`/`.pfm-badge` — non-color structural necessities with no
      parity counterpart (Vue2 renders the badge text via an inline `style=` attribute on a
      bare `<span>`, not a class — same value, different mechanism, same pattern as parity's
      own `.places-cover-portal .cp-search-ic` New-UI-additions citation).
   2. `.map-filter-pop`'s background/border/box-shadow (a surface-treatment ruling, reviewed
      and upheld — the popover's own chrome, not its content, is New-UI's to reshape; see the
      full argument preserved below, still accurate).
   3. Three `:hover`/`.is-active:hover`/`.is-on:hover` pairs Vue2 never had at all (verified:
      parity's own `.mfp-count-row button` / `.mfp-region-row button` / `.mfp-checkbox` carry
      no `:hover` rule whatsoever) — desktop hover affordance this repo's convention requires,
      plus the cssCascade hover-lock variant so the affordance can't steal the `.is-active`/
      `.is-on` state's own background. PlacesFilterMenu.test.ts's three
      `winningHoverBackground`/substring assertions pin these to this file's own `<style>`
      text, so they stay local rather than moving to parity. */
.pfm-anchor { position: relative; }

/* Vue2 has no equivalent classes for either of these — the chip icon's baseline nudge and
   the badge's spacing/opacity are inline-style concerns in Vue2 (see `.pfm-badge` below),
   expressed here as classes instead because New-UI's markup uses raw `<svg>`/`<span>`. */
.pfm-chip-icon { vertical-align: -1px; }
/* Same value as Vue2's own inline `style="margin-left:4px;font-variant-numeric:tabular-nums;
   opacity:0.7"` on the badge `<span>` (PhotosPlacesView.vue:921) — different mechanism
   (class vs. inline style), not a different value. */
.pfm-badge { margin-left: 4px; font-variant-numeric: tabular-nums; opacity: 0.7; }

/* Surface-treatment ruling — REVERSED.
   The former "reviewed and upheld" note below (kept for history) argued for this repo's
   established floating-menu/panel chrome convention (--popup-bg / --card-shadow-hi) over
   Vue2's own flat grey + single shadow, on the basis that a popover's chrome is "component
   system / surface treatment", New-UI's side of that split. That argument assumed the
   substitute tokens were merely a *different-looking* convention; they are also *global*
   New-UI tokens that only follow the app-wide `[data-theme]` attribute, never Photos' own
   private `.photos-root.is-light` toggle (`usePhotosTheme()`) — so in the very common
   "Photos-light + app-global-dark" combination (dark is theme.css's default, no
   `data-theme="light"` attribute needed to hit it) this popover stayed dark regardless of
   Photos' own theme switch. That is a functional is-light bug, not a stylistic one, and a
   real-device testing report ("Filters / Map theme chips stay dark") is the
   real-device rejection the original note itself said would trigger this exact reversal.
   Restored to parity's own literal values (photos-places.scss's own `.map-filter-pop` rule):
   flat `--surface-2` + `--line` border + Vue2's own literal drop shadow (see that declaration's
   own theme-exception comment just below for the exact value) — Vue2 never themes this shadow
   either, same literal in both of Photos' own themes, so a plain literal is the precise parity
   value, not an approximation. Both the background and border are Photos-local tokens,
   correctly redefined under `.photos-root.is-light`.

   [Former note, superseded above, kept for history: "this deliberately uses this repo's
   established floating-menu/panel chrome convention (--popup-bg / --card-shadow-hi) rather
   than porting Vue2's flat opaque grey (--surface-2) + single box-shadow... if that's ever
   rejected on real-device review, the fix is two new tokens (--filter-pop-bg/
   --filter-pop-shadow) precisely replicating Vue2's own flat grey + single-alpha shadow
   (photos-places.scss:864), not reverting this rule." — real-device review rejected it; no
   new tokens were needed since parity's own local tokens already cover this exactly.] */
.map-filter-pop {
  background: var(--surface-2);
  border: 1px solid var(--line);
  /* theme-exception: Vue2's own literal drop shadow (photos-places.scss:867, black at 60%
     alpha) — theme-invariant in Vue2 itself (same value in both of Photos' own themes), not a
     token substitution. */
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
}

/* New-UI-only hover affordances (verified absent from Vue2/parity — see header comment).
   `.is-active:hover` variants exist solely to out-rank the base `:hover` rule's background
   (equal specificity would otherwise let source order decide, which this repo's convention
   treats as unreliable — see PlacesRail.vue's own citation of the same lesson); their values
   are copied from parity's own `.is-active` rules so hovering an active control never
   flips its color. `--chip-bg`/`--chip-bg-hi`/`--fg` (global) were corrected to
   local `--surface-2`/`--surface-3`/`--text-1`, same is-light rationale as `.map-filter-pop`
   above. */
.map-filter-pop .mfp-count-row button:hover { background: var(--surface-3); color: var(--text-1); }
/* theme-exception: literal text color below matches parity's own `.mfp-count-row
   button.is-active` (photos-places.scss), which is the same literal in both of Vue2's
   themes (theme-invariant) — kept in lockstep with that value, not a hardcoded escape. */
.map-filter-pop .mfp-count-row button.is-active:hover { background: var(--accent); color: white; }
.map-filter-pop .mfp-region-row button:hover { background: var(--surface-2); color: var(--text-1); }
.map-filter-pop .mfp-region-row button.is-active:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-hi);
}
.map-filter-pop .mfp-checkbox:hover { background: var(--surface-3); }
.map-filter-pop .mfp-checkbox.is-on:hover .mfp-tick {
  border-color: var(--accent);
  background: var(--accent);
}
</style>
