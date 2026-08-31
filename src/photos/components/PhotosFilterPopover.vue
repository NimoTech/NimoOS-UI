<script setup lang="ts">
// PhotosFilterPopover.vue — list-style filter popover primitive (one of two shared list-popover primitives).
// Structurally matches Vue2 PhotosSearchView.vue:124-147's list popover. Compared line-for-line against
// PhotosFilterBar.vue:25-63 (corrected wording below; an earlier version said "the only substantive difference",
// which wasn't accurate): there are actually two real value
// differences — ① the scroll container's max-height: 280px on the search side, 260px on the FilterBar side, this
// component follows the search side and hardcodes 280 (the 260 discrepancy is logged as follow-up work to
// decide whether to add a prop); ② the `.fpop` inline width: 260 on the search side, 240 on the FilterBar side — this
// one is already absorbed by this component's `width` prop (the interface already accounted for both numbers),
// so it isn't a functional difference, it just shouldn't be overshadowed by that word "only". The remaining surface
// differences (two hardcoded strings for the empty-state copy vs. a single source, the type-specific $t(it) conversion
// vs. passing it straight through, the cancelPop argument) are already flattened at New-UI's interface layer with the
// emptyHint / labelFor props, and aren't structural differences.
//
// props.selected must never be mutated in place — toggle() always emits a new array (porting Vue2 toggleDraftItem's
// (:741-747) immutable style, immer-style `{ ...draft, [key]: ... }`, here it's the array version of the same
// filter/spread-literal idea), a test pins down that "the reference content of the passed-in array is not push/spliced".
//
// Equivalence log for clearing search on every popover open: Vue2's togglePop() (:783-793) explicitly does
// `this.popSearch = ''`; this component's search is an internal ref, and doesn't accept a host-supplied value. The
// host remounts this component fresh via v-if each time, so the internal ref naturally returns to its initial value
// '' — equivalent semantics to Vue2's explicit clear, and the host doesn't need to, and shouldn't, maintain its own
// search state (otherwise there'd be two sources of truth).
//
// No portal/Teleport, no close-on-outside-click/Esc (a deliberate decision) — both of those are
// handled by the host at the container-ref level; this component only does @click.stop on its root node to keep
// clicks inside the popover from bubbling up into the host's "click outside" detection logic (structure mirrors
// Vue2's `<div v-if="..." @click.stop>` outer + `.fpop` inner two levels).
//
// The max-height discrepancy (280 on search / 260 on FilterBar, see module
// comment ① above) was originally logged as follow-up work to decide whether to add a prop, and was never wired up — the
// component kept hardcoding 280. Wired up here — added a maxHeight prop (default 280, doesn't change existing
// consumers' existing behavior), following the same "inline-style override" pattern the width prop already uses
// (:style rather than a hardcoded CSS declaration), with the FilterBar side explicitly passing 260 to hit Vue2's value.
//
// Rollback (overturning an earlier decision to keep New-UI's glassmorphism look for the
// EXIF pill/popover): glass is invisible under the light theme, the decision was to
// revert the glass and fall back to Vue2's original opaque panel styling — a pure styling change, the component's
// Vue3 code is unchanged. The style block below is therefore split in two:
// ① `.fpop`/`.fpop-title`/`.fpop-search` (+:focus)/`.fpop-quick` (+:hover)/`.btn`/
// `.btn-primary` (+:hover) — vue2-parity/photos.scss already has line-for-line matching bare selectors for these
// class names (:2662-2704, and `.btn`/`.btn-primary` go through the global `.photos-root .btn` family :262-273) —
// this whole half is deleted, handed off to the parity/global rules.
// ② `.fpop-list`/`.fpop-item` (+:hover/[data-active]/child icon)/`.fpop-item-icon`/
// `.fpop-empty`/`.fpop-foot` (+combinator selectors) — parity scss has none of these classes (confirmed via grep:
// `.fpop-item`/`.fpop-list`/`.fpop-empty`/`.fpop-foot` all get zero hits in the whole file): Vue2's original list
// popover (PhotosSearchView.vue:129-140) uses inline style + the `.nav-item`/`.nav-icon` classes (reused elsewhere) at
// this level, and never extracted a `.fpop-item`-level class of its own — this is an abstraction New-UI built for
// reuse at the time, which parity naturally doesn't cover; kept here, just switching the color tokens from this
// repo's generic glassmorphism semantics (--fg-muted/--fg/--fg-faint/--chip-bg-hi/--accent-text) back to Vue2
// photos.scss's actual values at the corresponding spot: --text-2/--text-1/--text-3/--surface-3/--accent-hi (values
// follow .photos-root's local definitions, present for both dark/is-light).
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
    maxHeight?: number
    multiple?: boolean
    labelFor?: (item: string) => string
  }>(),
  {
    width: 260,
    maxHeight: 280,
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

// Ported from Vue2 filteredPopItems (:778-782): empty search → return items as-is; otherwise a case-insensitive
// substring match. No trim — Vue2's original doesn't trim either, and this doesn't add it on its own initiative
// (that would be a behavior change, not a port).
const filtered = computed(() => {
  if (!search.value) return props.items
  const q = search.value.toLowerCase()
  return props.items.filter((i) => i.toLowerCase().includes(q))
})

function isSel(it: string): boolean {
  return props.selected.includes(it)
}

// Ports the semantics of Vue2 toggleDraftItem (:741-747), expressing single/multi-select through a unified
// selected: string[]: multiple → array add/remove, returns a new array (never mutates props.selected in place);
// !multiple → set to an empty array when already selected, a single-element array when not (corresponds to Vue2's
// single-value branch `v === it ? null : it`'s null/it two-state logic, here []/[it] expresses the same semantics so
// the host can consume it uniformly as an array).
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
      <div class="fpop-list" :style="{ maxHeight: `${maxHeight}px` }">
        <div
          v-for="it in filtered" :key="it" class="fpop-item"
          :data-active="isSel(it) ? 'true' : 'false'"
          @click="toggle(it)"
        >
          <span class="fpop-item-icon">
            <svg
              v-if="isSel(it)" width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent-hi)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
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
/* Rollback (see module comment above the script): the batch of Vue2-native class names —
   .fpop/.fpop-title/.fpop-search (+:focus)/.fpop-quick (+:hover)/.btn/.btn-primary (+:hover) — already has
   line-for-line matching rules in vue2-parity/photos.scss (the .fpop family is at :2662-2704, and the .btn family
   goes through the global `.photos-root .btn`/`.photos-root .btn-primary` (+:hover) family, :262-273, which applies
   app-wide, covering every button mounted under .photos-root, so this component doesn't need its own copy). This
   half of the scoped rules is deleted, handed off to the parity/global rules, no longer relying on the
   scoped-compiled [data-v-xxxx] attribute to win specificity. @keyframes pop-in is deleted for the same reason —
   parity scss already has a keyframes block of the same name (:881), and animation names live in a global
   namespace, unaffected by scoping. */

