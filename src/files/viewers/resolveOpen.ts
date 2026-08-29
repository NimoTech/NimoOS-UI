import { getPanelType } from './panelMap'
import type { FileEntry } from '../stores/files'

export type OpenResolution = { kind: 'dir' } | { kind: 'view' } | { kind: 'download' }

export function resolveOpen(entry: FileEntry, _list: FileEntry[]): OpenResolution {
  if (entry.is_dir) return { kind: 'dir' }
  return getPanelType(entry.name) ? { kind: 'view' } : { kind: 'download' }
}
