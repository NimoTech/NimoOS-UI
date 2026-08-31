<script setup lang="ts">
// SearchDatePopover.vue — the search page's date popover (5 quick-range buttons + a real
// calendar; a third "shell" implementation beyond the two established overlay primitives).
// Structure corresponds to Vue2 PhotosSearchView.vue:61-91 (template), :755-777
// (setDraftDateQuick/shiftCalMonth/pickCalDay), :790-796 (togglePop's date branch). Styles
// correspond to photos.scss:2658-2688 (every declaration in that range has been individually
// cross-checked).
//
// Noted shell duplication (a deliberate decision: write it out plainly here rather than
// extracting a shared shell component): the `.fpop` / `.fpop-title` / `.fpop-quick` (+:hover) /
// `.btn` / `.btn-primary` shell duplicates roughly 8 declarations already present in
// PhotosFilterPopover.vue (.fpop, .fpop-title, .fpop-quick, .fpop-quick:hover, .btn,
// .btn:hover, .btn-primary, .btn.btn-primary:hover). This is an unavoidable cost of two
// independent popovers under scoped SFCs — this popover is "fixed 320px + calendar", the
// other is "width prop + search box + list"; the structures differ enough that extracting a
// shared component isn't a good fit (this repo's "no unrelated refactors" convention, plus
// only two overlay primitives having been established so far). Whether to extract a shared
// shell is left for a later end-to-end triage pass (this will be the 4th duplicate by the
// time the next similar component lands).
// Value sourcing: this file's .fpop/.fpop-quick/.btn family of values are all copied from
// Vue2's photos.scss directly, not from PhotosFilterPopover.vue's own file (that file made
// adjustments like turning width into a prop for its own list popover, and copying from it
// would contaminate the values here — this is exactly the cross-component pitfall worth
// flagging: that file's conclusion that width:320px is "always unreachable" holds true for
// its own list popover, but does not hold for this popover).
//
// Stale-comment cleanup: the paragraph that used to sit here described a
// generic New-UI glass token-mapping table (--text-1/2/3 → --fg/--fg-muted/--fg-faint, etc.)
// as this file's current design. That table stopped being true the moment the 2026-08-13
// owner reversal (see this file's own style-block comment below) deleted every scoped color
// rule in this component — the mapping paragraph was simply never updated to say so, leaving
// documentation describing a state the code had already left. Removed rather than "corrected
// in place" since there is nothing left to map: this component's style block carries zero
// `var(--...)` references now (parity supplies every color).
//
// Locale to BCP-47 conversion: rangeLabel/calDowLabels/calMonthLabel already do
// `locale.replace('_','-')` internally, so this component passes useI18n().locale.value
// straight through to them without converting it again.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  QUICK_KEYS,
  QUICK_LABEL_KEYS,
  quickRange,
  rangeLabel,
  calCells,
  calDowLabels,
  calMonthLabel,
  type DateRange,
  type CalCell,
  type QuickKey,
} from '../util/dateRange'

const props = defineProps<{
  draft: DateRange | null
  committed: DateRange | null
}>()

const emit = defineEmits<{
  (e: 'update:draft', v: DateRange | null): void
  (e: 'apply'): void
  (e: 'cancel'): void
}>()

const { t, locale } = useI18n()

// The calendar's displayed year/month is this component's own internal state, with its
// initial value determined by committed — following Vue2's togglePop()'s date branch
// (:790-796): if committed.end exists, use its year/month, otherwise use today. This is only
// a one-time initial value set at mount, not a reactive binding that keeps following
// committed — the host remounts this component with v-if every time the popover opens (the
// same established technique as PhotosFilterPopover.vue), which is equivalent to Vue2
// recomputing it every time togglePop runs.
function initCalYearMonth(): { y: number; m: number } {
  if (props.committed && props.committed.end) {
    const [y, m] = props.committed.end.split('-')
    return { y: Number(y), m: Number(m) - 1 }
  }
  const now = new Date()
  return { y: now.getFullYear(), m: now.getMonth() }
}
const init = initCalYearMonth()
const calYear = ref(init.y)
const calMonth = ref(init.m)

const dows = computed(() => calDowLabels(locale.value))
const cells = computed(() => calCells(calYear.value, calMonth.value, props.draft))
const monthLabel = computed(() => calMonthLabel(calYear.value, calMonth.value, locale.value))

// Follows Vue2 :81's class-string concatenation order (cal-cell -> blank -> in -> start -> end).
function cellClass(c: CalCell): string {
  return ['cal-cell', c.blank ? 'blank' : '', c.in ? 'in' : '', c.start ? 'start' : '', c.end ? 'end' : '']
    .filter(Boolean)
    .join(' ')
}

// Follows Vue2's setDraftDateQuick (:755-759). quickRange() already fills the input key into
// the returned DateRange.key (see dateRange.ts), so it doesn't need to be attached again here.
function setQuick(key: QuickKey): void {
  const rng = quickRange(key, new Date(), t(QUICK_LABEL_KEYS[key]))
  emit('update:draft', rng)
  const [y, m] = rng.end!.split('-')
  calYear.value = Number(y)
  calMonth.value = Number(m) - 1
}

