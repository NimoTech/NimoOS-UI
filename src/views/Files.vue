<script setup lang="ts">
import { watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FilesShell from '../files/components/FilesShell.vue'
import { useFilesStore, type FileEntry } from '../files/stores/files'
import {
  toRealPath, toVirtualPath, virtualPathToRouteParam, routeParamToVirtualPath,
} from '../files/util/pathUtils'

const route = useRoute()
const router = useRouter()
const files = useFilesStore()

async function sync() {
  const vp = routeParamToVirtualPath(route.params.path as string | string[] | undefined)
  if (vp === '/') {
    const rootReal = files.defaultRootReal()
    if (!rootReal) return
    const rootVirtual = toVirtualPath(rootReal, files.displayNames)
    router.replace('/files/' + virtualPathToRouteParam(rootVirtual))
    return
  }
  await files.load(toRealPath(vp, files.displayNames))
}

function openEntry(entry: FileEntry) {
  if (!entry.is_dir) return
  const vp = toVirtualPath(entry.path, files.displayNames)
  router.push('/files/' + virtualPathToRouteParam(vp))
}

onMounted(async () => {
  await files.loadRoots()
  await sync()
})

watch(() => route.params.path, () => { sync().catch((e) => console.warn('[files] route sync failed', e)) })
</script>

<template>
  <FilesShell>
    <ul class="files-list">
      <li
        v-for="entry in files.entries"
        :key="entry.path"
        class="files-row"
        :class="{ 'is-dir': entry.is_dir }"
        @click="openEntry(entry)"
      >
        <span class="files-row-mark">{{ entry.is_dir ? '📁' : '📄' }}</span>
        <span class="files-row-name">{{ entry.name }}</span>
      </li>
    </ul>
  </FilesShell>
</template>

<style scoped>
.files-list { list-style: none; margin: 0; padding: 0; }
.files-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; cursor: default; }
.files-row.is-dir { cursor: pointer; }
.files-row:hover { background: var(--chip-bg, rgba(255,255,255,0.06)); }
.files-row-name { font-size: 14px; }
</style>
