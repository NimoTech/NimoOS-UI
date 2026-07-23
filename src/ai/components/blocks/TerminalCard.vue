<!-- 1b-stub: filled in Task 9 (heavy renderer, ported verbatim from Vue2 there) -->
<script setup lang="ts">
defineProps<{
  command?: string
  cwd?: string
  shell?: string
  sandbox?: string
  state?: string
  exitCode?: number
  durationMs?: number | null
  lines?: unknown[]
  streamingLine?: unknown
  approval?: unknown
  defaultOpen?: boolean
}>()
</script>

<template>
  <div class="block-stub">[terminal]</div>
</template>

<style scoped>
.block-stub {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--r-pill);
  font-size: 12px;
  background: var(--bg-chip);
  color: var(--text-tertiary);
}
</style>
