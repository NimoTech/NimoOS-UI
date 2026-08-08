import type { SelectedFile } from './types'

// Shared normalization for both the file/folder picker (handleSelectedFiles)
// and drag-drop (onDrop) in Files.vue: strip leading slashes from
// relativePath — the downstream protected-dir check reads split('/')[0] to
// take the first segment, and a leading slash would produce an empty first
// segment that bypasses it.
export function toSelectedFiles(
  entries: { file: File; relativePath: string }[],
  targetPath: string,
): SelectedFile[] {
  return entries.map((e) => ({
    file: e.file,
    targetPath,
    relativePath: e.relativePath.replace(/^\/+/, ''),
  }))
}
