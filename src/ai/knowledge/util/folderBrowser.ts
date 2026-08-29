// SP8-P5c Task 3 (part 1) —— three pure functions for folder picker.
// 1:1 ported from the Vue 2 panel's `src/components/common/folderBrowser.js`
// (main@7a6ee6b7, 34 lines, read via `git show main:` ——
// governance §1: that repo's working tree is unreliable old branch).
//
// Point-by-point alignment:
//   Original :3-8   dirEntries
//   Original :10-23 pickerRoots (including :13 fallback comment semantics)
//   Original :25-34 crumbsFor
//
// 【Verbatim port rationale】Original reads `e.is_dir` / `e.name` / `e.path`, and shared
// package `FolderEntry = { name: string; path: string; is_dir: boolean }`
// (the shared HTTP client's `src/types.ts:26-30`) matches word-for-word → don't change any field
// names, **never change to camelCase `isDir`** (governance §12.1 C-5 verified: `GET /v1/folder`
// response field is snake_case `is_dir`).
//
// 【N7】 `dirEntries` `(content || [])` and `pickerRoots` `(candidates || [])` are
// necessary guards for Go nil slice serializing to `null`, **don't delete**.
//
// 【Why fallback three roots aren't dead code】Governance §4.3 testing: local
// `GET /v1/wiki/candidates` returns `[]` (HTTP 200, instant) → `pickerRoots([])` takes
// fallback branch, verifiable on real device. Those three labels (`System (/DATA)` / `/media` /
// `/mnt`) are **hardcoded English, not i18n** (original does so; they're data not copy).

import type { FolderEntry } from '@nimotech/nimoos-service'

/** One line of folder picker (original `:6` mapped shape). */
export interface DirEntry {
  name: string
  path: string
}

/** Input shape for `pickerRoots` —— structurally compatible with shared package `WikiCandidate`
 *  (`{ path, type, size?, label? }`), `label` optional (uses `|| c.path`). */
export interface PickerCandidate {
  path: string
  label?: string
}

/** One root-level item (original `:16` / `:19-21` return paths' common shape). */
export interface PickerRoot {
  path: string
  label: string
}

/** One breadcrumb item (original `:26` / `:31`). */
export interface Crumb {
  label: string
  path: string
}

/**
 * Original `:3-8` —— keep only directories, filter out hidden items starting with `.`,
 * sort by name `localeCompare` ascending.
 */
export function dirEntries(content?: FolderEntry[] | null): DirEntry[] {
  return (content || [])
    .filter((e) => e.is_dir && !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, path: e.path }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Original `:10-23` —— root-level candidates from Wiki service (LocalStorage-backed
 * volume list); when empty or unreachable, picker must still work, so fallback to
 * known NimoOS layout.
 */
export function pickerRoots(candidates?: PickerCandidate[] | null): PickerRoot[] {
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

/**
 * Original `:25-34` —— first item always root (`path: ''`), empty `path` yields root only;
 * else split by `/` (`filter(Boolean)` removes leading/trailing/consecutive slashes),
 * accumulate segment by segment.
 */
export function crumbsFor(path: string, rootLabel: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: rootLabel, path: '' }]
  if (!path) return crumbs
  let acc = ''
  for (const seg of path.split('/').filter(Boolean)) {
    acc += '/' + seg
    crumbs.push({ label: seg, path: acc })
  }
  return crumbs
}
