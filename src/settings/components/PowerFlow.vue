<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue 的侧栏电源块(L33-46)+ 两个确认弹窗(L711-712)
// + 电源状态浮层(L714-790,6 个态)。相位机在 util/powerFlow.ts,这里只管界面。
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
  // Vue2 是 .catch(()=>{}) —— 关机请求常常在响应回来之前连接就断了,
  // 报错不代表没关成功,所以不因此中断相位机。
  try { await service.sys.power('off') } catch { /* 见上 */ }
}

async function doRestart() {
  askRestart.value = false
  flow.startRestart()
  try { await service.sys.power('restart') } catch { /* 同上 */ }
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
/* 关机是破坏性动作,hover 给危险色提示(Vue2 的 .power-item-btn.attention 同理) */
.pf-shutdown:hover { color: var(--remove-fg); border-color: var(--remove-fg); }
</style>
