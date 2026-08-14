<script setup lang="ts">
// SP7-P7a-T12: PhotosFilterChip.vue — filter chip primitive (one of two primitives in D14, consumed by T13/T14/T16/P7b).
// Char-for-char correspondence to Vue2 PhotosSearchView.vue:51-59 (confirmed identical by char-by-char comparison
// with PhotosFilterBar.vue:16-24, only two differences: ① handler names clearFilter/clearChip ② component tag casing
// photos-icon/PhotosIcon, neither affects this repo's landing; full comparison conclusion in task-12-report.md).
// Structure: .fchip-wrap (position:relative, popup positioning context, default slot's popup is sibling not child —
// popup clicks don't pass through .fchip's click handler) → .fchip (:data-on, @click → toggle) contains icon slot +
// label + chevD icon + (when active) clear x → then default slot hosts popup.
//
// Deviation logging 1 (B7 decision, interface deviation from brief): brief's original interface is `{ icon: string }`,
// fed to shared PhotosIcon component's glyph name. This repo has no PhotosIcon.vue (confirmed by grep
// `find src -name "PhotosIcon.vue"` zero hits, this photos zone's established practice is each component inlines <svg>,
// precedent SmartViewCard.vue:76-88), string name consumed nowhere in this repo — if hardcoding name→svg map in this
// primitive, equals rebuilding a mini PhotosIcon, and T13/T14/T16/P7b will keep adding new glyphs. Decision: change icon
// from prop to named slot #icon, host inlines corresponding <svg> itself. chevD and x these two "chip fixed structure"
// glyphs (not varying with host) still self-inlined by this component, not in slot.
//
// Deviation logging 2 (glyph values 1:1 replica): below chevD `d="m6 9 6 6 6-6"`, x
// `d="m6 6 12 12M18 6 6 18"` copied char-by-char from Vue2 NimoOS-UI
// src/views/Photos/PhotosIcon.vue corresponding name branch (P6b final review caught 4 glyph omissions/miscopies,
// three-gate testing caught none), tests assert rendered <path d> precisely pinned.
//
// Deviation logging 3 (token mapping, controller decision B2): chevD color Vue2 original is var(--text-3)
// (PhotosSearchView.vue:55), not brief's --fg-subtle (that is text-4). This cycle's established
// four-tier mapping (SmartViewCreateDialog.vue:43-45) text-1→--fg / text-2→--fg-muted /
// text-3→--fg-faint / text-4→--fg-subtle, use --fg-faint here.
// (ClusterActionDialog.vue:368 maps text-3 to --fg-muted is P6b existing code, inconsistent with this cycle's table,
// but that is existing code not to be touched, also not basis for this task — this task follows T5's table.)
//
// open prop: Vue2 has no corresponding concept (chip's visual state only has data-on, no separate dimension of
// "is popup expanded"). brief's frozen interface carries this optional prop, passed through as-is here; specific
// consumption (whether to attach CSS hook) left to T13/T14/T16, avoiding inventing visual effects Vue2 doesn't have.
// fix round 1 · M4 (review Important batch finding): data-open only renders to DOM when open === true
// (:data-open="open ? 'true' : undefined"), not always — Vue2's .fchip has no such attribute at all, default state
// (open not passed or false) DOM should match Vue2 char-for-char, cannot randomly add data-open="false".
// Semantics (whether to attach styles) defined by T13, currently no CSS consumption.
defineProps<{
  label: string
  active: boolean
  open?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'clear'): void
}>()
</script>

<template>
  <div class="fchip-wrap">
    <div class="fchip" :data-on="active" :data-open="open ? 'true' : undefined" @click="emit('toggle')">
      <span class="fchip-icon"><slot name="icon" /></span>
      <span>{{ label }}</span>
      <svg
        class="fchip-chevd" width="11" height="11" viewBox="0 0 24 24" fill="none"
        stroke="var(--fg-faint)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
      <button v-if="active" type="button" class="fchip-x" @click.stop="emit('clear')">
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
        >
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
    <slot />
  </div>
</template>

<style scoped>
/* token mapping: Vue2 --surface-2/--surface-3 (solid chip bg/hover bg) → this repo's existing
   --chip-bg/--chip-bg-hi (same generic mapping precedent as ClusterActionDialog.vue/PhotosToolbar.vue/AlbumPickerDialog.vue);
   --line → --chip-border; --text-1/2/3 → --fg/--fg-muted/--fg-faint
   (four-tier table from deviation logging 3 above); --accent-hi (nonexistent, confirmed by grep) → --accent-text
   (same precedent as MergeReviewDialog.vue:249-252/PersonHero.vue:488-491); Vue2's border is a
   hardcoded accent purple, 30% opacity (not var(--accent-rgb) style, but same hue same opacity magnitude)
   → the existing three-tier accent family's closest to 30% opacity --accent-soft-bd (dark 3.6% / light 3%). */
.fchip-wrap {
  position: relative;
  display: inline-flex;
}
.fchip {
  height: 30px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 99px;
  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  color: var(--fg-muted);
  font-size: 12.5px;
  position: relative;
  cursor: pointer;
}
.fchip:hover {
  background: var(--chip-bg-hi);
  color: var(--fg);
}
.fchip[data-on='true'] {
  background: var(--accent-soft);
  border-color: var(--accent-soft-bd);
  color: var(--fg);
}
/* hover hard constraint (one of three places this task is constrained by this): base class .fchip:hover is (0,2,0),
   variant .fchip[data-on="true"] unhovered only (0,2,0) (class + attribute selector), equal ⇒ surviving by write order
   (P6a's second form of four incidents). T7 already fixed cssCascade.ts's classSpecificity —
   attribute selector now counts toward specificity, so variant with its own :hover is (0,3,0), solidly beats base,
   no need to change to companion class. Values replica unhovered [data-on] state, i.e. "selected state unchanged on hover". */
.fchip[data-on='true']:hover {
  background: var(--accent-soft);
  border-color: var(--accent-soft-bd);
  color: var(--fg);
}
.fchip[data-on='true'] .fchip-icon {
  color: var(--accent-text);
}
.fchip-icon {
  color: var(--fg-faint);
  display: flex;
}
/* fix round 1 · M3 (merged in review, affects four downstream T13/T14/T16/P7b): Vue2
   PhotosSearchView.vue:53 uses <photos-icon :name="chip.icon" :size="13"/>, i.e. svg
   width/height each 13px. After this component changes icon from string prop to #icon named slot, this size
   contract cannot be explained away in report text alone — use :deep(svg) to weld host-provided svg
   fixed at 13×13, regardless of svg size the host writes inline, rendering will be converged by this rule,
   not relying on downstream task to remember number 13. */
.fchip-icon :deep(svg) {
  width: 13px;
  height: 13px;
}
.fchip-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  margin-left: 2px;
  margin-right: -4px;
  color: var(--fg-faint);
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}
/* Vue2 uses a faint overlay following text color, 10% opacity for hover bg on transparent background
   (based on Vue2's own --ink text-color token at 10% opacity) — this repo has no --ink RGB triplet token,
   substitute semantically equivalent --hover defined in both themes (same precedent as PersonRelationsTab.vue:218
   .rel-row:hover). */
.fchip-x:hover {
  background: var(--hover);
  color: var(--fg);
}
</style>
