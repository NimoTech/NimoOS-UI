<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { service } from '@nimotech/nimoos-service'
import { iconNameFor, iconUrl } from '../util/icons'
import type { DeckPreview, DeckPreviewTile } from '../composables/useDeckPreview'

export interface TimeMachineCardItem {
  time: string
  dayLabelText: string
  label: string
  typeKind: 'auto' | 'manual' | 'preop'
  typeLabelKey: string
}

const props = defineProps<{
  item: TimeMachineCardItem
  state: 'front' | 'behind' | 'past'
  depth: number
  preview?: DeckPreview | null
}>()
const { t } = useI18n()

const moreCount = computed(() => {
  const p = props.preview
  return p && p.status === 'ready' ? Math.max(0, p.total - p.tiles.length) : 0
})
function tileSrc(tile: DeckPreviewTile): string {
  return tile.isImage
    ? service.image.thumbUrl(tile.path)
    : iconUrl(iconNameFor({ name: tile.name, is_dir: tile.isDir }))
}
// 缩略图 404 时静默换成类型图标,不让卡片上出现破图
function onTileError(e: Event) {
  const img = e.target as HTMLImageElement
  img.src = iconUrl('unknown')
}
</script>

<template>
  <div
    class="tm-card"
    :class="[`is-${props.state}`, `depth-${props.depth}`, `type-${props.item.typeKind}`]"
  >
    <!-- 变换全部由 class 驱动的 CSS 决定(不写内联 transform):同一批 DOM 节点在选中变化时
         只换 class,浏览器就能沿着已声明的 transition 平滑过渡,无需任何 JS 动画循环。
         注:这条注释必须放在根元素内部,不能放在根元素之前——放在外面会让模板变成
         "注释 + div" 的多根 fragment,组件 $el 解析成注释节点,VTU 的 wrapper.classes()
         就会读到空数组(实测踩坑,已在此改正)。 -->
    <span class="tm-card-badge">{{ t(props.item.typeLabelKey) }}</span>
    <div v-if="props.preview?.status === 'ready' && props.preview.tiles.length" class="tm-tiles">
      <span v-for="tile in props.preview.tiles" :key="tile.path" class="tm-tile">
        <img :src="tileSrc(tile)" alt="" loading="lazy" @error="onTileError" />
      </span>
      <span v-if="moreCount > 0" class="tm-tile tm-tile-more">+{{ moreCount }}</span>
    </div>
    <span v-else-if="props.preview?.status === 'missing'" class="tm-card-missing">{{ t('tmNoFolderAtTime') }}</span>
    <span class="tm-card-day">{{ props.item.dayLabelText }}</span>
    <span class="tm-card-time">{{ props.item.time }}</span>
    <span v-if="props.item.label" class="tm-card-label">{{ props.item.label }}</span>
    <span v-if="props.preview?.status === 'ready'" class="tm-card-count">{{ t('tmItemCount', { n: props.preview.total }) }}</span>
  </div>
</template>

<style scoped>
.tm-card {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  padding: 20px; border-radius: 18px; text-align: center; cursor: pointer;
  color: var(--tm-fg); background: var(--tm-card-bg);
  border: 1px solid var(--tm-card-bd); box-shadow: var(--tm-card-shadow);
  transform-origin: center top;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s var(--ease), filter 0.4s var(--ease);
}
/* 选中(最前) */
.is-front { transform: translate3d(0, 0, 0) scale(1); z-index: 50; opacity: 1; }
/* 更老的快照往后退 */
.is-behind.depth-1 { transform: translate3d(0, -16px, -70px) rotateX(2deg) scale(0.94); z-index: 40; opacity: 0.86; filter: brightness(0.86); }
.is-behind.depth-2 { transform: translate3d(0, -30px, -140px) rotateX(4deg) scale(0.88); z-index: 30; opacity: 0.7; filter: brightness(0.7); }
.is-behind.depth-3 { transform: translate3d(0, -42px, -210px) rotateX(6deg) scale(0.82); z-index: 20; opacity: 0.52; filter: brightness(0.56); }
.is-behind.depth-4 { transform: translate3d(0, -52px, -280px) rotateX(8deg) scale(0.76); z-index: 10; opacity: 0.34; filter: brightness(0.44); }
/* 已经翻过去的(更新的)快照朝观众飞出屏幕下方 —— 参考稿的 isPast 分支 */
.is-past { transform: translate3d(0, 300px, 200px) rotateX(-20deg) scale(1.3); opacity: 0; z-index: 60; pointer-events: none; }

.tm-card-badge {
  font-size: 10px; font-weight: 700; letter-spacing: 0.6px;
  padding: 2px 8px; border-radius: 999px;
  background: var(--nrm-bg); color: var(--nrm-fg);
}
.type-manual .tm-card-badge { background: var(--accent-soft); color: var(--accent-text); }
.type-preop .tm-card-badge { background: var(--dem-bg); color: var(--dem-fg); }
/* 类型只给最前那张卡描边着色(与刻度尺、存储区时间线同一套三色系统) */
.is-front.type-manual { border-color: var(--accent-soft-bd); }
.is-front.type-preop { border-color: var(--dem-bd); }

.tm-card-day { font-size: 12px; color: var(--tm-fg-muted); }
.tm-card-time { font-size: 30px; font-weight: 600; line-height: 1.1; }
.tm-card-label {
  font-size: 12px; color: var(--tm-fg-muted); max-width: 90%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tm-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; width: 78%; margin-bottom: 4px; }
.tm-tile {
  aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; overflow: hidden; background: var(--nrm-bg);
  font-size: 11px; color: var(--tm-fg-muted);
}
.tm-tile img { width: 100%; height: 100%; object-fit: cover; }
.tm-card-count { font-size: 11px; color: var(--tm-fg-muted); }
.tm-card-missing { font-size: 12px; color: var(--tm-fg-muted); }
@media (prefers-reduced-motion: reduce) { .tm-card { transition: none; } }
</style>
