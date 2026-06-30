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
.drop-ghost {
  border: 2px dashed var(--accent);
  border-radius: 16px;
  background: rgba(76, 141, 255, 0.08);
  pointer-events: none;
}

.drop-ghost.bad {
  border-color: #ff6b6b;
  background: rgba(255, 107, 107, 0.08);
}
</style>
