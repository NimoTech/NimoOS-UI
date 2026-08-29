import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import type { NormalizedAggregate } from '@nimotech/nimoos-service'

// Mock the entire service package: search.agentTool is the protagonist here;
// image.thumbUrl is consumed by media rows;
// storage.list is pulled in by files store's loadRoots() → foldersStore.loadDisks()
// (the draft said folder.listDisks but the actual call chain is service.storage.list;
//  copying that would cause loadDisks to hit catch and print "[home] disk load failed" to stderr, now corrected).
const agentTool = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    search: { agentTool: (...a: unknown[]) => agentTool(...a) },
    image: { thumbUrl: (p: string) => '/thumb?path=' + encodeURIComponent(p) },
    storage: { list: async () => [] },
  },
}))

import { useHomeUiStore } from '../stores/homeUi'
import { useFoldersStore } from '../stores/folders'
import { useViewer } from '../../files/viewers/useViewer'
import SearchDialog from './SearchDialog.vue'

// i18n is already set up globally by vitest.setup.ts (defaults to zh_cn), **do not create a separate createI18n in tests**.
let wrapper: VueWrapper | null = null

function agg(over: Partial<NormalizedAggregate> = {}): NormalizedAggregate {
  return {
    semantic: [], filenames: [], images: [], notes: [],
    stats: { fileindexStatus: 'ready', totalCandidates: 0 }, warnings: [], ...over,
  }
}

// Real device response from spec §7.10a (query=receipt)
const REAL = agg({
  filenames: [
    { path: '/DATA/Documents/Recipes/Receipt.pdf', name: 'Receipt.pdf', ext: 'pdf', size: 53866, mtimeMs: 1784715139167, isDir: false, match: 2 },
    { path: "/DATA/Documents/life/Nick's receipt.jpg", name: "Nick's receipt.jpg", ext: 'jpg', size: 42943, mtimeMs: 1783651328200, isDir: false, match: 1.5 },
  ],
  stats: { fileindexStatus: 'ready', totalCandidates: 2 },
  warnings: ['images_unavailable'],
})

// F1 control group: images source (Photos CLIP) matches — this is the only row type the Photos
// app truly recognizes, and album cards appear as expected.
// Badge is derived from buildSearchView's badgeOf: images source with fromFilename=false / fromOcr=false → 'semantic'.
const FROM_IMAGES = agg({
  images: [
    { assetId: 'a1', name: 'beach.jpg', path: '/DATA/Gallery/beach.jpg', score: 0.42,
      takenAt: '2026-01-01T00:00:00Z', thumbnailUrl: '/v1/photos/a1/thumbnail', caption: 'a beach at sunset' },
  ],
  stats: { fileindexStatus: 'ready', totalCandidates: 1 },
})

// Seed a real disk so displayNames = { '/DATA': 'NimoOS-HD' } — otherwise displayNames
// is always {}, toVirtualPath degenerates to identity function, and "converting path to
// virtual path" becomes un-testable (no-op). This follows the existing convention from src/views/Files.test.ts:61.
function seedDisks(): void {
  const folders = useFoldersStore()
  folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] })
}

// SearchDialog has used useRoute()/useRouter() to consume deep links ?q= since SP9-P8,
// so mounting must include the router plugin. Create a minimal router with memory history
// containing only '/': this component doesn't use <RouterView>, just needs to support query.
// ⚠️ Do not import the real src/router — that would pull the entire routing table
// (all page components) into the unit test.
async function mountDialog(url = '/'): Promise<Router> {
  const r = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
  r.push(url)
  await r.isReady()
  wrapper = mount(SearchDialog, { attachTo: document.body, global: { plugins: [r] } })
  return r
}

async function open(): Promise<void> {
  seedDisks()
  useHomeUiStore().openSearch()
  await mountDialog()
  await flushPromises() // Wait for onMounted's loadRoots() to settle, then displayNames is ready
  await nextTick()
}
async function search(q: string): Promise<void> {
  const input = document.body.querySelector('.searchbox') as HTMLInputElement
  input.value = q
  input.dispatchEvent(new Event('input'))
  await nextTick()
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
  await flushPromises()
  await nextTick()
}

