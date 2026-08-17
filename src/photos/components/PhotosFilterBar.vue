<script setup lang="ts">
// SP7-P7b-T2: PhotosFilterBar.vue — EXIF filter bar (funnel + three pills: year/location/camera).
// Line-for-line port of Vue2 NimoOS-UI src/views/Photos/PhotosFilterBar.vue (312 lines).
// The pill itself and the list-style popover reuse the two primitives built in P7a (D14): PhotosFilterChip / PhotosFilterPopover.
//
// Deviation log 1 (data source injected from outside): Vue2 reads
// `this.$store.getters['photos/displayMonths']` directly inside the component for the facet source, because in Vue2 it only
// has one mount point (the timeline toolbar). New-UI has two consumers with different data sources — the timeline page reads
// the timeline store, the drilldown page reads usePlaceAssets's one-shot result — so the facet source is instead injected by
// the host via the `photos` prop. A necessary deviation.
//
// Deviation log 2 (D19, chipKeys): Vue2 always shows all three pills. The drilldown page (/photos/places/:key) per D19
// shows only year + camera — tracing back to Vue2 PhotosTimeline.vue:167, the spot branch explicitly passes only
// years/cameras to applyExifFilters and drops places (the comment states outright "the city is already scoped, layering
// a location-text filter on top would misfire"), copying it verbatim would mean putting a dead pill that does nothing when
// clicked on a standalone page. chipKeys defaults to all three enabled; the timeline page doesn't pass it, matching Vue2.
//
// Deviation log 3 (F1, a Vue2 defect): Vue2's availYears (:99-102) puts
// `String(new Date(p.date).getFullYear())` straight into the Set — an unparseable date lands in the Set as the literal
// string "NaN"; but the filter predicate side goes through photoYear(), which returns an empty string ⇒ users can pick
// a NaN option from the dropdown that will never match anything. Here the facet side is switched to call that same
// photoYear(), skipping the empty string.
//
// Log 4 (the external trigger for auto-expand no longer exists in this repo): Vue2's anyActive watcher exists to catch
// the path where "jumping over from the places page pushes a value into activeFilters.places externally"; New-UI's city
// navigation goes through its own route page (D6), so the timeline's filter is never written from outside. The watcher
// and the mounted check are still ported as-is — "collapse after clear all, then restore a filter from elsewhere" is
// still meaningful along this component's own paths, and keeps behavior equivalent.
//
// No Esc-closes-popover: Vue2's own component has no keydown listener, and a strict 1:1 port doesn't add one on its own
// initiative (the Esc handling on the search page is that page's own structural spec 19, and doesn't spill over here).
//
// Plan B Task 5 (2026-08-12, "toolbar + FilterBar reskin"):
// ① Popover max-height: Vue2 PhotosFilterBar.vue:29 has an inline `max-height:260px`; the shared primitive
//   PhotosFilterPopover originally hardcoded a default of 280 (matching the search side), and the 260 discrepancy was
//   logged as "hand off to P7b/T16" — this task wires it up, adding a maxHeight prop passing 260 (see the matching log
//   at the top of PhotosFilterPopover.vue).
// ② The five classes .exif-filter/.exif-funnel/.exif-badge/.exif-chiprow/.exif-clear serve only this component
//   (confirmed via grep across the whole repo — zero other consumers), and the color tokens in the style block below
//   are changed back from the generic app tokens P7b wrote at the time (--fg/--chip-bg/--accent-soft-bd etc., which
//   resolve to the site's glassmorphism palette) to the Vue2 original's --surface-2/--text-1/2/3/--line-strong/
//   --accent-glow/--accent-hi token names — the `.photos-root` block in src/photos/styles/vue2-parity/photos.scss
//   (built by T3/T4 for Plan B, a line-for-line local dark-variant table matching Vue2 photos.scss) redefines this set
//   of names, and when P7b wrote this style block that file didn't exist yet (the component comment at the time also
//   said "--line-strong doesn't exist in this repo, confirmed via grep — zero hits" — that statement was true before
//   the parity scss landed, it no longer is). After switching back to the same-named tokens, the values follow
//   .photos-root's local definitions, matching Vue2 line-for-line — this isn't a newly invented palette.
//   .fchip/.fchip-wrap/.fchip-x (PhotosFilterChip.vue) and .fpop* (PhotosFilterPopover.vue)
//   are out of scope for this change — these two primitives are shared by six consumers at once, including
//   PhotosSearch/SmartView/Settings/the date and people popovers, so recoloring them uniformly is a cross-panel visual
//   decision that's out of scope for this task's "toolbar + FilterBar's two pills", and is logged as follow-up work
//   (see the concerns section of task-5-report.md).
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PhotosFilterChip from './PhotosFilterChip.vue'
import PhotosFilterPopover from './PhotosFilterPopover.vue'
import { photoYear, type FilterablePhoto } from '../util/photosFilterUtils'

