<template>
  <div v-if="ghost" class="drop-ghost" :class="{ bad: !ghost.ok }" :style="style" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ ghost: { c: number; r: number; w: number; h: number; ok: boolean } | null }>()

const style = computed(() =>
  props.ghost ? { gridArea: `${props.ghost.r} / ${props.ghost.c} / span ${props.ghost.h} / span ${props.ghost.w}` } : {}
)
</script>

<style scoped>
/* Token-based drop ghost — aligned to base.css:112-113 */
.drop-ghost {
  border: 2px dashed var(--accent);
  border-radius: var(--radius);
  background: var(--drop-bg);
  pointer-events: none;
}

.drop-ghost.bad {
  border-color: var(--remove-bg);
  background: var(--drop-bad, rgba(255,80,100,.12));
}
</style>
