// SP7-P8a-T3: PhotosStorageCard.vue — Storage card on the settings page.
// Source coordinates in task-3-brief.md; Vue2 PhotosSettings.vue:39-126(template)/:299-331(computed)/
// :382(fmt)/:405-457(fmtBytes/five action methods).
//
// Test infrastructure deviation registry (brief vs. actual repo — follow actual test results):
// 1. The brief draft uses `@pinia/testing`'s `createTestingPinia({ stubActions: true })`, but the repo's
//    package.json does not have that package (`node_modules/.pnpm` has no @pinia/testing at any version).
//    Use the established pattern from settings.test.ts / AlbumPickerDialog.test.ts instead:
//    `setActivePinia(createPinia())` to create a real store instance, then use `vi.spyOn(store, 'action')`
//    to selectively stub only the actions that need controlled return values, while the rest use the real
//    implementation (we mock the shared package `@nimotech/nimoos-service`, not the store itself).
// 2. The brief's Step7 references `winningDeclaration(css, [...], 'background', {hover, dataActive})`
//    and `readComponentStyle()`, but neither exists in `cssCascade.ts` — that file actually only exports
//    `extractStyleBlock`/`winningHoverBackground`/`parseCssRules`/`ownBackground`. Use the established
//    pattern from `PhotosFilterChip.test.ts:107-114` instead: import component source with `?raw` →
//    `extractStyleBlock` → `winningHoverBackground(style, ['seg-btn'])`, and assert that the winning
//    selector contains both `:hover` and `data-active`.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { fmtGB, fmtBytes, buildBreakdown } from '../../util/storagePalette'

describe('storage card pure functions', () => {
  it('fmtGB: round when >=100, else one decimal place (Vue2 :382)', () => {
    expect(fmtGB(100)).toBe('100')
    expect(fmtGB(99.94)).toBe('99.9')
    expect(fmtGB(0)).toBe('0.0')
  })

  it('fmtBytes: step-wise carry-over, round when >=100 (Vue2 :405-413)', () => {
    expect(fmtBytes(0)).toBe('0 B')
    expect(fmtBytes(-1)).toBe('0 B')
    expect(fmtBytes(512)).toBe('512 B') // 512 >= 100 → round
    expect(fmtBytes(1536)).toBe('1.5 KB')
    expect(fmtBytes(1024 ** 4 * 2)).toBe('2.0 TB')
    // Units go up to TB; larger values continue in TB (while loop i < len-1 boundary)
    expect(fmtBytes(1024 ** 5)).toBe('1024 TB')
  })

  it('buildBreakdown: segment order fixed, other appended only when remainder > 0.05 GB (Vue2 :327)', () => {
    const GB = 1024 ** 3
    const segs = buildBreakdown(
      { photosBytes: 3 * GB, videosBytes: 2 * GB, rawBytes: GB, cacheBytes: 0, aiBytes: 0 },
      10, // usedGB
    )
    expect(segs.map((s) => s.key)).toEqual(['photos', 'videos', 'raw', 'thumbs', 'ai', 'other'])
    expect(segs.find((s) => s.key === 'other')!.gb).toBeCloseTo(4, 5)
  })

  it('buildBreakdown: remainder exactly 0.05 GB does not append other (boundary is strict greater-than)', () => {
    // Deviation registry (brief's test fixture has floating-point error, not source/brief logic conflict):
    // The brief draft originally used `{photosBytes: 1GB}, usedGB=1.05` intending other = 1.05-1 to hit 0.05 exactly,
    // but `1.05 - 1` in IEEE-754 double precision is 0.050000000000000044 (> 0.05), not exactly 0.05,
    // so the "no append at boundary" test case would necessarily misbehave with the original numbers — this is
    // inherent noise in floating-point subtraction, unrelated to the buildBreakdown/Vue2 source's `other > 0.05`
    // logic. Changed to: known=0 (no known segments) + usedGB=0.05, so other = Math.max(0, 0.05 - 0) has the exact
    // same IEEE-754 bit pattern as the literal 0.05 in the implementation, truly landing at the boundary without
    // introducing subtraction noise.
    const segs = buildBreakdown(
      { photosBytes: 0, videosBytes: 0, rawBytes: 0, cacheBytes: 0, aiBytes: 0 },
      0.05,
    )
    expect(segs.map((s) => s.key)).not.toContain('other')
  })

  it('buildBreakdown: negative bytes treated as 0 (Vue2 :317 Math.max(0, b))', () => {
    const segs = buildBreakdown(
      { photosBytes: -1, videosBytes: 0, rawBytes: 0, cacheBytes: 0, aiBytes: 0 },
      0,
    )
    expect(segs.find((s) => s.key === 'photos')!.gb).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Component tests: real Pinia store + mock shared package (not mocking the store itself)
// ---------------------------------------------------------------------------
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      getStorage: vi.fn(),
      getAbout: vi.fn(),
      pruneCache: vi.fn(),
      rebuildIndex: vi.fn(),
      triggerScan: vi.fn(),
      reclusterFaces: vi.fn(),
    },
  },
}))

