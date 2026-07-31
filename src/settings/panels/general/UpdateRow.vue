<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue 的两行:
//   - L249-278「Firmware Update」,数据来自 /sys/os_version(kind='os')
//   - L281-312「System Update」(源码注释写 App Update),数据来自 /sys/version(kind='app')
// ⚠️ Vue2 的标签与数据源确实是交叉的,界面 1:1 就照留,别"纠正"标签。
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
// os 行副标题由父组件传 hardware.version(Vue2 L254);app 行用自己的 current_version(L287)
const subLabel = computed(() => `v${props.sub || info.value.current_version || '1.0.0'}`)
const progress = computed(() => info.value.download_progress ?? 0)

async function fetchInfo(): Promise<UpdateCheck | null> {
  try {
    const res = props.kind === 'app' ? await service.sys.getAppVersion() : await service.sys.getOsVersion()
    // Vue2 checkVersion/checkAppVersion 的保护:轮询回来的旧进度不许覆盖更大的实时进度
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

// 对位 Vue2 showUpdateModal / showAppUpdateModal:先查一次,没更新就只弹提示
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

// 对位 Vue2 showFirmwareDownloadingModal / showAppDownloadingModal:直接进下载态
function openDownloading() {
  wasDownloading.value = true
  dialogOpen.value = true
}
</script>

<template>
  <SettingsRow :label="label" :sub="subLabel">
    <template #control>
      <!-- is_downloading 优先于 need_update 判断:MessageBus 进度事件只更新
           is_downloading/download_progress,不会连带把 need_update 也翻成 true
           (真实后端两者本应一致,但单测/推送时序可能错开一拍),
           这里让"正在下载"这件事本身盖过"要不要更新"的判断,避免闪烁成"已是最新"。 -->
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
