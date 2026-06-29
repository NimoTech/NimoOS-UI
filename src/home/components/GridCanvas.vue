<template>
  <section ref="gridEl" class="grid" aria-label="主页画布">
    <GridItem v-for="item in layout.items" :key="item.id" :item="item" />
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import GridItem from './GridItem.vue'
import { useLayoutStore } from '../stores/layout'

const layout = useLayoutStore()
const gridEl = ref<HTMLElement | null>(null)
defineExpose({ gridEl })
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(var(--cols, 12), var(--cell, 92px));
  grid-auto-rows: var(--cell, 92px);
  gap: 16px;
  margin: 0 auto;
}
</style>
