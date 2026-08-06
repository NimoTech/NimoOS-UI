<!-- 1:1 移植自 Vue2 src/views/AI/Agent/blocks/ContextUsageBar.vue -->
<!-- 模板: 33-61, 样式: 63-107. 几何/阈值/格式化全部改调 Task 5 的 contextUsage.ts,不在本地重算。 -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatTokens, levelFor, dashArrayFor } from '../../util/contextUsage'

const props = withDefaults(
  defineProps<{ tokens?: number; window?: number; pct?: number }>(),
  { tokens: 0, window: 0, pct: 0 },
)
const { t } = useI18n()
</script>

<template>
  <div class="ctx-usage">
    <svg class="ctx-ring" viewBox="0 0 36 36" width="22" height="22" aria-hidden="true">
      <circle
        class="ctx-ring-track"
        cx="18"
        cy="18"
        r="15.5"
        fill="none"
        stroke-width="3.5"
      />
      <circle
        class="ctx-ring-arc"
        :class="levelFor(props.pct)"
        cx="18"
        cy="18"
        r="15.5"
        fill="none"
        stroke-width="3.5"
        stroke-linecap="round"
        :stroke-dasharray="dashArrayFor(props.pct)"
        transform="rotate(-90 18 18)"
      />
    </svg>
    <div class="ctx-usage-tip">
      {{ t('aiCtxLabel') }} {{ formatTokens(props.tokens) }} / {{ formatTokens(props.window) }} · {{ props.pct }}%
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ctx-usage {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ctx-ring {
  display: block;
}
.ctx-ring-track {
  stroke: var(--line-strong);
}
.ctx-ring-arc {
  transition: stroke-dasharray 0.3s ease, stroke 0.3s ease;

  &.ok     { stroke: var(--accent); }
  &.warn   { stroke: var(--warning); }
  &.danger { stroke: var(--danger); }
}

.ctx-usage-tip {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  padding: 5px 12px;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: 999px;
  box-shadow: var(--shadow-pop);
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.ctx-usage:hover .ctx-usage-tip {
  opacity: 1;
  transform: translateY(0);
}
</style>
