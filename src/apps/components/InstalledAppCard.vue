<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { DropdownMenuItem, DropdownMenuSeparator } from 'reka-ui'
import AppActionsMenu from './AppActionsMenu.vue'
import type { InstalledApp, AppOp } from '../stores/installedApps'

const props = defineProps<{ app: InstalledApp; pendingOp?: AppOp }>()
const emit = defineEmits<{
  (e: 'open'): void
  (e: 'action', op: 'start' | 'stop' | 'restart' | 'update'): void
  (e: 'settings'): void
  (e: 'console'): void
  (e: 'uninstall'): void
}>()
const { t } = useI18n()

const running = computed(() => props.app.status === 'running')
const busy = computed(() => !!props.pendingOp)
const statusKey = computed(() => {
  switch (props.app.status) {
    case 'running': return 'appsStatusRunning'
    case 'paused': return 'appsStatusPaused'
    case 'restarting': return 'appsStatusRestarting'
    case 'unknown': return 'appsStatusUnknown'
    default: return 'appsStatusStopped' // exited/dead/created/removing
  }
})
// running → 打开(需 webUrl);非 running → 启动
const primaryDisabled = computed(() => busy.value || (running.value && !props.app.webUrl))
function onPrimary() {
  if (running.value) emit('open')
  else emit('action', 'start')
}
</script>

<template>
  <div class="app-card" :class="{ busy }">
    <div class="app-card-head">
      <img v-if="app.icon" class="app-icon" :src="app.icon" alt="" loading="lazy" />
      <div v-else class="app-icon app-icon-fallback">{{ app.title.slice(0, 1) }}</div>
      <div class="app-meta">
        <div class="app-title-row">
          <span class="app-title">{{ app.title }}</span>
          <span v-if="app.updateAvailable" class="app-badge">{{ t('appsUpdateBadge') }}</span>
        </div>
        <span class="app-status" :class="{ on: running }">
          <i class="dot" />{{ busy ? t('appsWorking') : t(statusKey) }}
        </span>
      </div>
      <AppActionsMenu :ariaLabel="t('appsMenuAria')">
        <template #menu>
          <template v-if="running">
            <DropdownMenuItem class="ui-drop-item" :disabled="busy" @select="emit('action', 'stop')">{{ t('appsStop') }}</DropdownMenuItem>
            <DropdownMenuItem class="ui-drop-item" :disabled="busy" @select="emit('action', 'restart')">{{ t('appsRestart') }}</DropdownMenuItem>
          </template>
          <DropdownMenuItem class="ui-drop-item" :disabled="busy" @select="emit('settings')">{{ t('appsSettings') }}</DropdownMenuItem>
          <DropdownMenuItem class="ui-drop-item" :disabled="busy" @select="emit('console')">{{ t('appsConsole') }}</DropdownMenuItem>
          <DropdownMenuItem v-if="!app.isUncontrolled" class="ui-drop-item" :disabled="busy" @select="emit('action', 'update')">{{ t('appsCheckUpdate') }}</DropdownMenuItem>
          <DropdownMenuSeparator class="ui-drop-sep" />
          <DropdownMenuItem class="ui-drop-item danger" :disabled="busy" @select="emit('uninstall')">{{ t('appsUninstall') }}</DropdownMenuItem>
        </template>
      </AppActionsMenu>
    </div>
    <button class="bar-btn card-primary" type="button" :disabled="primaryDisabled" @click="onPrimary">
      {{ running ? t('appsOpen') : t('appsStart') }}
    </button>
  </div>
</template>

<style scoped>
.app-card {
  display: flex; flex-direction: column; gap: 12px; padding: 14px;
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: var(--radius); box-shadow: var(--card-shadow); backdrop-filter: var(--blur);
}
.app-card.busy { opacity: 0.75; }
.app-card-head { display: flex; align-items: flex-start; gap: 10px; }
.app-icon { width: 40px; height: 40px; border-radius: 10px; flex: 0 0 auto; object-fit: contain; }
.app-icon-fallback {
  display: flex; align-items: center; justify-content: center;
  background: var(--chip-bg); color: var(--fg); font-weight: 600; font-size: 18px;
}
.app-meta { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.app-title-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.app-title { font-size: 14px; font-weight: 600; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.app-badge {
  flex: 0 0 auto; font-size: 11px; padding: 1px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
}
.app-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--fg-muted); }
.app-status .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--fg-muted); }
.app-status.on .dot { background: var(--good); }
.card-primary { justify-content: center; }
.card-primary:disabled { opacity: 0.45; cursor: default; }
</style>
