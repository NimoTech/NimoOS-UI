import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useFoldersStore } from '../../home/stores/folders'
import { useFolderSizesStore } from './folderSizes'
import type { DisplayNames } from '../util/pathUtils'
import { sortEntries, type SortField, type SortOrder } from '../util/sortEntries'
import { folderListErrorMsg } from '../util/folderListError'
import { isHiddenEntry } from '../../util/hiddenEntries'

export interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size?: number | string
  date?: string
  write?: boolean
  /** Synthetic optimistic entry for an in-flight upload (see
   *  upload/uploadPlaceholders.ts). Not a real on-disk entry — the tile renders
   *  it as uploading and it can't be opened. */
  uploading?: boolean
  extensions?: {
    share?: { shared?: string }
    // Upload batch status the backend attaches to listing entries (NimoOS
    // route/v1/file.go:441). `broken` may arrive as a boolean or as a string —
    // see the leniency in util/uploadBadge.ts.
    upload?: { broken?: boolean | string; batchId?: string }
  } | null
}

export const useFilesStore = defineStore('files', () => {
  const displayNames = ref<DisplayNames>({})
  const mountNames = ref<DisplayNames>({})
  const disks = ref<{ name: string; path: string; usb: boolean }[]>([])
  const entries = ref<FileEntry[]>([])
  const currentPath = ref('')
  const loading = ref(false)
  // Empty string = no error. See load() for why this had to exist.
  const error = ref('')

  // displayNames = disks-derived map overlaid with mountNames (host names from network mounts).
  // Separated to prevent losing network mount names written by setMountNames when loadRoots() rebuilds the disk map.
  function rebuildDisplayNames() {
    const map: DisplayNames = {}
    for (const d of disks.value) map[d.path] = d.name
    displayNames.value = { ...map, ...mountNames.value }
  }

  async function loadRoots() {
    const folders = useFoldersStore()
    await folders.loadDisks()
    disks.value = folders.disks.map((d) => ({ ...d }))
    rebuildDisplayNames()
  }

  // Called by mountsStore.loadMounts() to register display name mapping for network mounts /mnt/<host> → host,
  // so that toVirtualPath/toRealPath also work on network mount paths (do not leak /mnt/* to URL/breadcrumb/clipboard).
  function setMountNames(names: DisplayNames) {
    mountNames.value = names
    rebuildDisplayNames()
  }

  function defaultRootReal(): string {
    return disks.value.length ? disks.value[0].path : ''
  }

  // Epoch guard against an out-of-order response. Unlike ensureVolumes() (snapshotBrowse.ts) and
  // useFolderSizesStore() (see this function's own pre-existing comment just below), load() had
  // no such guard -- whichever call's own service.folder.getList() happened to RESOLVE LAST won,
  // regardless of which call was STARTED last. Two load() calls fired close together (e.g. a
  // rapid Time Machine rail re-click: switchTo(A) immediately followed by switchTo(B), before A's
  // own listing fetch has resolved) race on the network; if A's response is merely SLOWER than
  // B's (not required to be pathologically slow -- ordinary jitter is enough), it lands AFTER B's
  // already-correct one and silently overwrites currentPath/entries back to A -- with route/rail
  // state still showing B. Confirmed via a real router + real Files.vue + real async-timing
  // integration test (src/files/snapshot/timeMachineFlightChainIntegration.test.ts's own "rapid
  // re-supersede" case): browse.currentSnapshotName reverts to the stale target, and because
  // snapshotBrowse.ts's own `pendingTravel` guard (TimeMachineDepthStack.vue) has ALREADY been
  // consumed by B's own legitimate travel, this stale flip fires with no matching pending travel
  // -- no runTravel() call ever animates it, so every already-tweened depth-stack strip is simply
  // never told to move again, appearing permanently frozen at wherever B's travel left it until an
  // unrelated safety net eventually reveals the real window over it. Guarded here, at the root
  // cause, exactly like ensureVolumes()/useFolderSizesStore() already guard their own async races
  // -- a stale response can now never write over a newer call's state, so currentPath only ever
  // reflects the LAST-STARTED load().
  let loadEpoch = 0
  async function load(realPath: string) {
    clearSelection()
    // New listing, new world: computed folder sizes from the previous view
    // must not leak into this one (see folderSizes.ts for the epoch guard).
    useFolderSizesStore().reset()
    loading.value = true
    error.value = ''
    const myEpoch = ++loadEpoch
    try {
      const data = await service.folder.getList(realPath)
      if (myEpoch !== loadEpoch) return // superseded by a newer load() call -- discard this stale response entirely
      const content: FileEntry[] = (data && (data as { content?: FileEntry[] }).content) || []
      entries.value = content.filter((e) => !isHiddenEntry(e.name))
      currentPath.value = realPath
    } catch (e) {
      if (myEpoch !== loadEpoch) return
      // This used to be swallowed into an empty listing, which renders exactly
      // like a genuinely empty folder -- the user could not tell "load failed"
      // from "nothing here", and had nothing to retry.
      console.warn('[files] load failed', realPath, e)
      entries.value = []
      currentPath.value = realPath
      error.value = folderListErrorMsg(e)
    } finally {
      // Only the current epoch's own call may clear `loading` -- a stale call's finally landing
      // between a newer call's own start and finish must not flip it back false while the real
      // navigation is still genuinely in flight.
      if (myEpoch === loadEpoch) loading.value = false
    }
  }

  const viewMode = ref<'list' | 'grid'>((localStorage.getItem('nimoos:file-view') as 'list' | 'grid') || 'grid')
  const sort = ref<SortField>((localStorage.getItem('nimoos:file-sort') as SortField) || 'name')
  const order = ref<SortOrder>((localStorage.getItem('nimoos:file-order') as SortOrder) || 'asc')

  // Comparator itself lives in ../util/sortEntries.ts (extracted so SnapshotPreviewWindow.vue's
  // depth-stack previews can mirror this SAME live sort/order rather than reimplementing it --
  // see that util's own header comment).
  const sortedEntries = computed<FileEntry[]>(() => sortEntries(entries.value, sort.value, order.value))

  function setView(v: 'list' | 'grid') {
    viewMode.value = v
    localStorage.setItem('nimoos:file-view', v)
  }
  function setSort(s: string, o?: SortOrder) {
    const next = (o ?? (s === sort.value ? (order.value === 'asc' ? 'desc' : 'asc') : 'asc')) as SortOrder
    sort.value = s as typeof sort.value
    order.value = next
    localStorage.setItem('nimoos:file-sort', sort.value)
    localStorage.setItem('nimoos:file-order', order.value)
  }

  const selected = ref<Set<string>>(new Set())
  const selectionAnchor = ref<string | null>(null)

  function isSelected(path: string): boolean {
    return selected.value.has(path)
  }
  const selectedCount = computed(() => selected.value.size)
  const allSelected = computed(
    () => entries.value.length > 0 && sortedEntries.value.every((e) => selected.value.has(e.path)),
  )
  function clearSelection() {
    selected.value = new Set()
    selectionAnchor.value = null
  }
  function setSelection(paths: string[]) {
    selected.value = new Set(paths)
  }
  function toggleSelect(path: string) {
    const next = new Set(selected.value)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    selected.value = next
    selectionAnchor.value = path
  }
  function selectOnly(path: string) {
    selected.value = new Set([path])
    selectionAnchor.value = path
  }
  function selectRange(path: string) {
    const list = sortedEntries.value
    const anchor = selectionAnchor.value
    if (!anchor) { selectOnly(path); return }
    const ai = list.findIndex((e) => e.path === anchor)
    const bi = list.findIndex((e) => e.path === path)
    if (ai === -1 || bi === -1) { toggleSelect(path); return }
    const [lo, hi] = ai <= bi ? [ai, bi] : [bi, ai]
    const next = new Set(selected.value)
    for (let i = lo; i <= hi; i++) next.add(list[i].path)
    selected.value = next
  }
  function selectAll() {
    selected.value = new Set(sortedEntries.value.map((e) => e.path))
  }

  return {
    displayNames, disks, entries, currentPath, loading, error, loadRoots, setMountNames, defaultRootReal, load,
    viewMode, sort, order, sortedEntries, setView, setSort,
    selected, selectionAnchor, isSelected, selectedCount, allSelected,
    toggleSelect, selectOnly, selectRange, selectAll, clearSelection, setSelection,
  }
})
