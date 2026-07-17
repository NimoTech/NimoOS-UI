<template>
  <main class="home-screen">
    <HomeTopbar @add="addPanel.openLib" />
    <GridCanvas ref="canvas" :cell="cell" :gap="gap" :cols="cols" :rows="rows" />
    <HomeDock ref="dock" />
    <AddPanel :open="addPanel.open.value" :cell="cell" :gap="gap" :cols="cols" :rows="rows" :grid-el="gridEl" @close="addPanel.close" />
    <SearchDialog />
    <StartAppDialog />
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import GridCanvas from '../home/components/GridCanvas.vue'
import HomeTopbar from '../home/components/HomeTopbar.vue'
import HomeDock from '../home/components/HomeDock.vue'
import AddPanel from '../home/components/AddPanel.vue'
import SearchDialog from '../home/components/SearchDialog.vue'
import StartAppDialog from '../home/components/StartAppDialog.vue'
import { useLayoutStore } from '../home/stores/layout'
import { useAppsStore } from '../home/stores/apps'
import { usePhotosStore } from '../home/stores/photos'
import { useHomeUiStore } from '../home/stores/homeUi'
import { useGridMeasure } from '../home/composables/useGridMeasure'
import { useLiveStats } from '../home/composables/useLiveStats'
import { useEvents } from '../home/composables/useEvents'
import { reconcileGpu } from '../home/composables/reconcileGpu'
import { useAddPanel } from '../home/composables/useAddPanel'
import { useDock } from '../home/composables/useDock'
import { useParallax } from '../home/composables/useParallax'
import { useMessageBus } from '../composables/useMessageBus'
import { createContainerEventHandler, CONTAINER_EVENT } from '../home/containerEventBridge'

const canvas = ref<InstanceType<typeof GridCanvas> | null>(null)
const dock = ref<InstanceType<typeof HomeDock> | null>(null)
const gridEl = ref<HTMLElement | null>(null)
const layout = useLayoutStore()
const apps = useAppsStore()
const photos = usePhotosStore()
const homeUi = useHomeUiStore()
const live = useLiveStats()
const addPanel = useAddPanel({ cols: 12, rows: 8 })
useEvents()

// dockEl points to HomeDock root element for useGridMeasure to read dockTop
const dockEl = computed(() => dock.value?.root ?? null)

const { cols, rows, cell, gap, relayout } = useGridMeasure(gridEl, dockEl)
watch(() => live.gpu, () => reconcileGpu(layout, live))

const DIMS = { cols: 12, rows: 8 } // 与 useAddPanel 同一套固定网格(响应式网格是既有 defer 项)

let onResize: (() => void) | null = null
let stopParallax: (() => void) | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let onFocus: (() => void) | null = null
let offContainerEvents: (() => void) | null = null
let containerEventBridge: ReturnType<typeof createContainerEventHandler> | null = null

function refreshApps() {
  apps.loadGrid().then(() => {
    useDock().refresh()
    layout.autoPin(apps.desktopDecls(), DIMS, apps.stoppedDesktopKeys())
  }).catch((e) => console.warn('[home] appgrid', e))
}

onMounted(async () => {
  layout.loadInitial()
  await nextTick()
  gridEl.value = canvas.value?.gridEl ?? null
  relayout()
  layout.loadServer().then(() => relayout()).catch(() => {})
  onResize = () => relayout()
  window.addEventListener('resize', onResize)
  stopParallax = useParallax().stop

  layout.loadServerSeen().finally(() => refreshApps())
  pollTimer = setInterval(() => { if (!document.hidden) refreshApps() }, 30_000)
  onFocus = () => refreshApps()
  window.addEventListener('focus', onFocus)

  // docker daemon 事件推送:destroy 立即清位,其余去抖刷新(轮询仍是兜底)
  containerEventBridge = createContainerEventHandler({ evict: (k) => layout.evict(k), refresh: refreshApps })
  offContainerEvents = useMessageBus().on(CONTAINER_EVENT, containerEventBridge.handle)

  photos.loadAssets().then(() => layout.bindPhotos(photos.assets.map((a) => a.id))).catch((e) => console.warn('[home] photos', e))
})

onUnmounted(() => {
  if (onResize) window.removeEventListener('resize', onResize)
  if (stopParallax) stopParallax()
  if (pollTimer) clearInterval(pollTimer)
  if (onFocus) window.removeEventListener('focus', onFocus)
  if (offContainerEvents) offContainerEvents()
  if (containerEventBridge) containerEventBridge.dispose()
})
</script>

<style scoped>
.home-screen { min-height: 100vh; padding: 24px 24px 12px; box-sizing: border-box; }
</style>
