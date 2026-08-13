<script setup lang="ts">
// Counterpart of Vue2 SettingsPanel.vue's sidebar power block (L33-46) + two confirm dialogs (L711-712)
// + power status overlay (L714-790, 6 states). The phase machine lives in util/powerFlow.ts; this file only handles UI.
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import PowerOverlay from './PowerOverlay.vue'
import { createPowerFlow, probeAlive, type PowerPhase } from '../util/powerFlow'
import '../styles/settings.css'

const { t } = useI18n()

const phase = ref<PowerPhase>('idle')
const askShutdown = ref(false)
const askRestart = ref(false)

const flow = createPowerFlow({
  probe: () => probeAlive(),
  reload: () => window.location.reload(),
  onPhase: (p) => { phase.value = p },
})
onBeforeUnmount(() => flow.reset())

async function doShutdown() {
  askShutdown.value = false
  flow.startShutdown()
  // Vue2 uses .catch(()=>{}) — the shutdown request's connection often drops before
  // the response arrives, so an error doesn't mean shutdown failed; don't abort the phase machine.
  try { await service.sys.power('off') } catch { /* see above */ }
}

async function doRestart() {
  askRestart.value = false
  flow.startRestart()
  try { await service.sys.power('restart') } catch { /* same as above */ }
}

function close() { flow.reset() }
</script>

<template>
  <div class="pf">
    <button
      class="pf-btn pf-shutdown"
      type="button"
      :aria-label="t('settingsShutdown')"
      :disabled="phase !== 'idle'"
      @click="askShutdown = true"
    >
      ⏻
    </button>
    <button
      class="pf-btn pf-restart"
      type="button"
      :aria-label="t('settingsRestart')"
      :disabled="phase !== 'idle'"
      @click="askRestart = true"
    >
      ⟳
    </button>

    <AlertDialog
      :open="askShutdown"
      :title="t('settingsShutdownConfirmTitle')"
      :message="t('settingsShutdownConfirmMsg')"
      :confirm-text="t('settingsShutdown')"
      :cancel-text="t('settingsCancel')"
      destructive
      @update:open="askShutdown = $event"
      @confirm="doShutdown"
    />
    <AlertDialog
      :open="askRestart"
      :title="t('settingsRestartConfirmTitle')"
      :message="t('settingsRestartConfirmMsg')"
      :confirm-text="t('settingsRestart')"
      :cancel-text="t('settingsCancel')"
      @update:open="askRestart = $event"
      @confirm="doRestart"
    />

    <PowerOverlay :phase="phase" @close="close" />
  </div>
</template>

<style scoped>
.pf { display: flex; align-items: center; gap: 8px; padding: 8px 4px; }
.pf-btn {
  width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--chip-border); border-radius: 50%;
  background: var(--chip-bg); color: var(--fg-muted);
  font-size: 16px; cursor: pointer; font-family: inherit;
}
.pf-btn:hover { background: var(--chip-bg-hi); color: var(--fg); }
/* Shutdown is destructive; hover shows the danger color (same as Vue2's .power-item-btn.attention) */
.pf-shutdown:hover { color: var(--remove-fg); border-color: var(--remove-fg); }
</style>