import PhotosStorageCard from '../PhotosStorageCard.vue'
import photosStorageCardRaw from '../PhotosStorageCard.vue?raw'
import { usePhotosSettingsStore } from '../../stores/settings'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'

const GB = 1024 ** 3

function mountCard() {
  const wrapper = mount(PhotosStorageCard)
  const store = usePhotosSettingsStore()
  return { wrapper, store }
}

describe('PhotosStorageCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('when storageError, main numbers show em-dash + unavailable secondary line', async () => {
    const { wrapper, store } = mountCard()
    store.storage = null
    store.storageError = true
    await nextTick()
    expect(wrapper.get('[data-test="storage-headline"]').text()).toContain('—')
    expect(wrapper.text()).toContain('不可用')
  })

  it('retention: 5 tiers, current tier has data-active', async () => {
    const { wrapper, store } = mountCard()
    store.retentionDays = 30
    await nextTick()
    const btns = wrapper.findAll('[data-test="retention-seg"] button')
    expect(btns).toHaveLength(5)
    expect(btns.filter((b) => b.attributes('data-active') === 'true')).toHaveLength(1)
    expect(btns[2]!.attributes('data-active')).toBe('true') // third tier of [7,15,30,60,90]
  })

  it('clicking retention tier calls setRetention; emits toast on failure', async () => {
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'setRetention').mockResolvedValue(false)
    await wrapper.findAll('[data-test="retention-seg"] button')[4]!.trigger('click')
    expect(store.setRetention).toHaveBeenCalledWith(90)
    await flushPromises()
    expect(wrapper.emitted('toast')).toBeTruthy()
  })

  it('clicking retention tier successfully does not emit toast', async () => {
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'setRetention').mockResolvedValue(true)
    await wrapper.findAll('[data-test="retention-seg"] button')[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('toast')).toBeFalsy()
  })

  it('scanInterval: 5 tiers, off tier value via i18n (other four are unit abbreviation literals, no $t)', async () => {
    const { wrapper } = mountCard()
    const btns = wrapper.findAll('[data-test="scan-seg"] button')
    expect(btns).toHaveLength(5)
    expect(btns.map((b) => b.text())).toEqual([
      expect.not.stringMatching(/^\d/), '6h', '12h', '24h', '7d',
    ])
  })

  it('clicking scanInterval tier calls setScanInterval; emits toast on failure', async () => {
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'setScanInterval').mockResolvedValue(false)
    await wrapper.findAll('[data-test="scan-seg"] button')[1]!.trigger('click')
    expect(store.setScanInterval).toHaveBeenCalledWith(360)
    await flushPromises()
    expect(wrapper.emitted('toast')).toBeTruthy()
  })

  it('cache button: disabled when prunableBytes is 0', async () => {
    const { wrapper, store } = mountCard()
    store.storage = {
      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 0,
      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
    }
    await nextTick()
    expect(wrapper.get('[data-test="clear-cache"]').attributes('disabled')).toBeDefined()
  })

  it('cache button: clickable when prunableBytes > 0', async () => {
    const { wrapper, store } = mountCard()
    store.storage = {
      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
    }
    await nextTick()
    expect(wrapper.get('[data-test="clear-cache"]').attributes('disabled')).toBeUndefined()
  })

  it('after clearing cache successfully, refetch storage (Vue2 :423) and emit success toast', async () => {
    const { wrapper, store } = mountCard()
    store.storage = {
      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
    }
    await nextTick()
    vi.spyOn(store, 'pruneCache').mockResolvedValue(1024 * 1024)
    const fetchSpy = vi.spyOn(store, 'fetchStorage').mockResolvedValue(undefined)
    await wrapper.get('[data-test="clear-cache"]').trigger('click')
    await flushPromises()
    expect(fetchSpy).toHaveBeenCalled()
    expect(wrapper.emitted('toast')).toBeTruthy()
  })

  it('clear cache failure: emit failure toast, do not refetch storage', async () => {
    const { wrapper, store } = mountCard()
    store.storage = {
      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
    }
    await nextTick()
    vi.spyOn(store, 'pruneCache').mockRejectedValue(new Error('boom'))
    const fetchSpy = vi.spyOn(store, 'fetchStorage').mockResolvedValue(undefined)
    await wrapper.get('[data-test="clear-cache"]').trigger('click')
    await flushPromises()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(wrapper.emitted('toast')).toBeTruthy()
  })

  it('capacity bar segment count = breakdown count + 1 free segment (review Important-take-along: exact assertion, not >=5)', async () => {
    const { wrapper, store } = mountCard()
    const fixture = {
      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
    }
    store.storage = fixture
    await nextTick()
    // Expected segment count derived from buildBreakdown itself (usedGB = capGB - freeGB = 60, known segments total 58GB,
    // other = 2GB > 0.05 will be appended) — don't hardcode the number, so if fixture values change,
    // the expectation adjusts accordingly and the assertion still proves "the component actually renders every
    // segment from buildBreakdown", not just a coincidentally passing lower bound.
    const usedGB = fixture.diskTotalBytes / 1024 ** 3 - fixture.diskFreeBytes / 1024 ** 3
    const expectedSegs = buildBreakdown(fixture, usedGB)
    expect(expectedSegs.map((s) => s.key)).toEqual(['photos', 'videos', 'raw', 'thumbs', 'ai', 'other'])
    expect(wrapper.findAll('[data-test="bar-seg"]')).toHaveLength(expectedSegs.length)
    expect(wrapper.findAll('[data-test="bar-free"]')).toHaveLength(1)
  })

  it('on mount, fetch storage once (fetchStorage called, correcting action named in T3 Consumes interface list)', () => {
    const fetchSpy = vi.spyOn(usePhotosSettingsStore(), 'fetchStorage')
    mount(PhotosStorageCard)
    expect(fetchSpy).toHaveBeenCalled()
  })

  // Review Important-1: Rescan Now (rescanNow/triggerScan/scanBusy guard/success check toast/
  // failure fallback toast) had zero coverage previously — task-3-report.md mistakenly claimed "included in component and tests",
  // but it was never actually written. Added three conditions: success, failure, busy-time guard (first report's completeness claim was
  // inaccurate; it's been properly documented in the report — not just quietly changed to "now tested").
  it('Rescan Now success: call triggerScan, emit check toast, reset scanBusy', async () => {
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'triggerScan').mockResolvedValue(true)
    const btn = wrapper.get('[data-test="rescan-now"]')
    await btn.trigger('click')
    await flushPromises()
    expect(store.triggerScan).toHaveBeenCalledTimes(1)
    const toasts = wrapper.emitted('toast')
    expect(toasts).toBeTruthy()
    expect(toasts![0]![0]).toMatchObject({ icon: 'check' })
    expect(wrapper.get('[data-test="rescan-now"]').attributes('disabled')).toBeUndefined()
  })

  it('Rescan Now failure: emit fallback toast (trash icon, reuse photosSettingsRebuildStartFailed), reset scanBusy', async () => {
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'triggerScan').mockRejectedValue(new Error('boom'))
    const btn = wrapper.get('[data-test="rescan-now"]')
    await btn.trigger('click')
    await flushPromises()
    const toasts = wrapper.emitted('toast')
    expect(toasts).toBeTruthy()
    expect(toasts![0]![0]).toMatchObject({ icon: 'trash' })
    expect(wrapper.get('[data-test="rescan-now"]').attributes('disabled')).toBeUndefined()
  })

  it('Rescan Now busy guard: clicking again before in-flight request completes does not trigger second triggerScan', async () => {
    const { wrapper, store } = mountCard()
    let release: (() => void) | undefined
    vi.spyOn(store, 'triggerScan').mockImplementation(
      () => new Promise<boolean>((res) => { release = () => res(true) }),
    )
    const btn = wrapper.get('[data-test="rescan-now"]')
    await btn.trigger('click') // don't await completion, click again while in flight
    expect(wrapper.get('[data-test="rescan-now"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-test="rescan-now"]').trigger('click')
    expect(store.triggerScan).toHaveBeenCalledTimes(1)
    release?.()
    await flushPromises()
  })

  it('retention and scan-interval segmented buttons expose aria-pressed matching data-active', async () => {
    const { wrapper, store } = mountCard()
    store.retentionDays = 30
    await nextTick()
    const retentionBtns = wrapper.findAll('[data-test="retention-seg"] .seg-btn')
    const activeBtn = retentionBtns.find((b) => b.attributes('data-active') === 'true')
    expect(activeBtn!.attributes('aria-pressed')).toBe('true')
    const inactiveBtn = retentionBtns.find((b) => b.attributes('data-active') !== 'true')
    expect(inactiveBtn!.attributes('aria-pressed')).toBe('false')

    const scanBtns = wrapper.findAll('[data-test="scan-seg"] .seg-btn')
    const activeScan = scanBtns.find((b) => b.attributes('data-active') === 'true')
    expect(activeScan!.attributes('aria-pressed')).toBe('true')
  })
})

describe('Styles: segmented control [data-active] variant with built-in hover background (this area has fallen 4 times)', () => {
  it('seg-btn hover winning rule contains both :hover and data-active', () => {
    const style = extractStyleBlock(photosStorageCardRaw)
    expect(style.length).toBeGreaterThan(0)
    const winner = winningHoverBackground(style, ['seg-btn'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-active')
  })
})
