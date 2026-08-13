// SP8-P5c Task 3(half two) — `FolderBrowser.vue` component test.
// Blueprint `NimoOS-UI` (main@7a6ee6b7) `src/components/common/FolderBrowser.vue` (143 lines).
//
// 🔴 【mock layering — governance §4.1 five-row table, easiest place to crash in this task】
//   `service.folder.getList` in shared package is `unwrap<FolderListing>(res.data)`
//   (`NimoOS-Service/src/folder.ts:7-10`) → it resolves to **single layer**
//   `{ content: FolderEntry[] }`.
//   fixture `folder-list-DATA.json` is **three-layer HTTP envelope**
//   `{success,message,data:{content:[…18 items…],total,index,size}}`.
//   → this file copies its **`data.content` layer**, wrapped as `{ content: <those 18 items> }`
//   as the mock return value. **never stuff the three-layer envelope into mock** (that way
//   `listing.content` would be undefined, K28 would be wasted). This unwrapping action is
//   the proof of K28, the reverse test case below nails it ("stuff three-layer envelope into
//   mock → list must be empty").
// 🔴 Fixture copy (not runtime read from `.superpowers/`) — coordinator's ruling, rationale
//   in this file's FIXTURE-COPY block comment and T3 report §8; equivalence validated by
//   one-shot script (report §9).
// Read `.vue` source files (guard gaps ③ those two) still exclusively via `node:fs`, not
//   Vite's `?raw` (vitest's CSSEnablerPlugin turns style source into empty string → assertion
//   against empty string "false passes"; precedent in `knowledgeStyles.test.ts` head comment ③).
// Test scaffold follows `QueueView.test.ts` / `IndexedFilesView.test.ts` (P5b shipping products):
//   real i18n (not hand-written subset) + `vi.hoisted()` service mock + `flushPromises()`.
//   This component uses no router / no store, so those two plugins are not installed.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { i18n } from '../../../i18n'
import FolderBrowser from './FolderBrowser.vue'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── vi.hoisted mock skeleton (governance §9: avoid ESM hoisting TDZ) ──
const folder = vi.hoisted(() => ({ getList: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { folder } }))

interface RawEntry { name: string; path: string; is_dir: boolean }

/**
 * Raw shape of each item from `GET /v1/folder?path=/DATA` (11 fields, order matches backend).
 * Copied verbatim from `.superpowers/sdd/p5c-fixtures/folder-list-DATA.json` (captured on device 2026-08-03).
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
// FIXTURE-COPY-BEGIN — folder-list-DATA.json's data.content (18 items)
// Taken from `.superpowers/sdd/p5c-fixtures/folder-list-DATA.json` (captured on device 2026-08-03),
// copied verbatim to avoid test cross-boundary dependency on gitignore directory —
// coordinator's ruling, see T3 report §8.
// 🔴 Copying the **`data.content` layer** from the three-layer envelope (= K28's unwrapping action).
// 🔴 No fields trimmed, no order changed; equivalence validated by one-shot script (report §9).
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

/** 🔴 Single-layer shape (= return value of wrapper method `service.folder.getList()`), not the three-layer envelope. */
const DATA_LISTING = { content: DATA_CONTENT }

/** Blueprint parent passes output of `pickerRoots()`; local wiki/candidates tested to return `[]` →
 *  on-device runs with fallback three roots (governance §4.3), use those three verbatim here. */
const FALLBACK_ROOTS = [
  { path: '/DATA', label: 'System (/DATA)' },
  { path: '/media', label: '/media' },
  { path: '/mnt', label: '/mnt' },
]

function makeDeferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let res!: (v: T) => void
  let rej!: (e: unknown) => void
  const promise = new Promise<T>((a, b) => { res = a; rej = b })
  return { promise, resolve: res, reject: rej }
}

