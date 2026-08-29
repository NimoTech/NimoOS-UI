<script setup lang="ts">
// Settings-area route component: picks a skeleton for :tab and slots it into the shell, tracking the "last tab" memory.
// Fallback for an unknown :tab is handled by the route's beforeEnter (see src/settings/settingsRoutes.ts),
// but we still do a fallback here too -- the component may also be mounted directly (tests / future reuse).
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
    <!-- The key rebuilds the skeleton instead of reusing the same instance when switching tabs (each panel will later hold its own request state).
         The whole block swaps via <component :is>, there's no v-show -- sp8 P2a recorded a v-show narrow-screen regression trap. -->
    <component :is="panel" :key="tab" @open-tab="go" />
  </SettingsShell>
</template>
