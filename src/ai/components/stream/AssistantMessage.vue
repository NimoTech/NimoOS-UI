<!--
  1:1 port from Vue2 src/views/AI/Agent/stream/AssistantMessage.vue;
  1b re-adds groupBlocks/ProcessStrip (1a version was `v-for="b in msg.blocks"` directly through
  BlockRenderer placeholder). Footer only keeps Copy button; Regenerate/Read-aloud recorded in 1c.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '../../../stores/toast'
import { copyText } from '../../../files/util/clipboard'
import { groupBlocks, type AgentBlockLike, type ProcessGroup } from '../../util/groupBlocks'
import { formatMs } from '../../services/streamMappers'
import BlockRenderer from '../blocks/BlockRenderer.vue'
import ProcessStrip from '../blocks/ProcessStrip.vue'
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

// 1b: groupBlocks merges consecutive thinking/tool blocks into a ProcessStrip entry
// (`__process: true`), other blocks pass through BlockRenderer as-is.
const renderItems = computed(() => groupBlocks(props.msg.blocks ?? []))

function isProcessGroup(item: AgentBlockLike | ProcessGroup): item is ProcessGroup {
  return (item as ProcessGroup).__process === true
}

const statsLine = computed(() => {
  const s = props.msg.stats
  if (!s) return ''
  const parts: string[] = []
  // Note: Vue2 original sentence `TTFT {ms}` / `Duration {ms}` is not in this phase's i18n key mapping
  // table (ai* key set created in Task 4, and this task forbids single-sided locale key additions),
  // so English literal labels are kept here, not passed through t() — visual copy matches Vue2,
  // just not hooked into i18n yet.
  if (s.ttftMs != null) parts.push(`TTFT ${formatMs(s.ttftMs)}`)
  if (s.outputTokens != null) parts.push(`${s.outputTokens} tok`)
  if (s.tokensPerSec != null) parts.push(`${s.tokensPerSec} tok/s`)
  if (s.totalMs != null) parts.push(`Duration ${formatMs(s.totalMs)}`)
  return parts.join(' · ')
})

async function copy() {
  const text = (props.msg.blocks || [])
    .filter((b) => b.type === 'md')
    .map((b) => b.text)
    .join('\n\n')
  try {
    await copyText(text)
    toast.show(t('aiCopied'))
  } catch {
    /* Silent: matches Vue2 behavior, no feedback on copy failure */
  }
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
    <template v-for="(item, i) in renderItems" :key="i">
      <ProcessStrip v-if="isProcessGroup(item)" :steps="item.steps" :streaming="!!msg.streaming" />
      <BlockRenderer v-else :block="item" />
    </template>
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
