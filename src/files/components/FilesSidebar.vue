<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFilesStore } from '../stores/files'
import { useFavoritesStore } from '../stores/favorites'
import { iconUrl } from '../util/icons'
import { toVirtualPath } from '../util/pathUtils'

const emit = defineEmits<{ (e: 'navigate', virtualPath: string): void }>()
const files = useFilesStore()
const favorites = useFavoritesStore()
const { t } = useI18n()

function go(realPath: string) {
  emit('navigate', toVirtualPath(realPath, files.displayNames))
}
function isActive(realPath: string): boolean {
  return files.currentPath === realPath
}
function diskIcon(usb: boolean): string {
  return iconUrl(usb ? 'folder-usb' : 'folder-hdd')
}

const dragIndex = ref<number | null>(null)
function onDragStart(i: number) { dragIndex.value = i }
function onDrop(i: number) {
  if (dragIndex.value !== null && dragIndex.value !== i) favorites.reorder(dragIndex.value, i)
  dragIndex.value = null
}
</script>

<template>
  <aside class="files-sidebar">
    <section class="side-section">
      <h4 class="side-title">{{ t('filesFavorites') }}</h4>
      <p v-if="!favorites.list.length" class="side-empty">{{ t('filesNoFavorites') }}</p>
      <ul class="side-list">
        <li
          v-for="(fav, i) in favorites.list"
          :key="fav.path"
          class="side-item"
          :class="{ active: isActive(fav.path) }"
          draggable="true"
          @click="go(fav.path)"
          @dragstart="onDragStart(i)"
          @dragover.prevent
          @drop="onDrop(i)"
        >
          <img class="side-icon" :src="iconUrl('folder-default')" alt="" />
          <span class="side-name">{{ fav.name }}</span>
          <button class="side-remove" @click.stop="favorites.remove(fav.path)">×</button>
        </li>
      </ul>
    </section>
    <section class="side-section">
      <h4 class="side-title">{{ t('filesDisks') }}</h4>
      <ul class="side-list">
        <li
          v-for="disk in files.disks"
          :key="disk.path"
          class="side-item"
          :class="{ active: isActive(disk.path) }"
          @click="go(disk.path)"
        >
          <img class="side-icon" :src="diskIcon(disk.usb)" alt="" />
          <span class="side-name">{{ disk.name }}</span>
        </li>
      </ul>
    </section>
  </aside>
</template>

<style scoped>
.files-sidebar { flex: 0 0 220px; display: flex; flex-direction: column; gap: 18px; padding: 4px 12px 4px 0; overflow-y: auto; }
.side-section { min-width: 0; }
.side-title { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--fg-muted, #9aa4bf); margin: 0 0 6px; }
.side-empty { font-size: 12px; color: var(--fg-muted, #9aa4bf); padding: 4px 8px; }
.side-list { list-style: none; margin: 0; padding: 0; }
.side-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; cursor: pointer; color: var(--fg); }
.side-item:hover { background: var(--chip-bg, rgba(255,255,255,0.06)); }
.side-item.active { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
.side-icon { width: 20px; height: 20px; flex: 0 0 auto; }
.side-name { flex: 1 1 auto; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.side-remove { opacity: 0; background: none; border: none; color: var(--fg-muted, #9aa4bf); cursor: pointer; font-size: 14px; }
.side-item:hover .side-remove { opacity: 1; }
</style>
