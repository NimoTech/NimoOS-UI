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
/* Shell duplication with T12's PhotosFilterPopover.vue (see file header registry): .fpop series +
   .fpop-quick + .btn series. Values copied verbatim from photos.scss:2658-2674, not from T12 file. */
.fpop {
  position: absolute;
  top: 36px;
  left: 0;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  box-shadow: var(--card-shadow-hi);
  padding: 14px;
  width: 320px;
  z-index: 10;
  animation: pop-in 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: default;
  text-align: left;
}
@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
  }
}

.fpop-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--fg-faint);
  letter-spacing: 0.06em;
  margin-bottom: 10px;
}

.fpop-row {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.fpop-quick {
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 99px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  color: var(--fg-muted);
  cursor: pointer;
}
.fpop-quick:hover {
  background: var(--accent-soft);
  color: var(--accent-text);
  border-color: var(--accent-soft-bd);
}
/* Hover hard constraint (A7): Vue2 original (photos.scss:2674) writes :hover and [data-on="true"]
   in the same rule, sharing the same values — when splitting here, both sides must match exactly
   (copy the :hover line above, not create a separate set). Base :hover and [data-on="true"] (not
   hovered) have equal specificity (both 0,2,0: one class + one pseudo-class / one class + one
   attribute selector); the variant must carry its own :hover to maintain the selected state when
   'hovering over an already-selected quick button', not be overridden by base hover. */
.fpop-quick[data-on='true'] {
  background: var(--accent-soft);
  color: var(--accent-text);
  border-color: var(--accent-soft-bd);
}
.fpop-quick[data-on='true']:hover {
  background: var(--accent-soft);
  color: var(--accent-text);
  border-color: var(--accent-soft-bd);
}

.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  margin-bottom: 2px;
}

.cal-nav {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--fg-muted);
  background: transparent;
  border: 0;
  transition: all 0.2s;
}
.cal-nav:hover {
  background: var(--chip-bg-hi);
  color: var(--fg);
}

.cal {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-top: 12px;
}
.cal-cell {
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.cal-cell.dow {
  color: var(--fg-faint);
  font-size: 10.5px;
  font-weight: 600;
  cursor: default;
  height: 22px;
}
.cal-cell:hover {
  background: var(--chip-bg-hi);
}
/* Hover hard constraint (A7; this component's most concentrated case of this constraint):
   .cal-cell:hover and the three variants .in/.start/.end all have equal specificity (all 0,2,0:
   one class + one pseudo-class / two classes). Vue2 relies on source code order (variants written
   after hover) to keep the selected state unoverridden when hovering — in scoped SFC this
   'order-dependent' approach should not be relied on; each of the three variants adds its own
   :hover with values equal to the existing state when not hovered (i.e., selected state unchanged
   when hovering). */
.cal-cell.in {
  background: var(--accent-soft);
  color: var(--fg);
  border-radius: 0;
}
.cal-cell.in:hover {
  background: var(--accent-soft);
  color: var(--fg);
}
/* .start / .end are accent solid bottom + white text scenarios — --on-accent is legitimate use here
   (background is indeed var(--accent) saturated solid). */
.cal-cell.start {
  background: var(--accent);
  color: var(--on-accent);
  border-radius: 6px 0 0 6px;
}
.cal-cell.start:hover {
  background: var(--accent);
  color: var(--on-accent);
}
.cal-cell.end {
  background: var(--accent);
  color: var(--on-accent);
  border-radius: 0 6px 6px 0;
}
.cal-cell.end:hover {
  background: var(--accent);
  color: var(--on-accent);
}
.cal-cell.start.end {
  border-radius: 6px;
}
.cal-cell.blank {
  cursor: default;
  pointer-events: none;
}
.cal-cell.blank:hover {
  background: transparent;
}
/* .cal-cell.muted (Vue2 photos.scss:2685) has zero grep hits in PhotosSearchView.vue template,
   no consumers — dead CSS, not migrated (A4; counter-assertion in tests). */

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

.btn {
  height: 32px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  color: var(--fg);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
}
.btn:hover {
  background: var(--chip-bg-hi);
}
.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}
/* Same as T12's established pattern (same as ClusterActionDialog.vue/MergeReviewDialog.vue):
   .btn:hover is (0,2,0), overrides single class .btn-primary (0,1,0), replaces accent solid with
   --chip-bg-hi on hover — the variant carries its own :hover to restore the accent solid. */
.btn.btn-primary:hover {
  background: var(--accent);
  filter: brightness(1.08);
}
</style>
