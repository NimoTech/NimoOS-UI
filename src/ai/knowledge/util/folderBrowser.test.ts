// SP8-P5c Task 3 (part 1) — unit tests for `util/folderBrowser.ts` three pure functions.
// Blueprint `NimoOS-UI` (main@7a6ee6b7) `src/components/common/folderBrowser.js:3-34`.
//
// [Data source for end-to-end test case] `data.content` layer of `folder-list-DATA.json`
// (18 items) **copied verbatim into this file** (see FIXTURE-COPY block below),
// not reading that directory at runtime — coordinator ruling (see T3 report §8):
// `.superpowers/` covered by gitignore, enters repo only via `git add -f`, SP7 lost
// entire directory once; tests under `src/` cross-depend on it, once merged without it
// or someone runs `git clean -X`, mysteriously dies with "file not found". Governance §4
// "forbid hand-written" means "don't invent data by imagination" (memory
// `newui-fixture-from-imagination-trap`), copy + cite source also satisfies + test
// self-contained. Copy-blueprint original equivalence verified programmatically by
// one-off script (report §9). Expected values (12 dir names and their `localeCompare`
// order) are **hardcoded literals**, not computed from copy — else assertion
// self-fulfills, losing discriminative power.
import { describe, it, expect } from 'vitest'
import type { FolderEntry } from '@nimotech/nimoos-service'
import { crumbsFor, dirEntries, pickerRoots } from './folderBrowser'

/**
 * The verbatim shape of each item from `GET /v1/folder?path=/DATA` (11 fields, in the same
 * order as the backend). Copied verbatim from `.superpowers/sdd/p5c-fixtures/folder-list-DATA.json`
 * (captured on a real device, 2026-08-03).
 */
