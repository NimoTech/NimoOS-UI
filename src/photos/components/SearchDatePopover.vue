<script setup lang="ts">
// SP7-P7a-T13: SearchDatePopover.vue — date search popover (5 quick range buttons + real calendar; D14
// the 3rd 'shell' implementation outside the popover primitives). Structure corresponds to Vue2
// PhotosSearchView.vue:61-91 (template), :755-777 (setDraftDateQuick/shiftCalMonth/pickCalDay),
// :790-796 (togglePop date branch). Styles correspond to photos.scss:2658-2688 (each line in the
// range verified one by one; see task report 'two-pronged audit').
//
// Shell duplication registry (controller decision: write as-is for this task, no shared shell
// component extracted): `.fpop` / `.fpop-title` / `.fpop-quick` (+:hover) / `.btn` / `.btn-primary`
// — this shell duplicates a copy in T12's PhotosFilterPopover.vue, ~8 declarations total (.fpop,
// .fpop-title, .fpop-quick, .fpop-quick:hover, .btn, .btn:hover, .btn-primary,
// .btn.btn-primary:hover). This is an inevitable cost under scoped SFC with two independent popovers
// — this one is 'fixed 320px + calendar', T12 is 'width prop + search box + list'; structures differ
// and are not suitable for sharing (repo 'no unrelated refactoring' rule + D14 only froze two
// primitives). Whether to extract a shared shell is left to the full review panel (T14 onwards
// will be the 4th duplicate).
// Value sources: all .fpop/.fpop-quick/.btn series values in this file are copied verbatim from
// Vue2 photos.scss, not from T12 file (T12's version has width prop adjustments for the list
// popover, copying would cause mixing — this is the lesson from brief A1's cross-task pitfall:
// T12's determination that width:320px is 'forever unreachable' applies to the list popover but
// not to this one).
//
// Token mapping (generic table consistent with T12/PlaceDetailPanel and other existing precedents,
// not repeated for each): --text-1/2/3 → --fg/--fg-muted/--fg-faint; --surface-2/3 →
// --chip-bg/--chip-bg-hi; --line → --chip-border; --menu-bg → --popup-bg; --accent-hi (does not
// exist in this repo) → --accent-text; rgba(110,91,255,0.30) (accent 30% border) →
// --accent-soft-bd.
//
// Locale to BCP-47 (A2): T9's rangeLabel/calDowLabels/calMonthLabel internally do
// `locale.replace('_','-')`, this component passes useI18n().locale.value as-is to them, no
// duplicate conversion.
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

// The year-month displayed by the calendar is component-internal state; its initial value is
// determined by committed — copied from Vue2's togglePop() date branch (:790-796): if
// committed.end exists take its year-month, otherwise take today. This is only a one-time
// initial value at mount, not a reactive binding that continuously follows committed — the
// host (T16) remounts this component with v-if every time the popover opens (same technique as
// T12's PhotosFilterPopover.vue), equivalent to Vue2 recalculating each time togglePop is called.
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

// Copy Vue2's class concatenation order (:81: cal-cell → blank → in → start → end).
function cellClass(c: CalCell): string {
  return ['cal-cell', c.blank ? 'blank' : '', c.in ? 'in' : '', c.start ? 'start' : '', c.end ? 'end' : '']
    .filter(Boolean)
    .join(' ')
}

// Copy Vue2's setDraftDateQuick (:755-759). quickRange() already fills in the input key to the
// return value's DateRange.key (T9 revision, see dateRange.ts); no need to splice it again here.
function setQuick(key: QuickKey): void {
  const rng = quickRange(key, new Date(), t(QUICK_LABEL_KEYS[key]))
  emit('update:draft', rng)
  const [y, m] = rng.end!.split('-')
  calYear.value = Number(y)
  calMonth.value = Number(m) - 1
}

// Copy Vue2's shiftCalMonth (:761-764) — use `new Date(year, month+delta, 1)` to get year-month,
// naturally handles year boundary (December +1 → next year January, January -1 → previous year
// December); do not manually split into if branches and rewrite.
function shiftMonth(delta: number): void {
  const d = new Date(calYear.value, calMonth.value + delta, 1)
  calYear.value = d.getFullYear()
  calMonth.value = d.getMonth()
}

// Copy Vue2's pickCalDay (:765-777). The newly created DateRange after pick does not carry a key
// field — custom ranges do not belong to any quick key, which is the precondition for the
// 'data-on uses key comparison' criterion to hold (see file header + task report 'A3').
function pick(c: CalCell): void {
  if (c.blank || !c.date) return
  const r = props.draft
  if (!r || !r.start || r.end) {
    // Open a new single-day range (r doesn't exist / no start / already complete range; all three cases restart).
    emit('update:draft', { label: rangeLabel(c.date, c.date, locale.value), start: c.date, end: null })
  } else {
    // Complete the range; sort endpoints, swap if end < start.
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
/* 2026-08-13 rollback (the owner overturned the EXIF glass exception; Fix-3 item 7 follow-up —
   this component was missed in that round, and the brief names it explicitly: "align their
   chrome to parity like the FilterChip/Popover treatment"): the whole batch of Vue2-native
   class names .fpop/.fpop-title/.fpop-row/.fpop-quick(+:hover/[data-on])/.cal-head/
   .cal-nav(+:hover)/.cal/.cal-cell(+ every variant)/.btn/.btn-primary(+ both :hover rules)
   already have character-for-character bare selectors in vue2-parity/photos.scss (:2690-2726;
   the .btn family goes through the global `.photos-root .btn` / `.photos-root .btn-primary`
   rules at :290-301), whose values are Vue2's own local tokens (--surface-2/3, --text-1/2/3,
   --line, --accent-soft, --accent-hi and so on, defined in both the dark block and the
   .photos-root.is-light block). This file used to carry a duplicate of each, mapped onto the
   repo-wide glass semantics (--popup-bg/--card-border/--card-shadow-hi/--chip-bg/--fg-muted/
   --accent-text and friends) — none of which `.photos-root` redefines locally, so they fell
   through to theme.css's global accent-toned glass values, and the [data-v-xxxx] attribute
   that scoped compilation adds pushed them above the parity bare selectors, which is the only
   reason that mismatched colour set could win at all. Dropping the duplicate lets the parity
   rules apply directly, with no attribute-driven specificity boost needed. `@keyframes pop-in`
   goes for the same reason — the parity scss already has a keyframe of that name, and
   animation names live in a global namespace that scoped compilation does not touch.
   `.cal-cell.muted` (Vue2 photos.scss:2685) has zero hits in PhotosSearchView.vue's template
   and no consumer at all; parity transcribed that dead CSS, this component never repeated the
   declaration, and nothing here changes. */

/* `.fpop-row`'s `flex-wrap: wrap` is not a property Vue2/parity has (Vue2 photos.scss:2660's
   `.fpop-row` carries only `display:flex; gap:6px; margin-bottom:6px`, no flex-wrap) — it is a
   New-UI-only additive fix: without wrapping, the five quick-range buttons overflow a 320px-wide
   popover under some languages' button copy. The rollback keeps this one declaration (only the
   addition stays; everything else goes to parity's bare `.fpop-row`). */
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
