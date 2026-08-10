import type { FileTask } from './fileOps'

/**
 * Percentage for one file-operation row, or null when the backend has not told
 * us how big the job is.
 *
 * Deliberately NOT the same as `taskPercent` in ./fileOps.ts, which returns 0
 * for an unknown total. Returning 0 draws a progress bar that claims "0% done"
 * when the truth is "size unknown, in progress" -- two different states that
 * must not render the same. `taskPercent` keeps its own semantics for its own
 * callers; do not "unify" the two.
 */
export function opsTaskPercent(task: FileTask): number | null {
  if (!task.total_size || task.total_size <= 0) return null
  const pct = Math.floor((task.processed_size / task.total_size) * 100)
  return Math.min(100, Math.max(0, pct))
}

/** i18n key (not text) for a task's verb, so the caller owns translation. */
export function opsTaskLabelKey(task: FileTask): string {
  return task.type === 'copy' ? 'filesOpCopy' : 'filesOpMove'
}

/** Last path segment only -- the panel must never leak the full /DATA path. */
export function opsTaskBasename(path: string): string {
  return path.split('/').filter(Boolean).pop() || path
}
