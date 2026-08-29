<script setup lang="ts">
// Power status overlay, counterpart of the 6 states in Vue2 SettingsPanel.vue L714-790.
// Why a pure presentational component: the phase is driven by the parent's phase machine;
// this only maps "phase → copy + closable", so all 6 states can be mounted and asserted
// directly without adding test-only hooks to PowerFlow.
//
// Hand-rolled instead of ui/Dialog.vue: waiting phases must not allow Esc / outside-click
// close, and reka's DialogRoot allows both by default — disabling each is less clear than drawing it ourselves.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PowerPhase } from '../util/powerFlow'
import '../styles/settings.css'

const props = defineProps<{ phase: PowerPhase }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

// Include idle as a key (empty-string value). The template's v-if="phase !== 'idle'" does
// NOT narrow the type for indexed access like TITLE[phase]; typing it as Exclude<PowerPhase,'idle'> makes vue-tsc error.
const TITLE: Record<PowerPhase, string> = {
  idle: '',
  shutting: 'settingsPowerShutting', offline: 'settingsPowerOffline',
  restarting: 'settingsPowerRestarting', reconnecting: 'settingsPowerReconnecting',
  done: 'settingsPowerBack', appUpdating: 'settingsPowerAppUpdating',
  fallback: 'settingsPowerFallback',
}
const MSG: Record<PowerPhase, string> = {
  idle: '',
  shutting: 'settingsPowerShuttingMsg', offline: 'settingsPowerOfflineMsg',
  restarting: 'settingsPowerRestartingMsg', reconnecting: 'settingsPowerReconnectingMsg',
  done: 'settingsPowerBackMsg', appUpdating: 'settingsPowerAppUpdatingMsg',
  fallback: 'settingsPowerFallbackMsg',
}

// Waiting phases get no close button (counterpart of Vue2 :can-cancel="false" — only offline / fallback have a delete button)
const CLOSABLE: readonly PowerPhase[] = ['offline', 'fallback']
const closable = computed(() => CLOSABLE.includes(props.phase))

function reloadPage() {
  window.location.reload()
}
</script>

<template>
  <div v-if="phase !== 'idle'" class="pf-overlay" role="dialog" aria-modal="true">
    <div class="pf-card">
      <header class="pf-card-head">
        <h2 class="pf-card-title" :class="{ 'set-warn': phase === 'fallback' }">
          {{ t(TITLE[phase]) }}
        </h2>
        <button
          v-if="closable"
          class="pf-close"
          type="button"
          :aria-label="t('settingsCancel')"
          @click="emit('close')"
        >×</button>
      </header>
      <p class="pf-card-msg">{{ t(MSG[phase]) }}</p>
      <footer v-if="phase === 'fallback'" class="pf-card-foot">
        <button class="set-btn primary pf-reload" type="button" @click="reloadPage">
          {{ t('settingsRefresh') }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.pf-overlay {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  background: var(--overlay-bg); backdrop-filter: var(--overlay-blur);
}
.pf-card {
  width: min(360px, 88vw); padding: 20px; border-radius: 18px;
  background: var(--popup-bg); border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow-hi); color: var(--fg);
}
.pf-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.pf-card-title { margin: 0 0 10px; font-size: 16px; font-weight: 600; }
.pf-close {
  border: 0; background: none; color: var(--fg-faint);
  font-size: 20px; line-height: 1; cursor: pointer; padding: 0; font-family: inherit;
}
.pf-close:hover { color: var(--fg); }
.pf-card-msg { margin: 0; font-size: 14px; color: var(--fg-muted); }
.pf-card-foot { display: flex; justify-content: flex-end; margin-top: 18px; }
</style>
