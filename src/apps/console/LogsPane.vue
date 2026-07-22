<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppLogs } from './useAppLogs'

const props = defineProps<{ appId: string }>()
const { t } = useI18n()
const logs = useAppLogs(() => props.appId)
const box = ref<HTMLElement | null>(null)

watch(logs.text, () => {
  const el = box.value
  if (!el) return
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  if (atBottom) void nextTick(() => { el.scrollTop = el.scrollHeight })
})
onMounted(() => logs.start())
onBeforeUnmount(() => logs.stop())
</script>

<template>
  <div class="logs-wrap">
    <div class="logs-bar">
      <span v-if="logs.error.value" class="logs-err">{{ logs.error.value }}</span>
      <button type="button" class="logs-refresh" data-test="logs-refresh" :disabled="logs.loading.value" @click="logs.refresh()">{{ t('appsConsoleRefresh') }}</button>
    </div>
    <pre ref="box" class="logs-pre" data-test="logs-pre">{{ logs.text.value || t('appsConsoleLogsEmpty') }}</pre>
  </div>
</template>

<style scoped>
.logs-wrap { display: flex; flex-direction: column; height: 480px; border-radius: 12px; overflow: hidden; background: var(--console-bg); }
.logs-bar { display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding: 6px 10px; }
.logs-err { color: var(--remove-fg); font-size: 12px; margin-right: auto; }
.logs-refresh { padding: 3px 12px; border-radius: 8px; border: 1px solid var(--card-border); background: var(--chip-bg-hi); color: var(--fg); cursor: pointer; font-size: 12px; }
.logs-pre { flex: 1; margin: 0; padding: 10px 14px; overflow: auto; color: var(--console-fg); font: 13px/1.5 Consolas, Monaco, monospace; white-space: pre-wrap; word-break: break-all; }
</style>
