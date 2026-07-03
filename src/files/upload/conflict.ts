import { service } from '@nimotech/nimoos-service'
import type { SelectedFile } from './types'

const ALLOWED = ['overwrite', 'rename', 'skip'] as const
type ConflictPolicy = (typeof ALLOWED)[number]

export function conflictKey(targetPath: string, relativePath: string): string {
  return `${targetPath} ${relativePath}`
}

/**
 * Groups files by targetPath and issues one uploadPrecheck call per distinct
 * directory, returning a Set of conflictKey(...) for files reported to
 * already exist on disk. Any error from the service call is rethrown so the
 * caller can decide whether to fall back to uploading everything.
 */
export async function precheckExisting(files: SelectedFile[]): Promise<Set<string>> {
  const byTarget = new Map<string, SelectedFile[]>()
  for (const f of files) {
    if (!byTarget.has(f.targetPath)) byTarget.set(f.targetPath, [])
    byTarget.get(f.targetPath)!.push(f)
  }

  const existingKeys = new Set<string>()

  for (const [targetPath, group] of byTarget) {
    const res = await service.file.uploadPrecheck(
      targetPath,
      group.map((f) => ({ relativePath: f.relativePath, size: f.file.size })),
    )
    if (res && Array.isArray(res.results)) {
      for (const r of res.results) {
        if (r.exists) {
          existingKeys.add(conflictKey(targetPath, r.relativePath))
        }
      }
    }
  }

  return existingKeys
}

// Normalize a UI choice into a backend conflictPolicy. Unknown/null/cancel
// falls back to rename (neither overwrite nor silently drop data).
export function decideConflictPolicy(choice: string | null | undefined): ConflictPolicy {
  return (ALLOWED as readonly string[]).includes(choice as string) ? (choice as ConflictPolicy) : 'rename'
}
