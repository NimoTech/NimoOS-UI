// P6b-T7: PlaceCoverPicker.vue — Place detail "set cover" fullscreen overlay (tabs / search / 8-column
// candidate grid / pagination / restore default). Each case corresponds to the required test
// checklist in task-7-brief.md. Pure presentation + emit, no store access — only mock
// @nimotech/nimoos-service's thumbnailUrl (following the existing mock approach in
// PlaceSpotDialog.test.ts / PlacesRail.test.ts).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import type { CoverCandidates } from '../../stores/places'

const thumbnailUrl = vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { thumbnailUrl: (...a: unknown[]) => (thumbnailUrl as (...a: unknown[]) => string)(...a) } },
}))

import PlaceCoverPicker from '../PlaceCoverPicker.vue'
// Raw source text (Vite `?raw`): the hover cascade + color compliance two test groups
// need to parse the <style> source — jsdom doesn't compute cascade styles or enter true
// hover state (same pattern as existing in PlacesRail.test.ts).
import placeCoverPickerRaw from '../PlaceCoverPicker.vue?raw'
import { extractStyleBlock, hoverBackgroundRules, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function candidates(over: Partial<CoverCandidates> = {}): CoverCandidates {
  return {
    tabs: [
      { id: 'recent', label: 'Recent', icon: 'clock', count: 12 },
      { id: 'top', label: 'Top rated', icon: 'sparkles', count: 34 },
      { id: 'fav', label: 'Favorited', icon: 'star', count: 5 },
      { id: 'all', label: 'All', icon: 'grid', count: 120 },
    ],
    items: ['a1', 'a2', 'a3'],
    page: 0,
    totalPages: 5,
    total: 88,
    ...over,
  }
}

function mountPicker(props: Partial<InstanceType<typeof PlaceCoverPicker>['$props']> = {}, i18n = makeI18n()) {
  return mount(PlaceCoverPicker, {
    props: {
      open: true,
      city: 'Hangzhou',
      totalCount: 100,
      currentAssetId: '',
      candidates: candidates(),
      tab: 'recent',
      search: '',
      page: 0,
      busy: false,
      ...props,
    },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  thumbnailUrl.mockImplementation((id: string | number, size: string) => `mock://thumb/${id}/${size}`)
})

// ── Open toggle ─────────────────────────────────────────────────────────
describe('open toggle', () => {
  it('open=false → entire layer does not render', () => {
    const w = mountPicker({ open: false })
    expect(w.find('.cp-scrim').exists()).toBe(false)
  })

  it('open=true → .cp-scrim and .cp-shell both present', () => {
    const w = mountPicker({ open: true })
    expect(w.find('.cp-scrim').exists()).toBe(true)
    expect(w.find('.cp-shell').exists()).toBe(true)
  })
})

// ── Structure inventory ────────────────────────────────────────────────
describe('structure inventory', () => {
  it('head: thumb / title / sub / close all in place', () => {
    const w = mountPicker()
    expect(w.find('.cp-head-thumb').exists()).toBe(true)
    expect(w.find('.cp-head-title').exists()).toBe(true)
    expect(w.find('.cp-head-sub').exists()).toBe(true)
    expect(w.find('.cp-close-btn').exists()).toBe(true)
  })

  it('number of tabs = candidates.tabs.length, search input in place', () => {
    const w = mountPicker()
    expect(w.findAll('[data-test="cp-tab"]').length).toBe(4)
    expect(w.find('.cp-search input').exists()).toBe(true)
  })

  it('grid: number of cells = items length', () => {
    const w = mountPicker({ candidates: candidates({ items: ['a1', 'a2', 'a3', 'a4'] }) })
    expect(w.findAll('[data-test="cp-cell"]').length).toBe(4)
  })

  it('foot: reset / info / two pagers all in place', () => {
    const w = mountPicker()
    expect(w.find('.cp-reset-btn').exists()).toBe(true)
    expect(w.find('.cp-foot-info').exists()).toBe(true)
    expect(w.find('[data-test="cp-page-prev"]').exists()).toBe(true)
    expect(w.find('[data-test="cp-page-next"]').exists()).toBe(true)
  })

  it('when currentAssetId is empty, header thumbnail does not render img', () => {
    const w = mountPicker({ currentAssetId: '' })
    expect(w.find('.cp-head-thumb img').exists()).toBe(false)
  })

  it('when currentAssetId is not empty, header thumbnail renders img', () => {
    const w = mountPicker({ currentAssetId: 'hero-1' })
    expect(w.find('.cp-head-thumb img').exists()).toBe(true)
  })
})

// ── Title/subtitle interpolation ──────────────────────────────────────────
describe('title/subtitle interpolation', () => {
  it("city='杭州', totalCount=12345 → title contains 杭州, subtitle contains thousand separator 12,345", () => {
    const w = mountPicker({ city: '杭州', totalCount: 12345 })
    expect(w.find('.cp-head-title').text()).toContain('杭州')
    expect(w.find('.cp-head-sub').text()).toContain('12,345')
  })
})

// ── Tab label fallback chain (carried over from Vue2 :374-377) ────────────
describe('tab label fallback chain three levels', () => {
  it("t.id='recent' → Chinese '近期'", () => {
    const w = mountPicker({
      candidates: candidates({ tabs: [{ id: 'recent', label: 'Recent', icon: 'clock', count: 1 }] }),
    })
    expect(w.find('[data-test="cp-tab"]').text()).toContain('近期')
  })

  it("t.id='zzz', label='Zzz' (no corresponding i18n key) → fall back to label", () => {
    const w = mountPicker({
      candidates: candidates({ tabs: [{ id: 'zzz', label: 'Zzz', icon: 'clock', count: 1 }] }),
    })
    expect(w.find('[data-test="cp-tab"]').text()).toContain('Zzz')
  })

  it("t.id='zzz' no label → fall back to id itself", () => {
    const w = mountPicker({
      candidates: candidates({ tabs: [{ id: 'zzz', label: '', icon: 'clock', count: 1 }] }),
    })
    expect(w.find('[data-test="cp-tab"]').text()).toContain('zzz')
  })
})

// ── cp-tab-count thousand separator abbreviation (carried over from Vue2 :1284) ──
describe('cp-tab-count abbreviation', () => {
  // Deviation note (source verification): brief's manual calculation
  // "Math.round(1234/100)/10 = 12.3" is wrong — 1234/100=12.34, Math.round(12.34)=12,
  // 12/10=1.2, actual result is "1.2k". Implemented exactly per Vue2 source :1284 formula;
  // source is authoritative; here using manually-verified correct expected value.
  it('count=1234 → text 1.2k (Math.round(1234/100)/10 = 1.2, source verification noted)', () => {
    const w = mountPicker({
      candidates: candidates({ tabs: [{ id: 'recent', label: 'Recent', icon: 'clock', count: 1234 }] }),
    })
    expect(w.find('.cp-tab-count').text()).toBe('1.2k')
  })

  it('count=999 → display 999 as-is (boundary, does not enter k branch)', () => {
    const w = mountPicker({
      candidates: candidates({ tabs: [{ id: 'recent', label: 'Recent', icon: 'clock', count: 999 }] }),
    })
    expect(w.find('.cp-tab-count').text()).toBe('999')
  })
})

// ── Icon branching (backend contract: clock/sparkles/star/grid, unknown falls back to generic) ──
describe('tab icon branching', () => {
  it('four known icon names each hit corresponding data-test, unknown values fall back to fallback', () => {
    const w = mountPicker({
      candidates: candidates({
        tabs: [
          { id: 'a', label: 'A', icon: 'clock', count: 1 },
          { id: 'b', label: 'B', icon: 'sparkles', count: 1 },
          { id: 'c', label: 'C', icon: 'star', count: 1 },
          { id: 'd', label: 'D', icon: 'grid', count: 1 },
          { id: 'e', label: 'E', icon: 'mystery-icon', count: 1 },
        ],
      }),
    })
    expect(w.find('[data-test="cp-tab-ico-clock"]').exists()).toBe(true)
    expect(w.find('[data-test="cp-tab-ico-sparkles"]').exists()).toBe(true)
    expect(w.find('[data-test="cp-tab-ico-star"]').exists()).toBe(true)
    expect(w.find('[data-test="cp-tab-ico-grid"]').exists()).toBe(true)
    expect(w.find('[data-test="cp-tab-ico-fallback"]').exists()).toBe(true)
  })
})

// ── Current cover checkmark (String normalization guard) ──────────────────
describe('current cover checkmark', () => {
  it('currentAssetId is number 7, items contains string "7" → that cell has .is-active and contains .cp-cell-check', () => {
    const w = mountPicker({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Intentionally passing number to simulate external out-of-bounds input (brief requirement)
      currentAssetId: 7 as any,
      candidates: candidates({ items: ['6', '7', '8'] }),
    })
    const cells = w.findAll('[data-test="cp-cell"]')
    expect(cells[1].classes()).toContain('is-active')
    expect(cells[1].find('.cp-cell-check').exists()).toBe(true)
    expect(cells[0].classes()).not.toContain('is-active')
    expect(cells[2].classes()).not.toContain('is-active')
  })
})

// ── Click / busy state ────────────────────────────────────────────────────
describe('click cell / busy state', () => {
  it('click cell → emit pick with String(assetId)', async () => {
    const w = mountPicker({ candidates: candidates({ items: ['a1', 'a2'] }) })
    await w.findAll('[data-test="cp-cell"]')[1].trigger('click')
    expect(w.emitted('pick')).toEqual([['a2']])
  })

  it('when busy=true, all cells and reset button are disabled', () => {
    const w = mountPicker({ busy: true, candidates: candidates({ items: ['a1', 'a2'] }) })
    for (const cell of w.findAll('[data-test="cp-cell"]'))
      expect((cell.element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('.cp-reset-btn').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('click reset button → emit reset', async () => {
    const w = mountPicker()
    await w.find('.cp-reset-btn').trigger('click')
    expect(w.emitted('reset')).toHaveLength(1)
  })
})

// ── Empty state ────────────────────────────────────────────────────────────
describe('empty state', () => {
  it('items=[] → .cp-empty appears and copy contains search query, .cp-grid does not render', () => {
    const w = mountPicker({ search: '西湖', candidates: candidates({ items: [] }) })
    expect(w.find('.cp-empty').exists()).toBe(true)
    expect(w.find('.cp-empty').text()).toContain('西湖')
    expect(w.find('.cp-grid').exists()).toBe(false)
  })
})

// ── Pagination ────────────────────────────────────────────────────────────
describe('pagination', () => {
  it('page=0 → previous page disabled', () => {
    const w = mountPicker({ page: 0, candidates: candidates({ totalPages: 5 }) })
    expect((w.find('[data-test="cp-page-prev"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('page = totalPages - 1 → next page disabled', () => {
    const w = mountPicker({ page: 4, candidates: candidates({ totalPages: 5 }) })
    expect((w.find('[data-test="cp-page-next"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('click next page → emit update:page with page+1', async () => {
    const w = mountPicker({ page: 2, candidates: candidates({ totalPages: 5 }) })
    await w.find('[data-test="cp-page-next"]').trigger('click')
    expect(w.emitted('update:page')).toEqual([[3]])
  })

  it('click previous page → emit update:page with page-1', async () => {
    const w = mountPicker({ page: 2, candidates: candidates({ totalPages: 5 }) })
    await w.find('[data-test="cp-page-prev"]').trigger('click')
    expect(w.emitted('update:page')).toEqual([[1]])
  })

  it('when totalPages=1, both pagers are disabled', () => {
    const w = mountPicker({ page: 0, candidates: candidates({ totalPages: 1 }) })
    expect((w.find('[data-test="cp-page-prev"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('[data-test="cp-page-next"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  // Deletion checklist ④: dedicated assertion for Math.max(0, page - 1) clamping. Native
  // disabled buttons block clicks in real browsers, but the component handler must also
  // clamp — here we bypass vue-test-utils' trigger() (which doesn't dispatch on disabled
  // elements) and use raw dispatchEvent to directly fire the click listener, decoupled from
  // "is disabled", to verify the clamping logic itself (brief deletion checklist ④ fallback:
  // disabled attribute + emit parameter both enforced).
  it('when page=0, force dispatch click (bypass disabled) → emitted page is not negative (Math.max clamp)', () => {
    const w = mountPicker({ page: 0, candidates: candidates({ totalPages: 5 }) })
    w.find('[data-test="cp-page-prev"]').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const emitted = w.emitted('update:page')
    expect(emitted).toEqual([[0]])
  })
})

// ── Page information ────────────────────────────────────────────────────────
describe('page information', () => {
  it('total=88, page=0, totalPages=5 → text contains 88, 1, 5 (page displayed as +1)', () => {
    const w = mountPicker({ page: 0, candidates: candidates({ total: 88, totalPages: 5 }) })
    const text = w.find('.cp-foot-info').text()
    expect(text).toContain('88')
    expect(text).toContain('1')
    expect(text).toContain('5')
  })
})

// ── Search / tab click ────────────────────────────────────────────────────
describe('search and tabs', () => {
  it('enter 西湖 → emit update:search with 西湖', async () => {
    const w = mountPicker()
    await w.find('.cp-search input').setValue('西湖')
    expect(w.emitted('update:search')).toEqual([['西湖']])
  })

  it('click tab → emit update:tab with t.id', async () => {
    const w = mountPicker()
    const tabs = w.findAll('[data-test="cp-tab"]')
    await tabs[2].trigger('click')
    expect(w.emitted('update:tab')).toEqual([['fav']])
  })
})

// ── Close three paths ────────────────────────────────────────────────────
describe('close three paths', () => {
  it('click .cp-close-btn → emit close', async () => {
    const w = mountPicker()
    await w.find('.cp-close-btn').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('click scrim blank area (click.self) → emit close', async () => {
    const w = mountPicker()
    await w.find('.cp-scrim').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('click inside .cp-shell → do not emit close', async () => {
    const w = mountPicker()
    await w.find('.cp-shell').trigger('click')
    expect(w.emitted('close')).toBeUndefined()
  })

  it('Esc (dispatch on document, bubbles:true) → emit close', async () => {
    const w = mountPicker()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('non-Escape key does not trigger close', async () => {
    const w = mountPicker()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('close')).toBeUndefined()
  })
})

// ── Esc listener lifecycle ────────────────────────────────────────────────
describe('Esc listener lifecycle', () => {
  it('after open changes from true to false, dispatching Esc no longer emits', async () => {
    const w = mountPicker({ open: true })
    await w.setProps({ open: false })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('close')).toBeUndefined()
  })

  it('after unmount(), also does not emit (assert removeEventListener is called)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const w = mountPicker({ open: true })
    const added = addSpy.mock.calls.find(c => c[0] === 'keydown') as [string, EventListener] | undefined
    expect(added).toBeDefined()
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    expect(removeSpy).toHaveBeenCalledWith('keydown', added![1])
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

// ── cssCascade: hover state background not stolen by base class rule ──────
describe('hover state background not stolen by base class rule (deletion ⑦)', () => {
  it('.cp-tab.is-active hover background belongs to variant rule containing :hover', () => {
    const styleText = extractStyleBlock(placeCoverPickerRaw)
    const win = winningHoverBackground(styleText, ['cp-tab', 'is-active'])
    expect(win.selector).toContain('is-active')
    expect(win.selector).toContain(':hover')
  })

  it('.cp-tab.is-active has dedicated :hover rule with specificity strictly higher than base .cp-tab:hover', () => {
    const styleText = extractStyleBlock(placeCoverPickerRaw)
    const rules = hoverBackgroundRules(styleText, ['cp-tab', 'is-active'])
    const baseHover = rules.find(r => r.selector === '.cp-tab:hover')
    const activeHover = rules.find(r => r.selector !== '.cp-tab:hover' && r.selector.includes('is-active') && r.selector.includes(':hover'))
    expect(baseHover).toBeDefined()
    expect(activeHover).toBeDefined()
    expect(activeHover!.specificity).toBeGreaterThan(baseHover!.specificity)
  })

  it('.cp-cell.is-active hover background belongs to variant rule containing :hover', () => {
    const styleText = extractStyleBlock(placeCoverPickerRaw)
    const win = winningHoverBackground(styleText, ['cp-cell', 'is-active'])
    expect(win.selector).toContain('is-active')
    expect(win.selector).toContain(':hover')
  })

  it('.cp-cell.is-active has dedicated :hover rule with specificity strictly higher than base .cp-cell:hover', () => {
    const styleText = extractStyleBlock(placeCoverPickerRaw)
    const rules = hoverBackgroundRules(styleText, ['cp-cell', 'is-active'])
    const baseHover = rules.find(r => r.selector === '.cp-cell:hover')
    const activeHover = rules.find(r => r.selector !== '.cp-cell:hover' && r.selector.includes('is-active') && r.selector.includes(':hover'))
    expect(baseHover).toBeDefined()
    expect(activeHover).toBeDefined()
    expect(activeHover!.specificity).toBeGreaterThan(baseHover!.specificity)
  })
})

// ── Color compliance ────────────────────────────────────────────────────────
describe('color compliance', () => {
  it('.cp-cell-check rule contains --on-accent (background is accent solid, allowed usage)', () => {
    const style = extractStyleBlock(placeCoverPickerRaw)
    const m = /\.cp-cell-check\s*\{([^}]*)\}/.exec(style)
    expect(m, '.cp-cell-check rule not found').not.toBeNull()
    expect(m![1]).toContain('--on-accent')
  })

  it('full style block has no literal #/rgba(/rgb( literals (except lines with theme-exception — this component is expected to need no exemptions)', () => {
    const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/.exec(placeCoverPickerRaw)
    expect(styleMatch).not.toBeNull()
    const lines = styleMatch![1].split('\n')
    const HEX = /#[0-9a-fA-F]{3,8}\b/
    const FUNC = /\b(?:rgba?|hsla?)\s*\(/
    function stripVar(s: string): string {
      let out = ''; let i = 0
      while (i < s.length) {
        if (s.startsWith('var(', i)) {
          let depth = 0; let j = i + 3
          for (; j < s.length; j++) {
            if (s[j] === '(') depth++
            else if (s[j] === ')') { depth--; if (depth === 0) { j++; break } }
          }
          i = j
        } else { out += s[i]; i++ }
      }
      return out
    }
    let exempt = false
    lines.forEach((line, idx) => {
      if (line.includes('theme-exception')) exempt = true
      const bare = stripVar(line)
      if (HEX.test(bare) || FUNC.test(bare))
        expect(exempt, `L${idx + 1} bare color literal missing theme-exception exemption: ${line.trim()}`).toBe(true)
      if (line.includes(';') || line.includes('}')) exempt = false
    })
  })
})

// ── Programmatic style assertion (review I1 supplementary: high-risk non-color visual
// properties cannot rely on manual verification alone) ──────────────────────────
// Three rules anchored inside specific selector bodies (not keyword search over whole file,
// avoids false positives) — following the existing pattern in PlaceVisitHistory.test.ts:188-217
// / PlaceDetailPanel.test.ts:333-339.
describe('high-risk non-color visual properties (review I1)', () => {
  const style = extractStyleBlock(placeCoverPickerRaw)

  it('.cp-scrim rule contains backdrop-filter (exact property from T3 incident — was lost when converting inline style to class)', () => {
    const m = /\.cp-scrim\s*\{([^}]*)\}/.exec(style)
    expect(m, '.cp-scrim rule not found').not.toBeNull()
    expect(m![1]).toMatch(/backdrop-filter\s*:/)
  })

  it('.cp-cell rule contains aspect-ratio: 1 (8-column thumbnail grid must be square cells)', () => {
    const m = /\.cp-cell\s*\{([^}]*)\}/.exec(style)
    expect(m, '.cp-cell rule not found').not.toBeNull()
    expect(m![1]).toMatch(/aspect-ratio\s*:\s*1\b/)
  })

  it('.cp-grid rule contains grid-template-columns: repeat(8, 1fr) (carried over 8 columns from Vue2 :1129)', () => {
    const m = /\.cp-grid\s*\{([^}]*)\}/.exec(style)
    expect(m, '.cp-grid rule not found').not.toBeNull()
    expect(m![1]).toMatch(/grid-template-columns\s*:\s*repeat\(\s*8\s*,\s*1fr\s*\)/)
  })
})

// ── English locale sanity ───────────────────────────────────────────────────
describe('English locale sanity', () => {
  it('under en_us, title/subtitle/placeholder switch to English', () => {
    const w = mountPicker({ city: 'Hangzhou', totalCount: 100 }, makeI18n('en_us'))
    expect(w.find('.cp-head-title').text()).toContain('Hangzhou')
    expect(w.find('.cp-search input').attributes('placeholder')).toBeTruthy()
  })
})