// Follows Vue2's shiftCalMonth (:761-764) — uses `new Date(year, month+delta, 1)` to get the
// year/month, which naturally handles year rollover (December +1 -> next January, January -1
// -> previous December); don't rewrite this by hand-splitting into if branches.
function shiftMonth(delta: number): void {
  const d = new Date(calYear.value, calMonth.value + delta, 1)
  calYear.value = d.getFullYear()
  calMonth.value = d.getMonth()
}

// Follows Vue2's pickCalDay (:765-777).
// The DateRange built after a pick carries no key field — a custom range doesn't belong to
// any quick-range key, which is the precondition that makes the "data-on compares by key"
// predicate valid (see the file header).
function pick(c: CalCell): void {
  if (c.blank || !c.date) return
  const r = props.draft
  if (!r || !r.start || r.end) {
    // Starts a new single-day range (whether r doesn't exist / has no start / is already a
    // complete range — all three cases restart).
    emit('update:draft', { label: rangeLabel(c.date, c.date, locale.value), start: c.date, end: null })
  } else {
    // Completes the range; sorts the two endpoints, swapping if end < start.
    let start = r.start
    let end = c.date
    if (end < start) {
      const tmp = start
      start = end
      end = tmp
    }
    emit('update:draft', { label: rangeLabel(start, end, locale.value), start, end })
  }
}
</script>

<template>
  <div @click.stop>
    <div class="fpop">
      <div class="fpop-title">{{ t('photosSearchQuickRange') }}</div>
      <div class="fpop-row">
        <button
          v-for="k in QUICK_KEYS"
          :key="k"
          type="button"
          class="fpop-quick"
          :data-on="draft?.key === k ? 'true' : 'false'"
          @click="setQuick(k)"
        >{{ t(QUICK_LABEL_KEYS[k]) }}</button>
      </div>
      <div class="cal-head">
        <button
          type="button" class="cal-nav" :title="t('photosSearchPreviousMonth')"
          @click="shiftMonth(-1)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6" /></svg>
        </button>
        <span class="fpop-title" style="margin: 0">{{ monthLabel }}</span>
        <button
          type="button" class="cal-nav" :title="t('photosSearchNextMonth')"
          @click="shiftMonth(1)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>
      <div class="cal">
        <div v-for="(d, i) in dows" :key="'h' + i" class="cal-cell dow">{{ d }}</div>
        <div
          v-for="(c, i) in cells" :key="'c' + i"
          :class="cellClass(c)"
          :data-date="c.date"
          @click="pick(c)"
        >{{ c.blank ? '' : c.d }}</div>
      </div>
      <div class="fpop-foot">
        <button type="button" class="fpop-quick" @click="emit('cancel')">{{ t('photosCancel') }}</button>
        <button type="button" class="btn btn-primary" @click="emit('apply')">{{ t('photosSearchApply') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* A 2026-08-13 rollback (the machine owner overturned the EXIF-glass exception; this
   component had missed that rollback earlier and is brought in line here, matching the
   direction to "align their chrome to parity like the FilterChip/Popover treatment"): the
   whole batch of Vue2-native class names —
   .fpop/.fpop-title/.fpop-row/.fpop-quick(+:hover/[data-on])/.cal-head/.cal-nav(+:hover)/.cal/
   .cal-cell (+ every variant)/.btn/.btn-primary (+:hover, two rules) — already have
   verbatim-matching bare selectors in vue2-parity/photos.scss (:2690-2726, the .btn family
   goes through the global `.photos-root .btn`/`.photos-root .btn-primary` family at
   :290-301), with values that are Vue2's own original local tokens (--surface-2/3,
   --text-1/2/3, --line, --accent-soft, --accent-hi, etc., defined for both dark and
   .photos-root.is-light). This file used to duplicate each of them locally, mapping colors
   onto this repo's generic glass semantics (--popup-bg/--card-border/--card-shadow-hi/
   --chip-bg/--fg-muted/--accent-text, etc.) — none of those tokens are locally redefined by
   `.photos-root`, so they'd fall through to theme.css's global blue-purple glass values, and
   the only reason that color mismatch could "win" was the [data-v-xxxx] attribute scoped
   compilation adds, which pushed its specificity above parity's bare selectors. Deleting this
   duplication lets parity's bare rules take effect directly, with no need to borrow
   specificity from a data attribute anymore. `@keyframes pop-in` is deleted for the same
   reason — parity's scss already has a keyframe of the same name, and animation names live in
   a global namespace unaffected by scoping. `.cal-cell.muted` (Vue2 photos.scss:2685) has zero
   matches and no consumer in PhotosSearchView.vue's template; parity transcribed this dead
   CSS as-is, and this component doesn't redeclare it either, so it's unaffected. */

/* `.fpop-row`'s `flex-wrap: wrap` isn't a property Vue2/parity has (Vue2 photos.scss:2660's
   `.fpop-row` only has `display:flex;gap:6px;margin-bottom:6px`, no flex-wrap) — this is a
   New-UI-only additive fix: the 5 quick-range buttons would overflow a 320px-wide popover
   under some languages' button text if they didn't wrap, so this one declaration was kept
   during the rollback (keeping only the added property, leaving everything else to parity's
   bare `.fpop-row`). */
.fpop-row {
  flex-wrap: wrap;
}

.fpop-foot {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.fpop-foot .fpop-quick,
.fpop-foot .btn {
  flex: 1;
  justify-content: center;
}
</style>
