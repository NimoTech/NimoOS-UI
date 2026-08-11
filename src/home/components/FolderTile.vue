<template>
  <div class="folder-tile-wrap">
    <FileThumb class="folder-ic" :entry="entry" />
    <span class="app-label">{{ item.key }}</span>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutItem } from '../grid/types'
import type { FileEntry } from '../../files/stores/files'
import FileThumb from '../../files/components/FileThumb.vue'

const props = defineProps<{ item: LayoutItem }>()
// 主页 folder 项永远是目录:构造最小 FileEntry 交给 files 的图标块,
// iconNameFor 按名字给出类型化文件夹图标(Media→video、Downloads→download…)。
const entry = computed<FileEntry>(() => ({
  name: props.item.key,
  path: props.item.path ?? '',
  is_dir: true,
}))
</script>
<style scoped>
/* .kind-folder 列布局 + .folder-ic 尺寸(方形 aspect-ratio 规则)全在全局 theme.css —— 不要在此覆盖 width/height,同分后置会压掉方形规则(bug.txt #6) */
/* gap/字号随 --cell 等比(锚定 108px 舒适格:字号 16.7/108≈0.155) — 与 theme.css .kind-folder/.app-label 同比例 */
.folder-tile-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: calc(var(--cell, 92px) * 0.046); height: 100%; }
.app-label { flex: 0 0 auto; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; font-size: max(11px, calc(var(--cell, 92px) * 0.155)); font-weight: 500; line-height: 1.25; color: var(--label-color, var(--fg)); text-shadow: var(--label-shadow, none); }
</style>
