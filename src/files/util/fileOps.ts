import type { OperateObject } from '../stores/clipboard'

export interface FileTask {
  id: string
  type: string
  finished: boolean
  status: string
  processing_path: string
  processed_size: number
  total_size: number
  to: string
}

// socket props.file_operate is a JSON string -> { data: FileTask[] } (ported
// from Vue2's FilePanel socket handler).
export function parseFileOperate(props: unknown): FileTask[] {
  const s = (props as { file_operate?: unknown } | null)?.file_operate
  if (typeof s !== 'string') return []
  try {
    const parsed = JSON.parse(s) as { data?: unknown }
    return Array.isArray(parsed.data) ? (parsed.data as FileTask[]) : []
  } catch { return [] }
}

export function filterActive(tasks: FileTask[]): FileTask[] {
  return tasks.filter((t) => !t.finished)
}

// Ported from Vue2 FilePanel: completed task's destination === current directory → need to reload
export function shouldReload(tasks: FileTask[], currentPath: string): boolean {
  return tasks.some((t) => t.finished && t.to === currentPath)
}

// B6: `is_dir` rides on clipboard items purely so the conflict dialog can tell
// files from folders (see clipboard.ts) -- it never belonged on the wire.
// Vue2's FilePanel.vue submitPasteTask keeps the request body byte-for-byte
// the shape the backend already expects (`item.map(entry => ({ from: entry.from }))`);
// stripping it here matches that instead of passing OperateItem through as-is.
export function buildPastePayload(o: OperateObject, to: string, style: 'overwrite' | 'rename') {
  return { type: o.type, item: o.item.map((entry) => ({ from: entry.from })), to, style }
}

export function taskPercent(task: FileTask): number {
  if (!task.total_size || task.total_size <= 0) return 0
  return Math.floor((task.processed_size / task.total_size) * 100)
}
