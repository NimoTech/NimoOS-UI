// SP7-P7a-T14: SearchPeoplePopover.vue — tests for search bar "People" filter popover.
// Mounts with i18n (real zh_cn/en_us entries), no Pinia needed (component does not
// touch store). Mocks shared package @nimotech/nimoos-service (PersonAvatar calls
// personFaceThumbnailUrl internally).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    personFaceThumbnailUrl: vi.fn((id: string | number, ver?: string | number | null) => `mock://face/${id}/${ver ?? ''}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import SearchPeoplePopover from '../SearchPeoplePopover.vue'
import searchPeoplePopoverRaw from '../SearchPeoplePopover.vue?raw'
import type { PersonOption } from '../../util/searchUnderstood'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function people(overrides: Partial<PersonOption>[] = []): PersonOption[] {
  const base: PersonOption[] = [
    { id: '1', name: 'Sara', count: 42, coverFaceId: 'face-1' },
    { id: '2', name: 'Tom', count: 7, coverFaceId: '' },
    { id: '3', name: 'Alice', count: 1200, coverFaceId: 'face-3' },
    { id: '4', name: 'Bob', count: 3, coverFaceId: '' },
  ]
  if (overrides.length === 0) return base
  return overrides as PersonOption[]
}

function mountPop(props: { people: PersonOption[]; selected: string[] }, i18n = makeI18n()) {
  return mount(SearchPeoplePopover, { props, global: { plugins: [i18n] } })
}

beforeEach(() => {
  svc.photos.personFaceThumbnailUrl.mockClear()
})

describe('structure inventory', () => {
  it('4 people → 4 .face-cell elements', () => {
    const w = mountPop({ people: people(), selected: [] })
    expect(w.findAll('.face-cell')).toHaveLength(4)
  })

  it('people is empty → empty state text and 0 cells', () => {
    const w = mountPop({ people: [], selected: [] })
    expect(w.findAll('.face-cell')).toHaveLength(0)
    expect(w.get('[data-test="people-empty"]').text()).toBe(zh.photosSearchNoPeopleDetectedYet)
  })
})

describe('avatar three-level fallback (reuses PersonAvatar)', () => {
  it('coverFaceId non-empty → has img, and personFaceThumbnailUrl receives that person id', () => {
    const w = mountPop({ people: people(), selected: [] })
    const cells = w.findAll('.face-cell')
    // Sara (first) has coverFaceId
    expect(cells[0]!.find('[data-test="avatar-img"]').exists()).toBe(true)
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith('1', 'face-1')
  })

  it('coverFaceId empty → no img, show name initial', () => {
    const w = mountPop({ people: people(), selected: [] })
    const cells = w.findAll('.face-cell')
    // Tom (second) has no coverFaceId
    expect(cells[1]!.find('[data-test="avatar-img"]').exists()).toBe(false)
    expect(cells[1]!.find('[data-test="avatar-initial"]').text()).toBe('T')
  })
})

describe('selected state', () => {
  it('selected contains someone → that cell has data-on="true", others false', () => {
    const w = mountPop({ people: people(), selected: ['Tom'] })
    const cells = w.findAll('.face-cell')
    expect(cells[0]!.attributes('data-on')).toBe('false')
    expect(cells[1]!.attributes('data-on')).toBe('true')
  })

  it('clicking cell → update:selected adds/removes (new array, not in-place)', async () => {
    const selected = ['Tom']
    const snapshot = [...selected]
    const w = mountPop({ people: people(), selected })
    const cells = w.findAll('.face-cell')
    await cells[0]!.trigger('click') // click Sara (not selected) → add
    expect(w.emitted('update:selected')).toEqual([[['Tom', 'Sara']]])
    expect(selected).toEqual(snapshot) // original prop array unchanged

    await cells[1]!.trigger('click') // click Tom (already selected) → remove
    expect(w.emitted('update:selected')![1]).toEqual([[]])
  })
})

describe('search filter', () => {
  it('case insensitive', async () => {
    const w = mountPop({ people: people(), selected: [] })
    await w.get('[data-test="people-search"]').setValue('SA')
    expect(w.findAll('.face-cell')).toHaveLength(1)
    expect(w.get('.face-cell-name').text()).toBe('Sara')
  })

  it('filter to 0 → empty state', async () => {
    const w = mountPop({ people: people(), selected: [] })
    await w.get('[data-test="people-search"]').setValue('zzz-nonexistent')
    expect(w.findAll('.face-cell')).toHaveLength(0)
    expect(w.get('[data-test="people-empty"]').text()).toBe(zh.photosSearchNoPeopleDetectedYet)
  })
})

