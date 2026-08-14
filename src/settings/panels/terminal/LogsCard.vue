<script setup lang="ts">
// 设置 · 终端与日志 —— 日志卡。对位 Vue2 components/logsAndTerminal/LogsCard.vue(111 行)。
// 移植纪律(登记):Vue2 用 v-html 把服务端日志原文当 HTML 渲染 —— 日志里有用户可控内容
//   (文件名/路径)时是注入面。这里用文本插值 + white-space: pre-wrap,视觉结果一致。
//
// 2026-08 机主验收 SP9-P3:改用 apps/console/LogsPane.vue 同一套展示壳(components/ui/
// LogConsole.vue),不再自成一套外观 —— 深色控制台底 + 圆角 + 右上角浮动工具条 + 贴底自动
// 滚动都与应用控制台一致。原先 .set-logs 的 padding-top: 52px 硬编码撑距离已废,改由
// LogConsole 的 --log-console-* 自定义属性覆盖(见 settings.css .set-logs-wrap 处的注释)。
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LogConsole from '../../../components/ui/LogConsole.vue'
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
    <LogConsole
      :text="text"
      :empty-text="t('settingsTermLoadingLogs')"
      class="set-logs"
      data-test="logs-pre"
    >
      <template #tools>
        <slot name="tools" />
        <button class="set-btn set-logs-fs" type="button" :title="fsLabel" @click="fullscreen = !fullscreen">
          {{ fsLabel }}
        </button>
      </template>
    </LogConsole>
    <!-- The footer sits inside .set-logs-wrap on purpose: the fullscreen state is
         `position: fixed; inset: 16px` on the wrap, so anything placed outside it
         would be covered up and the pager would be unreachable while fullscreen. -->
    <slot name="footer" />
  </div>
</template>
