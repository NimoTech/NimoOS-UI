<template>
  <div class="mobile-home">
    <section v-if="widgets.length" class="m-widgets">
      <div v-for="it in widgets" :key="it.id" class="m-widget" :style="{ aspectRatio: `${it.w} / ${it.h}` }">
        <WidgetCard :item="it" />
      </div>
    </section>
    <section v-if="tiles.length" class="m-tiles">
      <button
        v-for="it in tiles" :key="it.id"
        class="m-tile" :class="[`kind-${it.kind}`, { 'm-photo': it.kind === 'photo' }]"
        @click="openItem(it)"
      >
        <AppTile v-if="it.kind === 'app'" :item="it" />
        <FolderTile v-else-if="it.kind === 'folder'" :item="it" />
        <PhotoTile v-else :item="it" />
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useLayoutStore } from '../stores/layout'
import { linearizeLayout } from '../grid/linearize'
import { useOpenAction } from '../composables/useOpenAction'
import WidgetCard from './widgets/WidgetCard.vue'
import AppTile from './AppTile.vue'
import FolderTile from './FolderTile.vue'
import PhotoTile from './PhotoTile.vue'

// 手机端只读启动器:小组件全宽竖排 + 图标 4 列流式,顺序沿用桌面视觉顺序。
// 见 docs/superpowers/specs/2026-07-18-mobile-home-launcher-design.md
const layout = useLayoutStore()
const { openItem } = useOpenAction()

const ordered = computed(() => linearizeLayout(layout.items))
const widgets = computed(() => ordered.value.filter((i) => i.kind === 'widget' || i.kind === 'appwidget'))
const tiles = computed(() => ordered.value.filter((i) => i.kind === 'app' || i.kind === 'folder' || i.kind === 'photo'))

// 手机上没有 useGridMeasure 来设全局 --app-size(Dock 图标尺寸),CSS 兜底 64px 在
// 窄屏偏大;挂载期间压到 52px,卸载(切回桌面)时清掉,让 measure() 重新接管。
onMounted(() => document.documentElement.style.setProperty('--app-size', '52px'))
onUnmounted(() => document.documentElement.style.removeProperty('--app-size'))
</script>

<style scoped>
/* --cell = 4 列下的列宽(容器 padding 12×2 + 3 个 gap 12):磁贴内部字号/间距/圆角
   随之等比(theme.css 的比例规则),与桌面同构。 */
.mobile-home {
  --cell: calc((100vw - 60px) / 4);
  display: flex; flex-direction: column; gap: 18px;
  padding: 12px 12px calc(120px + env(safe-area-inset-bottom)); /* 底部给 Dock 留空 */
}
.m-widgets { display: flex; flex-direction: column; gap: 14px; }
.m-widget { width: 100%; max-height: 60vh; }
/* 图标区:行高=列宽 → 格子恒为正方形;photo 磁贴占 2×2,dense 回填空洞 */
.m-tiles {
  display: grid; grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: calc((100vw - 60px) / 4);
  gap: 12px; grid-auto-flow: row dense;
}
.m-tile { padding: 0; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.m-photo { grid-column: span 2; grid-row: span 2; }
</style>
