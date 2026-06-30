<template>
  <main class="home-screen">
    <GridCanvas ref="canvas" />
    <div ref="dockEl" class="dock-placeholder" aria-hidden="true" />
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import GridCanvas from '../home/components/GridCanvas.vue'
import { useLayoutStore } from '../home/stores/layout'
import { useAppsStore } from '../home/stores/apps'
import { usePhotosStore } from '../home/stores/photos'
import { useGridMeasure } from '../home/composables/useGridMeasure'
import { useLiveStats } from '../home/composables/useLiveStats'
import { useEvents } from '../home/composables/useEvents'
import { reconcileGpu } from '../home/composables/reconcileGpu'

const canvas = ref<InstanceType<typeof GridCanvas> | null>(null)
const dockEl = ref<HTMLElement | null>(null)
const gridEl = ref<HTMLElement | null>(null)
const layout = useLayoutStore()
const apps = useAppsStore()
const photos = usePhotosStore()
const live = useLiveStats()
useEvents()
const { relayout } = useGridMeasure(gridEl, dockEl)
watch(() => live.gpu, () => reconcileGpu(layout, live))

let onResize: (() => void) | null = null

onMounted(async () => {
  layout.loadInitial()
  await nextTick()
  gridEl.value = canvas.value?.gridEl ?? null
  relayout()
  onResize = () => relayout()
  window.addEventListener('resize', onResize)

  apps.loadGrid().catch((e) => console.warn('[home] appgrid', e))
  photos.loadAssets().then(() => layout.bindPhotos(photos.assets.map((a) => a.id))).catch((e) => console.warn('[home] photos', e))
})

onUnmounted(() => { if (onResize) window.removeEventListener('resize', onResize) })
</script>

<style scoped>
.home-screen { min-height: 100vh; padding: 24px 24px 12px; box-sizing: border-box; }
.dock-placeholder { height: 64px; }
</style>
