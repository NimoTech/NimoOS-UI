<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import { useInstalledAppsStore } from '../stores/installedApps'
import { useMessageBus } from '../../composables/useMessageBus'
import { createContainerEventHandler, CONTAINER_EVENT } from '../../home/containerEventBridge'

const { t } = useI18n()
const store = useInstalledAppsStore()
const bus = useMessageBus()

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
          <!-- Task 5 用 InstalledAppCard 替换此占位卡 -->
          <div v-for="a in store.apps" :key="a.id" class="app-card-placeholder">
            <img v-if="a.icon" :src="a.icon" alt="" width="40" height="40" />
            <span>{{ a.title }}</span>
            <span>{{ a.status }}</span>
          </div>
        </div>
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
