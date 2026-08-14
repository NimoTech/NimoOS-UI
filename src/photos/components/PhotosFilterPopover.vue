<script setup lang="ts">
// SP7-P7a-T12: PhotosFilterPopover.vue — list-type filter popover primitive (one of two primitives
// in D14). Structure corresponds to Vue2 PhotosSearchView.vue:124-147 list popover. Character-by-
// character comparison with PhotosFilterBar.vue:25-63 (full conclusion in task-12-report.md,
// fix round 1 · M9 corrected wording — previously said "only structural difference", inaccurate):
// actual numeric differences in two places — ① scroll container max-height: search side 280px,
// FilterBar side 260px; using search side as reference, this component hard-codes 280 (260
// difference delegated to P7b/T16 to decide whether to open prop); ② `.fpop` inline width:
// search side 260, FilterBar side 240 — already absorbed by this component's `width` prop
// (brief interface section already provided both numbers), does not constitute functional
// difference, just should not be covered by the word "only". Remaining surface differences (empty
// state message source two hardcodes vs single source, type-specific $t(it) transform vs direct
// pass, cancelPop parameter) already unified at New-UI interface layer with emptyHint / labelFor
// two props, not structural differences.
//
// props.selected must not be modified in-place — toggle() always emits a new array (copy Vue2's
// toggleDraftItem :741-747 immutable pattern, immer-style `{ ...draft, [key]: ... }`; array
// version here is filter/spread literal), test pins down "incoming array reference content not
// mutated by push/splice".
//
// Search clear-on-popover-open equivalence registration: Vue2 togglePop()(:783-793) explicitly
// `this.popSearch = ''`; this component's search is an internal ref, not accepted from host. Host
// remounts this component via v-if each time; internal ref naturally resets to initial value ''
// — equivalent semantics to Vue2's explicit clear, host does not need to and should not maintain
// search state itself (else two sources of truth).
//
// No portal/Teleport, no outside-click/Esc close (explicit P6a decision + brief Step 4) — both
// handled uniformly by the host (T16) at the container ref level; this component only uses
// @click.stop at root to prevent internal clicks from bubbling to host's "outside click" logic
// (structure parallels Vue2 `<div v-if="..." @click.stop>` outer layer + `.fpop` inner layer).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    title: string
    items: string[]
    selected: string[]
    searchPlaceholder: string
    emptyHint: string
    width?: number
    multiple?: boolean
    labelFor?: (item: string) => string
  }>(),
  {
    width: 260,
    multiple: true,
  },
)

