<!-- 1:1 ported from Vue2 src/views/AI/Agent/blocks/ProgressCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import AgentIcon from '../icons/AgentIcon.vue'

interface ProgressItem {
  name?: string
  pct: number
}

const props = withDefaults(defineProps<{ title?: string; items?: ProgressItem[] }>(), { title: '', items: () => [] })

const doneCount = computed(() => (props.items || []).filter((i) => i.pct >= 100).length)
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div class="card-head-icon" style="background: var(--teal-soft); color: var(--teal)">
        <AgentIcon name="upload" :size="14" />
      </div>
      <div style="flex: 1">
        <div class="card-title">{{ title }}</div>
        <div class="card-sub">{{ doneCount }} of {{ (items || []).length }} complete</div>
      </div>
    </div>
    <div class="progress-card">
      <div v-for="(it, i) in (items || [])" :key="i" style="margin-bottom: 10px">
        <div class="progress-row">
          <span class="progress-name">{{ it.name }}</span>
          <span class="progress-pct">{{ it.pct >= 100 ? 'Done' : it.pct + '%' }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :data-state="it.pct >= 100 ? 'done' : 'running'" :style="{ width: it.pct + '%' }" />
        </div>
      </div>
    </div>
  </div>
</template>
