<script setup lang="ts">
// Corresponds to two rows in Vue2 SettingsPanel.vue:
//   - L249-278 "Firmware Update", data from /sys/os_version (kind='os')
//   - L281-312 "System Update" (source comment says App Update), data from /sys/version (kind='app')
// ⚠️ Vue2's labels and data sources really are crossed like this — since the UI is a 1:1
// port, keep it as-is, don't "correct" the labels.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service, type UpdateCheck } from '@nimotech/nimoos-service'
import SettingsRow from '../../components/SettingsRow.vue'
import UpdateDialog from '../../components/UpdateDialog.vue'
import type { UpdateKind } from '../../util/updateKind'
import { useMessageBus } from '../../../composables/useMessageBus'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const props = defineProps<{ kind: UpdateKind; sub?: string }>()

const { t } = useI18n()
const toast = useToast()
const bus = useMessageBus()

const EV = {
  os: { progress: 'nimoos:upgrade:progress', done: 'nimoos:upgrade:downloaded' },
  app: { progress: 'nimoos:app:download:progress', done: 'nimoos:app:downloaded' },
} as const

const info = ref<UpdateCheck>({ current_version: '', need_update: false })
const checking = ref(false)
const dialogOpen = ref(false)
const wasDownloading = ref(false)

const label = computed(() => (props.kind === 'os' ? t('settingsFirmwareUpdate') : t('settingsSystemUpdate')))
// The os row's sublabel comes from the parent component's hardware.version (Vue2 L254);
// the app row uses its own current_version (L287)
const subLabel = computed(() => `v${props.sub || info.value.current_version || '1.0.0'}`)
const progress = computed(() => info.value.download_progress ?? 0)

async function fetchInfo(): Promise<UpdateCheck | null> {
  try {
    const res = props.kind === 'app' ? await service.sys.getAppVersion() : await service.sys.getOsVersion()
    // Vue2 checkVersion/checkAppVersion guard: a stale polled-back progress value must
    // not overwrite a larger, more up-to-date live progress value
    if (res.is_downloading && (info.value.download_progress ?? 0) > (res.download_progress ?? 0)) {
      res.download_progress = info.value.download_progress
    }
    info.value = res
    return res
  } catch (e) {
    console.warn('[settings] version check failed', props.kind, e)
    return null
  }
}

let unsub: (() => void)[] = []
onMounted(async () => {
  await fetchInfo()
  const ev = EV[props.kind]
  unsub.push(bus.on(ev.progress, (p) => {
    const v = Number.parseFloat(String((p as { progress?: unknown })?.progress ?? ''))
    if (!Number.isFinite(v)) return
    info.value = { ...info.value, is_downloading: true, download_progress: v }
  }))
  unsub.push(bus.on(ev.done, () => { void fetchInfo() }))
})
onBeforeUnmount(() => { unsub.forEach((f) => f()); unsub = [] })

// Corresponds to Vue2 showUpdateModal / showAppUpdateModal: check once first, and if
// there's no update, just show a toast
async function check() {
  checking.value = true
  const res = await fetchInfo()
  checking.value = false
  if (!res) return
  if (!res.need_update) {
    toast.show(t('settingsLatestVersion'))
    return
  }
  wasDownloading.value = false
  dialogOpen.value = true
}

// Corresponds to Vue2 showFirmwareDownloadingModal / showAppDownloadingModal: go straight
// into the downloading state
function openDownloading() {
  wasDownloading.value = true
  dialogOpen.value = true
}
</script>

<template>
  <SettingsRow :label="label" :sub="subLabel">
    <template #control>
      <!-- is_downloading takes priority over need_update: the MessageBus progress event only
           updates is_downloading/download_progress, it doesn't also flip need_update to true
           (the real backend keeps the two consistent, but unit tests/push timing can skew
           them by a tick), so here "currently downloading" overrides the "needs update"
           check, to avoid a flash of "already up to date". -->
      <button v-if="info.is_downloading" class="set-btn primary ur-progress" type="button" @click="openDownloading">
        {{ t('settingsDownloading') }} {{ progress }}%
      </button>
      <span v-else-if="!info.need_update" class="set-ok">{{ t('settingsLatestVersion') }} ✓</span>
      <span v-else-if="info.is_downloaded" class="set-info">
        v{{ info.latest_version }} {{ t('settingsDownloaded') }} ✓
      </span>

      <button v-if="info.is_downloaded" class="set-btn primary ur-open" type="button" @click="dialogOpen = true">
        {{ t('settingsUpdateNow') }}
      </button>
      <button
        v-else-if="!info.is_downloading"
        class="set-btn primary ur-check"
        type="button"
        :disabled="checking"
        @click="check"
      >{{ t('settingsCheckUpdate') }}</button>
    </template>
  </SettingsRow>

  <UpdateDialog
    :open="dialogOpen"
    :kind="kind"
    :info="info"
    :currently-downloading="wasDownloading"
    @update:open="dialogOpen = $event"
    @changed="fetchInfo"
  />
</template>