export type ChipKey = 'years' | 'places' | 'cameras'
export interface ExifFilterValue {
  years: string[]
  places: string[]
  cameras: string[]
}

const props = withDefaults(defineProps<{
  filter: ExifFilterValue
  photos: FilterablePhoto[]
  chipKeys?: ChipKey[]
}>(), {
  chipKeys: () => ['years', 'places', 'cameras'],
})

const emit = defineEmits<{ (e: 'update:filter', v: ExifFilterValue): void }>()

const { t } = useI18n()

// chipKey → the array key for this dimension on filter (same name) + i18n label key + icon.
// Order follows Vue2 CHIPS (:74-78): year / location / camera.
const CHIP_DEFS: Array<{ key: ChipKey; labelKey: string; icon: 'clock' | 'map' | 'settings' }> = [
  { key: 'years', labelKey: 'photosFilterYear', icon: 'clock' },
  { key: 'places', labelKey: 'photosFilterLocation', icon: 'map' },
  { key: 'cameras', labelKey: 'photosFilterCamera', icon: 'settings' },
]

const rootRef = ref<HTMLElement | null>(null)
const openPop = ref<ChipKey | null>(null)
const draft = ref<Partial<Record<ChipKey, string[]>>>({})
let ovT: ReturnType<typeof setTimeout> | null = null

// ── facet: values that actually exist across the whole data source ────────────────────────────────────────
const availYears = computed(() => {
  const set = new Set<string>()
  props.photos.forEach((p) => {
    const y = photoYear(p) // F1: goes through the same predicate — an unparseable date returns an empty string → excluded from the list
    if (y) set.add(y)
  })
  return [...set].sort().reverse() // matches Vue2 :103 — reverse string sort = years newest to oldest
})

// Matches Vue2 facet() (:151-159): dedupe + localeCompare ascending (needed for correct sorting of accented/CJK names).
function facet(extract: (p: FilterablePhoto) => string): string[] {
  const set = new Set<string>()
  props.photos.forEach((p) => {
    const v = extract(p)
    if (v) set.add(v)
  })
  return [...set].sort((a, b) => a.localeCompare(b))
}
const availPlaces = computed(() => facet(p => (p.place ? p.place.split(',')[0].trim() : '')))
const availCameras = computed(() => facet(p => (p.camera ? p.camera.split('·')[0].trim() : '')))

const itemsByKey = computed<Record<ChipKey, string[]>>(() => ({
  years: availYears.value,
  places: availPlaces.value,
  cameras: availCameras.value,
}))

const chips = computed(() => CHIP_DEFS
  .filter(c => props.chipKeys.includes(c.key))
  .map(c => ({ ...c, label: t(c.labelKey), items: itemsByKey.value[c.key] })))

// The badge only counts "visible" dimensions (a direct consequence of D19): a dimension the user can't see, they also
// can't clear — counting it toward the badge would show the user a number they can't account for. All three pills are
// visible on the timeline page, matching Vue2.
const activeCount = computed(() =>
  chips.value.reduce((n, c) => n + (props.filter[c.key] || []).length, 0))
const anyActive = computed(() => activeCount.value > 0)

const emptyHint = computed(() =>
  openPop.value === 'places' ? t('photosSearchNoLocationDataYet') : t('photosSearchNothingHereYet'))

// Deviation log 5 (a filter value is already present at mount → the very first frame should already be expanded, no
// waiting for one async update): Vue2 assigns this.expanded inside the mounted() hook, and Vue2's reactive updates are
// likewise flushed asynchronously via nextTick — a Vue2 template test that doesn't await a tick simply wouldn't see this
// assignment either, it's just that the Vue2 project never had an equivalent "assert right at mount" unit test. Under
// Vue3 + @vue/test-utils, a re-render triggered by a ref change inside onMounted is only flushed on a microtask, so a
// test that asserts a class right after mount() without awaiting will read the pre-mount initial value (already
// verified with a minimal one-off repro: change a ref inside onMounted, assert without awaiting, and you can't observe
// it). This component requires that "a filter value is already present at mount → expand immediately" also hold at a
// call site that doesn't await, so expanded's initial value is taken directly from anyActive (props are already in
// place the instant mounting happens, so it can be computed synchronously) rather than relying on onMounted to set it
// true — onMounted still calls expand(), to re-arm the 450ms overflow-timer side effect (re-assigning a value that's
// already true doesn't trigger an extra render).
const expanded = ref(anyActive.value)
const overflowOpen = ref(false)