describe('Apply button count text', () => {
  it('selected is empty → no parentheses', () => {
    const w = mountPop({ people: people(), selected: [] })
    const btn = w.get('[data-test="people-apply-btn"]')
    expect(btn.text()).not.toMatch(/\(\d+\)/)
    expect(btn.text()).toBe(zh.photosSearchApply)
  })

  it('2 people → contains (2)', () => {
    const w = mountPop({ people: people(), selected: ['Sara', 'Tom'] })
    const btn = w.get('[data-test="people-apply-btn"]')
    expect(btn.text()).toBe(`${zh.photosSearchApply} (2)`)
  })
})

describe('count thousand separator follows locale', () => {
  // fix round 1 · M3 (review mutation evidence): old pattern `/toLocaleString\(\s*\S+/`
  // has no discrimination power — `)` itself is `\S`, so the regex even matches
  // bare `toLocaleString()` call (changing back from quantified to bare still passes
  // 19 cases; review confirmed via mutation). Changed to pin the actual identifier
  // `toLocaleString(localeTag)` — removing param or changing to bare call turns red.
  it('source text: toLocaleString(localeTag) is a call with identifier arg, not bare', () => {
    expect(searchPeoplePopoverRaw).toMatch(/toLocaleString\(\s*localeTag\s*\)/)
  })

  // fix round 1 · M3 (review mutation evidence): this render assertion itself has
  // no discrimination power for "whether localeTag was really passed" — 'zh-cn' /
  // 'en-us' / bare call (runtime default locale) all produce identical thousand-separator
  // output for 1200 (all comma); changing locale or removing param doesn't change the
  // rendered result for this specific number. Still worth keeping as a basic regression
  // anchor for "render actually has thousand-separator" (not a tautology — dropping
  // separator or changing to bare string concatenation turns red), but **the real pin
  // on "using localeTag variable" is the source text regex above**, not this render
  // assertion; different responsibilities, don't expect this to cover for the above.
  it("Alice's count=1200 renders as string with thousand separator (basic regression anchor, not locale discrimination source)", () => {
    const w = mountPop({ people: people(), selected: [] })
    const cells = w.findAll('.face-cell')
    expect(cells[2]!.get('.face-cell-count').text()).toBe((1200).toLocaleString('zh-cn'))
  })
})

describe('dead code not migrated (negative assertions)', () => {
  it('source text does not contain "?" ternary or photosSearchUnnamed key', () => {
    expect(searchPeoplePopoverRaw).not.toContain("'?'")
    expect(searchPeoplePopoverRaw).not.toContain('photosSearchUnnamed')
  })
})

describe('footer buttons + bubbling', () => {
  it('click Cancel → emit cancel; click Apply → emit apply', async () => {
    const w = mountPop({ people: people(), selected: [] })
    await w.get('[data-test="people-cancel-btn"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
    await w.get('[data-test="people-apply-btn"]').trigger('click')
    expect(w.emitted('apply')).toHaveLength(1)
  })

  it('clicking empty space inside popover does not bubble to host (root @click.stop)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let hostClicked = false
    host.addEventListener('click', () => { hostClicked = true })
    const w = mount(SearchPeoplePopover, {
      props: { people: people(), selected: [] },
      global: { plugins: [makeI18n()] },
      attachTo: host,
    })
    w.get('.fpop').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await w.vm.$nextTick()
    expect(hostClicked).toBe(false)
    w.unmount()
    host.remove()
  })
})

describe('styles', () => {
  it('cssCascade: .btn.btn-primary winning hover rule contains :hover and -primary', () => {
    const style = extractStyleBlock(searchPeoplePopoverRaw)
    const winner = winningHoverBackground(style, ['btn', 'btn-primary'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('-primary')
  })

  it('.face-pop-grid rule contains grid-template-columns: repeat(4, 1fr)', () => {
    const style = extractStyleBlock(searchPeoplePopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.face-pop-grid')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('repeat(4, 1fr)')
  })

  it('.fpop rule width is 300px (not a prop)', () => {
    const style = extractStyleBlock(searchPeoplePopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 300px')
  })

  it('.fpop-foot rule margin-top is 14px (differs from T12/T13\'s 12px, declare actual difference per item)', () => {
    const style = extractStyleBlock(searchPeoplePopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop-foot')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('margin-top: 14px')
  })
})
