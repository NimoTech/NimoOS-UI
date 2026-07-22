<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { service, type ComposeContainersInfo } from '@nimotech/nimoos-service'
import AreaShell from '../../components/shell/AreaShell.vue'
import AppsSidebar from '../components/AppsSidebar.vue'
import TerminalPane from '../console/TerminalPane.vue'
import LogsPane from '../console/LogsPane.vue'
import { useInstalledAppsStore } from '../stores/installedApps'
import { useToast } from '../../stores/toast'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const installed = useInstalledAppsStore()
const id = computed(() => String(route.params.name ?? ''))
const app = computed(() => installed.apps.find((a) => a.id === id.value))

const tab = ref<'terminal' | 'logs'>('terminal')
const logsVisited = ref(false) // lazy-mount LogsPane; once true, kept alive via v-show so polling survives tab switches
const info = ref<ComposeContainersInfo | null>(null)
const selectedService = ref('')
const containerId = computed(() => info.value?.containers[selectedService.value]?.ID ?? '')
const serviceNames = computed(() => Object.keys(info.value?.containers ?? {}))

async function load() {
  // Reset per-app UI state up front. vue-router reuses this component instance when only
  // the `:name` route param changes (same route name `apps-console`), so navigating from one
  // app's console straight to another's does NOT remount AppConsolePage. TerminalPane/LogsPane
  // have no watcher on their id props (T6 review), so without resetting here the stale
  // container/tab/logs state from the previous app would keep showing. `containerId` is keyed
  // into TerminalPane's :key below, which forces a fresh terminal connection; logsVisited=false
  // unmounts LogsPane so it re-lazy-mounts (fresh polling) for the new app if the user opens the
  // Logs tab again.
  tab.value = 'terminal'
  logsVisited.value = false
  info.value = null
  selectedService.value = ''
  try {
    const r = await service.compose.containers(id.value)
    if (!r || !Object.keys(r.containers).length) {
      toast.show(t('appsConsoleNotFound'))
      void router.push({ name: 'apps' })
      return
    }
    info.value = r
    selectedService.value = r.main && r.containers[r.main] ? r.main : Object.keys(r.containers)[0]
  } catch {
    toast.show(t('appsConsoleLoadFailed'))
    void router.push({ name: 'apps' })
  }
}

onMounted(() => {
  if (!installed.apps.length) installed.refresh().catch(() => {}) // deep-link direct hit backfills title (same as AppSettingsPage)
  void load()
})
// Route param changed in place (same route name, reused instance) — reload containers for the new app.
watch(id, () => { void load() })

function switchTab(v: 'terminal' | 'logs') { tab.value = v; if (v === 'logs') logsVisited.value = true }
function back() { router.push({ name: 'apps' }) }
</script>

<template>
  <AreaShell :title="t('appsTitle')">
    <div class="apps-layout">
      <AppsSidebar />
      <main class="apps-main">
        <button class="bar-btn detail-back" type="button" @click="back">‹ {{ t('appsSettingsBack') }}</button>
        <div class="console-page">
          <header class="console-head">
            <h2 class="console-title">{{ app?.title ?? id }}</h2>
            <select
              v-if="serviceNames.length > 1"
              v-model="selectedService"
              class="console-svc"
              data-test="console-svc-select"
            >
              <option v-for="s in serviceNames" :key="s" :value="s">{{ s }}</option>
            </select>
            <nav class="console-tabs" role="tablist">
              <button
                type="button" role="tab" data-test="console-tab-terminal"
                :aria-selected="tab === 'terminal'" :class="{ on: tab === 'terminal' }"
                @click="switchTab('terminal')"
              >{{ t('appsConsoleTerminal') }}</button>
              <button
                type="button" role="tab" data-test="console-tab-logs"
                :aria-selected="tab === 'logs'" :class="{ on: tab === 'logs' }"
                @click="switchTab('logs')"
              >{{ t('appsConsoleLogs') }}</button>
            </nav>
          </header>
          <template v-if="containerId">
            <!-- Keyed by containerId: switching the service selector = new container = new terminal session -->
            <TerminalPane v-show="tab === 'terminal'" :key="containerId" :container-id="containerId" />
            <LogsPane v-if="logsVisited" v-show="tab === 'logs'" :app-id="id" />
          </template>
        </div>
      </main>
    </div>
  </AreaShell>
</template>

<style scoped>
.apps-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }
.apps-main { flex: 1 1 auto; min-width: 0; align-self: stretch; }
.detail-back { font-size: 13px; margin-bottom: 14px; }
.console-page { display: flex; flex-direction: column; gap: 14px; }
.console-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.console-title { margin: 0; font-size: 18px; font-weight: 600; color: var(--fg); }
.console-svc {
  width: auto; min-width: 140px; box-sizing: border-box; padding: 7px 10px; font-size: 13px;
  color: var(--fg); background: var(--chip-bg); border: 1px solid var(--card-border); border-radius: 9px; outline: none;
}
.console-svc:focus { border-color: var(--accent); }
.console-tabs { display: flex; gap: 6px; margin-left: auto; }
.console-tabs button {
  padding: 5px 16px; border-radius: 9px; border: 1px solid var(--card-border);
  background: transparent; color: var(--fg-muted); cursor: pointer; font-size: 13px;
}
.console-tabs button.on { background: var(--chip-bg-hi); color: var(--fg); }
@media (max-width: 768px) { .apps-layout { gap: 0; } }
</style>
