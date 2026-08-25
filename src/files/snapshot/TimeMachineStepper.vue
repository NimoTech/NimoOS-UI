<script setup lang="ts">
// Task 9 (Files Time Machine Vue2-parity line): the Apple-style vertical stepper -- ⬆ / current-
// moment label / ⬇, floating outside the scaled real window's right edge. Ported from Vue2's
// `.tm-stepper` region (NimoOS-UI/src/components/filebrowser/components/TimeMachineStage.vue,
// M2-F7 point 5 + the 2026-07 up/down-swap fix round -- see that file's own header comment and its
// template/style-block comments on `.tm-stepper` for the full derivation this file ports).
//
// This component owns ONLY the visible control (shape/geometry/disabled state) and its two emits --
// it does NOT decide when stepping is possible or what "later"/"earlier" mean in terms of snapshot
// index. TimeMachineStage.vue's own `stepLater`/`stepEarlier` (built in Task 7, preempting this
// task's own "keyboard" file-list item -- see that file's own header comment) already own that
// logic and the SAME `clampStepIndex`-derived boundary check the keyboard handler uses; this
// component's `canLater`/`canEarlier` props are fed from two small computeds TimeMachineStage.vue
// derives from that exact same call, so there is exactly one notion of "can we step" shared by the
// keyboard, the stepper's own `:disabled`, and any future caller -- not three independently
// maintained copies (see task-7-report.md's own "given to T9" section, which flagged this before
// this task started).
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
    >▲</button>
    <div class="tm-stepper-time">{{ label }}</div>
    <button
      type="button"
      class="tm-stepper-btn tm-stepper-btn-down"
      :disabled="!canEarlier"
      :aria-label="t('tmStepEarlier')"
      :title="t('tmStepEarlier')"
      @click="emit('earlier')"
    >▼</button>
  </div>
</template>

<style scoped>
/* Self-positioned (same convention TimeMachineRail.vue's own header comment already established
   for this stage's right-edge chrome): anchored to the SCALED window's own real right edge, not a
   fixed fraction of the reserved gutter band -- ported byte-for-byte from Vue2's own $tm-stepper
   SCSS derivation (TimeMachineStage.vue, "Vertical stepper" <style> comment, M2-F9 Fix Round 5).
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
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s var(--ease), opacity 0.15s var(--ease);
}
.tm-stepper-btn:hover:not(:disabled) { background: var(--tm-stepper-btn-hover-bg); }
.tm-stepper-btn:disabled { opacity: 0.35; cursor: default; }

.tm-stepper-time {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--tm-chrome-text);
  text-align: center;
  white-space: nowrap;
  text-shadow: var(--tm-stepper-time-shadow);
}
</style>
