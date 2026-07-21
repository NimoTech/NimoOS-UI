<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import InstalledAppCard from '../components/InstalledAppCard.vue'
import InstallingAppCard from '../components/InstallingAppCard.vue'
import UninstallConfirm from '../components/UninstallConfirm.vue'
import { useInstalledAppsStore, type InstalledApp } from '../stores/installedApps'
import { useInstallProgressStore } from '../stores/installProgress'
import { useMessageBus } from '../../composables/useMessageBus'
import { useToast } from '../../stores/toast'
import { createContainerEventHandler, CONTAINER_EVENT } from '../../home/containerEventBridge'

const { t } = useI18n()
const store = useInstalledAppsStore()
const progress = useInstallProgressStore()
const installingTasks = computed(() => Object.values(progress.tasks))
const bus = useMessageBus()
const toast = useToast()
// reka-ui 的 AlertDialogAction 本身是个 DialogClose:点击红色确认按钮时,
// update:open(false) 先于 @click 派发的 confirm 事件触发。若 open 标志和 target
// 共用一个 ref,update:open 处理器会先把 target 置空,confirm 读到的就是 null,
// store.uninstall 永远不会被调用(SP5-P1 终审 CRITICAL)。参照 SharesPage.vue 的
// delDlg 模式:open 与 app 打包在同一个 ref 里,只在 confirm 读取后才关闭 open,
// update:open 处理器只改 open,不动 app。
const uninstallDlg = ref<{ open: boolean; app: InstalledApp | null }>({ open: false, app: null })

function onOpen(a: InstalledApp) {
  if (a.webUrl) window.open(a.webUrl, '_blank', 'noopener')
}
async function onAction(a: InstalledApp, op: 'start' | 'stop' | 'restart' | 'update') {
  try {
    if (op === 'update') {
      const msg = await store.update(a.id)
      if (msg) toast.show(msg, 4000)
    } else {
      await store.setStatus(a.id, op)
    }
  } catch (e) {
    console.warn('[apps]', op, a.id, e)
    toast.show(t('appsOpFailed', { name: a.title }), 4000)
  }
}
async function onUninstallConfirm(deleteConfigFolder: boolean) {
  const a = uninstallDlg.value.app
  if (!a) return
  try {
    await store.uninstall(a.id, deleteConfigFolder)
  } catch (e) {
    console.warn('[apps] uninstall', a.id, e)
    toast.show(t('appsOpFailed', { name: a.title }), 4000)
  } finally {
    uninstallDlg.value.open = false
  }
}

// app:* 生命周期(spec §2.3);install-* 由 installProgress store 全局订阅收敛(D6)
const APP_EVENTS = [
  'app:start-begin', 'app:start-end', 'app:start-error',
  'app:stop-begin', 'app:stop-end', 'app:stop-error',
  'app:restart-begin', 'app:restart-end', 'app:restart-error',
  'app:update-begin', 'app:update-end', 'app:update-error',
  'app:uninstall-begin', 'app:uninstall-end', 'app:uninstall-error',
]
const offs: Array<() => void> = []
const bridge = createContainerEventHandler({ evict: (k) => store.evict(k), refresh: () => { store.refresh().catch(() => {}) } })

onMounted(() => {
  store.refresh().catch((e) => console.warn('[apps] load', e))
  APP_EVENTS.forEach((ev) => offs.push(bus.on(ev, (props) => store.onAppEvent(ev, props))))
  offs.push(bus.on(CONTAINER_EVENT, (props) => bridge.handle(props)))
})
onUnmounted(() => { offs.forEach((off) => off()); bridge.dispose() })
</script>

<template>
  <AreaShell :title="t('appsTitle')">
    <div class="apps-layout">
      <AppsSidebar />
      <main class="apps-main">
        <div v-if="installingTasks.length" class="apps-grid iac-grid">
          <InstallingAppCard
            v-for="tk in installingTasks" :key="tk.id"
            :task="tk" @dismiss="progress.dismiss(tk.id)"
          />
        </div>
        <p v-if="!store.loading && !store.apps.length && !installingTasks.length" class="apps-empty">{{ t('appsEmpty') }}</p>
        <div v-else class="apps-grid">
          <InstalledAppCard
            v-for="a in store.apps" :key="a.id"
            :app="a" :pending-op="store.pending[a.id]"
            @open="onOpen(a)"
            @action="(op) => onAction(a, op)"
            @uninstall="uninstallDlg = { open: true, app: a }"
          />
        </div>
        <UninstallConfirm
          :open="uninstallDlg.open"
          :name="uninstallDlg.app?.title ?? ''"
          @update:open="(v) => { uninstallDlg.open = v }"
          @confirm="onUninstallConfirm"
        />
      </main>
    </div>
  </AreaShell>
</template>

<style scoped>
.apps-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.apps-main { flex: 1 1 auto; min-width: 0; align-self: stretch; }
.apps-empty { color: var(--fg-muted); font-size: 14px; padding: 24px 8px; }
.apps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.iac-grid { margin-bottom: 14px; }
@media (max-width: 768px) { .apps-layout { gap: 0; } }
</style>