describe('SearchDialog', () => {
  beforeEach(() => { setActivePinia(createPinia()); agentTool.mockReset() })
  afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

  it('when closed, no search box in DOM', async () => {
    await mountDialog()
    await nextTick()
    expect(document.body.querySelector('.searchbox')).toBeNull()
  })

  it('when opened, empty state: only hint text, no suggestion chips (chips deleted from demo phase)', async () => {
    await open()
    expect(document.body.querySelector('.searchbox')).not.toBeNull()
    expect(document.body.querySelectorAll('.chip').length).toBe(0)
    expect(document.body.textContent).toContain('输入关键词')
  })

  it('only send request on Enter, using trimmed query', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    const input = document.body.querySelector('.searchbox') as HTMLInputElement
    input.value = '  receipt  '
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(agentTool).not.toHaveBeenCalled()   // input doesn't trigger (no search-as-you-type)
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    await flushPromises()
    expect(agentTool).toHaveBeenCalledWith('receipt')
  })

  // ── F1 (spec deviation 6): album cards only accept rows from images / OCR sources ──────────
  // Both hits in the real device fixture come from the filenames source;
  // Nick's receipt.jpg is in /DATA/Documents/life/ and doesn't exist in the Photos library —
  // old behavior rendered it as an album card (CTA "Open Album" → jumps to empty page).
  it('real device response (both hits from filename source) → one document row + one media row, no album card', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.querySelectorAll('.result').length).toBe(1)
    expect(document.body.textContent).toContain('Receipt.pdf')
    // Album card must not appear at all (neither the card itself nor the thumbnail grid inside)
    expect(document.body.querySelector('.album')).toBeNull()
    expect(document.body.querySelectorAll('.album-thumb').length).toBe(0)
    // Convert to media single row, and it must be that jpg (thumbnail URL points to its real path, not "any row")
    const media = document.body.querySelectorAll('.media-row')
    expect(media.length).toBe(1)
    expect(media[0]?.querySelector('img')?.getAttribute('src'))
      .toBe('/thumb?path=' + encodeURIComponent("/DATA/Documents/life/Nick's receipt.jpg"))
  })

  // ── Spec deviation 7: media single row adds filename + path ────────────────────────────
  // After F1 diverts filename-match images to .media-row, that row originally only had
  // thumbnail + source badge — user searches for "receipt" and gets "Nick's receipt.jpg"
  // but cannot see the searched name in the row.
  // ⚠️ Path assertion relies on seedDisks() in open(): when disks are not seeded, displayNames
  //    is always {}, toVirtualPath degenerates to identity function, and '/DATA/Documents/life'
  //    would pass anyway, making the assertion a no-op.
  it('media single row displays filename and its folder **virtual path** (/DATA → /NimoOS-HD)', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    const row = document.body.querySelector('.media-row') as HTMLElement
    expect(row).not.toBeNull()
    expect(row.querySelector('.result-name')?.textContent).toBe("Nick's receipt.jpg")
    expect(row.querySelector('.result-path')?.textContent).toBe('/NimoOS-HD/Documents/life')
    // Badge and CTA still in same row (added text didn't squeeze them out)
    expect(row.querySelector('.media-acc-num')?.textContent).toBe('文件名')
    expect(row.querySelector('.row-open')).not.toBeNull()
  })

  it('filename-match images: left-click previews in place, top-right CTA is "Open Folder" not "Open Album"', async () => {
    agentTool.mockResolvedValue(REAL)
    const viewer = useViewer()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      await open()
      await search('receipt')
      const row = document.body.querySelector('.media-row') as HTMLElement
      // CTA text: "Open Folder ›" not "Open Album ›"
      const cta = row.querySelector('.row-open') as HTMLElement
      expect(cta.textContent).toContain('打开文件夹')
      expect(cta.textContent).not.toContain('打开相册')
      // Left-click → ViewerHost previews this jpg in place; openPhotos calls closeSearch() first, panel must stay open
      row.click()
      await nextTick()
      expect(viewer.open.value).toBe(true)
      expect(viewer.currentItem.value?.path).toBe("/DATA/Documents/life/Nick's receipt.jpg")
      expect(useHomeUiStore().searchOpen).toBe(true)
      // CTA uses openFolder (new window to the folder's virtual path), not openPhotos's same-page jump
      cta.click()
      await nextTick()
      expect(String(openSpy.mock.calls[0]?.[0])).toMatch(/#\/files\/NimoOS-HD\/Documents\/life$/)
    } finally {
      viewer.close()
      openSpy.mockRestore()
    }
  })

  // openMediaRow's badge branch is only visible when "the previewer can't open this media" —
  // and this path is easy to hit: VIDEO_X_GENERIC has 19 extensions, panelMap's video-player
  // only takes BROWSER_PLAYABLE_VIDEO's 5, and .mkv/.avi/.wmv are everywhere on NAS.
  // Old behavior fell back to /#/photos (empty page), new behavior falls back to containing folder.
  it('filename-match non-previewable media (.mkv): left-click falls back to containing folder, not empty album', async () => {
    agentTool.mockResolvedValue(agg({
      filenames: [{ path: '/DATA/Media/holiday.mkv', name: 'holiday.mkv', ext: 'mkv', size: 900, mtimeMs: 1, isDir: false, match: 2 }],
    }))
    const viewer = useViewer()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      await open()
      await search('holiday')
      const row = document.body.querySelector('.media-row') as HTMLElement
      expect(row).not.toBeNull()
      row.click()
      await nextTick()
      expect(viewer.open.value).toBe(false)                       // mkv has no preview panel, fallback indeed triggered
      expect(String(openSpy.mock.calls[0]?.[0])).toMatch(/#\/files\/NimoOS-HD\/Media$/)
      expect(useHomeUiStore().searchOpen).toBe(true)              // openPhotos calls closeSearch(), not taken
    } finally {
      viewer.close()
      openSpy.mockRestore()
    }
  })

  it('control group: images source hits show album card as expected (Photos-recognized rows unharmed)', async () => {
    agentTool.mockResolvedValue(FROM_IMAGES)
    await open()
    await search('beach')
    expect(document.body.querySelector('.album')).not.toBeNull()
    expect(document.body.querySelectorAll('.album-thumb').length).toBe(1)
    expect(document.body.textContent).toContain('打开相册')
    // Not diverted to media single row
    expect(document.body.querySelector('.media-row')).toBeNull()
  })

  it('reasons render as Chinese labels, not hardcoded English demo labels', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.textContent).toContain('文件名命中')
    expect(document.body.textContent).not.toContain('Exact filename match')
  })

  // After F1, real device fixture no longer has album cards, this test now checks the badge on media rows (same thing: badge replaces percentage).
  it('source badge replaces accuracy percentage: media row no longer shows % numbers', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    const acc = document.body.querySelector('.media-acc-num') as HTMLElement
    expect(acc.textContent).toBe('文件名')
    expect(document.body.textContent).not.toMatch(/\d+%/)
  })

  it('source badge replaces accuracy percentage: album card thumbnail no longer shows % numbers', async () => {
    agentTool.mockResolvedValue(FROM_IMAGES)
    await open()
    await search('beach')
    const acc = document.body.querySelector('.album-acc') as HTMLElement
    expect(acc.textContent).toBe('语义')
    expect(document.body.textContent).not.toMatch(/\d+%/)
  })

  it('document row path shows folder **virtual path** (/DATA → /NimoOS-HD)', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    const path = document.body.querySelector('.result-path') as HTMLElement
    // Asserting the translated virtual path: disk is seeded, if folderOf doesn't pass toVirtualPath it would be /DATA/... and fail
    expect(path.textContent).toBe('/NimoOS-HD/Documents/Recipes')
  })

  it('images_unavailable → degradation notice bar at top of results (not toast, doesn\'t cover results)', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    const notice = document.body.querySelector('.search-notice') as HTMLElement
    expect(notice).not.toBeNull()
    expect(notice.textContent).toContain('图片搜索不可用')
    expect(document.body.querySelectorAll('.result').length).toBe(1)  // results display normally
  })

  it('unrecognized warnings pass through as-is, not silently swallowed', async () => {
    agentTool.mockResolvedValue(agg({ ...REAL, warnings: ['brand_new_source_exploded'] }))
    await open()
    await search('receipt')
    const notice = document.body.querySelector('.search-notice') as HTMLElement
    expect(notice).not.toBeNull()
    expect(notice.textContent).toContain('brand_new_source_exploded')
  })

  it('no notice bar when all four sources present (warnings empty)', async () => {
    agentTool.mockResolvedValue(agg({ ...REAL, warnings: [] }))
    await open()
    await search('receipt')
    expect(document.body.querySelector('.search-notice')).toBeNull()
    expect(document.body.querySelectorAll('.result').length).toBe(1)
  })

  it('zero results with no warning → "no matching files" empty state', async () => {
    agentTool.mockResolvedValue(agg())
    await open()
    await search('zzz')
    expect(document.body.textContent).toContain('没有匹配的文件')
  })

  it('zero results with warning → "search backend not ready", distinguished from "not found"', async () => {
    agentTool.mockResolvedValue(agg({ warnings: ['semantic_unavailable', 'images_unavailable'] }))
    await open()
    await search('zzz')
    expect(document.body.textContent).toContain('搜索后端未就绪')
    expect(document.body.textContent).not.toContain('没有匹配的文件')
    // When backend_not_ready, subtitle must list which sources didn't participate
    const sub = document.body.querySelector('.search-empty-sub') as HTMLElement
    expect(sub.textContent).toContain('语义搜索不可用')
    expect(sub.textContent).toContain('图片搜索不可用')
  })

  it('no searchable directories → "no searchable directories", distinguished from other two empty states', async () => {
    agentTool.mockResolvedValue(agg({ warnings: ['no_accessible_roots'] }))
    await open()
    await search('zzz')
    expect(document.body.textContent).toContain('没有可搜索的目录')
    expect(document.body.textContent).not.toContain('搜索后端未就绪')
  })

  // no_roots empty state must also list which sources didn't participate: deriveDegrade sets
  // empty to 'no_roots' when it sees no_accessible_roots, and images_unavailable in the same
  // warning batch still goes into noticeItems — if we hardcode the subtitle condition to
  // 'backend_not_ready', the information is calculated but has nowhere to render, silently swallowed.
  it('no_roots empty state also lists unavailable sources (not just backend_not_ready)', async () => {
    agentTool.mockResolvedValue(agg({ warnings: ['no_accessible_roots', 'images_unavailable'] }))
    await open()
    await search('zzz')
    expect(document.body.textContent).toContain('没有可搜索的目录')
    const sub = document.body.querySelector('.search-empty-sub') as HTMLElement
    expect(sub).not.toBeNull()
    expect(sub.textContent).toContain('图片搜索不可用')
  })

  it('request fails → error state + retry button, never shows as empty result', async () => {
    agentTool.mockRejectedValue(new Error('ai down'))
    await open()
    await search('receipt')
    expect(document.body.textContent).toContain('搜索失败')
    expect(document.body.textContent).not.toContain('没有匹配的文件')
    const retry = document.body.querySelector('.search-retry') as HTMLElement
    expect(retry).not.toBeNull()

    agentTool.mockResolvedValue(REAL)
    retry.click()
    await flushPromises()
    await nextTick()
    expect(document.body.querySelectorAll('.result').length).toBe(1)
  })

  it('success then failure → error state not shown with previous results (view not cleared, only state gate works)', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.querySelectorAll('.result').length).toBe(1)
    // Don't change the query (changing it resets and clears the view, missing the pitfall);
    // just press Enter again to make it fail
    agentTool.mockReset()
    agentTool.mockRejectedValue(new Error('ai down'))
    ;(document.body.querySelector('.searchbox') as HTMLInputElement)
      .dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    await flushPromises()
    await nextTick()
    expect(document.body.querySelector('.search-error')).not.toBeNull()
    expect(document.body.querySelectorAll('.result').length).toBe(0)
    expect(document.body.querySelector('.album')).toBeNull()
  })

  it('while searching, don\'t show previous results (state is only gate, view not cleared)', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.querySelectorAll('.result').length).toBe(1)
    // Second search suspends without resolving — UI must switch to Searching…, old results must not stay visible
    let release: ((v: NormalizedAggregate) => void) | undefined
    agentTool.mockReturnValue(new Promise<NormalizedAggregate>((r) => { release = r }))
    const input = document.body.querySelector('.searchbox') as HTMLInputElement
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    await nextTick()
    expect(document.body.querySelector('.searching')).not.toBeNull()
    expect(document.body.querySelector('.result')).toBeNull()
    release?.(REAL)
    await flushPromises()
  })

  it('change query back to empty state, need to press Enter again', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.querySelectorAll('.result').length).toBe(1)
    const input = document.body.querySelector('.searchbox') as HTMLInputElement
    input.value = 'receipts'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(document.body.querySelector('.result')).toBeNull()
  })

  it('directory row: left-click enters that directory, "Open Folder" enters parent', async () => {
    agentTool.mockResolvedValue(agg({
      filenames: [{ path: '/DATA/Documents/Recipes', name: 'Recipes', ext: '', size: 4096, mtimeMs: 1784715139167, isDir: true, match: 2 }],
    }))
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      await open()
      await search('recipes')
      ;(document.body.querySelector('.result') as HTMLElement).click()
      await nextTick()
      expect(String(openSpy.mock.calls[0]?.[0])).toMatch(/#\/files\/NimoOS-HD\/Documents\/Recipes$/)
      ;(document.body.querySelector('.row-open') as HTMLElement).click()
      await nextTick()
      expect(String(openSpy.mock.calls[1]?.[0])).toMatch(/#\/files\/NimoOS-HD\/Documents$/)
    } finally {
      openSpy.mockRestore()
    }
  })

  it('characters # ? % in paths are encoded per segment, not raw-spliced into hash', async () => {
    // Raw splice: `#` truncates hash (jumps to parent dir), `?` treats later part as query, `%` causes vue-router decode failure.
    agentTool.mockResolvedValue(agg({
      filenames: [{ path: '/DATA/Project #2/50% off?.pdf', name: '50% off?.pdf', ext: 'pdf', size: 10, mtimeMs: 1, isDir: false, match: 2 }],
    }))
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      await open()
      await search('off')
      ;(document.body.querySelector('.row-open') as HTMLElement).click()
      await nextTick()
      const url = String(openSpy.mock.calls[0]?.[0])
      expect(url).toMatch(/#\/files\/NimoOS-HD\/Project%20%232$/)
      // In hash, besides the `#/files` leading hash, no bare # / ? / unencoded % allowed
      expect(url.slice(url.indexOf('#/files') + 1)).not.toMatch(/[#?]/)
    } finally {
      openSpy.mockRestore()
    }
  })

  it('close panel then reopen → query and results cleared', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.querySelectorAll('.result').length).toBe(1)
    const ui = useHomeUiStore()
    ui.closeSearch()
    await nextTick()
    ui.openSearch()
    await nextTick()
    expect(document.body.querySelector('.result')).toBeNull()
    expect((document.body.querySelector('.searchbox') as HTMLInputElement).value).toBe('')
    expect(document.body.textContent).toContain('输入关键词')
  })

  it('close button clears searchOpen', async () => {
    await open()
    ;(document.body.querySelector('.close-btn') as HTMLElement).click()
    await nextTick()
    expect(useHomeUiStore().searchOpen).toBe(false)
  })
})