/* max-height is driven by the maxHeight prop's inline style (see the module comment above for how the
   280/260 discrepancy got wired up), only the structural declaration is left here. parity scss has no
   .fpop-list class (Vue2's original uses inline style here, and never extracted a class — see the same log on the
   .fpop-item family below), it's New-UI-specific, and stays here. */
.fpop-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

/* .fpop-item (+:hover/[data-active]/child icon) and .fpop-item-icon: zero hits in parity scss across the whole file
   (confirmed via grep) — Vue2's original list popover (PhotosSearchView.vue:129-137) uses `.nav-item`/`.nav-icon`
   (generic classes reused elsewhere) + inline style at this level, and never extracted a `.fpop-item`-specific
   class; this is an abstraction New-UI built at the time for a reusable component, which parity naturally doesn't
   cover. Structure/sizing kept as-is, only switching the color tokens back from this repo's generic glassmorphism
   semantics to the values Vue2 photos.scss's `.nav-item`/`.nav-icon` actually use at the corresponding spot
   (around :171-172/1192): --fg-muted→--text-2, --fg→--text-1, --fg-faint→--text-3, --chip-bg-hi→--surface-3,
   --accent-text→--accent-hi (--accent-soft is already a .photos-root-local token, its value is already Vue2's
   original, no rename needed). */
.fpop-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  position: relative;
}
.fpop-item:hover {
  background: var(--surface-3);
  color: var(--text-1);
}
.fpop-item[data-active='true'] {
  background: var(--accent-soft);
  color: var(--text-1);
}
/* hover specificity hard constraint (the third instance of this pattern in this area — an earlier pass only
   handled .fchip and .btn-primary, missing this one): .fpop-item[data-active="true"] un-hovered and .fpop-item:hover are both (0,2,0),
   the second occurrence in a scoped SFC of exactly this "equal specificity surviving only on source order" danger
   shape. The variant carries its own :hover (value = the un-hovered state, i.e. the selected state stays put under
   hover — this makes explicit the implicit semantics of Vue2's "active rule written after the hover rule, tie won
   by source order", no longer depending on order). This hover-lock logic is unrelated to the color mapping — the
   rollback above didn't touch its structure, it only followed the same token rename. */
.fpop-item[data-active='true']:hover {
  background: var(--accent-soft);
  color: var(--text-1);
}
.fpop-item[data-active='true'] .fpop-item-icon {
  color: var(--accent-hi);
}
.fpop-item-icon {
  color: var(--text-3);
  flex: none;
  display: flex;
  width: 16px;
  justify-content: center;
}

/* .fpop-empty/.fpop-foot (+combinator selectors), same log as above — parity has neither of these classes either
   (Vue2's original uses inline style, :138/:142), kept here, only the .fpop-empty text color token changed. */
.fpop-empty {
  padding: 18px 8px;
  text-align: center;
  color: var(--text-3);
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
</style>
