// SP7-P7a-T12: PhotosFilterPopover.vue -- list-type filter popover primitive.
// Popover-markup comparison conclusion (PhotosSearchView.vue:124-147 vs
// PhotosFilterBar.vue:25-63, full writeup in the task report; fix round 1 · M9 has already
// corrected the wording -- the earlier "only substantive difference" phrasing was
// inaccurate): there are actually two numeric differences -- (1) the scroll container
// max-height is 280px on the Search side / 260px on the FilterBar side; (2) `.fpop`'s inline
// width is 260 on the Search side / 240 on the FilterBar side, already absorbed by the width
// prop (the brief's interface section already gave both numbers -- neither is a new
// difference discovered by this task). The rest (where the empty-state copy comes from,
// where the label transform comes from, the cancelPop parameter) is already flattened out
// at the New-UI interface level by the emptyHint/labelFor props.
//
// Plan B Task 5 (2026-08-12): the ①-side 260/260 difference was logged back then as "left to
// P7b/T16 to decide whether to open a prop" -- this task wires it up: max-height changes from
// a hardcoded CSS declaration to a maxHeight prop (default 280, unchanged behavior for
// existing consumers like PhotosSearch), copying the "inline style override" approach the
// width prop already has (the width assertion at :56-61 is the precedent for this pattern);
// the FilterBar side explicitly passes 260 to match the Vue2 value.
//
// Acceptance rollback by the owner (2026-08-13): the glassmorphism exception for the EXIF
// chip/popover was overturned, and the component's scoped style has shrunk down to only the
// part that parity genuinely does not cover (see the header comment in
// PhotosFilterPopover.vue). In the "styles" group below, the cssCascade hover-lock
// assertions that used to target .btn/.btn-primary and .fpop-quick have been moved out of
// the component along with their corresponding rules, replaced by a two-step assertion:
// "the component no longer owns this rule" + "the shared parity scss has the correct order
// itself".
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import PhotosFilterPopover from '../PhotosFilterPopover.vue'
import photosFilterPopoverRaw from '../PhotosFilterPopover.vue?raw'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from './cssCascade'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

type Props = {
  title: string
  items: string[]
  selected: string[]
  searchPlaceholder: string
  emptyHint: string
  width?: number
  maxHeight?: number
  multiple?: boolean
  labelFor?: (item: string) => string
}

function mountPop(props: Props) {
  return mount(PhotosFilterPopover, { props, global: { plugins: [i18n] } })
}

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    title: 'File type',
    items: ['Photo', 'Video', 'RAW', 'Screenshot', 'GIF'],
    selected: [],
    searchPlaceholder: 'Search…',
    emptyHint: 'Nothing here yet',
    ...overrides,
  }
}

describe('structure', () => {
  it('renders .fpop / .fpop-title / .fpop-search / the list / two footer buttons', () => {
    const w = mountPop(baseProps())
    expect(w.find('.fpop').exists()).toBe(true)
    expect(w.get('.fpop-title').text()).toBe('File type')
    expect(w.find('.fpop-search').exists()).toBe(true)
    expect(w.findAll('.fpop-item').length).toBe(5)
    expect(w.get('.fpop-foot').findAll('button').length).toBe(2)
  })

  it('width defaults to 260; passing 240 -> inline style is 240px', () => {
    const wDefault = mountPop(baseProps())
    expect(wDefault.get('.fpop').attributes('style')).toContain('width: 260px')
    const w240 = mountPop(baseProps({ width: 240 }))
    expect(w240.get('.fpop').attributes('style')).toContain('width: 240px')
  })

  it('maxHeight defaults to 280 (unchanged existing Search-side behavior); passing 260 -> .fpop-list inline style is 260px (FilterBar side, Plan B Task 5)', () => {
    const wDefault = mountPop(baseProps())
    expect(wDefault.get('.fpop-list').attributes('style')).toContain('max-height: 280px')
    const w260 = mountPop(baseProps({ maxHeight: 260 }))
    expect(w260.get('.fpop-list').attributes('style')).toContain('max-height: 260px')
  })

  it('5 items -> 5 .fpop-item elements; when selected contains the 2nd item -> it has data-active=true and a check icon, the rest are false with no check', () => {
    const w = mountPop(baseProps({ selected: ['Video'] }))
    const rows = w.findAll('.fpop-item')
    expect(rows).toHaveLength(5)
    rows.forEach((row, i) => {
      const isVideo = baseProps().items[i] === 'Video'
      expect(row.attributes('data-active')).toBe(isVideo ? 'true' : 'false')
      expect(row.find('svg').exists()).toBe(isVideo)
    })
    // fix round 1 · I1 (Important from review, mutation-verified: changing check's d from
    // "...L20 7" to "...L20 9" left the previous 15 cases all still green -- the earlier
    // assertion only checked whether an svg existed, without pinning down d/stroke-width).
    // Copied character-for-character from the check branch of Vue2 PhotosIcon.vue, the same
    // pinning approach as the x/chevD icons on the chip side.
    const checkRow = rows[1]!
    expect(checkRow.get('path').attributes('d')).toBe('m5 12 5 5L20 7')
    expect(checkRow.get('svg').attributes('stroke-width')).toBe('2.5')
  })

  it('search filter: typing a filter term -> the list gets shorter; case-insensitive; filtering to 0 items -> empty-state copy appears and the list has 0 items', async () => {
    const w = mountPop(baseProps())
    await w.get('.fpop-search').setValue('vid')
    expect(w.findAll('.fpop-item')).toHaveLength(1)
    expect(w.get('.fpop-item').text()).toBe('Video')

    await w.get('.fpop-search').setValue('VID')
    expect(w.findAll('.fpop-item')).toHaveLength(1)

    await w.get('.fpop-search').setValue('nonexistent-xyz')
    expect(w.findAll('.fpop-item')).toHaveLength(0)
    expect(w.get('.fpop-empty').text()).toBe('Nothing here yet')
  })

  it('labelFor takes effect: passing it => "X" + it -> rendered text contains X', () => {
    const w = mountPop(baseProps({ labelFor: (it) => `X${it}` }))
    expect(w.get('.fpop-item').text()).toContain('XPhoto')
  })
})

