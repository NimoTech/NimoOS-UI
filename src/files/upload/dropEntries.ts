// Drag-drop folder upload: use webkitGetAsEntry to recursively read directories, preserve
// relativePath (for protected directory checks + batch aggregation). Unlike Photos'
// collectFilesFromDataTransfer: no media type filtering (generic file manager), no hidden file skipping.
// Pure logic, no Vue/store dependencies.

interface FsEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  fullPath: string
  file?: (ok: (f: File) => void, err?: () => void) => void
  createReader?: () => { readEntries: (ok: (e: FsEntry[]) => void, err?: () => void) => void }
}
export interface DroppedFile { file: File; relativePath: string }
export interface DroppedTree { files: DroppedFile[]; emptyDirs: string[] }

function stripLead(p: string): string { return p.replace(/^\/+/, '') }

// readEntries returns at most ~100 entries per call (Chrome); loop until empty.
function readAllEntries(reader: { readEntries: (ok: (e: FsEntry[]) => void, err?: () => void) => void }): Promise<FsEntry[]> {
  return new Promise((resolve) => {
    const all: FsEntry[] = []
    const read = () => {
      reader.readEntries((entries) => {
        if (!entries || entries.length === 0) return resolve(all)
        all.push(...entries)
        read()
      }, () => resolve(all))
    }
    read()
  })
}

function entryToFile(entry: FsEntry): Promise<File | null> {
  return new Promise((resolve) => {
    if (!entry.file) return resolve(null)
    entry.file((f) => resolve(f), () => resolve(null))
  })
}

async function walk(entry: FsEntry | null, out: DroppedFile[], emptyDirs: string[]): Promise<void> {
  if (!entry) return
  if (entry.isFile) {
    const f = await entryToFile(entry)
    if (f) out.push({ file: f, relativePath: stripLead(entry.fullPath || entry.name) })
    return
  }
  if (entry.isDirectory && entry.createReader) {
    const children = await readAllEntries(entry.createReader())
    // Empty directories: the entire pipeline only has "file" entities; directories are a side
    // effect of files landing on disk. Do not record relative paths here—empty directories
    // will vanish from upload (bug.txt #4). Record only leaves: parent paths are filled by
    // backend MkdirAll. webkitdirectory selector cannot obtain empty directories per spec;
    // that code path cannot be fixed; only drag-drop reaches here.
    if (!children.length) { emptyDirs.push(stripLead(entry.fullPath || entry.name)); return }
    for (const child of children) await walk(child, out, emptyDirs)
  }
}

export async function readDroppedEntries(dt: DataTransfer | null): Promise<DroppedTree> {
  const out: DroppedFile[] = []
  const emptyDirs: string[] = []
  if (!dt) return { files: out, emptyDirs }
  const items = dt.items as unknown as (DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null })[] | null
  const supportsEntries = !!(items && items.length && items[0].webkitGetAsEntry)
  if (supportsEntries) {
    // Snapshot entries synchronously: DataTransferItemList is invalidated once the
    // event loop yields (after any await).
    const entries: (FsEntry | null)[] = []
    for (let i = 0; i < items!.length; i++) {
      if (items![i].kind === 'file') entries.push(items![i].webkitGetAsEntry!())
    }
    for (const entry of entries) {
      try { await walk(entry, out, emptyDirs) } catch (e) { console.error('[files][drop] walk failed', e) }
    }
    return { files: out, emptyDirs }
  }
  // Fallback: flat file list (no folder traversal possible, so no directories at all).
  for (const f of Array.from(dt.files || [])) out.push({ file: f, relativePath: f.name })
  return { files: out, emptyDirs }
}
