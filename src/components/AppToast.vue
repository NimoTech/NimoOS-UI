<template>
  <transition-group name="toast" tag="div" class="toast-stack">
    <div
      v-for="t in toast.toasts"
      :key="t.id"
      class="toast"
      :data-tier="t.tier"
      role="status"
      aria-live="polite"
    >{{ t.text }}</div>
  </transition-group>
</template>
<script setup lang="ts">
import { useToast } from '../stores/toast'
const toast = useToast()
</script>
<style scoped>
/* bottom-anchored stack: newest sits at the original spot, older ones push up */
.toast-stack { position: fixed; z-index: 60; left: 50%; bottom: 118px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; }
.toast { padding: 10px 18px; border: 1px solid var(--chip-border); border-radius: 999px; background: var(--toast-bg); color: var(--toast-fg, var(--fg)); font-size: 13px; pointer-events: none; backdrop-filter: var(--blur); white-space: nowrap; }
/* SP8-P1c2 Task 6: severity tiers. 'info' (the default/omitted case) keeps the
   base .toast rule above untouched — existing show(text)/show(text, ms) call
   sites across the app render identically to before this task. */
.toast[data-tier="warning"] { background: var(--toast-warn-bg); color: var(--toast-warn-fg); }
.toast[data-tier="danger"] { background: var(--toast-danger-bg); color: var(--toast-danger-fg); }

/* Vue <transition-group> enter/leave + smooth reflow as items stack/unstack */
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s var(--ease, ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px); }
.toast-move { transition: transform 0.2s var(--ease, ease); }
</style>