describe('multiple: true (default) -- array add/remove, does not mutate the prop in place', () => {
  it('clicking an unselected item -> update:selected carries [...original, it]', async () => {
    const w = mountPop(baseProps({ selected: ['Photo'] }))
    const rows = w.findAll('.fpop-item')
    await rows[1]!.trigger('click') // Video
    expect(w.emitted('update:selected')).toEqual([[['Photo', 'Video']]])
  })

  it('clicking a selected item -> update:selected carries the array with it removed; the original prop array content is not mutated in place', async () => {
    const original = ['Photo', 'Video']
    const originalSnapshot = [...original]
    const w = mountPop(baseProps({ selected: original }))
    const rows = w.findAll('.fpop-item')
    await rows[0]!.trigger('click') // Photo, already selected -> removed
    expect(w.emitted('update:selected')).toEqual([[['Video']]])
    expect(original).toEqual(originalSnapshot) // not mutated in place via push/splice
  })
})

describe('multiple: false -- single-select semantics (ported straight from Vue2 toggleDraftItem: v === it ? null : it)', () => {
  it('clicking an unselected item -> [it]', async () => {
    const w = mountPop(baseProps({ multiple: false, selected: [] }))
    const rows = w.findAll('.fpop-item')
    await rows[2]!.trigger('click') // RAW
    expect(w.emitted('update:selected')).toEqual([[['RAW']]])
  })

  it('clicking a selected item -> []', async () => {
    const w = mountPop(baseProps({ multiple: false, selected: ['RAW'] }))
    const rows = w.findAll('.fpop-item')
    await rows[2]!.trigger('click')
    expect(w.emitted('update:selected')).toEqual([[[]]])
  })
})

