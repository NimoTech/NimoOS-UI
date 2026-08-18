<template>
  <!-- SP8-P2b acceptance round 3 (2026-07-30): while the AI area is in the foreground, wrap
       ourselves in the AI toast scope and its light/dark theme. Without this, the component reads
       the global blue-black theme's translucent white background + white text, which is completely
       invisible on the AI light pages (no AI-area toast feedback ever reaches the user). Root cause
       and token values: aiSurfaces comment in src/ai/stores/aiTheme.ts; styles in tokens.scss
       .ai-toast-scope. Outside the AI area both bindings are inert — desktop/files/apps areas look
       exactly the same (explicit user requirement). -->
  <transition-group
    name="toast" tag="div" class="toast-stack"
    :class="{ 'ai-toast-scope': aiTheme.aiSurfaceActive }"
    :data-theme="aiTheme.aiSurfaceActive ? aiTheme.theme : undefined"
  >
    <div
      v-for="t in toast.toasts"
      :key="t.id"
      class="toast"
      :class="{ 'has-action': t.action }"
      :data-tier="t.tier"
      role="status"
      aria-live="polite"
    >
      {{ t.text }}
      <button v-if="t.action" type="button" class="toast-action" @click="onAction(t)">{{ t.action.label }}</button>
    </div>
  </transition-group>
</template>
<script setup lang="ts">
import { useToast, type ToastItem } from '../stores/toast'
import { useAiTheme } from '../ai/stores/aiTheme'
const toast = useToast()
const aiTheme = useAiTheme()
// Undo-style toasts (Task 9) should fire once and disappear immediately,
// rather than waiting out the remaining auto-dismiss timer.
function onAction(t: ToastItem) {
  t.action?.onClick()
  toast.dismiss(t.id)
}
</script>
<style scoped>
/* bottom-anchored stack: newest sits at the original spot, older ones push up */
/* z-index — **toasts must sit above every overlay in the repo** (layer ladder: docs/THEMING.md §8).
   With the old value 60, every "failed but the dialog is deliberately kept open for retry" path
   hid the failure reason: the scrims (.pd-scrim / .cad-overlay = 220 at the time, since
   renamed to .person-dialog-scrim and now 200 per Plan D Task 4's Vue2-parity fix — still
   below toast either way; ui-dialog-overlay = 1000,
   dialog panel = 1001, .sk-modal-bg = 1100) all sat above the toast, and with backdrop-filter the
   toast was blurred into oblivion — users thought the button did nothing and kept retrying
   (reproduced 2026-07-30: user clicked copy in the "create token" dialog).
   [SP8-P6-T3 merge] take sp8's 10100 rather than master's 1100: the AI area lands on trunk with
   this merge, and its SearchImageLightbox / SearchFileDrawer sit at 10000, SearchFullResults 9999,
   so 1100 would be buried under them. 10100 is the smallest safe value that is "above the repo's
   highest 10000, with headroom".
   This element has pointer-events: none, so being on top never intercepts clicks. Guard: last
   test in AppToast.test.ts. */
.toast-stack { position: fixed; z-index: 10100; left: 50%; bottom: var(--toast-bottom, 118px); transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; }
.toast { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border: 1px solid var(--chip-border); border-radius: 999px; background: var(--toast-bg); color: var(--toast-fg, var(--fg)); font-size: 13px; pointer-events: none; backdrop-filter: var(--blur); white-space: nowrap; }
/* SP8-P1c2 Task 6: severity tiers. 'info' (the default/omitted case) keeps the
   base .toast rule above untouched — existing show(text)/show(text, ms) call
   sites across the app render identically to before this task. */
.toast[data-tier="warning"] { background: var(--toast-warn-bg); color: var(--toast-warn-fg); }
.toast[data-tier="danger"] { background: var(--toast-danger-bg); color: var(--toast-danger-fg); }
/* only toasts carrying an action need to intercept clicks; plain status pills
   stay pointer-events:none so they never block content underneath */
.toast.has-action { pointer-events: auto; }
.toast-action {
  padding: 3px 11px; border-radius: 999px; border: 1px solid var(--accent-soft-bd);
  background: var(--accent-soft); color: var(--accent-text); font: inherit; font-size: 12px; font-weight: 600;
  cursor: pointer; pointer-events: auto;
}
.toast-action:hover { background: var(--accent-soft-2); }

/* Vue <transition-group> enter/leave + smooth reflow as items stack/unstack */
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s var(--ease, ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px); }
.toast-move { transition: transform 0.2s var(--ease, ease); }
</style>
