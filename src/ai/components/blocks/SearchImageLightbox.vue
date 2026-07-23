<!-- 1b-stub: filled in Task 9 (PhotoGridCard's click-to-enlarge lightbox) -->
<script setup lang="ts">
defineProps<{ photos?: unknown[]; index?: number | null }>()
defineEmits<{ (e: 'close'): void; (e: 'nav', delta: number): void }>()
</script>

<template>
  <div class="block-stub">[lightbox]</div>
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
