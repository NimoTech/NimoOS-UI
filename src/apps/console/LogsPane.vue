<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import LogConsole from '../../components/ui/LogConsole.vue'
import { useAppLogs } from './useAppLogs'

const props = defineProps<{ appId: string }>()
const { t } = useI18n()
const logs = useAppLogs(() => props.appId)

onMounted(() => logs.start())
onBeforeUnmount(() => logs.stop())
</script>

<template>
  <LogConsole
    :text="logs.text.value"
    :empty-text="t('appsConsoleLogsEmpty')"
    data-test="logs-pre"
  >
    <template #tools>
      <button type="button" class="logs-refresh" data-test="logs-refresh" :disabled="logs.loading.value" @click="logs.refresh()">{{ t('appsConsoleRefresh') }}</button>
    </template>
    <span v-if="logs.error.value" class="logs-err">{{ logs.error.value }}</span>
  </LogConsole>
</template>

<style scoped>
.logs-refresh { padding: 3px 12px; border-radius: 8px; border: 1px solid var(--card-border); background: var(--chip-bg-hi); color: var(--fg); cursor: pointer; font-size: 12px; }
.logs-refresh:disabled { opacity: .5; cursor: default; }
.logs-err { position: absolute; top: 8px; left: 14px; z-index: 10; color: var(--remove-fg); font-size: 12px; }
</style>
