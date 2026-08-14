<script setup lang="ts">
// SP7-P7a-T14: SearchPeoplePopover.vue — search bar "people" filter popover.
// Structure corresponds to Vue2 PhotosSearchView.vue:93-122 (template), :435-447 (realPeopleList),
// :545-549 (filteredPeopleList). Styles correspond to photos.scss:2689-2694 (.face-* 6 rules,
// verified line-by-line) + reuses existing .fpop/.fpop-search/.fpop-foot shell (same as T12/T13,
// values copied from photos.scss).
//
// Dead code not ported (controller decision, C4/A-2): Vue2 people popover each cell avatar has
// two ternary expressions — when no cover, show first letter, else show a placeholder question mark
// character; name area same logic, when named show name, else show an "unnamed" message key. Vue2's
// realPeopleList (:438) already `.filter(p => p.name && p.name.trim())` filters unnamed people;
// "already named" is always true for the search popover candidate set — these two placeholder
// branches are dead code. New-UI's PersonOption (searchUnderstood.ts:11-16) only contains named
// people, doesn't even have a named field — no corresponding state to port; this file therefore
// does not contain that question mark literal, nor references that "unnamed" i18n key identifier
// (test uses reverse assertion to pin both; not repeating in comment to avoid hitting that assertion).
// That i18n key itself **not deleted**: T9's 54-key table was generated from Vue2's actual $t()
// usage; that key truly is used by Vue2 (just on dead branch), table itself is correct; therefore
// do not delete key, do not change T9 key count (controller decision, see task-14-report.md "C4").
//
// PersonAvatar reuse decision (C10, full rationale in report): this repo's existing PersonAvatar.vue
// (built in P5) has three-level fallback logic that highly overlaps with the needed "if cover show
// image / if no cover show first letter" semantics, but its showImg only checks
// personId!==null && !failed, doesn't check for actual cover — passing p.id directly would let
// "no cover" people still attempt an image request (waiting for onerror to fall back to first letter),
// not satisfying brief's required "no img attempt if not present" assertion. Here we use
// `personId = p.coverFaceId ? p.id : null` to reuse personId itself as the switch for "should try
// loading real image" — when personId is null, PersonAvatar goes straight to first-letter branch,
// makes no image request; semantically equivalent to Vue2's `v-if="p.coverFaceId"`, and needs no
// modification to PersonAvatar.vue.
//
// Deviation log (fix round 1 · M2, one previously unrecorded; fix round 2 · N4 corrects gradient
// direction): PersonAvatar's first-letter fallback background uses `--avatar-fallback` token, while
// Vue2 `PhotosSearchView.vue:101-102` here uses a hard-coded two-color gradient (135 degree angle,
// starting light-purple tone, ending pink tone, not part of this repo's accent family) — color
// values differ; this is an inherited deviation from PersonAvatar reuse (the common fallback color
// was set in P5, outside this task's scope to change).
//
// Deviation log (fix round 1 · M8, additive change): PersonAvatar sets `alt` to `name || ''`
// (component :103), while Vue2's `<img>` here is literal `alt=""` (:103 same line). Since New-UI's
// PersonOption always has non-empty name, reusing PersonAvatar makes each avatar image carry the
// person's name as alt text, better for screen readers than Vue2's empty alt; additive accessibility
// improvement from reusing shared component, not deliberately new behavior from this task — still
// recorded per discipline.
//
// PersonOption order contract (fix round 1 · M9, hand-off to downstream): Vue2's realPeopleList
// (:435-447) ends with `.sort((a,b) => b.c - a.c)` descending by face count; popover grid render
// order depends on this sort. This component only passes through `people` prop, does not sort itself
// — when T16 assembles the `people` array it must maintain this descending order, otherwise popover
// order will not match Vue2 (see task-14-report.md hand-off section).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PersonOption } from '../util/searchUnderstood'
import PersonAvatar from './PersonAvatar.vue'

const props = defineProps<{
  people: PersonOption[]
  selected: string[]
}>()

const emit = defineEmits<{
  (e: 'update:selected', v: string[]): void
  (e: 'apply'): void
  (e: 'cancel'): void
}>()

const { t, locale } = useI18n()

// BCP-47 conversion (established pattern in this repo, follows SmartViewCard.vue:38 precedent):
// locale is 'zh_cn'/'en_us' with underscore; passing directly to toLocaleString throws RangeError.
const localeTag = computed(() => locale.value.replace('_', '-'))

const search = ref('')

// Copy Vue2 filteredPeopleList (:545-549): empty search → return people as-is; else filter by
// name.toLowerCase().includes(...) case-insensitive, no trim (Vue2 as-is has no trim).
const filtered = computed(() => {
  if (!search.value) return props.people
  const q = search.value.toLowerCase()
  return props.people.filter((p) => p.name.toLowerCase().includes(q))
})

function isSel(name: string): boolean {
  return props.selected.includes(name)
}

