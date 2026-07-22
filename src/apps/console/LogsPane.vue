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
/* flex 填满父容器剩余空间(AppConsolePage 定高布局给分母);min-height 兜底极矮视口 */
.logs-wrap { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 320px; border-radius: 12px; overflow: hidden; background: var(--console-bg); }
.logs-bar { display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding: 6px 10px; }
.logs-err { color: var(--remove-fg); font-size: 12px; margin-right: auto; }
.logs-refresh { padding: 3px 12px; border-radius: 8px; border: 1px solid var(--card-border); background: var(--chip-bg-hi); color: var(--fg); cursor: pointer; font-size: 12px; }
.logs-pre { flex: 1; margin: 0; padding: 10px 14px; overflow: auto; color: var(--console-fg); font: 13px/1.5 Consolas, Monaco, monospace; white-space: pre-wrap; word-break: break-all; }
/* 固定深底上的滚动条:全局拇指色随主题翻转,浅色主题下深拇指落在 --console-bg 上不可见,
   改用固定亮色 token(与 YamlEditor 同,见 theme.css --console-scroll-thumb) */
.logs-pre { scrollbar-width: thin; scrollbar-color: var(--console-scroll-thumb) transparent; }
.logs-pre::-webkit-scrollbar { width: 12px; height: 12px; }
.logs-pre::-webkit-scrollbar-track { background: transparent; }
.logs-pre::-webkit-scrollbar-thumb { background: var(--console-scroll-thumb); border: 3px solid transparent; background-clip: padding-box; border-radius: 8px; }
.logs-pre::-webkit-scrollbar-thumb:hover { background: var(--console-scroll-thumb-hover); background-clip: padding-box; }
</style>
