<script setup lang="ts">
// The Apple-style vertical stepper -- ⬆ / current-
// moment label / ⬇, floating outside the scaled real window's right edge. Ported from Vue2's
// `.tm-stepper` region (the Vue 2 panel's src/components/filebrowser/components/TimeMachineStage.vue,
// including the up/down-swap fix described below) -- see that file's own header comment and its
// template/style-block comments on `.tm-stepper` for the full derivation this file ports).
//
// This component owns ONLY the visible control (shape/geometry/disabled state) and its two emits --
// it does NOT decide when stepping is possible or what "later"/"earlier" mean in terms of snapshot
// index. TimeMachineStage.vue's own `stepLater`/`stepEarlier` (which also drive its keyboard handler
// -- see that file's own header comment) already own that
// logic and the SAME `clampStepIndex`-derived boundary check the keyboard handler uses; this
// component's `canLater`/`canEarlier` props are fed from two small computeds TimeMachineStage.vue
// derives from that exact same call, so there is exactly one notion of "can we step" shared by the
// keyboard, the stepper's own `:disabled`, and any future caller -- not three independently
// maintained copies.
//
// Direction mapping is Vue2's OWN swapped-and-final state (2026-07 user report, "the up/down keys
// are reversed" -- ported verbatim, not the pre-fix mapping): ⬆ emits `later` (steps to the next
// MORE RECENT snapshot, Vue2's own `stepLater`), ⬇ emits `earlier` (steps to the next OLDER one,
// `stepEarlier`). The prop names `canLater`/`canEarlier` intentionally mirror that same vocabulary
// so the mapping from prop to button to emit reads in one direction without a mental flip anywhere
// in this file.
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'TimeMachineStepper' })

defineProps<{
  /** Humanized current moment, e.g. "Today 14:30" -- Vue2's own `selectedMomentText`. */
  label: string
  /** Whether ⬆ (step to a MORE RECENT snapshot) is currently possible. */
  canLater: boolean
  /** Whether ⬇ (step to an OLDER snapshot) is currently possible. */
  canEarlier: boolean
}>()

const emit = defineEmits<{ (e: 'later'): void; (e: 'earlier'): void }>()

const { t } = useI18n()
</script>

<template>
  <div class="tm-stepper">
    <button
      type="button"
      class="tm-stepper-btn tm-stepper-btn-up"
      :disabled="!canLater"
      :aria-label="t('tmStepLater')"
      :title="t('tmStepLater')"
      @click="emit('later')"
    >
      <!-- Vue2's own `.tm-stepper__btn`
           icons are MDI `chevron-up`/`chevron-down` (`<b-icon icon="chevron-up"/>`, own file:1361,
           1372) -- ported as hand-inlined SVGs reproducing those exact MDI paths (house convention,
           see TimeMachineStage.vue's own gear-icon comment for the same derivation), replacing the
           previous plain Unicode ▲/▼ triangles, a visibly different mark entirely. -->
      <svg class="tm-stepper-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z" />
      </svg>
    </button>
    <div class="tm-stepper-time">{{ label }}</div>
    <button
      type="button"
      class="tm-stepper-btn tm-stepper-btn-down"
      :disabled="!canEarlier"
      :aria-label="t('tmStepEarlier')"
      :title="t('tmStepEarlier')"
      @click="emit('earlier')"
    >
      <svg class="tm-stepper-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7.41,8.59L12,13.17L16.59,8.59L18,10L12,16L6,10L7.41,8.59Z" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
/* Self-positioned (same convention TimeMachineRail.vue's own header comment already established
   for this stage's right-edge chrome): anchored to the SCALED window's own real right edge, not a
   fixed fraction of the reserved gutter band -- ported byte-for-byte from Vue2's own $tm-stepper
   SCSS derivation (TimeMachineStage.vue, "Vertical stepper" <style> comment).
   `.tm-fwin--active`'s rendered right edge (after `transform: scale(TM_WINDOW_SCALE)`,
   timeMachineMath.ts) sits, measured from the stage's own right edge, at
     (1 - TM_WINDOW_SCALE) * 0.5 * 100%                              -- Vue2's $tm-shrink-pct
     + (TM_RAIL_WIDTH + TM_STEPPER_BAND) * (1 + TM_WINDOW_SCALE) * 0.5  -- Vue2's $tm-gutter-half-scaled
   This stepper's own `right` then subtracts a real Apple-style gap (Vue2's $tm-stepper-gap, 20px)
   and its own width (Vue2's $tm-stepper-width, 44px) so its LEFT edge -- not its right -- sits that
   gap past the window's real edge. With this codebase's own TM_WINDOW_SCALE=0.82/TM_RAIL_WIDTH=220/
   TM_STEPPER_BAND=60 (timeMachineMath.ts):
     (1 - 0.82) * 0.5 * 100% = 9%
     (220 + 60) * (1 + 0.82) * 0.5 = 254.8px
     254.8px - 20px - 44px = 190.8px
   `max()` with 232px (Vue2's $tm-stepper-rail-clearance = TM_RAIL_WIDTH + 12px) is a structural
   floor -- Vue2's own explicit "keep it clear of the rail" requirement -- so the stepper can never
   actually be pushed closer to the stage's own right edge than 12px past the rail's 220px boundary,
   for any viewport width, rather than relying on the formula above staying positive on its own. */
.tm-stepper {
  position: absolute;
  top: 50%;
  width: 44px;
  right: max(232px, calc(9% + 190.8px));
  transform: translateY(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.tm-stepper-btn {
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tm-stepper-btn-bg);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: var(--tm-chrome-text);
  cursor: pointer;
  /* Vue2's own literal
     (`background 0.15s ease, opacity 0.15s ease`, TimeMachineStage.vue:3309) -- plain `ease`, not
     `var(--ease)`'s custom cubic-bezier curve. */
  transition: background 0.15s ease, opacity 0.15s ease;
}
.tm-stepper-btn:hover:not(:disabled) { background: var(--tm-stepper-btn-hover-bg); }
.tm-stepper-btn:disabled { opacity: 0.35; cursor: default; }
/* The inline MDI chevron-up/chevron-down SVG's own intrinsic box -- 13px matches
   this button's previous `font-size: 13px` (the Unicode triangle glyphs' own rendered size before
   this port). */
.tm-stepper-icon { width: 13px; height: 13px; }

.tm-stepper-time {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--tm-chrome-text);
  text-align: center;
  white-space: nowrap;
  text-shadow: var(--tm-stepper-time-shadow);
}
</style>
