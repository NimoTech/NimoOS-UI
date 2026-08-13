// Folder upload via the File System Access API (`showDirectoryPicker`).
//
// Why this exists at all, given `<input webkitdirectory>` already uploads folders:
// the input CANNOT represent an empty directory. Verified in Chromium 1228 by picking
// a real empty folder — `files.length === 0`, `value === ''`, `webkitEntries` empty, and
// the browser fires `cancel` rather than `change` because the selection did not change.
// Nothing on that event carries the folder's name, so the input path has no way to know
// which directory to create. The same blind spot swallows empty SUBdirectories of a
// non-empty pick: `webkitRelativePath` is produced by files, so a directory containing
// no files anywhere below it simply never appears.
//
// `showDirectoryPicker` hands back a real directory handle (name + walkable tree), so
// both cases work — but it requires a **secure context**. The product's usual deployment
// is HTTP on a LAN IP, where `isSecureContext` is false and `window.showDirectoryPicker`
// is therefore `undefined` (measured). Hence `supportsDirectoryPicker()`: callers must
// keep the input path as the fallback.
//
// Output shape is deliberately identical to dropEntries.ts's DroppedTree so both entry
// points feed the same commit pipeline.

import type { DroppedFile, DroppedTree } from './dropEntries'

export interface FileHandleLike {
  kind?: string
  name: string
  getFile: () => Promise<File>
}
export interface DirectoryHandleLike {
  kind?: string
  name: string
  values: () => AsyncIterable<FileHandleLike | DirectoryHandleLike>
}

export function supportsDirectoryPicker(): boolean {
  return typeof (globalThis as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
}

export function showDirectoryPicker(): Promise<DirectoryHandleLike> {
  const pick = (globalThis as unknown as { showDirectoryPicker: (o?: unknown) => Promise<DirectoryHandleLike> })
    .showDirectoryPicker
  return pick({ mode: 'read' })
}

function isDirectory(h: FileHandleLike | DirectoryHandleLike): h is DirectoryHandleLike {
  // `kind` is the spec-mandated discriminator; the structural check keeps this honest
  // against handles from older/partial implementations that predate it.
  return h.kind === 'directory' || typeof (h as DirectoryHandleLike).values === 'function'
}

async function walk(dir: DirectoryHandleLike, prefix: string, files: DroppedFile[], emptyDirs: string[]): Promise<void> {
  let children = 0
  for await (const child of dir.values()) {
    children++
    const rel = `${prefix}/${child.name}`
    if (isDirectory(child)) {
      await walk(child, rel, files, emptyDirs)
      continue
    }
    try {
      files.push({ file: await (child as FileHandleLike).getFile(), relativePath: rel })
    } catch (e) {
      // One unreadable file (permissions, vanished mid-walk) must not sink the batch —
      // the same tolerance dropEntries.ts applies to a failed entry.file() callback.
      console.error('[files][dirPicker] cannot read file', rel, e)
    }
  }
  // Only leaves are recorded: the backend creates parent chains with MkdirAll, and a
  // directory that has children is created as a side effect of its contents landing.
  if (children === 0) emptyDirs.push(prefix)
}

export async function readPickedDirectory(root: DirectoryHandleLike): Promise<DroppedTree> {
  const files: DroppedFile[] = []
  const emptyDirs: string[] = []
  // Prefix with the picked folder's own name so relativePath matches what
  // `webkitRelativePath` would have produced for the same tree.
  await walk(root, root.name, files, emptyDirs)
  return { files, emptyDirs }
}
