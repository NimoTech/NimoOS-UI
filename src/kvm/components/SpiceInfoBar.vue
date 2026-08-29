<script setup lang="ts">
// SPICE connection notification bar: briefly displayed when the selected VM has
// switched back to disk boot (bootFromDisk=true) and has a spicePort, prompting the
// user to connect with a SPICE client like virt-viewer for better experience. Visual
// 1:1 match of Vue2 components/KVM/KVMFullPage.vue template :156-165 + styles
// :2795-2865 (in the **first, scoped** `<style>` block, not the same as the global
// block at the end of the file with the installation banner).
//
// Display conditions (state==='running' etc. are not determined here), the 180-second
// auto-close timer, and VM-switch resets are all pre-computed by the parent component
// (KvmPage) — this component only handles "render when given, emit close on click".
import { useI18n } from 'vue-i18n'

defineProps<{ hostname: string; spicePort: number; isWindowsGuest: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="spice-info-bar">
    <div class="spice-info-content">
      <span>{{ t('kvmSpiceHint') }} <code>spice://{{ hostname }}:{{ spicePort }}</code></span>
      <span class="spice-agent-hint">
        {{ t(isWindowsGuest ? 'kvmSpiceAgentWin' : 'kvmSpiceAgentLinux') }}
      </span>
    </div>
    <button
      type="button"
      class="spice-info-close"
      :aria-label="t('kvmClose')"
      @click="emit('close')"
    >
      <!-- × is a monochrome text symbol placeholder (emoji forbidden), matching Vue2 b-icon icon="close-outline". -->
      <span aria-hidden="true">×</span>
    </button>
  </div>
</template>
