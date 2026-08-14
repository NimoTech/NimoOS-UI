// SP7-P7a-T15: PhotosSearchGrid.vue — Search results two-tier grid (best matches + collapsed long tail) +
// infinite scroll sentinel. Each test corresponds to task-15-brief.md "required tests" section B
// (except tile-level assertions already moved to SearchResultTile.test.ts). Only mock @nimotech/nimoos-service's
// thumbnailUrl; IntersectionObserver stubbed (afterEach restores, prevents leaking to other test files).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { ScoredPhoto } from '../../util/searchSort'
import { assetToPhoto, type Photo } from '../../util/assetToPhoto'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import PhotosSearchGrid from '../PhotosSearchGrid.vue'
import photosSearchGridRaw from '../PhotosSearchGrid.vue?raw'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function photo(id: string, overrides: Partial<Photo> = {}): Photo {
  return { ...assetToPhoto({ id, mimeType: 'image/jpeg' }), ...overrides }
}

function scored(id: string, score: number | null = 0.9, overrides: Partial<Photo> = {}): ScoredPhoto {
  return { p: photo(id, overrides), score }
}

function mountGrid(
  props: Partial<{
    best: ScoredPhoto[]
    more: ScoredPhoto[]
    moreExpanded: boolean
    showSentinel: boolean
    loadingMore: boolean
  }> = {},
  i18n = makeI18n(),
) {
  return mount(PhotosSearchGrid, {
    props: {
      best: [], more: [], moreExpanded: false, showSentinel: false, loadingMore: false,
      ...props,
    },
    global: { plugins: [i18n] },
  })
}

let ioInstances: Array<{ cb: (e: { isIntersecting: boolean }[]) => void; observeCalls: number; disconnectCalls: number }>

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
  ioInstances = []
  ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    inst: { cb: (e: { isIntersecting: boolean }[]) => void; observeCalls: number; disconnectCalls: number }
    constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
      this.inst = { cb, observeCalls: 0, disconnectCalls: 0 }
      ioInstances.push(this.inst)
    }
    observe() { this.inst.observeCalls++ }
    disconnect() { this.inst.disconnectCalls++ }
  }
})

afterEach(() => {
  delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver
})

describe('best matches grid', () => {
  it('3 best items → 3 .tile under first .grid', () => {
    const w = mountGrid({ best: [scored('1'), scored('2'), scored('3')] })
    const grids = w.findAll('.grid')
    expect(grids).toHaveLength(1)
    expect(grids[0].findAll('.tile')).toHaveLength(3)
  })

  it('more is empty → no .more-results-bar, no second .grid', () => {
    const w = mountGrid({ best: [scored('1')], more: [] })
    expect(w.find('.more-results-bar').exists()).toBe(false)
    expect(w.findAll('.grid')).toHaveLength(1)
  })
})

describe('collapsed long tail (more-results-bar)', () => {
  it('2 more items + moreExpanded:false → collapse bar present, text contains 2, no second .grid, no sentinel', () => {
    const w = mountGrid({ more: [scored('a'), scored('b')], moreExpanded: false })
    expect(w.find('.more-results-bar').exists()).toBe(true)
    expect(w.get('.more-results-bar').text()).toContain('2')
    // First .grid from best is unconditionally rendered (even if best is empty, no tiles inside);
    // only second .grid from more is gated by moreExpanded — when collapsed, exactly 1 .grid.
    expect(w.findAll('.grid')).toHaveLength(1)
    expect(w.findAll('.tile')).toHaveLength(0)
    expect(w.find('.load-more-sentinel').exists()).toBe(false)
  })

  it('best non-empty + more non-empty + collapsed → exactly one .grid (best\'s), second not rendered', () => {
    const w = mountGrid({ best: [scored('x')], more: [scored('a'), scored('b')], moreExpanded: false })
    expect(w.findAll('.grid')).toHaveLength(1)
  })

  it('click collapse bar → emit update:moreExpanded with true', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: false })
    w.get('.more-results-bar').trigger('click')
    expect(w.emitted('update:moreExpanded')?.[0]).toEqual([true])
  })

  it('when moreExpanded:true, click again → emit update:moreExpanded with false', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: true })
    w.get('.more-results-bar').trigger('click')
    expect(w.emitted('update:moreExpanded')?.[0]).toEqual([false])
  })

  it('moreExpanded:true → second .grid has 2 .tile', () => {
    const w = mountGrid({ more: [scored('a'), scored('b')], moreExpanded: true })
    const grids = w.findAll('.grid')
    // First .grid from best always renders (best is empty here, no tiles), expanded more's
    // second .grid appears — 2 .grid containers total, all tiles in second.
    expect(grids).toHaveLength(2)
    expect(grids[1].findAll('.tile')).toHaveLength(2)
  })

  // fix round 1 · I1 (review Important required): collapse bar chevD/chevR only tested for existence,
  // never asserted the `d` attribute string itself — review mutation changed chevD's `d` last `6-6`→`6-5`,
  // 50 examples all passed, proving this guard didn't exist. glyph `d` copied character-by-character from
  // Vue2 PhotosIcon.vue corresponding branch (chevD: `m6 9 6 6 6-6`; chevR: `m9 6 6 6-6 6`), each state tested once.
  it('moreExpanded:false → chevR path d matches PhotosIcon.vue character-by-character', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: false })
    expect(w.get('.more-results-bar svg path').attributes('d')).toBe('m9 6 6 6-6 6')
  })
  it('moreExpanded:true → chevD path d matches PhotosIcon.vue character-by-character', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: true })
    expect(w.get('.more-results-bar svg path').attributes('d')).toBe('m6 9 6 6 6-6')
  })
})

