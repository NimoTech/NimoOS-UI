<script setup lang="ts">
// 设置 · 终端与日志 —— 日志卡。对位 Vue2 components/logsAndTerminal/LogsCard.vue(111 行)。
// 移植纪律(登记):Vue2 用 v-html 把服务端日志原文当 HTML 渲染 —— 日志里有用户可控内容
//   (文件名/路径)时是注入面。这里用文本插值 + white-space: pre-wrap,视觉结果一致。
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import '../../styles/settings.css'

defineProps<{ text: string }>()
const { t } = useI18n()
const fullscreen = ref(false)
const fsLabel = computed(() =>
  fullscreen.value ? t('settingsTermExitFullscreen') : t('settingsTermFullscreen'),
)
</script>

<template>
  <div class="set-logs-wrap" :class="{ 'is-fullscreen': fullscreen }">
    <div class="set-logs-tools">
      <slot name="tools" />
      <button class="set-btn set-logs-fs" type="button" :title="fsLabel" @click="fullscreen = !fullscreen">
        {{ fsLabel }}
      </button>
    </div>
    <pre v-if="text" class="set-logs">{{ text }}</pre>
    <pre v-else class="set-logs">{{ t('settingsTermLoadingLogs') }}</pre>
  </div>
</template>
