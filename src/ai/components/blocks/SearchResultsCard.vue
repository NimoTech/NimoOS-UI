<!-- 1:1 ported from Vue2 src/views/AI/Agent/blocks/SearchResultsCard.vue -->
<script setup lang="ts">
import AgentIcon from '../icons/AgentIcon.vue'

interface SearchResultItem {
  title?: string
  snippet?: string
  path?: string
  score?: number | null
}

withDefaults(
  defineProps<{ query?: string; kind?: string; results?: SearchResultItem[] }>(),
  { query: '', kind: 'Search', results: () => [] },
)
</script>

<template>
  <div class="card">
    <div class="card-head">
      <div class="card-head-icon" style="background: var(--warning-soft); color: var(--warning)">
        <AgentIcon name="search" :size="14" />
      </div>
      <div style="flex: 1">
        <div class="card-title">{{ kind }} · {{ (results || []).length }} results</div>
        <div class="card-sub">"{{ query }}"</div>
      </div>
    </div>
    <div v-for="(r, i) in (results || [])" :key="i" class="search-result">
      <div class="search-rank">{{ i + 1 }}</div>
      <div style="flex: 1">
        <div class="search-title">{{ r.title }}</div>
        <div class="search-snippet">{{ r.snippet }}</div>
        <div class="search-meta">
          <span>{{ r.path }}</span>
          <template v-if="r.score != null"> · <span style="color: var(--accent)">match {{ Math.round(r.score * 100) }}%</span></template>
        </div>
      </div>
    </div>
  </div>
</template>
