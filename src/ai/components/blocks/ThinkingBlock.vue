<!-- 1:1 移植自 Vue2 src/views/AI/Agent/blocks/ThinkingBlock.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import AgentIcon from '../icons/AgentIcon.vue'

const props = withDefaults(
  defineProps<{ text?: string; streaming?: boolean; defaultOpen?: boolean }>(),
  { text: '', streaming: false, defaultOpen: false },
)

const open = ref(props.defaultOpen)
watch(() => props.defaultOpen, (v) => { open.value = v })
</script>

<template>
  <div>
    <div class="thinking" :style="{ cursor: streaming ? 'default' : 'pointer' }"
         @click="!streaming && (open = !open)">
      <div class="thinking-icon" />
      <div style="flex: 1">
        <span style="font-style: normal; font-weight: 500; color: var(--text-secondary)">
          {{ streaming ? 'Thinking' : (open ? 'Hide reasoning' : 'Reasoned') }}
        </span>
        <span v-if="streaming" class="dots" style="margin-left: 8px">
          <span /><span /><span />
        </span>
        <span v-if="!open && !streaming" style="margin-left: 8px; opacity: 0.7">· Click to expand</span>
      </div>
      <AgentIcon v-if="!streaming" :name="open ? 'chevDown' : 'chev'" :size="14" />
    </div>
    <div v-if="open || streaming" class="thinking-content">
      {{ text }}<span v-if="streaming" class="caret" />
    </div>
  </div>
</template>
