<script setup lang="ts">
// 对位 Vue2 UpdateModal.vue(321 行)。三种态:changelog(默认)/ 下载中(进度条)/ 升级中(日志)。
// spec §5.1 还点名了 UpdateCompleteModal(177 行)—— **不移植**:
// 它只由 Home.vue 在 localStorage['is_update']==='true' 时弹,而全仓没有一处写过该键
// (触发器从未实现)→ 从未弹过。用户 2026-07-31 拍板跳过,债务 D14。
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

// 事件名逐字取自 Vue2 sockets 块(SettingsPanel.vue L2201-2229 / UpdateModal.vue L203-241)。
// 两套事件必须按 kind 分开订阅 —— 串台会把固件进度显示到系统更新上。
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
  try {
    // 下载不是独立端点:靠 version 检查带 trigger_download=1 触发
    const res = props.kind === 'app'
      ? await service.sys.getAppVersion({ trigger_download: 1 })
      : await service.sys.getOsVersion({ trigger_download: 1 })
    if (res.is_downloaded) {
      phase.value = 'idle'
      toast.show(t('settingsDownloaded'))
      emit('changed')
      emit('update:open', false)
    }
    // 否则等 MessageBus 的进度 / downloaded 事件。
    // Vue2 这里还额外起了 3 秒轮询兜底(UpdateModal startProgressPolling);
    // MessageBus 的 downloaded 事件已覆盖同一件事,再加一条轮询只是重复,故不照抄。
  } catch (e) {
    phase.value = 'idle'
    console.warn('[settings] trigger download failed', e)
    toast.show(t('settingsSaveFailed'))
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
  try {
    if (props.kind === 'app') await service.sys.updateApp()
    else await service.sys.updateOs()
  } catch (e) {
    phase.value = 'idle'      // 让用户能再试一次,而不是卡在日志空屏
    console.warn('[settings] upgrade failed', e)
    toast.show(t('settingsUpgradeFailed'))
    return
  }
  pollLogs()
}

function pollLogs() {
  stopLogs()
  const path = LOG_PATH[props.kind]
  logTimer = setInterval(async () => {
    try {
      // FileContent 是具名类型({ content: string }),不需要 cast
      const res = await service.file.getContent(path)
      logs.value = res.content ?? ''
    } catch { /* 日志文件可能还没建出来,静默重试 */ }
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

      <!-- renderMarkdown 是 html:false 的 markdown-it —— 原始 HTML 被转义,v-html 其输出安全 -->
      <div v-else class="upd-log" v-html="changelogHtml"></div>
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
