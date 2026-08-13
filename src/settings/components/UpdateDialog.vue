<script setup lang="ts">
// Counterpart of Vue2 UpdateModal.vue (321 lines). Three states: changelog (default) / downloading (progress bar) / upgrading (logs).
// spec §5.1 also names UpdateCompleteModal (177 lines) — **not ported**:
// it is only shown by Home.vue when localStorage['is_update']==='true', and nowhere in the
// repo ever writes that key (the trigger was never implemented) → it never appeared.
// User decided 2026-07-31 to skip it; debt D14.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type UpdateCheck } from '@nimotech/nimoos-service'
import Dialog from '../../components/ui/Dialog.vue'
import { renderMarkdown } from '../../files/viewers/renderMarkdown'
import { useMessageBus } from '../../composables/useMessageBus'
import { useToast } from '../../stores/toast'
import type { UpdateKind } from '../util/updateKind'
import '../styles/settings.css'

defineOptions({ name: 'UpdateDialog' })
const props = defineProps<{
  open: boolean
  kind: UpdateKind
  info: UpdateCheck
  currentlyDownloading?: boolean
}>()
const emit = defineEmits<{ 'update:open': [boolean]; changed: [] }>()

const { t } = useI18n()
const toast = useToast()
const bus = useMessageBus()

// Event names taken verbatim from the Vue2 sockets blocks (SettingsPanel.vue L2201-2229 / UpdateModal.vue L203-241).
// The two event sets must be subscribed separately by kind — crosstalk would show firmware progress on the system update.
const EV = {
  os: { progress: 'nimoos:upgrade:progress', done: 'nimoos:upgrade:downloaded' },
  app: { progress: 'nimoos:app:download:progress', done: 'nimoos:app:downloaded' },
} as const
const LOG_PATH = {
  os: '/var/log/nimoos/upgrade.log',
  app: '/var/log/nimoos_app_upgrade.log',
} as const

type Phase = 'idle' | 'downloading' | 'upgrading'
const phase = ref<Phase>('idle')
const progress = ref(0)
const logs = ref('')
// Review fix round 2 · Important: both failure paths previously only did toast.show(...) —
// but the toast container is z-index:60 while the dialog's own overlay is z-index:1000 with
// backdrop blur; both sit in the root stacking context, so the toast is hidden behind the
// blurred overlay and the user sees nothing. Following the existing WebUiHttpsDialog.vue
// precedent, show it inline in the dialog body instead.
const error = ref('')

/** The Error.message thrown by the service layer is the backend envelope's message — prefer it; fall back to i18n copy only when empty. */
function errMsg(e: unknown, fallbackKey: string): string {
  const backend = e instanceof Error ? e.message : ''
  return backend || t(fallbackKey)
}

const changelogHtml = computed(() => renderMarkdown(props.info.version?.change_log ?? ''))
const isDownloaded = computed(() => props.info.is_downloaded === true)

let logTimer: ReturnType<typeof setInterval> | null = null
let unsub: (() => void)[] = []

function stopLogs() {
  if (logTimer) { clearInterval(logTimer); logTimer = null }
}
function unbind() {
  unsub.forEach((f) => f())
  unsub = []
}
onBeforeUnmount(() => { stopLogs(); unbind() })

watch(() => props.open, (o) => {
  if (!o) { stopLogs(); unbind(); phase.value = 'idle'; return }
  error.value = ''   // Clear any failure message left over from the previous round when opening (or reopening)
  phase.value = props.currentlyDownloading ? 'downloading' : 'idle'
  progress.value = props.info.download_progress ?? 0
  bind()
}, { immediate: true })

function bind() {
  unbind()
  const ev = EV[props.kind]
  unsub.push(bus.on(ev.progress, (p) => {
    const v = Number.parseFloat(String((p as { progress?: unknown })?.progress ?? ''))
    if (!Number.isFinite(v)) return
    progress.value = v
    if (v > 0 && v < 100) phase.value = 'downloading'
  }))
  unsub.push(bus.on(ev.done, () => {
    phase.value = 'idle'
    progress.value = 100
    toast.show(t('settingsDownloaded'))
    emit('changed')
    emit('update:open', false)
  }))
}

