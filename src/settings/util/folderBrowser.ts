/* Pure helpers for the folder picker. 1:1 port of the Vue 2
 * panel's src/components/common/folderBrowser.js (34 lines).
 */
import type { FolderEntry } from '@nimotech/nimoos-service'
import type { FolderCandidate } from './folderPermissions'

export interface PickerRoot { path: string; label: string }

export function dirEntries(content: FolderEntry[] | null | undefined): { name: string; path: string }[] {
  return (content || [])
    .filter((e) => e.is_dir && !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, path: e.path }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Root layer for the picker. Candidates come from the Wiki service (volumes backed by LocalStorage);
 *  when candidates are empty or unavailable, the picker must still work, so it falls back to
 *  NimoOS's fixed layout.
 *  ⚠️ The current snapshot is always empty → what you see on a real device is exactly these three fallback roots. */
export function pickerRoots(candidates: FolderCandidate[] | null | undefined): PickerRoot[] {
  const cands = candidates || []
  if (cands.length) {
    return cands.map((c) => ({ path: c.path, label: c.label || c.path }))
  }
  return [
    { path: '/DATA', label: 'System (/DATA)' },
    { path: '/media', label: '/media' },
    { path: '/mnt', label: '/mnt' },
  ]
}

export function crumbsFor(path: string, rootLabel: string): { label: string; path: string }[] {
  const crumbs = [{ label: rootLabel, path: '' }]
  if (!path) return crumbs
  let acc = ''
  for (const seg of path.split('/').filter(Boolean)) {
    acc += `/${seg}`
    crumbs.push({ label: seg, path: acc })
  }
  return crumbs
}