const emit = defineEmits<{
  (e: 'update:selected', v: string[]): void
  (e: 'apply'): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()

const search = ref('')

// Copy Vue2 filteredPopItems(:778-782): if search empty → return items as-is; else case-insensitive
// contains match. No trim — Vue2 doesn't trim either, don't add it unilaterally (that's behavior
// change, not porting).
const filtered = computed(() => {
  if (!search.value) return props.items
  const q = search.value.toLowerCase()
  return props.items.filter((i) => i.toLowerCase().includes(q))
})

function isSel(it: string): boolean {
  return props.selected.includes(it)
}

// Copy Vue2 toggleDraftItem(:741-747) semantics; use unified selected: string[] to express both
// single/multiple: multiple → add/remove from array, return new array (don't mutate props.selected
// in-place); !multiple → selected becomes empty array, unselected becomes single-element array
// (corresponds to Vue2's single-value branch `v === it ? null : it` null/it two-state; here []/
// [it] express the same semantics so host can uniformly consume as array).
function toggle(it: string): void {
  if (props.multiple) {
    const next = isSel(it) ? props.selected.filter((x) => x !== it) : [...props.selected, it]
    emit('update:selected', next)
  } else {
    emit('update:selected', isSel(it) ? [] : [it])
  }
}
</script>

<template>
  <div @click.stop>
    <div class="fpop" :style="{ width: `${width}px` }">
      <div class="fpop-title">{{ title }}</div>
      <input v-model="search" class="fpop-search" :placeholder="searchPlaceholder">
      <div class="fpop-list">
        <div
          v-for="it in filtered" :key="it" class="nav-item"
          :data-active="isSel(it) ? 'true' : 'false'"
          @click="toggle(it)"
        >
          <span class="nav-icon">
            <svg
              v-if="isSel(it)" width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-text)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
            >
              <path d="m5 12 5 5L20 7" />
            </svg>
          </span>
          <span>{{ labelFor ? labelFor(it) : it }}</span>
        </div>
        <div v-if="filtered.length === 0" class="fpop-empty">{{ emptyHint }}</div>
      </div>
      <div class="fpop-foot">
        <button type="button" class="fpop-quick" @click="emit('cancel')">{{ t('photosCancel') }}</button>
        <button type="button" class="btn btn-primary" @click="emit('apply')">{{ t('photosSearchApply') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Token mapping (same as four-tier table in PhotosFilterChip.vue comment + chip-bg/chip-border
   family; not expanding again). Popover's own background/border/shadow follows established
   convention for this repo's "trigger button + absolutely-positioned dropdown panel" component
   class — --popup-bg (opaque base) + --card-border + --card-shadow-hi; precedents: CloudActionDialog
   .vue:272-280(.cad-panel), AlbumPickerDialog.vue, PlacesFilterMenu.vue(.map-filter-pop; that
   file contains complete deviation log; conclusion matches here: Vue2 uses --menu-bg + backdrop-
   filter blur + pure box-shadow; this repo's "opaque panel anchored atop page content" class
   uniformly uses --popup-bg/--card-shadow-hi group, does not replicate blur — popup-bg is
   already (nearly) opaque, no blur needed for readability; backdrop-filter therefore omitted,
   not missed in porting). */
.fpop {
  position: absolute;
  top: 36px;
  left: 0;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  box-shadow: var(--card-shadow-hi);
  padding: 14px;
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

.fpop-search {
  width: 100%;
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  color: var(--fg);
  font: inherit;
  font-size: 12px;
  margin-bottom: 10px;
}
.fpop-search:focus {
  outline: 0;
  border-color: var(--accent-soft);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

/* Vue2's inline style max-height inconsistent between sides (search side 280px / FilterBar side
   260px; see character-by-character comparison conclusion in module comment above) — using search
   side as reference, set to 280. */
.fpop-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  color: var(--fg-muted);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  position: relative;
}
.nav-item:hover {
  background: var(--chip-bg-hi);
  color: var(--fg);
}
.nav-item[data-active='true'] {
  background: var(--accent-soft);
  color: var(--fg);
}
/* Hover hard constraint (B4's third fix; brief text only named .fchip and .btn-primary, missed
   this): .nav-item[data-active="true"] unhovered and .nav-item:hover both (0,2,0), scoped SFC
   exactly the second dangerous form of "equal specificity rely on source order for survival".
   Variant includes self :hover (value = existing state when not hovered, i.e., selected state
   persists on hover — this makes explicit Vue2's implicit "active rule after hover rule, tie won
   by source order" semantic; no longer source-order dependent). */
.nav-item[data-active='true']:hover {
  background: var(--accent-soft);
  color: var(--fg);
}
.nav-item[data-active='true'] .nav-icon {
  color: var(--accent-text);
}
.nav-icon {
  color: var(--fg-faint);
  flex: none;
  display: flex;
  width: 16px;
  justify-content: center;
}

.fpop-empty {
  padding: 18px 8px;
  text-align: center;
  color: var(--fg-faint);
  font-size: 12px;
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

.fpop-quick {
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 99px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  color: var(--fg-muted);
  cursor: pointer;
}
/* This component's Cancel button does not carry data-on (that's for T13 date popover shortcut-
   range button) — brief Step 3 clearly demarks: this task only ensures base-class hover exists;
   [data-on] variant hover handling deferred to T13. Handoff (brief error 2 found by review; T13
   needs this): brief describes here as "base-class overrides variant" danger form, but source
   photos.scss:2674 doesn't support it — Vue2 original is `.fpop-quick:hover, .fpop-quick[data-
   on="true"] { … }` single rule, two selectors share exactly same value set; no two different
   sets exist, no "override" at all. When T13 adds [data-on="true"] variant, values should copy
   this :hover rule, not define separate set. */
.fpop-quick:hover {
  background: var(--accent-soft);
  color: var(--accent-text);
  border-color: var(--accent-soft-bd);
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
/* Vue2 .btn:hover also carries border-color: var(--line-strong) — this repo lacks this stronger-
   emphasis line token (grep confirmed theme.css has no --line-strong); existing --chip-border
   value level already quite close; these two are secondary reasons for omission. Stronger reason
   (brief error 4 found by review; real case where "don't copy Vue2 bugs" porting discipline
   applies): `.photos-root .btn:hover { border-color: var(--line-strong) }` is (0,3,0) (.photos-
   root ancestor class + .btn + :hover), overrides `.photos-root .btn-primary { border-color:
   var(--accent) }` (0,2,0) — meaning in Vue2 original, primary button (.btn.btn-primary) on
   hover, border shifts from accent purple back to neutral line; this is Vue2's own cascade-
   coupling defect, not design intent. This component does not replicate this border declaration;
   that's not "omitted something that should copy", but deliberately not copying this bug. */
.btn:hover {
  background: var(--chip-bg-hi);
}
.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}
/* Hover hard constraint (one of three this task subject to): .btn:hover (0,2,0) overrides
   single-class .btn-primary (0,1,0); on hover, accent solid background swapped for --chip-bg-hi
   while text stays --on-accent (white/dark teal) → button and text both disappear. Variant
   includes :hover to restore accent solid, same as existing correct pattern in ClusterActionDialog
   .vue:331-332(.cad-btn-primary:hover)/MergeReviewDialog.vue:269 — background and filter in two
   separate declarations, avoid tainting by disabled state (this component has no disabled state,
   but reuse same pattern for consistency). */
.btn.btn-primary:hover {
  background: var(--accent);
  filter: brightness(1.08);
}
</style>
