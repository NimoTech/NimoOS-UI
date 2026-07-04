<template>
  <transition-group name="toast" tag="div" class="toast-stack">
    <div v-for="t in toast.toasts" :key="t.id" class="toast" role="status" aria-live="polite">{{ t.text }}</div>
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

/* Vue <transition-group> enter/leave + smooth reflow as items stack/unstack */
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s var(--ease, ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(12px); }
.toast-move { transition: transform 0.2s var(--ease, ease); }
</style>
