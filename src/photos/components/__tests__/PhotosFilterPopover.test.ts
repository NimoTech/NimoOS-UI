// SP7-P7a-T12: PhotosFilterPopover.vue — list-type filter popover primitive.
// Popover markup byte-by-byte comparison (PhotosSearchView.vue:124-147 vs
// PhotosFilterBar.vue:25-63, full details in task report; fix round 1 · M9
// corrected wording, prior "sole material difference" was inaccurate): two real
// differences — (1) scroll container max-height search-side 280px / FilterBar-side
// 260px, use search-side 280 as ref (this test asserts 280); 260 diff registered to
// P7b/T16; (2) `.fpop` inline width search-side 260 / FilterBar-side 240, absorbed
// by width prop (brief interface already provided these two, not new diff found by
// task). Remaining (empty text source, label transform source, cancelPop param)
// — New-UI interface unified via emptyHint/labelFor prop.
import { describe, it, expect } from 'vitest'
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
  it('renders .fpop / .fpop-title / .fpop-search / list / two footer buttons', () => {
    const w = mountPop(baseProps())
    expect(w.find('.fpop').exists()).toBe(true)
    expect(w.get('.fpop-title').text()).toBe('File type')
    expect(w.find('.fpop-search').exists()).toBe(true)
    expect(w.findAll('.nav-item').length).toBe(5)
    expect(w.get('.fpop-foot').findAll('button').length).toBe(2)
  })

  it('width defaults to 260; pass 240 → inline style is 240px', () => {
    const wDefault = mountPop(baseProps())
    expect(wDefault.get('.fpop').attributes('style')).toContain('width: 260px')
    const w240 = mountPop(baseProps({ width: 240 }))
    expect(w240.get('.fpop').attributes('style')).toContain('width: 240px')
  })

  it('items 5 → 5 .nav-item; selected contains 2nd → it has data-active=true and check icon, others false and no check', () => {
    const w = mountPop(baseProps({ selected: ['Video'] }))
    const rows = w.findAll('.nav-item')
    expect(rows).toHaveLength(5)
    rows.forEach((row, i) => {
      const isVideo = baseProps().items[i] === 'Video'
      expect(row.attributes('data-active')).toBe(isVideo ? 'true' : 'false')
      expect(row.find('svg').exists()).toBe(isVideo)
    })
    // fix round 1 · I1 (review Important, mutation evidence: changing check's d from
    // "...L20 7" to "...L20 9" still passes all 15 prior cases — only asserted svg
    // existence, didn't pin d/stroke-width). Copied verbatim from Vue2 PhotosIcon.vue
    // check branch, same pinning method as chip side x/chevD.
    const checkRow = rows[1]!
    expect(checkRow.get('path').attributes('d')).toBe('m5 12 5 5L20 7')
    expect(checkRow.get('svg').attributes('stroke-width')).toBe('2.5')
  })

  it('search filter: input filter term → list shrinks; case insensitive; filter to 0 → empty text appears and list is 0', async () => {
    const w = mountPop(baseProps())
    await w.get('.fpop-search').setValue('vid')
    expect(w.findAll('.nav-item')).toHaveLength(1)
    expect(w.get('.nav-item').text()).toBe('Video')

    await w.get('.fpop-search').setValue('VID')
    expect(w.findAll('.nav-item')).toHaveLength(1)

    await w.get('.fpop-search').setValue('nonexistent-xyz')
    expect(w.findAll('.nav-item')).toHaveLength(0)
    expect(w.get('.fpop-empty').text()).toBe('Nothing here yet')
  })

  it('labelFor works: pass it => "X" + it → rendered text contains X', () => {
    const w = mountPop(baseProps({ labelFor: (it) => `X${it}` }))
    expect(w.get('.nav-item').text()).toContain('XPhoto')
  })
})

describe('multiple: true (default) — array add/remove, do not mutate prop in-place', () => {
  it('click unselected item → update:selected with [...original, it]', async () => {
    const w = mountPop(baseProps({ selected: ['Photo'] }))
    const rows = w.findAll('.nav-item')
    await rows[1]!.trigger('click') // Video
    expect(w.emitted('update:selected')).toEqual([[['Photo', 'Video']]])
  })

  it('click selected item → update:selected with array after removal; original prop array not mutated in-place', async () => {
    const original = ['Photo', 'Video']
    const originalSnapshot = [...original]
    const w = mountPop(baseProps({ selected: original }))
    const rows = w.findAll('.nav-item')
    await rows[0]!.trigger('click') // Photo, already selected → remove
    expect(w.emitted('update:selected')).toEqual([[['Video']]])
    expect(original).toEqual(originalSnapshot) // not mutated via push/splice
  })
})

