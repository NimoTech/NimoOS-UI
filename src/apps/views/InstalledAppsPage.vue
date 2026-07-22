<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import InstalledAppCard from '../components/InstalledAppCard.vue'
import InstallingAppCard from '../components/InstallingAppCard.vue'
import UninstallConfirm from '../components/UninstallConfirm.vue'
import AlertDialog from '../../components/ui/AlertDialog.vue'
import { service } from '@nimotech/nimoos-service'
import { useInstalledAppsStore, type InstalledApp } from '../stores/installedApps'
import { useInstallProgressStore } from '../stores/installProgress'
import { useMessageBus } from '../../composables/useMessageBus'
import { useToast } from '../../stores/toast'
import { createContainerEventHandler, CONTAINER_EVENT } from '../../home/containerEventBridge'

const { t } = useI18n()
const router = useRouter()
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
// 安装中卡片的「停止并删除」确认框(同 delDlg 模式:open 与 task 同包,update:open 不动 task)
const cancelDlg = ref<{ open: boolean; taskId: string; taskTitle: string }>({ open: false, taskId: '', taskTitle: '' })

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
async function onCancelInstallConfirm() {
  const id = cancelDlg.value.taskId
  cancelDlg.value.open = false
  if (!id) return
  progress.dismiss(id)
  // 尽力而为删除已落盘内容:应用可能已装成(幽灵卡)或半装;404/未装成时无事可删,静默。
  // 后端无「中止安装」API——正在拉取的镜像层由 docker daemon 自行收尾,不影响删除结果。
  try { await service.compose.uninstall(id, { deleteConfigFolder: true }) } catch { /* not installed */ }
  store.refresh().catch(() => {})
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
  'app:apply-changes-begin', 'app:apply-changes-end', 'app:apply-changes-error',
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
            @cancel="cancelDlg = { open: true, taskId: tk.id, taskTitle: tk.title }"
          />
        </div>
        <p v-if="!store.loading && !store.apps.length && !installingTasks.length" class="apps-empty">{{ t('appsEmpty') }}</p>
        <div v-else class="apps-grid">
          <InstalledAppCard
            v-for="a in store.apps" :key="a.id"
            :app="a" :pending-op="store.pending[a.id]"
            @open="onOpen(a)"
            @action="(op) => onAction(a, op)"
            @settings="router.push({ name: 'apps-settings', params: { name: a.id } })"
            @console="router.push({ name: 'apps-console', params: { name: a.id } })"
            @uninstall="uninstallDlg = { open: true, app: a }"
          />
        </div>
        <UninstallConfirm
          :open="uninstallDlg.open"
          :name="uninstallDlg.app?.title ?? ''"
          @update:open="(v) => { uninstallDlg.open = v }"
          @confirm="onUninstallConfirm"
        />
        <AlertDialog
          :open="cancelDlg.open"
          :title="t('appsInstallCancelTitle', { name: cancelDlg.taskTitle })"
          :message="t('appsInstallCancelDesc')"
          :confirm-text="t('appsInstallCancel')"
          :cancel-text="t('appsCancel')"
          destructive
          @update:open="(v) => { cancelDlg.open = v }"
          @confirm="onCancelInstallConfirm"
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