async function startDownload() {
  phase.value = 'downloading'
  progress.value = 0
  error.value = ''
  try {
    // Download is not a standalone endpoint: triggered via the version check with trigger_download=1
    const res = props.kind === 'app'
      ? await service.sys.getAppVersion({ trigger_download: 1 })
      : await service.sys.getOsVersion({ trigger_download: 1 })
    if (res.is_downloaded) {
      phase.value = 'idle'
      toast.show(t('settingsDownloaded'))
      emit('changed')
      emit('update:open', false)
    }
    // Otherwise wait for MessageBus progress / downloaded events.
    // Vue2 additionally ran a 3-second polling fallback here (UpdateModal startProgressPolling);
    // the MessageBus downloaded event already covers the same thing, so the extra poll is
    // pure duplication and is not copied.
  } catch (e) {
    phase.value = 'idle'
    console.warn('[settings] trigger download failed', e)
    // Review fix round 2: "failed to save config" was the wrong sentence (this triggers a
    // download, not a config save) — reuse settingsUpgradeFailed instead of minting a new
    // key (the brief explicitly forbids new i18n keys).
    error.value = errMsg(e, 'settingsUpgradeFailed')
  }
}

async function cancel() {
  try {
    await service.sys.cancelDownload()
    toast.show(t('settingsDownloadCancelled'))
  } catch (e) {
    console.warn('[settings] cancelDownload failed', e)
    toast.show(t('settingsDownloadCancelFailed'))
  } finally {
    phase.value = 'idle'
    emit('changed')
    emit('update:open', false)
  }
}

async function upgrade() {
  phase.value = 'upgrading'
  logs.value = ''
  error.value = ''
  try {
    if (props.kind === 'app') await service.sys.updateApp()
    else await service.sys.updateOs()
  } catch (e) {
    phase.value = 'idle'      // Let the user retry instead of being stuck on an empty log screen
    console.warn('[settings] upgrade failed', e)
    error.value = errMsg(e, 'settingsUpgradeFailed')
    return
  }
  pollLogs()
}

function pollLogs() {
  stopLogs()
  const path = LOG_PATH[props.kind]
  logTimer = setInterval(async () => {
    try {
      // FileContent is a named type ({ content: string }); no cast needed
      const res = await service.file.getContent(path)
      logs.value = res.content ?? ''
    } catch { /* The log file may not exist yet; retry silently */ }
  }, 2000)
}
</script>

<template>
  <Dialog
    :open="open"
    :title="`${isDownloaded ? t('settingsUpdateTitle') : t('settingsUpdateAvailable')} v${info.latest_version ?? ''}`"
    @update:open="emit('update:open', $event)"
  >
    <div class="upd-body">
      <div v-if="phase === 'downloading'" class="upd-dl">
        <div class="upd-dl-head">
          <span>{{ t('settingsDownloadingSystem') }}…</span>
          <strong>{{ progress }}%</strong>
        </div>
        <div
          class="upd-bar"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="progress"
        ><span class="upd-bar-fill" :style="{ width: `${progress}%` }"></span></div>
      </div>

      <pre v-else-if="phase === 'upgrading'" class="upd-logs">{{ logs }}</pre>

      <!-- renderMarkdown is markdown-it with html:false — raw HTML is escaped, so v-html on its output is safe -->
      <div v-else class="upd-log" v-html="changelogHtml"></div>

      <p v-if="error" class="set-danger">{{ error }}</p>
    </div>

    <template #footer>
      <button v-if="phase === 'downloading'" class="set-btn upd-cancel" type="button" @click="cancel">
        {{ t('settingsCancel') }}
      </button>
      <button
        v-else-if="!isDownloaded && phase !== 'upgrading'"
        class="set-btn primary upd-download"
        type="button"
        @click="startDownload"
      >{{ t('settingsDownloadNow') }}</button>
      <button
        v-else-if="phase !== 'upgrading'"
        class="set-btn primary upd-upgrade"
        type="button"
        @click="upgrade"
      >{{ t('settingsUpgradeNow') }}</button>
    </template>
  </Dialog>
</template>

<style scoped>
.upd-body { min-width: min(560px, 82vw); max-height: 52vh; overflow-y: auto; }
.upd-dl-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; color: var(--fg-muted); }
.upd-bar { height: 8px; border-radius: 999px; background: var(--chip-bg); overflow: hidden; }
.upd-bar-fill { display: block; height: 100%; background: var(--accent); transition: width 0.2s var(--ease); }
.upd-logs {
  margin: 0; padding: 12px; border-radius: var(--radius-sm);
  background: var(--console-bg); color: var(--console-fg);
  font-size: 12px; white-space: pre-wrap; word-break: break-all; max-height: 46vh; overflow-y: auto;
}
.upd-log { font-size: 14px; line-height: 1.6; }
.upd-log :deep(h1), .upd-log :deep(h2), .upd-log :deep(h3) { font-size: 15px; margin: 12px 0 6px; }
.upd-log :deep(ul) { padding-left: 20px; margin: 6px 0; }
.upd-log :deep(a) { color: var(--accent-text); }
</style>
