<script setup lang="ts">
// 设置区路由组件:按 :tab 挑一个骨架塞进外壳,并维护「上次 tab」记忆。
// 未知 :tab 的回落由路由 beforeEnter 负责(见 src/settings/settingsRoutes.ts),
// 此处仍做一次兜底 —— 组件也可能被直接挂载(测试/将来的复用)。
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SettingsShell from '../components/SettingsShell.vue'
import { PANEL_BY_TAB } from '../panels'
import { DEFAULT_TAB, isSettingsTab, type SettingsTab } from '../util/tabs'
import { writeLastTab } from '../util/lastTab'

const route = useRoute()
const router = useRouter()

const tab = computed<SettingsTab>(() =>
  isSettingsTab(route.params.tab) ? route.params.tab : DEFAULT_TAB,
)
const panel = computed(() => PANEL_BY_TAB[tab.value])

watch(tab, (t) => writeLastTab(t), { immediate: true })

function go(next: string) {
  if (!isSettingsTab(next) || next === tab.value) return
  router.push(`/settings/${next}`)
}
</script>

<template>
  <SettingsShell :current="tab" @select="go">
    <!-- key 让切 tab 时重建骨架而不是复用同一实例(各 panel 后续会各自持有请求状态)。
         整块靠 <component :is> 换,不存在 v-show —— sp8 P2a 记过 v-show 的窄屏回归坑。 -->
    <component :is="panel" :key="tab" @open-tab="go" />
  </SettingsShell>
</template>
