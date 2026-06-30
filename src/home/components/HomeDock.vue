<template>
  <nav ref="root" class="dock" :class="{ expanded: dock.expanded.value }" aria-label="Dock" @pointermove="onMove" @pointerleave="reset">
    <div class="dock-main">
      <div class="dock-zone">
        <DockApp v-for="k in dock.favKeys.value" :key="k" :app-key="k" />
      </div>
      <span class="dock-sep" />
      <div v-show="dock.expanded.value" class="dock-zone dock-more">
        <DockApp v-for="k in dock.moreKeys.value" :key="k" :app-key="k" />
      </div>
      <button class="dock-app dock-toggle" :aria-expanded="dock.expanded.value" @click="dock.toggleExpanded()">
        <span class="dock-ic ic-all">▦</span><span class="dock-label">{{ dock.expanded.value ? '完成' : '所有应用' }}</span>
      </button>
    </div>
  </nav>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import DockApp from './DockApp.vue'
import { useDock } from '../composables/useDock'
import { magScale } from '../grid/dockMath'
const dock = useDock()
const root = ref<HTMLElement | null>(null)
function onMove(e: PointerEvent) {
  root.value?.querySelectorAll<HTMLElement>('.dock-app:not(.dock-dragging) .dock-ic').forEach((ic) => {
    const r = ic.getBoundingClientRect()
    ic.style.setProperty('--mag', magScale(e.clientX - (r.left + r.width / 2)).toFixed(3))
  })
}
function reset() { root.value?.querySelectorAll<HTMLElement>('.dock-ic').forEach((ic) => ic.style.setProperty('--mag', '1')) }
defineExpose({ root })
</script>
<style scoped>
.dock { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 30; }
.dock-main { display: flex; align-items: flex-end; gap: 10px; padding: 8px 14px; background: rgba(30,34,40,.6); backdrop-filter: blur(20px); border-radius: 22px; }
.dock-zone { display: flex; align-items: flex-end; gap: 10px; }
.dock-sep { width: 1px; align-self: stretch; background: rgba(255,255,255,.18); margin: 0 2px; }
.dock-toggle .ic-all { font-size: 18px; }
</style>
