<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L157-173 + watcher L1230-1237。
// 移植纪律 #2:Vue2 的 'barData.disk_standby' watcher 在初次 hydrate 时也会 fire,
// 于是每次打开设置页都会对磁盘下一次 standby 指令。这里只在用户 change 时下发。
// 两件事都要做:① patch 配置(给旧 UI 与下次启动读)② 立刻下发指令(当次生效)。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import SettingsRow from '../../components/SettingsRow.vue'
import { STANDBY_OPTIONS, parseStandbyMinutes } from '../../util/standby'
import { readSystemConfig, patchSystemConfig, SYSTEM_DEFAULTS } from '../../util/systemConfig'
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const { t } = useI18n()
const toast = useToast()
const value = ref<string>(SYSTEM_DEFAULTS.disk_standby as string)

// 交错防护(评审 fix 3,同 TimezoneRow.vue 的理由):真实网络延迟下,用户可能
// 在 onMounted 的读取返回前就已经改选并下发了正确的指令 —— 读取回调不能把
// 显示值再冲回服务端的旧快照。就地布尔标志,不抽公共 helper。
let touched = false

onMounted(async () => {
  const cfg = await readSystemConfig()
  if (touched) return
  if (typeof cfg.disk_standby === 'string' && cfg.disk_standby) value.value = cfg.disk_standby
})

async function onChange(e: Event) {
  touched = true
  const next = (e.target as HTMLSelectElement).value
  value.value = next
  try {
    await patchSystemConfig({ disk_standby: next })
  } catch (err) {
    console.warn('[settings] save disk_standby failed', err)
  }
  try {
    await service.sys.setDiskStandby({ minutes: parseStandbyMinutes(next) })
  } catch (err) {
    // 配置已落库,只是这一次没下发成功 → 提示但不把 select 弹回去
    console.warn('[settings] apply disk standby failed', err)
    toast.show(t('settingsSaveFailed'))
  }
}
</script>

<template>
  <SettingsRow :label="t('settingsDiskStandby')">
    <template #control>
      <select class="set-select" :value="value" @change="onChange">
        <option v-for="o in STANDBY_OPTIONS" :key="o.value" :value="o.value">{{ t(o.labelKey) }}</option>
      </select>
    </template>
  </SettingsRow>
</template>
