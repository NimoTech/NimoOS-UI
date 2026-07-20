<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import InstalledAppCard from '../components/InstalledAppCard.vue'
import UninstallConfirm from '../components/UninstallConfirm.vue'
import { useInstalledAppsStore, type InstalledApp } from '../stores/installedApps'
import { useMessageBus } from '../../composables/useMessageBus'
import { useToast } from '../../stores/toast'
import { createContainerEventHandler, CONTAINER_EVENT } from '../../home/containerEventBridge'

const { t } = useI18n()
const store = useInstalledAppsStore()
const bus = useMessageBus()
const toast = useToast()
const uninstallTarget = ref<InstalledApp | null>(null)

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
  const a = uninstallTarget.value
  uninstallTarget.value = null
  if (!a) return
  try {
    await store.uninstall(a.id, deleteConfigFolder)
  } catch (e) {
    console.warn('[apps] uninstall', a.id, e)
    toast.show(t('appsOpFailed', { name: a.title }), 4000)
  }
}

// app:* 生命周期(spec §2.3);install-end 单列:后台装完新应用要浮出列表
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
  offs.push(bus.on('app:install-end', () => { store.refresh().catch(() => {}) }))
  offs.push(bus.on(CONTAINER_EVENT, (props) => bridge.handle(props)))
})
onUnmounted(() => { offs.forEach((off) => off()); bridge.dispose() })
</script>

<template>
  <AreaShell :title="t('appsTitle')">
    <div class="apps-layout">
      <AppsSidebar />
      <main class="apps-main">
        <p v-if="!store.loading && !store.apps.length" class="apps-empty">{{ t('appsEmpty') }}</p>
        <div v-else class="apps-grid">
          <InstalledAppCard
            v-for="a in store.apps" :key="a.id"
            :app="a" :pending-op="store.pending[a.id]"
            @open="onOpen(a)"
            @action="(op) => onAction(a, op)"
            @uninstall="uninstallTarget = a"
          />
        </div>
        <UninstallConfirm
          :open="!!uninstallTarget"
          :name="uninstallTarget?.title ?? ''"
          @update:open="(v) => { if (!v) uninstallTarget = null }"
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
@media (max-width: 768px) { .apps-layout { gap: 0; } }
</style>