function mountFb(roots: { path: string; label?: string }[] = FALLBACK_ROOTS) {
  return mount(FolderBrowser, {
    props: { roots },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  folder.getList.mockReset()
})

describe('FolderBrowser — root level (current === "")', () => {
  it('renders each roots item: drive icon + label + chev, makes no requests', () => {
    const w = mountFb()
    const rows = w.findAll('.fb-row')
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.find('.fb-name').text())).toEqual([
      'System (/DATA)', '/media', '/mnt',
    ])
    // Each row has two KIcons: drive + chev (blueprint :13 / :15)
    expect(rows[0]!.findAll('svg')).toHaveLength(2)
    expect(folder.getList).not.toHaveBeenCalled()
  })

  it('when candidate lacks label, text falls back to path (template `r.label || r.path`)', () => {
    const w = mountFb([{ path: '/media/usb9' }])
    expect(w.find('.fb-name').text()).toBe('/media/usb9')
  })

  it('when roots is empty, shows "no disks detected" empty state with no .fb-row elements', () => {
    const w = mountFb([])
    expect(w.findAll('.fb-row')).toHaveLength(0)
    expect(w.find('.fb-stub').text()).toBe('未检测到磁盘卷——请在上方手输路径')
  })

  it('breadcrumbs initially have only root item, label from aiKbFbVolumes, data-last is string "true"', () => {
    const w = mountFb()
    const crumbs = w.findAll('.fb-crumb')
    expect(crumbs).toHaveLength(1)
    expect(crumbs[0]!.text()).toBe('卷')
    expect(crumbs[0]!.attributes('data-last')).toBe('true')
  })
})

describe('FolderBrowser — entering subdirectory (K28 single-layer fetch)', () => {
  it('clicking root item: calls getList(path), emits pick, renders 12 visible dirs by dirEntries', async () => {
    folder.getList.mockResolvedValue(DATA_LISTING)
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()

    expect(folder.getList).toHaveBeenCalledTimes(1)
    expect(folder.getList).toHaveBeenCalledWith('/DATA')
    expect(w.emitted('pick')).toEqual([['/DATA']])

    const names = w.findAll('.fb-row').map((r) => r.find('.fb-name').text())
    expect(names).toHaveLength(12)
    expect(names).toEqual([
      'Amalfi Coast', 'AppData', 'Documents', 'Downloads', 'Gallery', 'Image',
      'KVM', 'lost+found', 'Media', 'NIMO', 'Notes', 'todo-widget',
    ])
    // Hidden items and files not in list (fixture 18 items → 12 items)
    expect(names).not.toContain('.system_data')
    expect(names).not.toContain('nimo.tar.gz')
    expect(w.find('.fb-stub').exists()).toBe(false)
  })

  it('🔴 mock is single-layer {content}: if three-layer envelope is stuffed in, list is empty — proves we take .content not .data.data.content', async () => {
    // Discriminating test: three-layer envelope has no top-level content → `listing.content || []` (N7 fallback) yields empty array
    folder.getList.mockResolvedValue({ success: 200, message: 'ok', data: { content: DATA_CONTENT } })
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()
    expect(w.findAll('.fb-row')).toHaveLength(0)
    expect(w.find('.fb-stub').text()).toBe('(空)')
  })

  it('when directory is empty (content: []), shows "(empty)" empty state', async () => {
    folder.getList.mockResolvedValue({ content: [] })
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()
    expect(w.findAll('.fb-row')).toHaveLength(0)
    expect(w.find('.fb-stub').text()).toBe('(空)')
  })

  it('【N7】when content is null (Go nil slice), also shows "(empty)" not error', async () => {
    folder.getList.mockResolvedValue({ content: null })
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()
    expect(w.find('.fb-stub').text()).toBe('(空)')
    expect(w.find('.fb-err').exists()).toBe(false)
  })

  it('breadcrumbs grow with depth, data-last is "true" only on last item, "false" on others', async () => {
    folder.getList.mockResolvedValue(DATA_LISTING)
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()
    // Click down another level (first item in fixture: Amalfi Coast)
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()

    const crumbs = w.findAll('.fb-crumb')
    expect(crumbs.map((c) => c.text())).toEqual(['卷', 'DATA', 'Amalfi Coast'])
    expect(crumbs[0]!.attributes('data-last')).toBe('false')
    expect(crumbs[1]!.attributes('data-last')).toBe('false')
    expect(crumbs[2]!.attributes('data-last')).toBe('true')
    expect(folder.getList).toHaveBeenLastCalledWith('/DATA/Amalfi Coast')
  })

  it('while loading shows "loading…"; disappears after request resolves', async () => {
    const d = makeDeferred<{ content: RawEntry[] }>()
    folder.getList.mockReturnValue(d.promise)
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await nextTick()
    expect(w.find('.fb-stub').text()).toBe('加载中…')
    expect(w.findAll('.fb-row')).toHaveLength(0)

    d.resolve({ content: [] })
    await flushPromises()
    expect(w.find('.fb-stub').text()).toBe('(空)')
  })

  it('request fails: shows .fb-stub.fb-err "directory list failed to load", clears entries, closes loading', async () => {
    folder.getList.mockRejectedValue(new Error('boom'))
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()
    const err = w.find('.fb-err')
    expect(err.exists()).toBe(true)
    expect(err.classes()).toContain('fb-stub')
    expect(err.text()).toBe('目录列表加载失败')
    expect(w.findAll('.fb-row')).toHaveLength(0)
    // loading is closed (otherwise would render "loading…")
    expect(w.text()).not.toContain('loading…')
  })

  it('clicking root breadcrumb (path === "") returns to root: no emit pick, no request, clears entries', async () => {
    folder.getList.mockResolvedValue(DATA_LISTING)
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await flushPromises()
    expect(w.findAll('.fb-row')).toHaveLength(12)

    await w.findAll('.fb-crumb')[0]!.trigger('click') // root breadcrumb, path === ''
    await flushPromises()

    expect(folder.getList).toHaveBeenCalledTimes(1) // no second request
    expect(w.emitted('pick')).toEqual([['/DATA']]) // still only that one (blueprint :59 returns before :60)
    const names = w.findAll('.fb-row').map((r) => r.find('.fb-name').text())
    expect(names).toEqual(['System (/DATA)', '/media', '/mnt']) // back to roots level
    expect(w.findAll('.fb-crumb')).toHaveLength(1)
  })
})

