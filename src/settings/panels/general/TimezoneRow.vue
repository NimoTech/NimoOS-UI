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
import { useToast } from '../../../stores/toast'
import '../../styles/settings.css'

const { t } = useI18n()
const toast = useToast()
const value = ref<string>(SYSTEM_DEFAULTS.timezone as string)

// 交错防护(评审 fix 3,非假设性——本仓库反复栽在"异步写共享 state 缺过期/
// 已改动守卫"上):onMounted 的 readSystemConfig() 是真实网络请求,如果用户在
// 它返回前就手动选了别的时区,读取结果不能把用户刚选的值覆盖回去。用户一旦
// 改选就把 touched 置 true,读取回调里检查这个本地标志、不落地共享 store /
// 不抽公共 composable(上一轮评审已定论:这个守卫就地写,不要抽象)。
let touched = false

onMounted(async () => {
  const cfg = await readSystemConfig()
  if (touched) return
  if (typeof cfg.timezone === 'string' && cfg.timezone) value.value = cfg.timezone
})

async function onChange(e: Event) {
  touched = true
  const next = (e.target as HTMLSelectElement).value
  value.value = next
  try {
    await patchSystemConfig({ timezone: next })
  } catch (err) {
    // 评审 fix round 2 · Important:此前只 console.warn,用户毫无感知,以为改好了。
    console.warn('[settings] save timezone failed', err)
    toast.show(t('settingsSaveFailed'))
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