describe('multiple: false — single-select semantics (copy Vue2 toggleDraftItem v === it ? null : it)', () => {
  it('click unselected item → [it]', async () => {
    const w = mountPop(baseProps({ multiple: false, selected: [] }))
    const rows = w.findAll('.nav-item')
    await rows[2]!.trigger('click') // RAW
    expect(w.emitted('update:selected')).toEqual([[['RAW']]])
  })

  it('click selected item → []', async () => {
    const w = mountPop(baseProps({ multiple: false, selected: ['RAW'] }))
    const rows = w.findAll('.nav-item')
    await rows[2]!.trigger('click')
    expect(w.emitted('update:selected')).toEqual([[[]]])
  })
})

describe('footer buttons + bubbling', () => {
  it('click Cancel → emit cancel; click Apply → emit apply', async () => {
    const w = mountPop(baseProps())
    const buttons = w.get('.fpop-foot').findAll('button')
    await buttons[0]!.trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
    await buttons[1]!.trigger('click')
    expect(w.emitted('apply')).toHaveLength(1)
  })

  it('cancel/apply button text from common keys photosCancel / photosSearchApply (not hardcoded, B3 ruling)', () => {
    const w = mountPop(baseProps())
    const buttons = w.get('.fpop-foot').findAll('button')
    expect(buttons[0]!.text()).toBe(zh.photosCancel)
    expect(buttons[1]!.text()).toBe(zh.photosSearchApply)
  })

  // fix round 1 · M6 (review merged): if prior assertion's implementation changed to
  // hardcode Chinese text in template, both sides happen to equal zh key value,
  // still all green — no discrimination. Switch to en_us locale and assert 'Apply'/
  // 'Cancel' to really catch difference between "use t() key" vs "hardcoded text".
  it('switch to en_us locale → button text via t() becomes Cancel / Apply (proves really uses key, not hardcoded)', () => {
    const i18nEn = createI18n({ legacy: false, locale: 'en_us', messages: { zh_cn: zh, en_us: en } })
    const w = mount(PhotosFilterPopover, { props: baseProps(), global: { plugins: [i18nEn] } })
    const buttons = w.get('.fpop-foot').findAll('button')
    expect(buttons[0]!.text()).toBe(en.photosCancel)
    expect(buttons[1]!.text()).toBe(en.photosSearchApply)
    expect(buttons[0]!.text()).toBe('Cancel')
    expect(buttons[1]!.text()).toBe('Apply')
  })

  it('clicking empty space inside popover does not bubble to host (root @click.stop; dispatch bubbles:true click to .fpop)', async () => {
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
  it('cssCascade: .btn.btn-primary winning hover rule contains :hover and -primary', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    expect(style.length).toBeGreaterThan(0)
    const winner = winningHoverBackground(style, ['btn', 'btn-primary'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('-primary')
  })

  it('cssCascade (third hard constraint added by B4): .nav-item[data-active="true"] winning hover rule contains :hover and data-active', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    const winner = winningHoverBackground(style, ['nav-item'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-active')
  })

  it('scroll container (.fpop-list) has max-height: 280px and overflow-y: auto (anchor rule body first, no file-level toContain)', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.fpop-list')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('max-height: 280px')
    expect(rule?.body).toContain('overflow-y: auto')
  })

  // fix round 1 · M2 (review merged): brief structure spec 3 explicitly required
  // assertion for .fpop-quick base class hover, currently no [data-on] variant so
  // no risk, but this baseline assertion is the guard when T13 adds variant — first
  // pin "only hover rule that currently exists is the base class itself".
  it('cssCascade: .fpop-quick base class winning hover rule is itself (no variant now, guard when T13 adds [data-on])', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    const winner = winningHoverBackground(style, ['fpop-quick'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('fpop-quick')
  })

  // fix round 1 · M7 (review merged): add programmatic assertions for non-color
  // visual properties, anchor rule body first then assert. flex:1 most worth adding
  // — dropping it makes footer buttons collapse to content width, no longer half each.
  it('.fpop-foot .fpop-quick, .fpop-foot .btn rule contains flex: 1 and justify-content: center', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    const rule = parseCssRules(style).find(
      (r) => r.selectors.includes('.fpop-foot .fpop-quick') && r.selectors.includes('.fpop-foot .btn'),
    )
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('flex: 1')
    expect(rule?.body).toContain('justify-content: center')
  })

  it('.nav-icon rule contains width: 16px and justify-content: center', () => {
    const style = extractStyleBlock(photosFilterPopoverRaw)
    const rule = parseCssRules(style).find((r) => r.selectors.length === 1 && r.selectors[0] === '.nav-icon')
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
