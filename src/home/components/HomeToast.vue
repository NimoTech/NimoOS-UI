<template>
  <transition name="toast">
    <div v-if="ui.toastMsg" class="toast" role="status" aria-live="polite">{{ ui.toastMsg }}</div>
  </transition>
</template>
<script setup lang="ts">
import { useHomeUiStore } from '../stores/homeUi'
const ui = useHomeUiStore()
</script>
<style scoped>
/* glass pill toast — base.css:399; visible state = base .toast (v-if, no .show class needed) */
.toast { position: fixed; z-index: 60; left: 50%; bottom: 118px; transform: translate(-50%, 0); padding: 10px 18px; border: 1px solid var(--chip-border); border-radius: 999px; background: var(--toast-bg); color: var(--toast-fg, var(--fg)); font-size: 13px; pointer-events: none; backdrop-filter: var(--blur); }

/* Vue <transition name="toast"> enter/leave — maps prototype opacity+transform transition */
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s var(--ease, ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 12px); }
</style>