describe('footer buttons + bubbling', () => {
  it('clicking Cancel -> emits cancel; clicking Apply -> emits apply', async () => {
    const w = mountPop(baseProps())
    const buttons = w.get('.fpop-foot').findAll('button')
    await buttons[0]!.trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
    await buttons[1]!.trigger('click')
    expect(w.emitted('apply')).toHaveLength(1)
  })

  it('Cancel/Apply button copy comes from the shared keys photosCancel / photosSearchApply (not the hardcoded characters "应用", ruled by B3)', () => {
    const w = mountPop(baseProps())
    const buttons = w.get('.fpop-foot').findAll('button')
    expect(buttons[0]!.text()).toBe(zh.photosCancel)
    expect(buttons[1]!.text()).toBe(zh.photosSearchApply)
  })

  // fix round 1 · M6 (folded in from review): if the previous assertion's implementation
  // were changed to hardcode Chinese "提交"/"取消" directly in the template, both sides would
  // happen to equal the zh key values and it would still be all green -- not enough
  // discriminating power. Switching to the en_us locale and asserting 'Apply'/'Cancel' is what
  // actually catches the difference between "goes through the t() key" and "hardcodes
  // Chinese".
  it('switching to en_us locale -> button copy changes via t() to Cancel / Apply (proves it truly goes through the key, not hardcoded Chinese)', () => {
    const i18nEn = createI18n({ legacy: false, locale: 'en_us', messages: { zh_cn: zh, en_us: en } })
    const w = mount(PhotosFilterPopover, { props: baseProps(), global: { plugins: [i18nEn] } })
    const buttons = w.get('.fpop-foot').findAll('button')
    expect(buttons[0]!.text()).toBe(en.photosCancel)
    expect(buttons[1]!.text()).toBe(en.photosSearchApply)
    expect(buttons[0]!.text()).toBe('Cancel')
    expect(buttons[1]!.text()).toBe('Apply')
  })

  it('clicking blank space inside the popover does not bubble to the host (root @click.stop; dispatching a click with bubbles:true to .fpop)', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let hostClicked = false
    host.addEventListener('click', () => { hostClicked = true })
    const w = mount(PhotosFilterPopover, {
      props: baseProps(),
      global: { plugins: [i18n] },
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
  // 2026-08-13 rollback (owner overturned the EXIF glass exception): .btn/.btn-primary
  // (+:hover) have been removed entirely from this component's scoped style -- the global
  // `.photos-root .btn`/`.photos-root .btn-primary` (+:hover) family in
  // vue2-parity/photos.scss (:262-273) covers app-wide every button mounted under
  // .photos-root, so this component does not need its own copy any more. This asserts in place
  // that this set of color rules is no longer in this component; the hover-lock guarantee is
  // now verified against the shared file itself.
  it('this component scoped style no longer contains .btn/.btn-primary color rules (fully handed off to the global .photos-root .btn family)', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    const selectors = parseCssRules(style).flatMap((r) => r.selectors)
    expect(selectors.some((s) => s === '.btn' || s === '.btn-primary')).toBe(false)
  })

  it('parity scss: .photos-root .btn-primary:hover comes after .photos-root .btn:hover (so on hover the primary buttons accent background wins over the base class hover background, the original Vue2 approach)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const baseHoverIdx = parityScss.indexOf('.photos-root .btn:hover')
    const primaryHoverIdx = parityScss.indexOf('.photos-root .btn-primary:hover')
    expect(baseHoverIdx).toBeGreaterThan(-1)
    expect(primaryHoverIdx).toBeGreaterThan(baseHoverIdx)
  })

  it('cssCascade (the third hard constraint added by B4): the winning hover rule for .fpop-item[data-active="true"] contains :hover and contains data-active', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    const winner = winningHoverBackground(style, ['fpop-item'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-active')
  })

  it('the scroll container (.fpop-list) static rule has overflow-y: auto (max-height has moved to the maxHeight-prop-driven inline style, see the structure test above)', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop-list')
    expect(rule).toBeDefined()
    expect(rule?.body).not.toContain('max-height')
    expect(rule?.body).toContain('overflow-y: auto')
  })

  // 2026-08-13 rollback: .fpop-quick (+:hover) has likewise been handed off entirely to
  // vue2-parity/photos.scss (:2674-2678, a single rule
  // `.fpop-quick:hover, .fpop-quick[data-on="true"] { … }` where both selectors share the same
  // set of values -- neither one overrides the other, so there is no need here to also check
  // source order the way .fchip/.btn do). This asserts in place that the component no longer
  // carries this rule.
  it('this component scoped style no longer contains .fpop-quick color rules (fully handed off to parity)', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    const selectors = parseCssRules(style).flatMap((r) => r.selectors)
    expect(selectors.some((s) => s.startsWith('.fpop-quick'))).toBe(false)
  })

  it('parity scss .fpop-quick:hover, .fpop-quick[data-on="true"] is a single rule sharing one set of values (not two rules that override each other)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find(
      (r) => r.selectors.includes('.fpop-quick:hover') && r.selectors.includes('.fpop-quick[data-on="true"]'),
    )
    expect(rule).toBeDefined()
  })

  // fix round 1 · M7 (folded in from review): add programmatic assertions for non-color
  // visual properties, anchoring the rule body first before asserting on properties.
  // flex:1 is the most worth adding -- lose it and the two footer buttons collapse to
  // content width instead of each taking half.
  it('.fpop-foot .fpop-quick, .fpop-foot .btn rule contains flex: 1 and justify-content: center', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    const rule = parseCssRules(style).find(
      (r) => r.selectors.includes('.fpop-foot .fpop-quick') && r.selectors.includes('.fpop-foot .btn'),
    )
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('flex: 1')
    expect(rule?.body).toContain('justify-content: center')
  })

  it('.fpop-item-icon rule contains width: 16px and justify-content: center', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop-item-icon')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 16px')
    expect(rule?.body).toContain('justify-content: center')
  })

  it('.fpop-empty rule contains padding: 18px 8px', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop-empty')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('padding: 18px 8px')
  })
})
