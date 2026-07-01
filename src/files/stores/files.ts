import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useFoldersStore } from '../../home/stores/folders'
import type { DisplayNames } from '../util/pathUtils'

export interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size?: number | string
  date?: string
  write?: boolean
  extensions?: { share?: { shared?: string } } | null
}

const HIDDEN = new Set(['lost+found'])

export const useFilesStore = defineStore('files', () => {
  const displayNames = ref<DisplayNames>({})
  const disks = ref<{ name: string; path: string; usb: boolean }[]>([])
  const entries = ref<FileEntry[]>([])
  const currentPath = ref('')
  const loading = ref(false)

  async function loadRoots() {
    const folders = useFoldersStore()
    await folders.loadDisks()
    disks.value = folders.disks.map((d) => ({ ...d }))
    const map: DisplayNames = {}
    for (const d of disks.value) map[d.path] = d.name
    displayNames.value = map
  }

  function defaultRootReal(): string {
    return disks.value.length ? disks.value[0].path : ''
  }

  async function load(realPath: string) {
    loading.value = true
    try {
      const data = await service.folder.getList(realPath)
      const content: FileEntry[] = (data && (data as { content?: FileEntry[] }).content) || []
      entries.value = content.filter((e) => !e.name.startsWith('.') && !HIDDEN.has(e.name))
      currentPath.value = realPath
    } catch (e) {
      console.warn('[files] load failed', realPath, e)
      entries.value = []
      currentPath.value = realPath
    } finally {
      loading.value = false
    }
  }

  return { displayNames, disks, entries, currentPath, loading, loadRoots, defaultRootReal, load }
})
