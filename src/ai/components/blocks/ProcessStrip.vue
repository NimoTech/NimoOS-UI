<!--
  1:1 ported from Vue2 src/views/AI/Agent/blocks/ProcessStrip.vue.
  props.steps type uses AgentBlockLike from groupBlocks (`{type:string,[k:string]:unknown}`)
  rather than a dedicated interface — this way the step array from `groupBlocks()` grouping in
  AssistantMessage can be passed directly without type assertions at the call site; specific
  fields (text/sections/argsPreview/name/icon/time) are read with type casting as needed
  within this file (Vue2 original lacks this layer — necessary conversion under TS strict, behavior 1:1).
-->
<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AgentBlockLike } from '../../util/groupBlocks'
import AgentIcon from '../icons/AgentIcon.vue'

interface StepSection {
  label?: string
  code?: string
}

const props = withDefaults(
  defineProps<{ steps?: AgentBlockLike[]; streaming?: boolean }>(),
  { steps: () => [], streaming: false },
)

const { t } = useI18n()

const open = ref(false)
const expanded = reactive<Record<number, boolean>>({})

const thinkCount = computed(() => props.steps.filter((s) => s.type === 'thinking').length)
const toolCount = computed(() => props.steps.filter((s) => s.type === 'tool').length)
const headLabel = computed(() => {
  const verb = props.streaming ? t('aiProcWorking') : t('aiProcProcessed')
  const bits: string[] = []
  if (thinkCount.value) bits.push(t('aiProcThinkingWord'))
  if (toolCount.value) bits.push(t('aiProcSteps', { n: toolCount.value }))
  return bits.length ? `${verb} · ${bits.join(' + ')}` : verb
})

function toggle(i: number) {
  expanded[i] = !expanded[i]
}
function kindOf(s: AgentBlockLike): string {
  return s.type === 'thinking' ? 'think' : 'tool'
}
function iconOf(s: AgentBlockLike): string {
  if (s.type === 'thinking') return 'sparkle'
  return (s.icon as string | undefined) || 'wrench'
}
function labelOf(s: AgentBlockLike): string {
  if (s.type === 'thinking') return t('aiProcReasoned')
  return (s.name as string | undefined) || t('aiProcTool')
}
function metaOf(s: AgentBlockLike): string {
  if (s.type === 'thinking') return ''
  return (s.time as string | undefined) || ''
}
function textOf(s: AgentBlockLike): string {
  return (s.text as string | undefined) || ''
}
function argsPreviewOf(s: AgentBlockLike): string {
  return (s.argsPreview as string | undefined) || ''
}
function sectionsOf(s: AgentBlockLike): StepSection[] {
  return (s.sections as StepSection[] | undefined) || []
}
</script>

<template>
  <div class="proc">
    <div class="proc-head" :data-open="open" @click="open = !open">
      <AgentIcon name="chev" :size="13" class="chev" />
      <span>{{ headLabel }}</span>
    </div>
    <div v-if="open" class="proc-body">
      <div v-for="(s, i) in steps" :key="i" class="step" :data-open="!!expanded[i]">
        <div class="step-line" @click="toggle(i)">
          <span class="step-ic" :data-kind="kindOf(s)">
            <AgentIcon :name="iconOf(s)" :size="13" />
          </span>
          <span class="step-label">{{ labelOf(s) }}</span>
          <span v-if="metaOf(s)" class="step-meta">{{ metaOf(s) }}</span>
          <AgentIcon name="chev" :size="13" class="step-chev" />
        </div>
        <div v-if="expanded[i]" class="step-detail" :class="{ think: s.type === 'thinking' }">
          <template v-if="s.type === 'thinking'">
            {{ textOf(s) }}
          </template>
          <template v-else>
            <div v-if="!sectionsOf(s).length" class="step-empty">
              {{ argsPreviewOf(s) || t('aiProcNoDetails') }}
            </div>
            <div v-for="(sec, j) in sectionsOf(s)" :key="j" class="tool-section">
              <div class="tool-section-label">
                {{ sec.label }}
              </div>
              <div class="code-block">
                {{ sec.code }}
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
