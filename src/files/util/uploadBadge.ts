import type { FileEntry } from '../stores/files'

/**
 * True when the NAS reports this entry as belonging to an interrupted upload
 * batch. The backend may serialize the flag as a boolean or as the string
 * 'true' — both count (ported from Vue2 IconContainerMixin.js:71).
 */
export function isUploadBroken(entry: FileEntry | null | undefined): boolean {
  const up = entry?.extensions?.upload
  return !!up && (up.broken === true || up.broken === 'true')
}

/** Batch id behind the badge; '' when the entry carries none. */
export function uploadBatchIdOf(entry: FileEntry | null | undefined): string {
  return entry?.extensions?.upload?.batchId || ''
}
