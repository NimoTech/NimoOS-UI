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
// Home folder items are always directories: construct a minimal FileEntry for the files icon block,
// iconNameFor returns a typed folder icon based on name (Media→video, Downloads→download…).
const entry = computed<FileEntry>(() => ({
  name: props.item.key,
  path: props.item.path ?? '',
  is_dir: true,
}))
</script>
<style scoped>
/* .kind-folder column layout + .folder-ic size (square aspect-ratio rules) are all in global theme.css — do not override width/height here, same-specificity later rules will break the square aspect ratio (bug.txt #6) */
/* gap/font-size scale with --cell proportionally (anchored on 108px comfortable grid: font-size 16.7/108≈0.155) — same proportion as theme.css .kind-folder/.app-label */
.folder-tile-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: calc(var(--cell, 92px) * 0.046); height: 100%; }
.app-label { flex: 0 0 auto; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; font-size: max(11px, calc(var(--cell, 92px) * 0.155)); font-weight: 500; line-height: 1.25; color: var(--label-color, var(--fg)); text-shadow: var(--label-shadow, none); }
</style>