// selected stores person names (copies Vue2 isDraftSelected('people', p.n)'s name-based comparison).
// Do not modify props.selected in place — emit new array (follows PhotosFilterPopover.vue's
// established immutable pattern).
function toggle(name: string): void {
  const next = isSel(name) ? props.selected.filter((x) => x !== name) : [...props.selected, name]
  emit('update:selected', next)
}

// Copy Vue2 Apply button text (:118): append ` (n)` when selected is not empty.
const applyLabel = computed(() => {
  const base = t('photosSearchApply')
  return props.selected.length > 0 ? `${base} (${props.selected.length})` : base
})
</script>

<template>
  <div @click.stop>
    <div class="fpop">
      <input
        v-model="search" class="fpop-search" data-test="people-search"
        :placeholder="t('photosSearchSearchPeople')"
      >
      <div v-if="filtered.length" class="face-pop-grid">
        <div
          v-for="p in filtered" :key="p.id" class="face-cell"
          :data-on="isSel(p.name) ? 'true' : 'false'" @click="toggle(p.name)"
        >
          <PersonAvatar
            :person-id="p.coverFaceId ? p.id : null" :name="p.name" :ver="p.coverFaceId"
            :size="48"
          />
          <div class="face-cell-name">{{ p.name }}</div>
          <div class="face-cell-count">{{ p.count.toLocaleString(localeTag) }}</div>
        </div>
      </div>
      <div v-else class="face-pop-empty" data-test="people-empty">
        {{ t('photosSearchNoPeopleDetectedYet') }}
      </div>
      <div class="fpop-foot">
        <button type="button" class="fpop-quick" data-test="people-cancel-btn" @click="emit('cancel')">
          {{ t('photosCancel') }}
        </button>
        <button type="button" class="btn btn-primary" data-test="people-apply-btn" @click="emit('apply')">
          {{ applyLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* .fpop/.fpop-search/.fpop-foot/.btn series shell duplicated with T12/T13 (see same-class
   registration in both files' headers): values all copied from photos.scss, not copied from
   sibling task files. This popover has fixed width 300 (not a prop — brief interface section
   gave no width prop; Vue2 only uses 300 here, unlike T12's list popover which differs per side
   and needs a prop). */
.fpop {
  position: absolute;
  top: 36px;
  left: 0;
  background: var(--popup-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  box-shadow: var(--card-shadow-hi);
  padding: 14px;
  width: 300px;
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

/* Follow photos.scss:2689-2694 line-by-line (6 rules, already verified with two-path audit). */
.face-pop-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  max-height: 264px;
  overflow-y: auto;
}
.face-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
/* photos.scss:2691's `.face-cell .face-avatar { width/height:48px; font-size:18px;
   border:2px solid transparent }` is handled by PersonAvatar(:size="48") + the selection ring
   rule below — 48×48 size already passed via prop, no need to repeat width/height here. font-size:18px
   is Vue2's inline first-letter size; PersonAvatar's own first-letter formula is size*0.32=15.36px
   (component precedent, not new to this task), about 2.6px difference from Vue2's 18px — deviation
   log: do not change PersonAvatar's existing formula (it's a P5 contract frozen across multiple
   consumers; changing it would affect other components using it); here the divergence is acceptable. */
.face-cell-name {
  font-size: 11.5px;
  color: var(--fg-muted);
}
.face-cell-count {
  font-size: 10px;
  color: var(--fg-subtle);
}
/* photos.scss:2691-2692's selection ring: C10 decision uses :deep to target PersonAvatar's
   ring element, does not draw avatar itself. Base state fixed 2px width (not PersonAvatar's
   default 1px card-border) so selected state only changes color without width jump; selected
   state switches to accent stroke + glow (0.20 alpha closest to --accent-soft-2; this repo
   has no per-component accent-rgb token, Global Constraints §33). */
.face-cell :deep(.person-avatar-ring) {
  border-width: 2px;
}
.face-cell[data-on="true"] :deep(.person-avatar-ring) {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft-2);
}

/* Vue2 :110-112's empty state inline style (padding:24px 8px; different from T12's .fpop-empty
   18px 8px — not the same class, values also differ — cannot reuse that class, establish a new one). */
.face-pop-empty {
  padding: 24px 8px;
  text-align: center;
  color: var(--fg-faint);
  font-size: 12px;
}

/* Vue2 :113's footer margin-top here is 14px, different from T13 `SearchDatePopover.vue`
   (Vue2 date popover :84) / T12 `PhotosFilterPopover.vue` (Vue2 list popover :142) at 12px
   (fix round 2 · N3 corrects pairing: previously had T12/T13 to :84/:142 mapping backwards;
   line-by-line declaration level two-path audit verified the true difference, not copy error)
   — the two footer rules each declared independently, not merged/reused. */
.fpop-foot {
  display: flex;
  gap: 8px;
  margin-top: 14px;
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
.btn:hover {
  background: var(--chip-bg-hi);
}
.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}
.btn.btn-primary:hover {
  background: var(--accent);
  filter: brightness(1.08);
}
</style>
