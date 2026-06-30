<template>
  <main class="home-screen">
    <HomeTopbar @add="onAdd" />
    <GridCanvas ref="canvas" :cell="cell" :gap="gap" :cols="cols" :rows="rows" />
    <HomeDock ref="dock" />
    <HomeToast />
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import GridCanvas from '../home/components/GridCanvas.vue'
import HomeTopbar from '../home/components/HomeTopbar.vue'
import HomeToast from '../home/components/HomeToast.vue'
import HomeDock from '../home/components/HomeDock.vue'
import { useLayoutStore } from '../home/stores/layout'
import { useAppsStore } from '../home/stores/apps'
import { usePhotosStore } from '../home/stores/photos'
import { useHomeUiStore } from '../home/stores/homeUi'
import { useGridMeasure } from '../home/composables/useGridMeasure'
import { useLiveStats } from '../home/composables/useLiveStats'
import { useEvents } from '../home/composables/useEvents'
import { reconcileGpu } from '../home/composables/reconcileGpu'

const canvas = ref<InstanceType<typeof GridCanvas> | null>(null)
const dock = ref<InstanceType<typeof HomeDock> | null>(null)
const gridEl = ref<HTMLElement | null>(null)
const layout = useLayoutStore()
const apps = useAppsStore()
const photos = usePhotosStore()
const homeUi = useHomeUiStore()
const live = useLiveStats()
useEvents()

// dockEl points to HomeDock root element for useGridMeasure to read dockTop
const dockEl = computed(() => dock.value?.root ?? null)

const { cols, rows, cell, gap, relayout } = useGridMeasure(gridEl, dockEl)
watch(() => live.gpu, () => reconcileGpu(layout, live))

function onAdd() { homeUi.toggleEdit(true) }

let onResize: (() => void) | null = null

onMounted(async () => {
  layout.loadInitial()
  await nextTick()
  gridEl.value = canvas.value?.gridEl ?? null
  relayout()
  layout.loadServer().then(() => relayout()).catch(() => {})
  onResize = () => relayout()
  window.addEventListener('resize', onResize)

  apps.loadGrid().catch((e) => console.warn('[home] appgrid', e))
  photos.loadAssets().then(() => layout.bindPhotos(photos.assets.map((a) => a.id))).catch((e) => console.warn('[home] photos', e))
})

onUnmounted(() => { if (onResize) window.removeEventListener('resize', onResize) })
</script>

<style scoped>
.home-screen { min-height: 100vh; padding: 24px 24px 12px; box-sizing: border-box; }
</style>
