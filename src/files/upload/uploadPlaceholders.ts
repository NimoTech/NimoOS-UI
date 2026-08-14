// Optimistic listing entries for uploads that are still in flight. A folder
// upload's files only materialize on disk once the first child finishes, so a
// freshly started folder upload is invisible in the directory listing for what
// can feel like a long time — the user cannot tell anything is happening. These
// synthetic entries put the top-level folder (or single file) into the list the
// instant the upload is queued; the real listing takes over on the next refresh
// and these drop out by de-duplication.
import type { FileEntry } from '../stores/files'
import type { UploadItem } from './types'

// Only pending/uploading/paused count as "in flight". done is dropped (the real
// listing refresh shows it) and error is dropped (a failed upload must not leave
// a ghost folder behind — the user asked for failures to disappear).
const ACTIVE = new Set(['pending', 'uploading', 'paused'])

function stripTrailingSlash(p: string): string {
  return p.length > 1 ? p.replace(/\/+$/, '') : p
}

/**
 * Top-level placeholder entries for uploads targeting `currentPath`. One entry
 * per distinct top segment; a top segment that appears with a nested path
 * (`Trip/a.jpg`) is a folder, a bare one (`a.txt`) is a file. Folder wins if the
 * same top name shows up both ways. Entries are marked `uploading` so the tile
 * can render an in-progress style and openEntry can refuse to open them.
 */
export function uploadPlaceholders(queue: UploadItem[], currentPath: string): FileEntry[] {
  const dir = stripTrailingSlash(currentPath || '')
  if (!dir) return []
  const isDirByName = new Map<string, boolean>()
  for (const item of queue || []) {
    if (!ACTIVE.has(item.status)) continue
    if (stripTrailingSlash(item.targetPath || '') !== dir) continue
    const rel = item.relativePath || item.fileName || ''
    if (!rel) continue
    const slash = rel.indexOf('/')
    const top = slash === -1 ? rel : rel.slice(0, slash)
    if (!top) continue
    const nested = slash !== -1
    // Folder wins over file for the same top name.
    isDirByName.set(top, (isDirByName.get(top) || false) || nested)
  }
  const out: FileEntry[] = []
  for (const [name, is_dir] of isDirByName) {
    out.push({ name, path: `${dir}/${name}`, is_dir, uploading: true })
  }
  return out
}

/**
 * Merge upload placeholders in front of the real (already sorted) listing,
 * dropping any whose name already exists on disk — once the folder is created
 * the real entry takes over and the placeholder must not double it.
 */
export function mergeUploadPlaceholders(sorted: FileEntry[], placeholders: FileEntry[]): FileEntry[] {
  if (!placeholders.length) return sorted
  const existing = new Set(sorted.map((e) => e.name))
  const fresh = placeholders.filter((p) => !existing.has(p.name))
  return fresh.length ? [...fresh, ...sorted] : sorted
}
