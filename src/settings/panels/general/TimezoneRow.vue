<script setup lang="ts">
// 对位 Vue2 SettingsPanel.vue L138-154。
// 移植纪律 #1:Vue2 的 barData 深度 watcher 会在**加载完成的那一刻**把刚读到的配置
// 原样写回服务端(每次打开设置都白写一次)。这里只在用户 change 时才 patch。
// 注意:时区目前只有 Vue2 的时钟组件在消费(New-UI 还没有对位小组件),
// 但两套 UI 共用服务端同一个 system blob —— 在这里改是真的会影响旧 UI 的时钟,不是空操作。
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/SettingsRow.vue'
import { TIMEZONES } from '../../util/timezones'
import { readSystemConfig, patchSystemConfig, SYSTEM_DEFAULTS } from '../../util/systemConfig'
import '../../styles/settings.css'

const { t } = useI18n()
const value = ref<string>(SYSTEM_DEFAULTS.timezone as string)

onMounted(async () => {
  const cfg = await readSystemConfig()
  if (typeof cfg.timezone === 'string' && cfg.timezone) value.value = cfg.timezone
})

async function onChange(e: Event) {
  const next = (e.target as HTMLSelectElement).value
  value.value = next
  try {
    await patchSystemConfig({ timezone: next })
  } catch (err) {
    console.warn('[settings] save timezone failed', err)
  }
}
</script>

<template>
  <SettingsRow :label="t('settingsTimezone')">
    <template #control>
      <select class="set-select" :value="value" @change="onChange">
        <option v-for="tz in TIMEZONES" :key="tz.value" :value="tz.value">{{ tz.label }}</option>
      </select>
    </template>
  </SettingsRow>
</template>
