<script setup lang="ts">
// SP7-P7b-T2: PhotosFilterBar.vue — EXIF filter bar (funnel + year/location/camera three capsules).
// Verbatim correspondence to Vue2 NimoOS-UI src/views/Photos/PhotosFilterBar.vue (312 lines).
// Capsule body and list-type popover reuse two primitives built in P7a (D14): PhotosFilterChip / PhotosFilterPopover.
//
// Deviation registration 1 (data source external injection): Vue2 component reads directly
// from `this.$store.getters['photos/displayMonths']` to get facet source, because in Vue2 it has only one mount point
// (timeline toolbar). New-UI has two consumers with different data sources — timeline page reads timeline store, places detail page reads
// usePlaceAssets one-time result — so facet source changed to be injected by parent via `photos` prop. Necessary deviation.
//
// Deviation registration 2 (D19, chipKeys): Vue2 always shows all three capsules. Places detail page (/photos/places/:key) per D19 shows
// only year + camera — looking back at Vue2 PhotosTimeline.vue:167, spot branch explicitly only passes years/cameras to
// applyExifFilters and discards places (comment says "city is already framed, adding location text again would over-kill"), copying as-is would
// mean placing a dead, non-responding capsule on an independent page. chipKeys defaults to all three open, timeline page omits it to match Vue2.
//
// Deviation registration 3 (F1, Vue2 defect): Vue2 availYears (:99-102) uses
// `String(new Date(p.date).getFullYear())` to directly add to Set, encounters unparseable date adds literal
// "NaN"; while filter predicate side uses photoYear() returning empty string ⇒ user can pick a NaN option in dropdown that never matches.
// Here facet side changed to call the same photoYear(), skips empty string.
//
// Registration 4 (external trigger for auto-expand no longer exists in this repo): Vue2's anyActive watcher was to handle
// the path "when jumping from places page, external code writes values to activeFilters.places"; New-UI's city jump uses a separate
// route page (D6), timeline's filter won't be written externally. Watcher and mounted check still copied as-is — "clear all then collapse,
// then restore filters from elsewhere" type of self-initiated paths still make sense, and behavior is kept equivalent.
//
// Do not implement Esc to close popover: Vue2 this component has no keydown listener, 1:1 does not add it on our own (search page's Esc
// is its own structural spec 19, does not leak to here).
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

// chipKey → that dimension's array key on filter (same name) + i18n label key + icon.
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

// ── facet:整个数据源里真实存在的取值 ────────────────────────────────────────
const availYears = computed(() => {
  const set = new Set<string>()
  props.photos.forEach((p) => {
    const y = photoYear(p) // F1: use same predicate, unparseable date returns empty string → not added to list
    if (y) set.add(y)
  })
  return [...set].sort().reverse() // Per Vue2 :103, reverse string order = years from newest to oldest
})

// Per Vue2 facet() (:151-159): deduplicate + localeCompare ascending (accented/CJK names sort correctly).
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

// Badge counts only "visible" dimensions (direct consequence of D19): invisible dimensions user can neither see nor clear,
// counting them in badge would show user a number they can't account for. Timeline page all three capsules are visible, equivalent to Vue2.
const activeCount = computed(() =>
  chips.value.reduce((n, c) => n + (props.filter[c.key] || []).length, 0))
const anyActive = computed(() => activeCount.value > 0)

const emptyHint = computed(() =>
  openPop.value === 'places' ? t('photosSearchNoLocationDataYet') : t('photosSearchNothingHereYet'))

// Deviation registration 5 (mounted with filter value → first frame should already be expanded, don't wait for one async update):
// Vue2 assigns to this.expanded in mounted() hook, Vue2's reactivity update is also async nextTick — Vue2 template tests
// wouldn't see this assignment without awaiting tick, just Vue2 project has no equivalent mount-time assertion tests.
// Vue3 + @vue/test-utils: re-render triggered by ref change inside onMounted is queued to microtask flush,
// if test doesn't await after mount() and directly asserts class, reads the pre-mount initial value (verified with minimal reproduction case:
// change ref in onMounted, without await the assertion doesn't fire). This component requires "mounted with filter value → expand immediately"
// to hold even at call sites that don't await, so expanded's initial value takes anyActive directly (at mount time props is already in place,
// can be computed synchronously), doesn't depend on onMounted to set true — onMounted still calls expand()
// to supply the 450ms overflow timer side effect (when value is already true, re-assignment doesn't trigger extra renders).
const expanded = ref(anyActive.value)
const overflowOpen = ref(false)