describe('deep link ?q= (desktop search panel)', () => {
  beforeEach(() => { setActivePinia(createPinia()); agentTool.mockReset() })
  afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

  // Deep link scenario can't reuse open(): that helper manually calls openSearch() before mounting,
  // but deep link tests what we want is "component opens panel by itself". Just mount here,
  // then wait two rounds of microtasks + tick for the watcher chain to complete.
  async function deepLink(url: string): Promise<Router> {
    seedDisks()
    const r = await mountDialog(url)
    await flushPromises(); await nextTick(); await flushPromises(); await nextTick()
    return r
  }

  it('?q=receipt: auto-open panel + seed query + search once + results actually render', async () => {
    agentTool.mockResolvedValue(REAL)
    await deepLink('/?q=receipt')
    const input = document.body.querySelector('.searchbox') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.value).toBe('receipt')
    expect(agentTool).toHaveBeenCalledTimes(1)
    expect(agentTool).toHaveBeenCalledWith('receipt')
    // ⚠️ Must assert results render, can't just assert "request was made": missing one tick
    //    and the request still fires, but results are dropped by query watcher's reset() —
    //    just checking request count misses this.
    expect(document.body.textContent).toContain('Receipt.pdf')
  })

  it('after consuming, immediately remove q from URL (closing panel and refreshing won\'t pop up again)', async () => {
    agentTool.mockResolvedValue(REAL)
    const r = await deepLink('/?q=receipt')
    expect(r.currentRoute.value.query.q).toBeUndefined()
    expect(agentTool).toHaveBeenCalledTimes(1) // removing query doesn't trigger second round
  })

  it('?q= empty value (mirrors Vue2\'s old bare /search): open panel but don\'t send request', async () => {
    await deepLink('/?q=')
    expect(document.body.querySelector('.searchbox')).not.toBeNull()
    expect(agentTool).not.toHaveBeenCalled()
  })

  it('no q key: panel doesn\'t auto-open (normal entering desktop unaffected)', async () => {
    await deepLink('/')
    expect(document.body.querySelector('.searchbox')).toBeNull()
    expect(agentTool).not.toHaveBeenCalled()
  })

  it('?q=a&q=b array form takes first (doesn\'t send "a,b" as query)', async () => {
    agentTool.mockResolvedValue(REAL)
    await deepLink('/?q=a&q=b')
    expect(agentTool).toHaveBeenCalledWith('a')
  })

  it('?q= all whitespace: empty after trim, don\'t send request (consistent with run() trim semantics)', async () => {
    await deepLink('/?q=%20%20')
    expect(document.body.querySelector('.searchbox')).not.toBeNull()
    expect(agentTool).not.toHaveBeenCalled()
  })

  // ⚠️ `?q` (key present but no equals sign) — vue-router gives **null**, not ''.
  //    Not theoretical: a user typing /?q by hand hits exactly this shape.
  //    Early implementation only blocked undefined; seed got null → seed.trim() throws TypeError.
  //    vue-tsc caught it first (TS18047 / TS2322), this test pins it at runtime.
  // ⚠️ Reverting to old way, failure looks like **Unhandled Errors** from vitest
  //    (TypeError: Cannot read properties of null (reading 'trim'))+ **exit code 1**,
  //    not a failing assertion — throw point is in watcher's async IIFE, assertions can't see it.
  //    Already tested: mutate exit=1, restore exit=0.
  it('?q (key no value, vue-router gives null): open panel but don\'t send request, no throw', async () => {
    await deepLink('/?q')
    expect(document.body.querySelector('.searchbox')).not.toBeNull()
    expect(agentTool).not.toHaveBeenCalled()
  })

  it('after deep link search, can still change query and search normally (seeding didn\'t break follow-up interaction)', async () => {
    agentTool.mockResolvedValue(REAL)
    await deepLink('/?q=receipt')
    expect(agentTool).toHaveBeenCalledTimes(1)
    await search('invoice')
    expect(agentTool).toHaveBeenCalledTimes(2)
    expect(agentTool).toHaveBeenLastCalledWith('invoice')
  })
})

