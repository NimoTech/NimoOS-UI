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
    <button type="button" class="logs-refresh" data-test="logs-refresh" :disabled="logs.loading.value" @click="logs.refresh()">{{ t('appsConsoleRefresh') }}</button>
    <span v-if="logs.error.value" class="logs-err">{{ logs.error.value }}</span>
    <pre ref="box" class="logs-pre" data-test="logs-pre">{{ logs.text.value || t('appsConsoleLogsEmpty') }}</pre>
  </div>
</template>

<style scoped>
/* flex 填满父容器剩余空间(AppConsolePage 定高布局给分母);min-height 兜底极矮视口 */
.logs-wrap { position: relative; display: flex; flex-direction: column; flex: 1 1 auto; min-height: 320px; border-radius: 12px; overflow: hidden; background: var(--console-bg); }
/* Refresh 悬浮右上角(与 TerminalPane 的全屏按钮同款),不再独占一整行顶栏 */
.logs-refresh { position: absolute; top: 8px; right: 12px; z-index: 10; padding: 2px 8px; background: transparent; border: none; color: var(--console-fg); opacity: .5; cursor: pointer; font-size: 12px; }
.logs-refresh:hover { opacity: 1; }
.logs-err { position: absolute; top: 8px; left: 14px; z-index: 10; color: var(--remove-fg); font-size: 12px; }
/* margin 上/右/下 10px:滚动条贴死滚动容器边缘且不可调距,把容器内缩才能让它离开圆角框
   (2026-07-22 真机踩坑:theme.css 对 * 设了标准 scrollbar-width/color,Chrome 121+
   因此禁用全部 ::-webkit-scrollbar 定制,此前的宽度/track margin 都是死代码) */
.logs-pre { flex: 1; margin: 10px 10px 10px 0; padding: 10px 14px; overflow: auto; color: var(--console-fg); font: 13px/1.5 Consolas, Monaco, monospace; white-space: pre-wrap; word-break: break-all; }
/* 固定深底上的拇指用固定亮色 token:全局滚动条色随主题翻转,浅色主题下深拇指在 --console-bg 上不可见 */
.logs-pre { scrollbar-width: thin; scrollbar-color: var(--console-scroll-thumb) transparent; }
</style>
