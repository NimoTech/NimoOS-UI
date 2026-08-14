<!--
  1:1 port from Vue2 src/views/AI/Agent/shell/ThinkingBar.vue (105 lines). SP8-P1c2 Task 8.

  Vue2 is a "dumb" component: state is entirely held by parent (AgentTopbar → AgentPage → store);
  this component only accepts props and emits explicit events upward — no defineModel, no store reads
  (brief explicitly requires keeping this shape; the reason is in AgentTopbar where v-model would
  directly two-way bind update:enabled/level back to its own prop, but the parent here needs to
  re-map in the middle to thinking-enabled/thinking-level before passing to AgentPage;
  defineModel's implicit two-way binding would hide this explicit relay).

  Only bare color: Vue2 ThinkingBar.vue:90 slider background literal white → changed to
  `var(--text-on-accent)` (tokens.scss has this value in both themes, both pure white, semantics is
  exactly "text/foreground color on top of accent color track").
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ThinkingLevel } from '../../stores/agentStore'

withDefaults(
  defineProps<{
    enabled?: boolean
    // F2 fix (review) — four intensity levels are a closed enum; originally only had comments
    // listing valid values, now using ThinkingLevel union type (reusing definition from agentStore.ts,
    // rationale in that file's comment).
    level?: ThinkingLevel
    supportsThinking?: boolean
    providerType?: string // for tooltip text
  }>(),
  {
    enabled: true,
    level: 'medium',
    supportsThinking: false,
    providerType: '',
  },
)

const emit = defineEmits<{
  (e: 'update:enabled', value: boolean): void
  (e: 'update:level', value: string): void
}>()

const { t } = useI18n()

function onToggle(e: Event) {
  emit('update:enabled', (e.target as HTMLInputElement).checked)
}

function onLevelChange(e: Event) {
  emit('update:level', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <div class="thinking-bar" :class="{ disabled: !supportsThinking }">
    <span class="icon">💭</span>
    <span class="label">{{ t('aiThinkingLabel') }}</span>
    <label class="toggle">
      <input
        type="checkbox"
        :checked="enabled"
        :disabled="!supportsThinking"
        @change="onToggle"
      />
      <span class="track"><span class="thumb" /></span>
    </label>

    <span class="strength-label">{{ t('aiThinkingIntensity') }}</span>
    <select
      class="strength-select"
      :value="level"
      :disabled="!supportsThinking || !enabled"
      @change="onLevelChange"
    >
      <option value="low">{{ t('aiThinkingLow') }}</option>
      <option value="medium">{{ t('aiThinkingMedium') }}</option>
      <option value="high">{{ t('aiThinkingHigh') }}</option>
      <option value="max">{{ t('aiThinkingMax') }}</option>
    </select>

    <span v-if="!supportsThinking" class="unsupported-note">
      {{ t('aiThinkingUnsupported') }}
    </span>
    <span v-else-if="providerType === 'deepseek'" class="provider-note">
      {{ t('aiThinkingDeepseekNote') }}
    </span>
  </div>
</template>

<style scoped>
.thinking-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  border-top: 1px solid var(--line-faint);
  min-height: 32px;
}
.thinking-bar.disabled {
  opacity: 0.7;
}
.icon { font-size: 14px; }
.label { font-weight: 500; color: var(--text-primary); }
.strength-label { margin-left: 8px; color: var(--text-primary); }

.toggle { position: relative; display: inline-block; width: 32px; height: 18px; }
.toggle input { opacity: 0; width: 0; height: 0; }
.track {
  position: absolute; inset: 0; background: var(--line-strong); border-radius: 18px;
  transition: background .15s; cursor: pointer;
}
.toggle input:checked + .track { background: var(--accent); }
.toggle input:disabled + .track { cursor: not-allowed; }
.thumb {
  position: absolute; top: 2px; left: 2px; width: 14px; height: 14px;
  background: var(--text-on-accent); border-radius: 50%; transition: left .15s;
  box-shadow: var(--shadow-xs);
}
.toggle input:checked + .track .thumb { left: 16px; }

.strength-select {
  padding: 2px 6px; border: 1px solid var(--line);
  border-radius: var(--r-xs); background: var(--bg-elevated);
  font-size: 13px; color: var(--text-primary);
}
.strength-select:disabled { cursor: not-allowed; }

.unsupported-note, .provider-note {
  margin-left: auto; font-size: 12px; color: var(--text-secondary);
}
</style>