describe('FolderBrowser — §5.2 `_seq` race guard (interleaved paths)', () => {
  // 🔴 Memory `newui-async-stale-guard`: async writes to shared state must have stale guard,
  // regression tests must actually take interleaved path (send then arrive late), not just
  // test sequential path. These three cases below nail blueprint :65(success branch) /
  // :68(catch) / :72(finally positive check) three guard sites.
  type Listing = { content: RawEntry[] }
  const A_LISTING: Listing = { content: [{ name: 'AAA', path: '/DATA/AppData/AAA', is_dir: true }] }
  const B_LISTING: Listing = { content: [{ name: 'BBB', path: '/DATA/BBB', is_dir: true }] }

  /**
   * Real interleaving scenario (user "can't wait" real path):
   *   ① Enter /DATA (resolves immediately, gets 12 rows)
   *   ② Click subdir AppData → `go('/DATA/AppData')` in flight (seq=2), call it **A**
   *   ③ Before it returns, click breadcrumb "DATA" → `go('/DATA')` in flight (seq=3), call it **B**
   * So A is stale, B is latest; their paths and return values are different.
   */
  async function raceSetup() {
    folder.getList.mockResolvedValueOnce(DATA_LISTING)
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click') // ① /DATA
    await flushPromises()
    expect(w.findAll('.fb-row')).toHaveLength(12)

    const dA = makeDeferred<Listing>()
    const dB = makeDeferred<Listing>()
    folder.getList.mockReturnValueOnce(dA.promise).mockReturnValueOnce(dB.promise)
    await w.findAll('.fb-row')[1]!.trigger('click') // ② AppData (row 2)
    await w.findAll('.fb-crumb')[1]!.trigger('click') // ③ breadcrumb "DATA"
    expect(folder.getList.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      '/DATA', '/DATA/AppData', '/DATA',
    ])
    return { w, dA, dB }
  }

  it('two go() calls interleaved (second returns first, first returns late) → entries are second result, loading closes to false', async () => {
    const { w, dA, dB } = await raceSetup()

    // Interleaving: latest B returns first
    dB.resolve(B_LISTING)
    await flushPromises()
    expect(w.findAll('.fb-name').map((n) => n.text())).toEqual(['BBB'])

    // Stale A returns late — must be dropped by guard, not allowed to overwrite B's result (blueprint :65)
    dA.resolve(A_LISTING)
    await flushPromises()
    expect(w.findAll('.fb-name').map((n) => n.text())).toEqual(['BBB'])
    expect(w.text()).not.toContain('AAA')
    expect(w.text()).not.toContain('loading…') // loading closes
  })

  it('when stale call returns first, must not write entries or close loading (blueprint :72 positive `if (seq === _seq)`)', async () => {
    const { w, dA, dB } = await raceSetup()

    // Stale A lands first → its finally must not close loading (B still in flight)
    dA.resolve(A_LISTING)
    await flushPromises()
    expect(w.find('.fb-stub').text()).toBe('加载中…')
    expect(w.text()).not.toContain('AAA')

    // Latest B lands to close it
    dB.resolve(B_LISTING)
    await flushPromises()
    expect(w.findAll('.fb-name').map((n) => n.text())).toEqual(['BBB'])
    expect(w.text()).not.toContain('loading…')
  })

  it('when stale call fails, must not write error state (blueprint :68 catch guard)', async () => {
    const { w, dA, dB } = await raceSetup()

    dB.resolve(B_LISTING)
    await flushPromises()
    dA.reject(new Error('stale failure'))
    await flushPromises()

    expect(w.find('.fb-err').exists()).toBe(false)
    expect(w.text()).not.toContain('目录列表加载失败')
    expect(w.findAll('.fb-name').map((n) => n.text())).toEqual(['BBB'])
  })

  // 🔴 M-1 (review probe 7 found guard gap, 2026-08-03): `seq` must be **component-local**
  // (`let` inside `<script setup>`), not module-level. Review testing: moving it to true
  // module-level (shared across instances) results in above three **single-instance** interleave
  // tests still passing 19/0 — i.e., "component-local" had no test guarding it then. Real
  // consequence of module-level `seq`: two selector instances used simultaneously will each
  // judge other's requests as stale (entries forever empty, loading forever spinning).
  // This test case exclusively guards this: move `seq` to module-level → this test must fail.
  // ⚠️ Still **don't extract common guard** (premature abstraction), and **don't change
  // production code** — it's already correct. This is guard-side supplement to this repo's
  // discipline "async writes to shared state must have stale guard" (memory `newui-async-stale-guard`,
  // caught by review four times).
  it('two instances in flight don\'t interfere — seq is component-local, not module-level (cross-instance sharing)', async () => {
    const A_CHILD: Listing = { content: [{ name: 'A-CHILD', path: '/A/A-CHILD', is_dir: true }] }
    const B_CHILD: Listing = { content: [{ name: 'B-CHILD', path: '/B/B-CHILD', is_dir: true }] }
    const dA = makeDeferred<Listing>()
    const dB = makeDeferred<Listing>()
    folder.getList.mockImplementation((p: string) => (p === '/A' ? dA.promise : dB.promise))

    const wA = mountFb([{ path: '/A', label: 'A' }])
    const wB = mountFb([{ path: '/B', label: 'B' }])
    await wA.find('.fb-row').trigger('click') // 实例 A:go('/A') 在飞
    await wB.find('.fb-row').trigger('click') // 实例 B:go('/B') 在飞
    expect(folder.getList.mock.calls.map((c: unknown[]) => c[0])).toEqual(['/A', '/B'])

    // Interleaving: later-sent B returns first, then A — neither instance should be affected by the other
    dB.resolve(B_CHILD)
    await flushPromises()
    dA.resolve(A_CHILD)
    await flushPromises()

    expect(wB.findAll('.fb-name').map((n) => n.text())).toEqual(['B-CHILD'])
    // ↓ At module-level seq, A's mySeq(1) !== seq(2) → judged stale, would be []
    expect(wA.findAll('.fb-name').map((n) => n.text())).toEqual(['A-CHILD'])
    expect(wA.text()).not.toContain('B-CHILD')
    expect(wB.text()).not.toContain('A-CHILD')
    // ↓ At module-level seq, A's finally positive check would fail → loading spins forever
    expect(wA.text()).not.toContain('加载中…')
    expect(wB.text()).not.toContain('加载中…')
  })

  it('reset() increments seq first then clears state → in-flight request landing writes no state', async () => {
    const dA = makeDeferred<typeof A_LISTING>()
    folder.getList.mockReturnValue(dA.promise)
    const w = mountFb()
    await w.findAll('.fb-row')[0]!.trigger('click')
    await nextTick()
    expect(w.find('.fb-stub').text()).toBe('加载中…')

    // Blueprint parent uses $refs.fb.reset(); Vue3 uses defineExpose
    ;(w.vm as unknown as { reset: () => void }).reset()
    await nextTick()
    // Back to root level (current === ''), loading cleared
    expect(w.findAll('.fb-name').map((n) => n.text())).toEqual(['System (/DATA)', '/media', '/mnt'])
    expect(w.findAll('.fb-crumb')).toHaveLength(1)

    dA.resolve(A_LISTING) // stale request lands
    await flushPromises()
    expect(w.text()).not.toContain('AAA')
    expect(w.findAll('.fb-name').map((n) => n.text())).toEqual(['System (/DATA)', '/media', '/mnt'])
  })

  it('defineExpose exposes reset (blueprint uses $refs.fb.reset() to call)', () => {
    const w = mountFb()
    expect(typeof (w.vm as unknown as { reset?: unknown }).reset).toBe('function')
  })
})

