<script setup lang="ts">
// PhotosThreshSlider.vue — quality threshold slider primitive (range + three-level scale:
// loose/balanced/strict), extracted from SmartViewCreateDialog.vue.
//
// Root cause: an earlier scss read range of `:659-1013` didn't cover the actual slider rules in
// `photos-smartview.scss:543-563` (specificity (0,2,0), overrides single class `.sv-slider` in
// `photos.scss:2817`), so the first version only wrote `.sv-slider { width: 100% }`, the entire
// repo had zero `slider-thumb`/`accent-color` — on real devices it degraded to browser default gray
// controls. Already verified against source line-by-line for Vue2 active rules and ported verbatim
// (see style block comments below).
//
// Reason for extracting as a standalone component: the same 'range + three-level scale' markup is
// needed in three places — this dialog, the detail page's right-column threshold section, and the
// save-as-smart-view modal — markup identical in all three, so writing it as its own scoped SFC
// avoids repeating 14 lines of styles three times.
//
// ⚠ Contract frozen; other consumers rely on this exact signature — don't change it casually:
//   props: { value: number; min?: number; max?: number }   // default min 50 / max 99
//   emits: (e: 'input', v: number): void                    // immediate, no debounce (throttling is consumer's responsibility)
// Following Vue2 `:113-114` convention: range uses :value + @input, not v-model.
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{ value: number; min?: number; max?: number }>(), {
  min: 50,
  max: 99,
})
const emit = defineEmits<{ (e: 'input', v: number): void }>()

const { t } = useI18n()

function onInput(e: Event): void {
  emit('input', Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <input
    type="range" :min="props.min" :max="props.max" :value="props.value" class="sv-slider"
    data-test="pts-range" @input="onInput"
  >
  <div class="sv-slider-marks">
    <span>{{ t('photosSvLoose') }}</span><span>{{ t('photosSvBalanced') }}</span><span>{{ t('photosSvStrict') }}</span>
  </div>
</template>

<style scoped>
/* Line-by-line copy from Vue2 photos-smartview.scss:543-563 (actual effective rules, specificity (0,2,0), overrides
   single class .sv-slider in photos.scss:2817; controller already verified against source line-by-line). Summary of Vue2 original values (not quoting
   full declarations to avoid literal color functions in comments): track is a gradient bar with appearance:none (left side
   accent at 25% opacity, right side accent solid), thumb is 18px circle, white background, 2px accent border,
   accent shadow halo at 40% opacity. This repo doesn't have per-RGB-component accent token (Global
   Constraints §33), the two semi-transparent accent uses proxy to existing --accent-soft-2 (dark .24 / light .20, closer than --accent-soft's
   .14/.11 to Vue2's original .25/.4 magnitude). */
.sv-slider {
  appearance: none;
  width: 100%;
  height: 6px;
  background: linear-gradient(to right, var(--accent-soft-2), var(--accent));
  border-radius: 99px;
  outline: 0;
  /* fix round 1 · M1 (task-8 review batch finding, controller-authorized supplement): Vue2 `photos.scss:2817`'s
     low-specificity bare `.sv-slider` attaches `cursor: pointer` to the track itself, not overridden by high-specificity rules,
     still merges and takes effect — previously only the thumb pseudo-element had the pointer cursor, the track itself was missing. */
  cursor: pointer;
}
.sv-slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  /* theme-exception: slider dot is light color across themes, layered over accent gradient track + accent border, doesn't use
     --on-accent — in dark theme it's deep navy, loses the 'white dot' legibility needed here (this is Vue2's
     intentional design, not a semantic color that changes with theme). */
  background: white;
  border: 2px solid var(--accent);
  box-shadow: 0 2px 8px var(--accent-soft-2);
  cursor: pointer;
}
/* Vue2 only wrote webkit prefix; on Firefox it degrades to default control — this supplements Vue2's gap, not a copy
   (entry: this line doesn't exist in Vue2 source, New-UI proactively filled it in; vendor-prefixed selectors must be declared independently to take effect, can't
   rely on comma-merging selector lists, else the whole rule fails on both engines). */
.sv-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  /* theme-exception: same light color rationale as ::-webkit-slider-thumb above. */
  background: white;
  border: 2px solid var(--accent);
  box-shadow: 0 2px 8px var(--accent-soft-2);
  cursor: pointer;
}
.sv-slider-marks {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--fg-subtle);
  margin-top: 4px;
}
</style>
