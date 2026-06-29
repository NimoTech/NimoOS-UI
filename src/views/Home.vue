<template>
  <main class="home-screen">
    <GridCanvas ref="canvas" />
    <div ref="dockEl" class="dock-placeholder" aria-hidden="true" />
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import GridCanvas from '../home/components/GridCanvas.vue'
import { useLayoutStore } from '../home/stores/layout'
import { useGridMeasure } from '../home/composables/useGridMeasure'

const canvas = ref<InstanceType<typeof GridCanvas> | null>(null)
const dockEl = ref<HTMLElement | null>(null)
const gridEl = ref<HTMLElement | null>(null)
const layout = useLayoutStore()
const { relayout } = useGridMeasure(gridEl, dockEl)

let onResize: (() => void) | null = null

onMounted(async () => {
  layout.loadInitial()
  await nextTick()
  gridEl.value = canvas.value?.gridEl ?? null
  relayout()
  onResize = () => relayout()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => { if (onResize) window.removeEventListener('resize', onResize) })
</script>

<style scoped>
.home-screen { min-height: 100vh; padding: 24px 24px 12px; box-sizing: border-box; }
.dock-placeholder { height: 64px; }
</style>
