<script setup lang="ts">
// 电源状态浮层,对位 Vue2 SettingsPanel.vue L714-790 的 6 个态。
// 拆成纯展示组件的理由:相位由父组件的相位机驱动,这里只做「相位 → 文案 + 可否关闭」的映射,
// 于是 6 个态能直接挂载断言,不必在 PowerFlow 上开只为测试存在的接口。
//
// 自绘而不用 ui/Dialog.vue:等待类相位不允许 Esc / 点外部关闭,
// 而 reka 的 DialogRoot 默认允许两者,逐个关掉不如自绘清楚。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PowerPhase } from '../util/powerFlow'
import '../styles/settings.css'

const props = defineProps<{ phase: PowerPhase }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

// 含 idle 一起给键(值为空串)。模板里的 v-if="phase !== 'idle'" **不会**为
// TITLE[phase] 这种索引访问收窄类型,写成 Exclude<PowerPhase,'idle'> 会让 vue-tsc 报错。
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

// 等待类相位不给关闭按钮(对位 Vue2 :can-cancel="false" —— 只有 offline / fallback 有 delete 按钮)
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