// ── Expand / collapse (per Vue2 :160-180) ────────────────────────────────────────────
function expand(): void {
  expanded.value = true
  // During width transition, keep chiprow clipped, only release overflow after transition ends,
  // otherwise capsule popover gets clipped during expand animation.
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

// ── Capsule / popover interaction (per Vue2 :181-217) ───────────────────────────────────────
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
  // On open, snapshot committed value into draft — edits don't take effect until "apply" is clicked.
  draft.value = { ...draft.value, [key]: [...(props.filter[key] || [])] }
}
function cancelPop(): void { openPop.value = null }
function applyPop(key: ChipKey): void {
  emitPatch({ [key]: [...(draft.value[key] || [])] })
  openPop.value = null
}
function clearChip(key: ChipKey): void { emitPatch({ [key]: [] }) }
function clearAll(): void {
  // Clear all three dimensions together (even if some capsules are invisible per chipKeys) — leftover values on invisible dimensions
  // should also be swept away by "clear all", leaving them would become ghost filters user can neither see nor clear.
  emitPatch({ years: [], places: [], cameras: [] })
  openPop.value = null
}
function emitPatch(patch: Partial<ExifFilterValue>): void {
  emit('update:filter', { ...props.filter, ...patch })
}

// ── Click outside to close popover ─────────────────────────────────────────────────────────────
// Vue2 (:136-142) unconditionally attaches document listener in mounted, handler early-exits with `if (!this.openPop) return`
// inside. Here changed to use this repo's established convention (PhotosSearch.vue:522-530): only attach listener when popover is open, detach when closed.
// Behavior equivalent, one fewer permanent global listeners.
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
      <!-- glyph copied character-by-character from Vue2 PhotosIcon.vue name==='filter' branch; size=15. -->
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
          <!-- glyph copied character-by-character from Vue2 PhotosIcon.vue corresponding name branch; size fixed by primitive's
               .fchip-icon :deep(svg) hardcoded at 13×13, width/height not written here. -->
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
/* Token mapping (reuses the four-tier table at top of PhotosFilterChip.vue, not expanded here):
   Vue2 --surface-2 → --chip-bg · --text-1/2/3 → --fg/--fg-muted/--fg-faint ·
   --accent-hi → --accent-text · badge originally hardcoded pure white text → --on-accent.
   Vue2 --line-strong and --accent-glow don't exist in this repo (confirmed zero hits with grep theme.css):
   former takes --chip-border (same as existing judgment in PhotosFilterPopover.vue:273-281), latter takes
   --accent-soft-bd (accent family border tier, same as PhotosFilterChip.vue [data-on] border mapping). */
.exif-filter {
  display: inline-flex;
  align-items: center;
  align-self: center;
  /* Pinned to chip capsule height to prevent this flex item from pushing toolbar row taller or misaligning. */
  height: 32px;
  min-width: 0;
}
.exif-funnel {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 1px solid var(--chip-border);
  background: var(--chip-bg);
  color: var(--fg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s;
}
/* fix round 1 (review mandatory 1, human has decided): Vue2 source
   NimoOS-UI/src/views/Photos/PhotosFilterBar.vue:251 only changes color/border-color,
   background stays --surface-2 (→ --chip-bg) unchanged; previously an extra line was added here
   `background: var(--chip-bg-hi)`, was drift in the brief text itself, not a copy error — deleted per "UI must be exactly 1:1"
   iron rule, no deviation registration added (this is not intentional deviation, it's correction). */
.exif-funnel:hover {
  color: var(--fg);
  border-color: var(--accent-soft-bd);
}
.exif-funnel.on {
  background: var(--accent-soft);
  border-color: var(--accent-soft-bd);
  color: var(--accent-text);
}
/* hover hard constraint: base class .exif-funnel:hover is (0,2,0), variant .exif-funnel.on is also (0,2,0)
   — tie, survives by writing order (this area has had four failures of this pattern). Variant carries its own :hover, value equals
   non-hovered .on state, i.e. "active funnel keeps accent appearance on hover" — this is exactly the semantic implied in Vue2 by
   ".on written after :hover", made explicit here. */
.exif-funnel.on:hover {
  background: var(--accent-soft);
  border-color: var(--accent-soft-bd);
  color: var(--accent-text);
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
  color: var(--on-accent);
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* In-place horizontal expansion: during transition clip with max-width, after transition .ov releases overflow,
   so capsule popover can overflow the container. */
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
/* .fchip-wrap is PhotosFilterChip's root node — under scoped CSS child component root node also has parent component's
   scope attribute, so can select it directly here, no need for :deep(). */
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
  color: var(--fg-faint);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 9999px;
  transition: color 0.2s;
}
.exif-clear:hover { color: var(--fg); }
</style>
