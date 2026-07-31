<script setup lang="ts">
// 服务端 system blob 里一个布尔字段的开关行。两处复用:
//   - 推荐应用(Vue2 L220-226,直接保存)
//   - 新闻流  (Vue2 L229-236 + rssConfirm L1696-1715,**只在开启方向**弹确认)
// 「显示其他 Docker 容器应用」那一行不做 —— Vue2 恒不渲染(债务 D15,见计划 §实测校正 4)。
//
// 移植纪律 #1:加载不回写;只在用户拨动时 patch,且只写自己那一个字段
// (整块覆写会和别的行/语言互相洗,见 systemConfig.ts 的串行队列)。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/SettingsRow.vue'
import SettingsSwitch from '../../components/SettingsSwitch.vue'
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { readSystemConfig, patchSystemConfig, SYSTEM_DEFAULTS } from '../../util/systemConfig'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const props = defineProps<{
  field: string
  labelKey: string
  /** 三个 confirm* 同时给才启用「开启前确认」 */
  confirmTitleKey?: string
  confirmMsgKey?: string
  confirmOkKey?: string
}>()

const { t } = useI18n()
const toast = useToast()

const on = ref<boolean>(SYSTEM_DEFAULTS[props.field] === true)
const busy = ref(false)
const confirmOpen = ref(false)

// 交错防护(同 DiskStandbyRow.vue / WebUiPortRow.vue 的理由):真实网络延迟下,用户
// 可能在 onMounted 的读取返回前就已经拨动过开关(直接落库,或走确认弹窗)——
// 读取回调不能把显示值冲回服务端的旧快照。就地布尔标志,不抽公共 helper
// (本仓库此前评审裁定跨组件抽象是过早抽象)。
let touched = false

onMounted(async () => {
  const cfg = await readSystemConfig()
  if (touched) return
  if (typeof cfg[props.field] === 'boolean') on.value = cfg[props.field] as boolean
})

async function save(next: boolean) {
  // 评审 fix round 2 · Minor:touched 必须在「真的要保存」这一刻才置位,不能在
  // onToggle 打开确认弹窗那一刻就置(此前的坑:开了确认框但用户点了取消,
  // touched 已经是 true,迟到的 hydrate 再也无法把行拉回服务端真实值,
  // 行为永久卡在用户没有确认过的旧显示值上)。
  touched = true
  const prev = on.value
  on.value = next
  busy.value = true
  try {
    await patchSystemConfig({ [props.field]: next })
  } catch (e) {
    on.value = prev
    toast.show(t('settingsSaveFailed'))
    console.warn('[settings] save switch failed', props.field, e)
  } finally {
    busy.value = false
  }
}

function onToggle(next: boolean) {
  // 只有「开启」方向需要确认;关闭方向直接存(对位 Vue2 rssConfirm 的 !rss_switch 分支)
  if (next && props.confirmMsgKey) {
    confirmOpen.value = true
    return
  }
  void save(next)
}

function onConfirm() {
  confirmOpen.value = false
  void save(true)
}
</script>

<template>
  <SettingsRow :label="t(labelKey)">
    <template #control>
      <SettingsSwitch
        :model-value="on"
        :label="t(labelKey)"
        :disabled="busy"
        @update:model-value="onToggle"
      />
    </template>
  </SettingsRow>

  <AlertDialog
    v-if="confirmMsgKey && confirmTitleKey && confirmOkKey"
    :open="confirmOpen"
    :title="t(confirmTitleKey)"
    :message="t(confirmMsgKey)"
    :confirm-text="t(confirmOkKey)"
    :cancel-text="t('settingsCancel')"
    @update:open="confirmOpen = $event"
    @confirm="onConfirm"
  />
</template>