describe('sentinel (v-if gated, unmounting disconnects observer)', () => {
  it('showSentinel:true + expanded → sentinel present', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: true, showSentinel: true })
    expect(w.find('.load-more-sentinel').exists()).toBe(true)
  })
  it('showSentinel:false → sentinel not present', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: true, showSentinel: false })
    expect(w.find('.load-more-sentinel').exists()).toBe(false)
  })
  it('loadingMore:true → .load-more-status present, text correct', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: true, showSentinel: true, loadingMore: true })
    expect(w.get('.load-more-status').text()).toBe('正在加载更多…')
  })
  it('loadingMore:false → .load-more-status not present', () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: true, showSentinel: true, loadingMore: false })
    expect(w.find('.load-more-status').exists()).toBe(false)
  })
})

describe('sentinel trigger → load-more (useInfiniteScroll wiring, onHit directly emits, no extra throttle)', () => {
  it('IO callback isIntersecting:true → emit load-more', async () => {
    const w = mountGrid({ more: [scored('a')], moreExpanded: true, showSentinel: true })
    await w.vm.$nextTick()
    expect(ioInstances).toHaveLength(1)
    ioInstances[0].cb([{ isIntersecting: true }])
    expect(w.emitted('load-more')).toHaveLength(1)
  })
})

describe('open photo: tile open event pass-through', () => {
  it('click tile in best grid → emit open with corresponding photo', () => {
    const r = scored('55')
    const w = mountGrid({ best: [r] })
    w.get('.tile').trigger('click')
    expect(w.emitted('open')?.[0]).toEqual([r.p])
  })

  // Best grid and more grid are two independent @open bindings (two SearchResultTile v-for),
  // testing only best won't catch if more missed binding/wired wrong — both need separate tests.
  it('click tile in more grid (expanded) → emit open with corresponding photo', () => {
    const r = scored('66')
    const w = mountGrid({ more: [r], moreExpanded: true })
    w.get('.tile').trigger('click')
    expect(w.emitted('open')?.[0]).toEqual([r.p])
  })
})

describe('thumbnailUrl size specification', () => {
  it("size parameter passed to thumbnailUrl is 'small' (plan explicitly specifies)", () => {
    mountGrid({ best: [scored('9')] })
    expect(thumbnailUrl).toHaveBeenCalledWith('9', 'small')
  })
})

// ── two-leg audit: scroll container + more-results-bar hover + dead CSS not migrated ──────────────
describe('styles', () => {
  const styleText = extractStyleBlock(photosSearchGridRaw)

  it('style text non-empty (guard against silent no-op)', () => {
    expect(styleText.trim().length).toBeGreaterThan(0)
  })

  it('.photos-wrap rule body contains overflow-y: auto / position: relative (locate rule body first, then assert properties)', () => {
    const m = /\.photos-wrap\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '.photos-wrap rule body not found').toBeTruthy()
    expect(m![1]).toMatch(/overflow-y:\s*auto/)
    // fix round 1 · M-1 (review merged): D7 source missed photos.scss:300's position:relative,
    // added and pinned to prevent silent loss again.
    expect(m![1]).toMatch(/position:\s*relative/)
  })

  it('.photos-wrap::-webkit-scrollbar rule body contains display: none (M-1, hide scrollbar, aligned with repo convention, not Vue2 literal width:0)', () => {
    const m = /\.photos-wrap::-webkit-scrollbar\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '.photos-wrap::-webkit-scrollbar rule body not found').toBeTruthy()
    expect(m![1]).toMatch(/display:\s*none/)
  })

  it('.grid rule body follows PhotosGrid.vue default (comfortable) column-width strategy — D2 deviation registry: not Vue2 fixed 7 columns', () => {
    const m = /(?<!\[data-density[^{]*)\.grid\s*\{([^}]*)\}/.exec(styleText)
    expect(m, '.grid rule body not found').toBeTruthy()
    expect(m![1]).toMatch(/grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(140px,\s*1fr\)\)/)
    expect(m![1]).toMatch(/gap:\s*4px/)
  })

  it('.more-results-bar winning background on hover is --chip-bg-hi (cssCascade judges specificity, selector contains :hover)', () => {
    const win = winningHoverBackground(styleText, ['more-results-bar'])
    expect(win.selector).toContain(':hover')
    expect(win.value).toContain('--chip-bg-hi')
  })

  it('.match-badge not in style block (dead CSS, scss:2728-2738 not migrated, inverse assertion)', () => {
    expect(styleText).not.toMatch(/\.match-badge/)
  })
})
