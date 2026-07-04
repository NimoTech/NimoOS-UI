// 拖拽文件夹上传:用 webkitGetAsEntry 递归读取目录,保留 relativePath(供受保护
// 目录判断 + 批聚合)。与 Photos 的 collectFilesFromDataTransfer 不同:不按媒体
// 类型过滤(文件管理器通用),不跳过隐藏文件。纯逻辑,无 Vue/store 依赖。

interface FsEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  fullPath: string
  file?: (ok: (f: File) => void, err?: () => void) => void
  createReader?: () => { readEntries: (ok: (e: FsEntry[]) => void, err?: () => void) => void }
}
export interface DroppedFile { file: File; relativePath: string }

function stripLead(p: string): string { return p.replace(/^\/+/, '') }

// readEntries returns at most ~100 entries per call (Chrome); loop until empty.
function readAllEntries(reader: { readEntries: (ok: (e: FsEntry[]) => void, err?: () => void) => void }): Promise<FsEntry[]> {
  return new Promise((resolve) => {
    const all: FsEntry[] = []
    const read = () => {
      reader.readEntries((entries) => {
        if (!entries || entries.length === 0) return resolve(all)
        all.push(...entries)
        Promise.resolve().then(read)
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

async function walk(entry: FsEntry | null, out: DroppedFile[]): Promise<void> {
  if (!entry) return
  if (entry.isFile) {
    const f = await entryToFile(entry)
    if (f) out.push({ file: f, relativePath: stripLead(entry.fullPath || entry.name) })
    return
  }
  if (entry.isDirectory && entry.createReader) {
    const children = await readAllEntries(entry.createReader())
    for (const child of children) await walk(child, out)
  }
}

export async function readDroppedEntries(dt: DataTransfer | null): Promise<DroppedFile[]> {
  const out: DroppedFile[] = []
  if (!dt) return out
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
      try { await walk(entry, out) } catch (e) { console.error('[files][drop] walk failed', e) }
    }
    return out
  }
  // Fallback: flat file list (no folder traversal possible).
  for (const f of Array.from(dt.files || [])) out.push({ file: f, relativePath: f.name })
  return out
}
