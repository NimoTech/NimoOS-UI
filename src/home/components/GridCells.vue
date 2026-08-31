<template>
  <div v-for="cell in cells" :key="cell.k" class="cell" :style="{ gridArea: `${cell.r} / ${cell.c} / span 1 / span 1` }" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { occupiedSet } from '../grid/gridMath'
import { useLayoutStore } from '../stores/layout'

const props = defineProps<{ cols: number; rows: number }>()

const layout = useLayoutStore()

const cells = computed(() => {
  const occ = occupiedSet(layout.items, null)
  const out: { c: number; r: number; k: string }[] = []
  for (let r = 1; r <= props.rows; r++) {
    for (let c = 1; c <= props.cols; c++) {
      if (!occ.has(`${c},${r}`)) {
        out.push({ c, r, k: `${c},${r}` })
      }
    }
  }
  return out
})
</script>

<style scoped>
/* .cell base styles (pointer-events, border-radius, border, background) come from global theme.css.
   Scoped block kept for any future per-component overrides. */
</style>
