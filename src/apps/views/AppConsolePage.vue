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

// Monotonic request-sequence guard (same pattern as appstore.ts's loadCatalog `mySeq`,
// but instance/closure-scoped here, not module-scoped — this `seq` lives in this
// AppConsolePage instance's setup() closure, reset fresh on every mount, not shared
// across instances like a module-level singleton would be):
// rapid successive route-param changes (app A → app B before A's fetch resolves) fire
// load() twice with both in flight. Without this, whichever `containers()` response lands
// LAST wins unconditionally — a stale response can overwrite the newer app's info/selectedService,
// or worse, fire the invalid-app toast + router.push({name:'apps'}) and yank the user off an
// app's console they've since navigated to. Capture `mySeq` at entry; after every await,
// bail out silently (no state write, no toast, no redirect) if a newer load() has since started.
let seq = 0

async function load() {
  const mySeq = ++seq
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
    if (mySeq !== seq) return // a newer load() has since started — this response is stale, drop it silently
    if (!r || !Object.keys(r.containers).length) {
      toast.show(t('appsConsoleNotFound'))
      void router.push({ name: 'apps' })
      return
    }
    info.value = r
    selectedService.value = r.main && r.containers[r.main] ? r.main : Object.keys(r.containers)[0]
  } catch {
    if (mySeq !== seq) return
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
            <!--
              @change forces tab back to 'terminal' when the user picks a different service
              here while sitting on the Logs tab. Switching the service changes containerId,
              which remounts a fresh, :key-ed TerminalPane under v-show="tab === 'terminal'".
              If that remount happens while tab === 'logs', the new TerminalPane mounts hidden
              (display:none) — FitAddon.fit() is a no-op against a hidden host, so it connects
              at xterm's default 80×24 and the PTY (fixed-size at connect, no resize support by
              design) stays wrong-sized until the user manually reconnects. Using @change here
              (rather than a watch(selectedService, ...)) matters: load() also assigns
              selectedService programmatically on app switch, and load() already resets
              tab to 'terminal' itself — a watcher would double-handle that path for no
              reason and risk fighting load()'s own reset order. @change only fires on real
              user interaction with this <select>, so it can't clash with load().
            -->
            <select
              v-if="serviceNames.length > 1"
              v-model="selectedService"
              class="console-svc"
              data-test="console-svc-select"
              @change="tab = 'terminal'"
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
/* 控制台页天然是"应用式"定高布局(只有 tabs+面板,无长文档内容):
   height:100% 给下游一个确定分母,终端/日志面板才能占满剩余空间在内部滚
   (min-height:100% 是内容驱动高度,面板会随内容长高——YAML 标签同款教训) */
.apps-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }
.apps-main { flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; min-height: 0; }
.detail-back { font-size: 13px; margin-bottom: 14px; align-self: flex-start; }
.console-page { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 14px; }
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