// ── expand / collapse (matches Vue2 :160-180) ────────────────────────────────────────────
function expand(): void {
  expanded.value = true
  // Keep chiprow clipped during the width transition, and only release overflow once the transition ends —
  // otherwise the pill's popover gets a corner clipped off mid-expand-animation.
  if (ovT) clearTimeout(ovT)
  ovT = setTimeout(() => { overflowOpen.value = true }, 450)
}
function collapse(): void {
  expanded.value = false
  overflowOpen.value = false
  openPop.value = null
  if (ovT) { clearTimeout(ovT); ovT = null }
}
function toggleExpand(): void {
  if (expanded.value) collapse()
  else expand()
}

watch(anyActive, (active) => { if (active && !expanded.value) expand() })
onMounted(() => { if (anyActive.value) expand() })

// ── pill / popover interaction (matches Vue2 :181-217) ───────────────────────────────────────
function chipActive(key: ChipKey): boolean {
  return (props.filter[key] || []).length > 0
}
function chipLabel(chip: { key: ChipKey; label: string }): string {
  const v = props.filter[chip.key] || []
  return v.length ? v.join(', ') : chip.label
}
function togglePop(key: ChipKey): void {
  if (openPop.value === key) {
    openPop.value = null
    return
  }
  openPop.value = key
  // Snapshot the already-committed value into the draft on open — edits never take effect before clicking "Apply".
  draft.value = { ...draft.value, [key]: [...(props.filter[key] || [])] }
}
function cancelPop(): void { openPop.value = null }
function applyPop(key: ChipKey): void {
  emitPatch({ [key]: [...(draft.value[key] || [])] })
  openPop.value = null
}
function clearChip(key: ChipKey): void { emitPatch({ [key]: [] }) }
function clearAll(): void {
  // Clear all three dimensions together (even ones whose pill is hidden by chipKeys) — a leftover value on a hidden
  // dimension should still be swept up by "Clear all"; leaving it behind would become a ghost filter the user can
  // neither see nor clear.
  emitPatch({ years: [], places: [], cameras: [] })
  openPop.value = null
}
function emitPatch(patch: Partial<ExifFilterValue>): void {
  emit('update:filter', { ...props.filter, ...patch })
}

// ── close popover on outside click ─────────────────────────────────────────────────────────────
// Vue2 (:136-142) unconditionally attaches a document listener in mounted, with an early return in the handler via
// `if (!this.openPop) return`. Here it's changed to this repo's existing convention (PhotosSearch.vue:522-530): only
// attach the listener while the popover is open, and detach it as soon as it closes. Behavior is equivalent, one
// fewer standing global listener.
function onDocMousedown(e: MouseEvent): void {
  const el = rootRef.value
  if (el && !el.contains(e.target as Node)) cancelPop()
}
watch(openPop, (v) => {
  if (v !== null) document.addEventListener('mousedown', onDocMousedown)
  else document.removeEventListener('mousedown', onDocMousedown)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  if (ovT) clearTimeout(ovT)
})
</script>

<template>
  <div ref="rootRef" class="exif-filter" :class="{ expanded, ov: overflowOpen }">
    <button
      type="button" class="exif-funnel" :class="{ on: expanded || anyActive }"
      :title="t('photosFilterByExif')" data-test="exif-funnel" @click="toggleExpand"
    >
      <!-- glyph copied character-for-character from Vue2 PhotosIcon.vue's name==='filter' branch; size=15. -->
      <svg
        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="M3 5h18l-7 9v6l-4-2v-4z" />
      </svg>
      <span v-if="activeCount" class="exif-badge" data-test="exif-badge">{{ activeCount }}</span>
    </button>

    <div class="exif-chiprow">
      <PhotosFilterChip
        v-for="chip in chips" :key="chip.key"
        :label="chipLabel(chip)" :active="chipActive(chip.key)" :open="openPop === chip.key"
        :data-test="'exif-chip-' + chip.key"
        @toggle="togglePop(chip.key)" @clear="clearChip(chip.key)"
      >
        <template #icon>
          <!-- glyph copied character-for-character from Vue2 PhotosIcon.vue's corresponding name branch; size is
               pinned to 13×13 by the primitive's .fchip-icon :deep(svg), so width/height aren't written here. -->
          <svg
            v-if="chip.icon === 'clock'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
          ><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          <svg
            v-else-if="chip.icon === 'map'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></svg>
          <svg
            v-else viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.8a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-.8-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-.8c.6.5 1.3.9 2 1.2L10 21h4l.5-2.5c.7-.3 1.4-.7 2-1.2l2.4.8 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
          </svg>
        </template>

        <PhotosFilterPopover
          v-if="openPop === chip.key"
          :title="chip.label" :items="chip.items" :selected="draft[chip.key] || []" :width="240"
          :max-height="260"
          :search-placeholder="t('photosSearchSearchLabel', { label: chip.label })"
          :empty-hint="emptyHint"
          @update:selected="(v) => (draft = { ...draft, [chip.key]: v })"
          @apply="applyPop(chip.key)" @cancel="cancelPop"
        />
      </PhotosFilterChip>

      <button
        v-if="anyActive" type="button" class="exif-clear" data-test="exif-clear-all"
        @click="clearAll"
      >{{ t('photosSearchClearAll') }}</button>
    </div>
  </div>
