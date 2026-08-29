<!-- 1:1 ported from Vue2 src/views/AI/Agent/blocks/MaxTurnsCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProvidedAgentStore } from '../../composables/useProvidedAgentStore'

// BlockRenderer passes through via v-bind="block", so block.resumed automatically maps to this prop.
const props = withDefaults(defineProps<{ maxTurns?: number; resumed?: boolean }>(), { maxTurns: 0, resumed: false })
const { t } = useI18n()
const store = useProvidedAgentStore()

const busy = computed(() => store.busy)

function onContinue() {
  if (busy.value || props.resumed) return
  store.continueRun()
}
</script>

<template>
  <div class="max-turns-card">
    <div class="mt-text">
      {{ t('aiMaxTurnsReached') }}<span v-if="maxTurns"> ({{ maxTurns }} {{ t('aiSteps') }})</span>{{ t('aiTaskPaused') }}
    </div>
    <button class="mt-continue" :disabled="busy || resumed" @click="onContinue">
      {{ resumed ? t('aiResumed') : (busy ? t('aiResuming') : t('aiResume')) }}
    </button>
  </div>
</template>

<style scoped>
.max-turns-card {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; margin: 8px 0;
  border: 1px solid var(--line); border-radius: var(--r-sm);
  background: var(--bg-sunken);
}
.mt-text { font-size: 13px; color: var(--text-secondary); }
.mt-continue {
  margin-left: auto; padding: 5px 16px; border-radius: var(--r-xs);
  border: none; cursor: pointer; background: var(--accent); color: var(--text-on-accent);
}
.mt-continue:disabled { opacity: .6; cursor: default; }
</style>
