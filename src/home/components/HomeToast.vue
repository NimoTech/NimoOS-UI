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
.toast { position: fixed; left: 50%; bottom: 88px; transform: translateX(-50%); background: rgba(20,24,30,.92); color: #e8ecf1; padding: 8px 16px; border-radius: 12px; font-size: 13px; z-index: 50; box-shadow: 0 8px 30px rgba(0,0,0,.4); }
.toast-enter-active, .toast-leave-active { transition: opacity .2s, transform .2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 8px); }
</style>
