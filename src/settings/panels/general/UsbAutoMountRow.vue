<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L211-217(行)+ getUsbStatus L1442 / usbAutoMount L1449。
// 移植纪律:Vue2 的 usbAutoMount() 是 fire-and-forget(不 await、不看结果),
// 下发失败时开关停在新位置、界面在骗人。这里改成失败弹回。
// 树莓派警告:Vue2 用 hardwareInfo().drive_model 是否含 "raspberry" 判断
// (LocalStorage 服务在树莓派上会静默强制关掉 USB 自动挂载,见顶层 CLAUDE.md)。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SettingsRow from '../../components/SettingsRow.vue'
import SettingsSwitch from '../../components/SettingsSwitch.vue'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const { t } = useI18n()
const toast = useToast()

const on = ref(false)
const busy = ref(false)
const isRpi = ref(false)
const warn = ref('')

// 交错防护(同 DiskStandbyRow.vue / WebUiPortRow.vue 的理由):真实网络延迟下,
// 用户可能在 onMounted 的两个读取都返回前就已经点了开关 —— 读取回调不能把
// 显示值冲回服务端的旧快照。就地布尔标志,不抽公共 helper(本仓库此前评审裁定过早抽象)。
let touched = false

onMounted(async () => {
  // `service.sys` is a getter that throws synchronously before initService() runs.
  // Reading it while the array literal is being evaluated puts that throw outside
  // allSettled's protection, so it escapes as an unhandled rejection. Wrapping
  // each call in an async thunk moves the getter access inside the promise, where
  // allSettled can catch it. Production never hits this (main.ts initialises
  // first), but any entry point mounting a settings component earlier would.
  await Promise.allSettled([
    (async () => {
      const v = await service.sys.getUsbStatus()
      if (!touched) on.value = v
    })(),
    (async () => {
      const hw = await service.sys.hardwareInfo()
      const model = typeof hw.drive_model === 'string' ? hw.drive_model : ''
      isRpi.value = model.toLowerCase().includes('raspberry')
    })(),
  ])
})

async function onToggle(next: boolean) {
  if (busy.value) return
  touched = true
  const prev = on.value
  on.value = next            // 乐观翻转
  busy.value = true
  warn.value = ''
  try {
    await service.sys.toggleUsbAutoMount({ state: next ? 'on' : 'off' })
    // 警告只针对「开启」方向
    if (next && isRpi.value) warn.value = t('settingsUsbRpiWarn')
  } catch (e) {
    on.value = prev          // 失败弹回(Vue2 不弹,界面会骗人)
    toast.show(t('settingsSaveFailed'))
    console.warn('[settings] toggleUsbAutoMount failed', e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <SettingsRow :label="t('settingsUsbAutoMount')">
    <template #control>
      <SettingsSwitch
        :model-value="on"
        :label="t('settingsUsbAutoMount')"
        :disabled="busy"
        @update:model-value="onToggle"
      />
    </template>
    <template v-if="warn" #hint><span class="set-warn">{{ warn }}</span></template>
  </SettingsRow>
</template>