describe('FolderBrowser — guard gap ③: <template> block has no bare color literals', () => {
  // Governance §9 gap ③: color-guard.test.ts:44-56 styleLines() only takes <style> block
  // from .vue → zero scan of template style="…" attributes; this file adds targeted assertion
  // to plug this blind spot.
  // ⚠️ This file follows current style of QueueView.test.ts / IndexedFilesView.test.ts
  // (non-greedy + implicitly anchored on "</template> at column 0"); governance §9 gap ③′
  // "unify to greedy matching + coverage self-check" goes to T8, not touched this round.
  it('<template> block (stripped of var()/color-mix()) contains no bare hex / rgb / hsl literals', () => {
    const src: string = readFileSync(resolve(__dirname, './FolderBrowser.vue'), 'utf8')
    const m = /<template>([\s\S]*?)\n<\/template>/.exec(src)
    expect(m).not.toBeNull()
    const tmpl = m![1]
    // Coverage self-check: extracted segment must contain template's last line signature
    // (nested <template v-else> in this component are indented, won't prematurely cut
    // </template> at column 0)
    expect(tmpl).toContain('fb-crumbs') // template start
    expect(tmpl).toContain('aiKbFbEmpty') // template end (5 lines from end)

    // Strip insides of var(...) and color-mix(...) (same technique as color-guard.test.ts
    // stripVar: scan character-by-character tracking paired bracket depth, support nested
    // fallback)
    function stripCalls(s: string, prefixes: string[]): string {
      let out = ''
      let i = 0
      while (i < s.length) {
        const hit = prefixes.find((p) => s.startsWith(p, i))
        if (hit) {
          let depth = 0
          let j = i + hit.length - 1 // 落在开括号上
          for (; j < s.length; j++) {
            if (s[j] === '(') depth++
            else if (s[j] === ')') {
              depth--
              if (depth === 0) {
                j++
                break
              }
            }
          }
          i = j
        } else {
          out += s[i]
          i++
        }
      }
      return out
    }
    const scrubbed = stripCalls(tmpl, ['var(', 'color-mix('])
    expect(scrubbed).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(scrubbed).not.toMatch(/\b(rgba?|hsla?)\s*\(/)
  })

  it('this file has no <style> block (.fb* styles in knowledge.scss, moved by T2a)', () => {
    const src: string = readFileSync(resolve(__dirname, './FolderBrowser.vue'), 'utf8')
    expect(src).not.toMatch(/^<style/m)
  })
})
