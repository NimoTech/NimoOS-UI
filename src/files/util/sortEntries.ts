// Single source of truth for the Files area's own folders-first, sort-field/order comparator --
// extracted out of stores/files.ts's `sortedEntries` computed (fix round, Task 5 review finding 1)
// so SnapshotPreviewWindow.vue's depth-stack previews can mirror the LIVE front window's current
// sort/order instead of a fixed policy ("every stacked layer must look like a REAL window", same
// reasoning Vue2's own SnapshotPreviewWindow.vue applies by reading $store.state.sort/order
// directly). Generic over any entry shape with `name`/`is_dir` + optional `date`/`size`, since
// stores/files.ts's `FileEntry` and snapshotPreviewCache's `PreviewFile` are different shapes
// (`is_dir` vs `isDir`, `date` ISO string vs `mtime` epoch number) -- callers adapt their own
// entry shape to `SortableEntry` rather than this util knowing about either concrete type.
import { fileExt } from './ext'

export type SortField = 'name' | 'format' | 'date' | 'size'
export type SortOrder = 'asc' | 'desc'

export interface SortableEntry {
  name: string
  is_dir: boolean
  date?: string
  size?: number | string
}

const KEY_FN: Record<SortField, (e: SortableEntry) => string | number> = {
  name: (e) => e.name.toLowerCase(),
  format: (e) => fileExt(e.name),
  date: (e) => new Date(e.date || 0).getTime() || 0,
  size: (e) => Number(e.size) || 0,
}

/** Folders always first, then by the given field/order. Returns a new array; does not mutate `entries`. */
export function sortEntries<T extends SortableEntry>(entries: T[], sort: SortField, order: SortOrder): T[] {
  const keyFn = KEY_FN[sort] || KEY_FN.name
  const dir = order === 'desc' ? -1 : 1
  return [...entries].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
    const ka = keyFn(a)
    const kb = keyFn(b)
    if (ka < kb) return -1 * dir
    if (ka > kb) return 1 * dir
    return 0
  })
}
