<!-- 1:1 移植自 Vue2 src/views/AI/Agent/blocks/ToolCard.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import AgentIcon from '../icons/AgentIcon.vue'

interface ToolSection {
  label?: string
  kind?: string
  name?: string
  code?: string
}

const STATE_LABELS: Record<string, string> = { running: 'Running', success: 'Completed', error: 'Failed', pending: 'Pending' }

const props = withDefaults(
  defineProps<{
    name: string
    icon?: string
    state?: string
    argsPreview?: string
    time?: string
    sections?: ToolSection[]
    defaultOpen?: boolean
  }>(),
  { icon: 'settings', state: 'success', argsPreview: '', time: '', sections: () => [], defaultOpen: false },
)

const open = ref(props.defaultOpen)
const stateLabel = computed(() => STATE_LABELS[props.state] || '')

function diffLines(code?: string) {
  return String(code || '').split('\n').map((raw) => {
    if (raw.startsWith('+')) return { t: 'add', text: raw.slice(1) }
    if (raw.startsWith('-')) return { t: 'del', text: raw.slice(1) }
    return { t: 'ctx', text: raw }
  })
}
</script>

<template>
  <div class="tool-card" :data-open="open">
    <div class="tool-head" @click="open = !open">
      <div class="tool-icon-wrap" :data-state="state">
        <span v-if="state === 'running'" class="dots">
          <span /><span /><span />
        </span>
        <AgentIcon v-else :name="icon || 'settings'" :size="14" />
      </div>
      <div style="display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1">
        <div class="tool-name">{{ name }}</div>
        <div v-if="argsPreview" class="tool-args-preview">{{ argsPreview }}</div>
      </div>
      <div class="tool-time">{{ state === 'running' ? stateLabel : time }}</div>
      <AgentIcon name="chev" :size="14" class="tool-chev" />
    </div>
    <div v-if="open" class="tool-body">
      <div v-for="(s, i) in (sections || [])" :key="i" class="tool-section">
        <div class="tool-section-label">{{ s.label }}</div>
        <div v-if="s.kind === 'diff'" class="diff">
          <div class="diff-head"><span class="diff-name">{{ s.name || s.label }}</span></div>
          <div class="diff-body scroll">
            <div v-for="(ln, k) in diffLines(s.code)" :key="k" class="diff-line" :data-t="ln.t">
              <span class="gut">{{ k + 1 }}</span>
              <span class="ct">{{ ln.text }}</span>
            </div>
          </div>
        </div>
        <div v-else class="code-block">{{ s.code }}</div>
      </div>
    </div>
  </div>
</template>
