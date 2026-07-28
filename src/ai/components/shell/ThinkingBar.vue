<!--
  1:1 移植自 Vue2 src/views/AI/Agent/shell/ThinkingBar.vue(105 行)。SP8-P1c2 Task 8。

  Vue2 是"哑"组件:state 全由父组件(AgentTopbar → AgentPage → store)持有，本组件
  只接 props、往上 emit 显式事件——不用 defineModel、不读 store(brief 明确要求保持
  这个形状，理由见 AgentTopbar 里 v-model 会把 update:enabled/level 直接双向绑定回
  自己的 prop，而这里父组件需要在中间重映射成 thinking-enabled/thinking-level 再往
  上抛给 AgentPage，defineModel 的隐式双向绑定会掩盖这层显式转发)。

  唯一裸色:Vue2 ThinkingBar.vue:90 的滑块 background 字面白色 → 已改 `var(--text-on-accent)`
  (tokens.scss 两套主题都已有值，均为纯白，语义正是"叠在强调色轨道上的文字/前景色")。
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ThinkingLevel } from '../../stores/agentStore'

withDefaults(
  defineProps<{
    enabled?: boolean
    // F2 修复(review)—— 四档强度是闭合枚举,原先只靠注释列举合法值,改用
    // ThinkingLevel 联合类型(复用 agentStore.ts 的定义,理由见那里的注释)。
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
