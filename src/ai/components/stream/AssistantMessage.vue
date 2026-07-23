<!--
  1a 版:对齐 Vue2 src/views/AI/Agent/stream/AssistantMessage.vue,
  但不用 groupBlocks/ProcessStrip —— `v-for="b in msg.blocks"` 直接过 BlockRenderer。
  footer 只保 Copy 按钮;Regenerate/Read-aloud 记 1c 账。
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '../../../stores/toast'
import BlockRenderer from '../blocks/BlockRenderer.vue'
import AgentIcon from '../icons/AgentIcon.vue'

interface AssistantBlock {
  type: string
  text?: string
  [key: string]: unknown
}

interface AssistantStats {
  ttftMs?: number | null
  outputTokens?: number | null
  tokensPerSec?: number | null
  totalMs?: number | null
}

interface AssistantMsgLike {
  id?: string | number
  blocks?: AssistantBlock[]
  streaming?: boolean
  stats?: AssistantStats
  [key: string]: unknown
}

const props = defineProps<{ msg: AssistantMsgLike }>()
const { t } = useI18n()
const toast = useToast()

const toolCount = computed(() => (props.msg.blocks || []).filter((b) => b.type === 'tool').length)

// 1:1 移植自 Vue2 src/views/AI/Agent/services/agentStream.js:654-658
// (agentStream.js 整体是 1b 的流式模块,这里只借它这一个纯格式化函数)
function formatMs(ms?: number | null): string {
  if (ms == null) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const statsLine = computed(() => {
  const s = props.msg.stats
  if (!s) return ''
  const parts: string[] = []
  // 注意:Vue2 原句 `TTFT {ms}` / `Duration {ms}` 不在本期 i18n key 映射表内
  // (Task 4 才建 ai* key 集,且本任务禁止单边加 locale key),故此处保留英文
  // 字面标签,不经 t() —— 视觉文案与 Vue2 一致,只是暂不接入 i18n。
  if (s.ttftMs != null) parts.push(`TTFT ${formatMs(s.ttftMs)}`)
  if (s.outputTokens != null) parts.push(`${s.outputTokens} tok`)
  if (s.tokensPerSec != null) parts.push(`${s.tokensPerSec} tok/s`)
  if (s.totalMs != null) parts.push(`Duration ${formatMs(s.totalMs)}`)
  return parts.join(' · ')
})

function copy() {
  const text = (props.msg.blocks || [])
    .filter((b) => b.type === 'md')
    .map((b) => b.text)
    .join('\n\n')
  navigator.clipboard.writeText(text)
  toast.show(t('aiCopied'))
}
</script>

<template>
  <div class="msg msg-assistant">
    <div class="msg-head">
      <div class="assistant-mark" />
      <span style="font-weight: 500; color: var(--text-secondary)">Nimo</span>
      <span v-if="toolCount > 0">·</span>
      <span v-if="toolCount > 0">used {{ toolCount }} tool{{ toolCount > 1 ? 's' : '' }}</span>
    </div>
    <!-- 1b: groupBlocks/ProcessStrip -->
    <div v-for="(b, i) in msg.blocks || []" :key="i">
      <BlockRenderer :block="b" />
    </div>
    <div
      v-if="!msg.streaming"
      style="display: flex; align-items: center; gap: 8px; margin-top: 4px;
             color: var(--text-tertiary); font-size: 12px;"
    >
      <span v-if="statsLine">{{ statsLine }}</span>
      <span v-if="statsLine" style="opacity: 0.4;">·</span>
      <button class="icon-btn" style="width: 26px; height: 26px" @click="copy" :title="t('aiCopy')">
        <AgentIcon name="copy" :size="13" />
      </button>
      <!-- 1c: regenerate/read-aloud -->
    </div>
  </div>
</template>