</template>

<style scoped>
/* Plan B Task 5's token approach (see module comment ② above): no longer mapped to generic app tokens, use
   the token names from Vue2 photos.scss's original text directly — at render time this resolves inside .photos-root, to
   the line-for-line local dark-variant table in src/photos/styles/vue2-parity/photos.scss that mirrors Vue2
   (--surface-2/--text-1/2/3/--line-strong/--accent-soft/--accent-glow/--accent-hi),
   so the values match Vue2, not a newly invented palette. The badge's `color: white` matches
   Vue2 PhotosFilterBar.vue:262's hardcoded value character-for-character (the same precedent as parity scss's own
   .btn-primary's `color: white` — parity scss is the exception zone that transcribes Vue2 CSS verbatim, and doesn't
   follow the site-wide "colors always go through tokens" rule; this follows that same precedent, it isn't this
   component opening its own loophole). */
.exif-filter {
  display: inline-flex;
  align-items: center;
  align-self: center;
  /* Pinned to the label pill's height, so this flex item doesn't stretch or misalign the toolbar row. */
  height: 32px;
  min-width: 0;
}
.exif-funnel {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 1px solid var(--line-strong);
  background: var(--surface-2);
  color: var(--text-2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s;
}
/* fix round 1 (review-mandatory 1, owner's call already made): Vue2's original
   NimoOS-UI/src/views/Photos/PhotosFilterBar.vue:251 only changes color/border-color,
   the background stays at --surface-2; a line `background: var(--chip-bg-hi)` had crept in here previously — a drift
   in the brief text itself, not a copying error — already removed per the "strictly 1:1 on visuals" hard rule, no
   deviation log added (this isn't an intentional deviation, it's a correction). */
.exif-funnel:hover {
  color: var(--text-1);
  border-color: var(--accent-glow);
}
.exif-funnel.on {
  background: var(--accent-soft);
  border-color: var(--accent-glow);
  color: var(--accent-hi);
}
/* hover specificity hard constraint: the base class .exif-funnel:hover is (0,2,0), and the variant .exif-funnel.on is
   also (0,2,0) — a tie, surviving only by source order (a shape that has bitten this area four times already). The
   variant carries its own :hover, with a value equal to the un-hovered .on state — i.e. "an already-active funnel
   keeps its accent look while hovered" — this is exactly the semantics Vue2 expressed implicitly by writing ".on
   after :hover", made explicit here. */
.exif-funnel.on:hover {
  background: var(--accent-soft);
  border-color: var(--accent-glow);
  color: var(--accent-hi);
}
.exif-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 9999px;
  background: var(--accent);
  color: white; /* theme-exception: Vue2 PhotosFilterBar.vue:262 hardcodes the same value, parity scss's own
  .btn-primary (photos.scss:272) already got the owner's sign-off on this same precedent — the badge sits on
  .photos-root's local purple accent, and doesn't participate in the site-wide theme switch */
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* Expands horizontally in place: clipped via max-width during the transition, and .ov releases overflow once
   the transition ends, so the pill's popover can spill outside the container. */
.exif-chiprow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 0;
  margin-left: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  transition: max-width 0.42s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s, margin-left 0.42s;
}
.exif-filter.expanded .exif-chiprow {
  max-width: 640px;
  margin-left: 8px;
  opacity: 1;
  pointer-events: auto;
}
.exif-filter.ov .exif-chiprow { overflow: visible; }
/* .fchip-wrap is PhotosFilterChip's root node — under scoped CSS a child component's root node also carries the
   parent component's scope attribute, so it can be selected directly here, no :deep() needed. */
.exif-chiprow .fchip-wrap {
  transform: translateX(-10px);
  opacity: 0;
  transition: transform 0.34s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
}
.exif-filter.expanded .exif-chiprow .fchip-wrap { transform: none; opacity: 1; }
.exif-filter.expanded .exif-chiprow .fchip-wrap:nth-child(1) { transition-delay: 0.06s; }
.exif-filter.expanded .exif-chiprow .fchip-wrap:nth-child(2) { transition-delay: 0.13s; }
.exif-filter.expanded .exif-chiprow .fchip-wrap:nth-child(3) { transition-delay: 0.2s; }
.exif-clear {
  flex-shrink: 0;
  padding: 0 10px;
  height: 30px;
  border: none;
  background: none;
  color: var(--text-3);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 9999px;
  transition: color 0.2s;
}
.exif-clear:hover { color: var(--text-1); }
</style>
