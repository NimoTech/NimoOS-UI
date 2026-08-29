<!-- 1:1 ported from Vue2 src/views/AI/Agent/blocks/ActionsRow.vue -->
<script setup lang="ts">
import AgentIcon from '../icons/AgentIcon.vue'

interface ActionItem {
  icon?: string
  label?: string
  primary?: boolean
}

withDefaults(defineProps<{ items?: ActionItem[] }>(), { items: () => [] })

function actionStyle(a: ActionItem) {
  return {
    padding: '7px 14px',
    background: a.primary ? 'var(--accent)' : 'var(--bg-elevated)',
    color: a.primary ? 'var(--text-on-accent)' : 'var(--text-primary)',
    border: a.primary ? '0' : '1px solid var(--line)',
    fontWeight: 500,
    fontSize: '13px',
    borderRadius: '999px',
  }
}
</script>

<template>
  <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px">
    <button v-for="(a, i) in (items || [])" :key="i" class="composer-tool" :style="actionStyle(a)">
      <AgentIcon :name="a.icon || 'sparkle'" :size="13" /> {{ a.label }}
    </button>
  </div>
</template>