// SP16 Task 13: search → click result to preview → press **Esc once** → preview closes and
// search panel also closes, all results lost. Root cause is timing: reka's DismissableLayer
// and ViewerHost's Esc handler both register on window's **bubbling** phase, execution order
// depends on registration order — Home mounts a ViewerHost early, long before this dialog opens.
// So it sets viewer.open = false first, then guard reads it's already false, doesn't preventDefault,
// dialog dismisses normally.
describe('Esc closes only preview, not search panel together', () => {
  // Play the role of "Home's early-registered ViewerHost": bubbling phase, registered before
  // this dialog, closes preview on Esc. **Must be registered before mount**, order is the root
  // of this bug — if registered after, guard would still read true, test would pass for wrong
  // reason (first version was written that way).
  let offViewerHost: (() => void) | null = null
  function registerEarlierViewerHost(): void {
    const viewer = useViewer()
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape' && viewer.open.value) viewer.open.value = false }
    window.addEventListener('keydown', h)
    offViewerHost = () => window.removeEventListener('keydown', h)
  }
  afterEach(() => { offViewerHost?.(); offViewerHost = null })

  const pressEscape = (): void => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  }

  it('when preview open, press Esc once: panel and results still there', async () => {
    agentTool.mockResolvedValue(REAL)
    registerEarlierViewerHost()
    await open()
    await search('receipt')
    const homeUi = useHomeUiStore()
    expect(homeUi.searchOpen).toBe(true)
    expect(document.body.querySelectorAll('.result').length).toBeGreaterThan(0)

    const viewer = useViewer()
    viewer.open.value = true
    await nextTick()

    // One real window event, all three parties complete in this one dispatch: capture phase
    // (snapshot listener added by this task) → earlier-registered ViewerHost's bubble listener
    // sets open = false → reka's bubble listener reads the guard.
    pressEscape()
    await nextTick()
    await nextTick()

    expect(viewer.open.value).toBe(false)      // preview should close (ViewerHost's job)
    expect(homeUi.searchOpen).toBe(true)       // panel must stay open
    expect(document.body.querySelectorAll('.result').length).toBeGreaterThan(0) // results not lost
  })

  it('when no preview, pressing Esc still closes panel normally (don\'t block the normal path)', async () => {
    agentTool.mockResolvedValue(REAL)
    registerEarlierViewerHost()
    await open()
    await search('receipt')
    const homeUi = useHomeUiStore()
    expect(useViewer().open.value).toBe(false)

    pressEscape()
    await nextTick()
    await nextTick()

    expect(homeUi.searchOpen).toBe(false)
  })
})