interface RawFolderItem {
  name: string
  size: number
  is_dir: boolean
  is_symlink: boolean
  modified: string
  sign: string
  thumb: string
  type: number
  path: string
  date: string
  extensions: null
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE-COPY-BEGIN  ——  the data.content layer of folder-list-DATA.json (18 items)
// Taken from `.superpowers/sdd/p5c-fixtures/folder-list-DATA.json` (real-device capture,
// 2026-08-03), copied verbatim so the test doesn't cross-depend on a gitignored directory —
// coordinator ruling, see T3 report §8.
// 🔴 That fixture is a **three-layer envelope of the raw HTTP response**:
//   `{success,message,data:{content:[…18 items…],total,index,size}}`;
//   what's copied here is **just the `data.content` layer** (= the array itself inside the
//   `{ content }` that `service.folder.getList()` returns after `unwrap()`). This layer-drop
//   is the concrete evidence of K28.
// 🔴 Not a single field trimmed, not a single order changed; equivalence verified
//   programmatically by a one-off script (report §9).
// ─────────────────────────────────────────────────────────────────────────────
const DATA_CONTENT: RawFolderItem[] = [
  {"name": ".snapshots", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-30T22:08:06.07507098+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/.snapshots", "date": "2026-07-30T22:08:06.07507098+08:00", "extensions": null},
  {"name": ".system_data", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-30T22:16:28.530622772+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/.system_data", "date": "2026-07-30T22:16:28.530622772+08:00", "extensions": null},
  {"name": ".wiki.md", "size": 2558, "is_dir": false, "is_symlink": false, "modified": "2026-07-31T17:06:29.558792532+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/.wiki.md", "date": "2026-07-31T17:06:29.558792532+08:00", "extensions": null},
  {"name": "Amalfi Coast", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-07T12:19:56.792668321+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Amalfi Coast", "date": "2026-07-07T12:19:56.792668321+08:00", "extensions": null},
  {"name": "AppData", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-23T11:23:08.733979447+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/AppData", "date": "2026-07-23T11:23:08.733979447+08:00", "extensions": null},
  {"name": "Documents", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-22T17:03:25.553912817+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Documents", "date": "2026-07-22T17:03:25.553912817+08:00", "extensions": null},
  {"name": "Downloads", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2022-07-06T09:00:46.243995396+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Downloads", "date": "2022-07-06T09:00:46.243995396+08:00", "extensions": null},
  {"name": "Gallery", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-23T14:37:56.926239751+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Gallery", "date": "2026-07-23T14:37:56.926239751+08:00", "extensions": null},
  {"name": "Image", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-30T18:18:59.58279995+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Image", "date": "2026-07-30T18:18:59.58279995+08:00", "extensions": null},
  {"name": "KVM", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-30T20:33:51.818325425+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/KVM", "date": "2026-07-30T20:33:51.818325425+08:00", "extensions": null},
  {"name": "Media", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-21T14:29:41.551348808+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Media", "date": "2026-07-21T14:29:41.551348808+08:00", "extensions": null},
  {"name": "NIMO", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-04T10:56:17.701403032+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/NIMO", "date": "2026-07-04T10:56:17.701403032+08:00", "extensions": null},
  {"name": "Notes", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-18T16:05:53.980766082+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/Notes", "date": "2026-07-18T16:05:53.980766082+08:00", "extensions": null},
  {"name": "lost+found", "size": 16384, "is_dir": true, "is_symlink": false, "modified": "2022-07-06T08:56:00+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/lost+found", "date": "2022-07-06T08:56:00+08:00", "extensions": null},
  {"name": "nimo.tar.gz", "size": 12886696675, "is_dir": false, "is_symlink": false, "modified": "2026-06-12T11:49:39.693706674+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/nimo.tar.gz", "date": "2026-06-12T11:49:39.693706674+08:00", "extensions": null},
  {"name": "todo-widget", "size": 4096, "is_dir": true, "is_symlink": false, "modified": "2026-07-18T15:29:16.289637517+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/todo-widget", "date": "2026-07-18T15:29:16.289637517+08:00", "extensions": null},
  {"name": "todo-widget.html", "size": 4251, "is_dir": false, "is_symlink": false, "modified": "2026-07-18T15:21:03.066935239+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/todo-widget.html", "date": "2026-07-18T15:21:03.066935239+08:00", "extensions": null},
  {"name": "我如何高效的使用claudecode.md", "size": 6808, "is_dir": false, "is_symlink": false, "modified": "2026-07-04T14:22:27.546329309+08:00", "sign": "", "thumb": "", "type": 0, "path": "/DATA/我如何高效的使用claudecode.md", "date": "2026-07-04T14:22:27.546329309+08:00", "extensions": null},
]
// FIXTURE-COPY-END

/** Build one `GET /v1/folder` entry (field names match the real fixture verbatim: `is_dir`, not `isDir`). */
function entry(name: string, isDir: boolean, path?: string): FolderEntry {
  return { name, is_dir: isDir, path: path ?? `/DATA/${name}` }
}

describe('dirEntries(content) —— blueprint folderBrowser.js:3-8', () => {
  it('[N7 fallback] returns empty array when content is undefined, does not throw', () => {
    expect(dirEntries(undefined)).toEqual([])
  })

  it('[N7 fallback] returns empty array when content is null (result of a Go nil slice serialization), does not throw', () => {
    expect(dirEntries(null)).toEqual([])
  })

  it('returns empty array when content is an empty array', () => {
    expect(dirEntries([])).toEqual([])
  })

  it('returns empty array when all entries are files (is_dir all false) — only directories are kept', () => {
    const out = dirEntries([entry('a.txt', false), entry('b.md', false)])
    expect(out).toEqual([])
  })

  it('returns empty array when all entries are hidden directories (name starts with .) — startsWith(".") filters them out', () => {
    const out = dirEntries([entry('.snapshots', true), entry('.system_data', true)])
    expect(out).toEqual([])
  })

  it('mixed input keeps only "visible directories", and each item has only the name / path fields', () => {
    const out = dirEntries([
      entry('.hidden-dir', true),
      entry('visible-dir', true),
      entry('file.txt', false),
      entry('.hidden-file', false),
    ])
    expect(out).toEqual([{ name: 'visible-dir', path: '/DATA/visible-dir' }])
    // Only name / path are mapped out — is_dir must not be carried through
    expect(Object.keys(out[0]!).sort()).toEqual(['name', 'path'])
  })

  it('a name that is exactly the single character "." (starts with ".") is also filtered out (boundary: startsWith, not ===)', () => {
    expect(dirEntries([entry('.', true, '/DATA/.')])).toEqual([])
  })

  it('a directory whose name contains a "." but not at the start is kept (the other side of the boundary)', () => {
    expect(dirEntries([entry('a.b', true)])).toEqual([{ name: 'a.b', path: '/DATA/a.b' }])
  })

  it('sorting really takes effect: unordered in → localeCompare ascending out', () => {
    const out = dirEntries([entry('zeta', true), entry('alpha', true), entry('mid', true)])
    expect(out.map((e) => e.name)).toEqual(['alpha', 'mid', 'zeta'])
  })

  it('localeCompare is not codepoint order: with mixed case, lowercase sorts in between uppercase entries', () => {
    // Codepoint order would give ['KVM','Media','lost+found'] (all uppercase before lowercase);
    // localeCompare gives ['KVM','lost+found','Media'] — this case specifically pins down that localeCompare is used.
    const out = dirEntries([entry('Media', true), entry('lost+found', true), entry('KVM', true)])
    expect(out.map((e) => e.name)).toEqual(['KVM', 'lost+found', 'Media'])
  })

  it('end-to-end: the real 18 items from the folder-list-DATA.json copy → 12 visible directories (taking the data.content layer)', () => {
    const content = DATA_CONTENT // ← the content layer inside the three-layer envelope (the copy)
    // The copy hasn't drifted: 18 items, 14 of which are is_dir (including 3 hidden)
    expect(content).toHaveLength(18)
    expect(content.filter((e) => e.is_dir)).toHaveLength(14)

    const out = dirEntries(content)
    expect(out).toHaveLength(12)
    expect(out.map((e) => e.name)).toEqual([
      'Amalfi Coast', 'AppData', 'Documents', 'Downloads', 'Gallery', 'Image',
      'KVM', 'lost+found', 'Media', 'NIMO', 'Notes', 'todo-widget',
    ])
    expect(out.map((e) => e.path)).toEqual([
      '/DATA/Amalfi Coast', '/DATA/AppData', '/DATA/Documents', '/DATA/Downloads',
      '/DATA/Gallery', '/DATA/Image', '/DATA/KVM', '/DATA/lost+found',
      '/DATA/Media', '/DATA/NIMO', '/DATA/Notes', '/DATA/todo-widget',
    ])
    // The three items starting with . are filtered out (two hidden directories + one hidden file)
    expect(out.map((e) => e.name)).not.toContain('.snapshots')
    expect(out.map((e) => e.name)).not.toContain('.system_data')
    expect(out.map((e) => e.name)).not.toContain('.wiki.md')
    // Sorting really did change the order: in the fixture's original order lost+found comes after Notes, in the output it comes after KVM
    const rawNames = content.map((e) => e.name)
    expect(rawNames.indexOf('lost+found')).toBeGreaterThan(rawNames.indexOf('Notes'))
    expect(out.map((e) => e.name).indexOf('lost+found')).toBeLessThan(
      out.map((e) => e.name).indexOf('Media'),
    )
  })
})

describe('pickerRoots(candidates) —— blueprint folderBrowser.js:10-23', () => {
  // Verified against governance §4.3: on the real device GET /v1/wiki/candidates returns [] →
  // the real device does hit this fallback path, the three fallback roots are not dead code.
  // The three labels are hardcoded English, not routed through i18n (matches the blueprint).
  const FALLBACK = [
    { path: '/DATA', label: 'System (/DATA)' },
    { path: '/media', label: '/media' },
    { path: '/mnt', label: '/mnt' },
  ]

  it('[N7 fallback] gives the three fallback roots when candidates is undefined', () => {
    expect(pickerRoots(undefined)).toEqual(FALLBACK)
  })

  it('[N7 fallback] gives the three fallback roots when candidates is null', () => {
    expect(pickerRoots(null)).toEqual(FALLBACK)
  })

  it('gives the three fallback roots, in the same order, when candidates is an empty array (the real value observed from wiki/candidates on device)', () => {
    const out = pickerRoots([])
    expect(out).toEqual(FALLBACK)
    expect(out.map((r) => r.path)).toEqual(['/DATA', '/media', '/mnt'])
  })

  it('when candidates exist and have a label, maps each one to {path, label}, dropping the rest of the fields', () => {
    const out = pickerRoots([
      { path: '/media/usb1', label: 'USB Stick' },
      { path: '/mnt/pool', label: 'Pool' },
    ])
    expect(out).toEqual([
      { path: '/media/usb1', label: 'USB Stick' },
      { path: '/mnt/pool', label: 'Pool' },
    ])
    expect(Object.keys(out[0]!).sort()).toEqual(['label', 'path'])
  })

  it('when a candidate is missing label, label falls back to path (via `|| c.path`)', () => {
    expect(pickerRoots([{ path: '/media/usb2' }])).toEqual([
      { path: '/media/usb2', label: '/media/usb2' },
    ])
  })

  it('when a candidate\'s label is an empty string, it also falls back to path (the falsy semantics of `||`, not `??`)', () => {
    expect(pickerRoots([{ path: '/mnt/x', label: '' }])).toEqual([
      { path: '/mnt/x', label: '/mnt/x' },
    ])
  })

  it('when candidates exist, the three fallback roots are never mixed in (the other side of the boundary)', () => {
    const out = pickerRoots([{ path: '/media/usb1', label: 'USB' }])
    expect(out).toHaveLength(1)
    expect(out.map((r) => r.path)).not.toContain('/DATA')
  })
})

describe('crumbsFor(path, rootLabel) —— blueprint folderBrowser.js:25-34', () => {
  it('when path is an empty string there is only the root item, label uses the passed-in rootLabel, path is an empty string', () => {
    expect(crumbsFor('', '卷')).toEqual([{ label: '卷', path: '' }])
  })

  it('single-segment path: root + one segment', () => {
    expect(crumbsFor('/DATA', 'Volumes')).toEqual([
      { label: 'Volumes', path: '' },
      { label: 'DATA', path: '/DATA' },
    ])
  })

  it('multi-segment path: segments accumulate into an absolute path one by one', () => {
    expect(crumbsFor('/DATA/Documents/Sub', 'Volumes')).toEqual([
      { label: 'Volumes', path: '' },
      { label: 'DATA', path: '/DATA' },
      { label: 'Documents', path: '/DATA/Documents' },
      { label: 'Sub', path: '/DATA/Documents/Sub' },
    ])
  })

  it('extra leading/trailing / are swallowed by filter(Boolean), result matches a clean path', () => {
    expect(crumbsFor('/DATA/Documents/', 'Volumes')).toEqual(
      crumbsFor('/DATA/Documents', 'Volumes'),
    )
  })

  it('consecutive // are swallowed by filter(Boolean), producing no empty-label segment', () => {
    const out = crumbsFor('//DATA//Documents//', 'Volumes')
    expect(out).toEqual([
      { label: 'Volumes', path: '' },
      { label: 'DATA', path: '/DATA' },
      { label: 'Documents', path: '/DATA/Documents' },
    ])
    expect(out.some((c) => c.label === '')).toBe(false)
  })

  it('a relative path not starting with / is also padded into an absolute path (direct consequence of the blueprint\'s acc += "/" + seg)', () => {
    expect(crumbsFor('DATA/Documents', 'Volumes')).toEqual([
      { label: 'Volumes', path: '' },
      { label: 'DATA', path: '/DATA' },
      { label: 'Documents', path: '/DATA/Documents' },
    ])
  })

  it('rootLabel passes through unchanged, with no processing at all', () => {
    expect(crumbsFor('/x', '  Volumes  ')[0]).toEqual({ label: '  Volumes  ', path: '' })
  })
})
