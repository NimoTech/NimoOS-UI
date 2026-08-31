<script setup lang="ts">
// SearchPeoplePopover.vue — search bar "people" filter popover.
// Structure corresponds to Vue2 PhotosSearchView.vue:93-122 (template), :435-447 (realPeopleList),
// :545-549 (filteredPeopleList). Styles correspond to photos.scss:2689-2694 (.face-* 6 rules,
// verified line-by-line) + reuses existing .fpop/.fpop-search/.fpop-foot shell (same as the
// list and date popovers, values copied from photos.scss).
//
// Dead code not ported: Vue2 people popover each cell avatar has
// two ternary expressions — when no cover, show first letter, else show a placeholder question mark
// character; name area same logic, when named show name, else show an "unnamed" message key. Vue2's
// realPeopleList (:438) already `.filter(p => p.name && p.name.trim())` filters unnamed people;
// "already named" is always true for the search popover candidate set — these two placeholder
// branches are dead code. New-UI's PersonOption (searchUnderstood.ts:11-16) only contains named
// people, doesn't even have a named field — no corresponding state to port; this file therefore
// does not contain that question mark literal, nor references that "unnamed" i18n key identifier
// (test uses reverse assertion to pin both; not repeating in comment to avoid hitting that assertion).
// That i18n key itself **not deleted**: the i18n key table was generated from Vue2's actual
// $t() usage; that key truly is used by Vue2 (just on a dead branch), so the table itself is
// correct; therefore this key is not deleted, and the key count is not changed.
//
// PersonAvatar reuse decision: this repo's existing PersonAvatar.vue
// (built in P5) has three-level fallback logic that highly overlaps with the needed "if cover show
// image / if no cover show first letter" semantics, but its showImg only checks
// personId!==null && !failed, doesn't check for actual cover — passing p.id directly would let
// "no cover" people still attempt an image request (waiting for onerror to fall back to first letter),
// not satisfying the required "no img attempt if not present" assertion. Here we use
// `personId = p.coverFaceId ? p.id : null` to reuse personId itself as the switch for "should try
// loading real image" — when personId is null, PersonAvatar goes straight to first-letter branch,
// makes no image request; semantically equivalent to Vue2's `v-if="p.coverFaceId"`, and needs no
// modification to PersonAvatar.vue.
//
// Deviation log (one previously unrecorded; a later correction fixed the gradient
// direction): PersonAvatar's first-letter fallback background uses `--avatar-fallback` token, while
// Vue2 `PhotosSearchView.vue:101-102` here uses a hard-coded two-color gradient (135 degree angle,
// starting light-purple tone, ending pink tone, not part of this repo's accent family) — color
// values differ; this is an inherited deviation from PersonAvatar reuse (the common fallback color
// was set when that shared component was built, outside this component's scope to change).
//
// Deviation log (an additive change): PersonAvatar sets `alt` to `name || ''`
// (component :103), while Vue2's `<img>` here is literal `alt=""` (:103 same line). Since New-UI's
// PersonOption always has non-empty name, reusing PersonAvatar makes each avatar image carry the
// person's name as alt text, better for screen readers than Vue2's empty alt; additive accessibility
// improvement from reusing a shared component, not deliberately new behavior — still
// recorded for completeness.
//
// PersonOption order contract (a hand-off note for downstream work): Vue2's realPeopleList
// (:435-447) ends with `.sort((a,b) => b.c - a.c)` descending by face count; popover grid render
// order depends on this sort. This component only passes through the `people` prop, does not sort
// itself — whoever assembles the `people` array must maintain this descending order, otherwise
// the popover order will not match Vue2.
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
    <!-- A 2026-08-13 rollback addendum: `.fpop`'s shape, size, position and focus
         ring all come from the bare `.fpop` rule in the parity scss
         (vue2-parity/photos.scss:2690-2726) and are no longer restated locally — parity's default
         width is the 320px shared by the list and date popovers, and this popover's only deviation
         is Vue2 `:94`'s inline `style="width:300px"`, which is likewise overridden with an inline
         style (rather than adding a scoped rule that changes one property; PhotosFilterPopover.vue's
         width prop already set the precedent, overriding via :style rather than a CSS class). -->
    <div class="fpop" style="width: 300px">
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
/* A 2026-08-13 rollback (the owner overturned the EXIF glass exception; this component was
   missed in that earlier round, and is brought in line here, matching the direction to
   "align their chrome to parity like the FilterChip/Popover treatment"): the whole colour rule set
   .fpop/.fpop-search(+:focus)/.face-pop-grid/.face-cell/.face-cell-name/.face-cell-count/
   .fpop-quick(+:hover)/.btn/.btn-primary(+:hover) has been removed wholesale from this
   component's scoped style and handed to the bare selectors in vue2-parity/photos.scss
   (:2690-2726; the .btn family goes through the global `.photos-root .btn` /
   `.photos-root .btn-primary` rules at :290-301) — this component no longer carries its own
   duplicate mapping onto the repo-wide glass semantics (--popup-bg/--card-border/
   --card-shadow-hi/--chip-bg/--fg-muted/--fg-subtle/--accent-text and friends), none of which
   `.photos-root` redefines locally, so they fell through to theme.css's global accent-toned
   glass values. `@keyframes pop-in` goes for the same reason — the parity scss already has a
   keyframe of that name. What stays here is only what parity does not cover:
   `.face-pop-empty` (Vue2 :110-112 is an inline style, not a class, so parity has no such
   selector), `.face-cell :deep(.person-avatar-ring)` (+ its [data-on] variant, the
   New-UI-only selection-ring treatment, reaching into PersonAvatar's own
   structure, with no parity counterpart), and `.fpop-foot` (+ its child selectors; Vue2's
   margin-top here is 14px, unlike the 12px of the List/Date popovers, and parity never had a
   `.fpop-foot` class at all, so there is nothing to hand over). */
.face-pop-empty {
  padding: 24px 8px;
  text-align: center;
  color: var(--text-3);
  font-size: 12px;
}

/* photos.scss:2691-2692's selection ring: this hangs off PersonAvatar's ring
   element via :deep rather than drawing the avatar itself, by deliberate choice. The base state pins the width at
   2px (instead of PersonAvatar's default 1px card-border) so selecting only swaps the colour
   without a width jump; the selected state switches to an accent stroke plus glow (0.20 alpha).
   A token correction: the glow used to reference a token defined globally in this
   repo's theme.css (never redefined locally on `.photos-root`), which belongs to a different
   hue family than the rest of this page's accent family (defined locally by parity) — the same
   "global token leaking into a parity page" problem as elsewhere in this task. It now uses the
   literal marked theme-exception below (Vue2's own value, character for character), rather
   than introducing a new token. */
.face-cell :deep(.person-avatar-ring) {
  border-width: 2px;
}
.face-cell[data-on="true"] :deep(.person-avatar-ring) {
  border-color: var(--accent);
  /* theme-exception: Vue2's own glow value character for character (the accent hue at 0.20
     alpha), handled the same way as the same-family literal on parity's transcribed
     .fchip[data-on] border — no new token introduced. */
  box-shadow: 0 0 0 2px rgba(110,91,255,0.20);
}

/* Vue2 :113's footer margin-top here is 14px, unlike the 12px in SearchDatePopover.vue (Vue2
   date popover :84) / PhotosFilterPopover.vue (Vue2 list popover :142) — the three footer
   rules are each declared independently; parity has no `.fpop-foot` class of its own, so
   there is no merging or reuse to do. */
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
</style>
