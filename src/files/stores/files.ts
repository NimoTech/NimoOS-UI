import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
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

  const viewMode = ref<'list' | 'grid'>((localStorage.getItem('nimoos:file-view') as 'list' | 'grid') || 'grid')
  const sort = ref<'name' | 'format' | 'date' | 'size'>((localStorage.getItem('nimoos:file-sort') as any) || 'name')
  const order = ref<'asc' | 'desc'>((localStorage.getItem('nimoos:file-order') as any) || 'asc')

  function extOf(name: string): string {
    const i = name.lastIndexOf('.')
    return i > 0 ? name.slice(i + 1).toLowerCase() : ''
  }
  const KEY_FN: Record<string, (e: FileEntry) => string | number> = {
    name: (e) => e.name.toLowerCase(),
    format: (e) => extOf(e.name),
    date: (e) => new Date(e.date || 0).getTime() || 0,
    size: (e) => Number(e.size) || 0,
  }

  const sortedEntries = computed<FileEntry[]>(() => {
    const keyFn = KEY_FN[sort.value] || KEY_FN.name
    const dir = order.value === 'desc' ? -1 : 1
    return [...entries.value].sort((a, b) => {
      // folders first
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
      const ka = keyFn(a), kb = keyFn(b)
      if (ka < kb) return -1 * dir
      if (ka > kb) return 1 * dir
      return 0
    })
  })

  function setView(v: 'list' | 'grid') {
    viewMode.value = v
    localStorage.setItem('nimoos:file-view', v)
  }
  function setSort(s: string, o?: 'asc' | 'desc') {
    const next = (o ?? (s === sort.value ? (order.value === 'asc' ? 'desc' : 'asc') : 'asc')) as 'asc' | 'desc'
    sort.value = s as typeof sort.value
    order.value = next
    localStorage.setItem('nimoos:file-sort', sort.value)
    localStorage.setItem('nimoos:file-order', order.value)
  }

  return { displayNames, disks, entries, currentPath, loading, loadRoots, defaultRootReal, load, viewMode, sort, order, sortedEntries, setView, setSort }
})
