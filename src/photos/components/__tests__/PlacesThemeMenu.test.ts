// Task 10(SP7-P6a Places · Map main view): PlacesThemeMenu.vue — Map toolbar "map theme" chip button +
// dropdown popover (4 presets + 2 custom color pickers). Each test corresponds to task-10-brief.md's "required tests" list.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'
import PlacesThemeMenu, { type MapThemeSelection } from '../PlacesThemeMenu.vue'
import placesThemeMenuRaw from '../PlacesThemeMenu.vue?raw'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function defaultSelection(overrides: Partial<MapThemeSelection> = {}): MapThemeSelection {
  return { mapTheme: 'default', customDotColor: '#6E5BFF', customGridColor: '#9C8EFF', ...overrides }
}

const mounted: VueWrapper[] = []
function mountMenu(
  props: Partial<InstanceType<typeof PlacesThemeMenu>['$props']> = {},
  i18n = makeI18n(),
) {
  const w = mount(PlacesThemeMenu, {
    props: {
      selection: defaultSelection(),
      isLight: false,
      open: false,
      ...props,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  mounted.push(w)
  return w
}

afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
  document.body.innerHTML = ''
})

// ── chip button ────────────────────────────────────────────────────────────────
describe('chip button', () => {
  it('text via i18n key photosPlacesMapTheme', () => {
    const w = mountMenu()
    expect(w.get('[data-test="mtm-chip"]').text()).toContain('地图主题')
  })

  it('click chip → emit update:open toggled', async () => {
    const w = mountMenu({ open: false })
    await w.get('[data-test="mtm-chip"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[true]])
  })
})

// ── four presets ────────────────────────────────────────────────────────────────
describe('preset list', () => {
  it('render four .mtp-item, order default/ocean/sand/mono', () => {
    const w = mountMenu({ open: true })
    const items = w.findAll('[data-test="mtm-preset"]')
    expect(items).toHaveLength(4)
    expect(items.map((it) => it.attributes('data-theme-id'))).toEqual(['default', 'ocean', 'sand', 'mono'])
  })

  it('current item (one mapTheme matches) has .is-active and contains check icon, others do not', () => {
    const w = mountMenu({ open: true, selection: defaultSelection({ mapTheme: 'ocean' }) })
    const items = w.findAll('[data-test="mtm-preset"]')
    expect(items[1].classes()).toContain('is-active')
    expect(items[1].find('[data-test="mtm-check"]').exists()).toBe(true)
    for (const i of [0, 2, 3]) {
      expect(items[i].classes()).not.toContain('is-active')
      expect(items[i].find('[data-test="mtm-check"]').exists()).toBe(false)
    }
  })

  it('when mapTheme=custom, none of the four presets have .is-active (custom is not any preset)', () => {
    const w = mountMenu({ open: true, selection: defaultSelection({ mapTheme: 'custom' }) })
    const items = w.findAll('[data-test="mtm-preset"]')
    for (const i of items) expect(i.classes()).not.toContain('is-active')
  })

  it('preset name/description via i18n key (assert Chinese text, not Ocean literal)', () => {
    const w = mountMenu({ open: true })
    const items = w.findAll('[data-test="mtm-preset"]')
    expect(items[1].get('.mtp-name').text()).toBe('海洋')
    expect(items[1].get('.mtp-desc').text()).toBe('青绿调 + 深色背景')
    expect(items[1].text()).not.toContain('Ocean')
  })

  it('.mtp-swatch background and inner dot color change with isLight toggle', () => {
    const dark = mountMenu({ open: true, isLight: false })
    const darkSwatch = dark.findAll('[data-test="mtm-swatch"]')[1]
    expect(darkSwatch.attributes('style')).toContain('background-color: rgb(10, 18, 26)') // #0a121a
    expect(darkSwatch.get('.mtp-dot').attributes('style')).toContain('background: rgb(90, 200, 250)') // #5AC8FA

    const light = mountMenu({ open: true, isLight: true })
    const lightSwatch = light.findAll('[data-test="mtm-swatch"]')[1]
    expect(lightSwatch.attributes('style')).toContain('oklch(0.97 0.008 230)')
    expect(lightSwatch.get('.mtp-dot').attributes('style')).toContain('background: rgb(10, 132, 194)') // #0A84C2
  })

  it('click preset → emit update:selection (mapTheme changes to id, color fields preserved) + emit update:open(false)', async () => {
    const original = defaultSelection({ customDotColor: '#123456', customGridColor: '#abcdef' })
    const w = mountMenu({ open: true, selection: original })
    await w.get('[data-theme-id="sand"]').trigger('click')
    const next = w.emitted('update:selection')![0][0] as MapThemeSelection
    expect(next).toEqual({ ...original, mapTheme: 'sand' })
    expect(w.emitted('update:open')).toEqual([[false]])
  })
})

// ── custom color picker ──────────────────────────────────────────────────────────────
describe('custom color picker', () => {
  it('custom title via i18n key photosPlacesMapThemeCustom', () => {
    const w = mountMenu({ open: true })
    expect(w.text()).toContain('自定义')
  })

  it('two <input type="color"> elements exist', () => {
    const w = mountMenu({ open: true })
    expect(w.get('[data-test="mtm-dot-input"]').attributes('type')).toBe('color')
    expect(w.get('[data-test="mtm-grid-input"]').attributes('type')).toBe('color')
  })

  it('land dot color @input → emit payload.mapTheme===custom and customDotColor updated, customGridColor preserved', async () => {
    const original = defaultSelection({ mapTheme: 'ocean', customGridColor: '#abcdef' })
    const w = mountMenu({ open: true, selection: original })
    const input = w.get<HTMLInputElement>('[data-test="mtm-dot-input"]')
    input.element.value = '#ff00ff'
    await input.trigger('input')
    const next = w.emitted('update:selection')![0][0] as MapThemeSelection
    expect(next.mapTheme).toBe('custom')
    expect(next.customDotColor).toBe('#ff00ff')
    expect(next.customGridColor).toBe('#abcdef')
  })

  it('city light color @input → emit payload.mapTheme===custom and customGridColor updated, customDotColor preserved', async () => {
    const original = defaultSelection({ mapTheme: 'sand', customDotColor: '#123456' })
    const w = mountMenu({ open: true, selection: original })
    const input = w.get<HTMLInputElement>('[data-test="mtm-grid-input"]')
    input.element.value = '#00ffff'
    await input.trigger('input')
    const next = w.emitted('update:selection')![0][0] as MapThemeSelection
    expect(next.mapTheme).toBe('custom')
    expect(next.customGridColor).toBe('#00ffff')
    expect(next.customDotColor).toBe('#123456')
  })

  it('color picker does not close popover (unlike clicking presets, no emit update:open)', async () => {
    const w = mountMenu({ open: true })
    const input = w.get<HTMLInputElement>('[data-test="mtm-dot-input"]')
    input.element.value = '#ff00ff'
    await input.trigger('input')
    expect(w.emitted('update:open')).toBeUndefined()
  })
})

// ── popover spec: document mousedown / keydown (same as T9)───────────────────────────────
describe('popover spec', () => {
  it('when open=true, document mousedown outside container → emit update:open(false)', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    outside.remove()
  })

  it('when open=true, document mousedown inside container (inside popover) → do not emit', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    w.get('[data-test="mtm-pop"]').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('Escape (document-level dispatch, bubbles:true) → emit update:open(false)', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('non-Escape key does not trigger close', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('when open=false, document mousedown/keydown no longer triggers emit (listeners removed)', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    outside.remove()
  })

  it('after unmount, document listeners cleaned up (comparing function references)', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    const addedMousedown = addSpy.mock.calls.find((c) => c[0] === 'mousedown') as [string, EventListener] | undefined
    const addedKeydown = addSpy.mock.calls.find((c) => c[0] === 'keydown') as [string, EventListener] | undefined
    expect(addedMousedown).toBeDefined()
    expect(addedKeydown).toBeDefined()
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    expect(removeSpy).toHaveBeenCalledWith('mousedown', addedMousedown![1])
    expect(removeSpy).toHaveBeenCalledWith('keydown', addedKeydown![1])
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

// ── English locale sanity ────────────────────────────────────────────────────────
describe('English locale sanity', () => {
  it('under en_us, chip and preset text switch to English', () => {
    const w = mountMenu({ open: true }, makeI18n('en_us'))
    expect(w.get('[data-test="mtm-chip"]').text()).toContain('Map theme')
    const items = w.findAll('[data-test="mtm-preset"]')
    expect(items[1].get('.mtp-name').text()).toBe('Ocean')
  })
})

// ── theme-exception comment compliance (following color-guard exemption window rules)────────────────────
describe('theme-exception comment compliance', () => {
  it('if bare color literals appear in style block, must be covered by adjacent theme-exception exemption comments', () => {
    // Exactly replicate the exemption window state machine from src/styles/color-guard.test.ts:
    // exempt opens after theme-exception comment, closes at next ; or }. We don't assume
    // this component needs exceptions (unlike PlacesMap.vue; this component expects zero
    // literal colors — all via token or :style binding outside the style block), so don't
    // additionally assert comments.length > 0: if the implementation truly has no literal
    // colors, offenders array is empty and passes, naturally matching the entire repo's
    // color-guard.test.ts criteria. If someone adds a literal color and forgets the exemption
    // comment, this test will catch it before the full color-guard sweep.
    const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(placesThemeMenuRaw)
    expect(m).not.toBeNull()
    const styleText = m![1]
    const HEX = /#[0-9a-fA-F]{3,8}\b/
    const FUNC = /\b(rgba?|hsla?)\s*\(/
    let exempt = false
    const offenders: string[] = []
    for (const line of styleText.split('\n')) {
      if (line.includes('theme-exception')) exempt = true
      if (!exempt && (HEX.test(line) || FUNC.test(line))) offenders.push(line)
      if (line.includes(';') || line.includes('}')) exempt = false
    }
    expect(offenders, `bare colors not covered by exemption window:\n${offenders.join('\n')}`).toEqual([])
  })
})

// ── CSS cascade: .mtp-item.is-active:hover belongs to variant (hover cascade law)─────────────────
describe('cssCascade: .mtp-item.is-active:hover belongs to variant', () => {
  const styleText = extractStyleBlock(placesThemeMenuRaw)

  it('.mtp-item.is-active:hover background belongs to variant rule (higher specificity, not source-order tie-break)', () => {
    // Same lesson as PlacesFilterMenu.test.ts (T9): if only asserting winner.value contains expected token,
    // after the variant's own :hover rule is deleted, winningHoverBackground might rely on the
    // "same specificity, take source-order later" tie-break rule and coincidentally select the same
    // background value, leaving the test unable to catch RED. We additionally pin that winner.selector
    // must have explicit :hover, proving it wins by higher specificity.
    const winner = winningHoverBackground(styleText, ['map-theme-pop', 'mtp-item', 'is-active'])
    expect(winner.selector).toContain('is-active')
    expect(winner.selector).toContain(':hover')
    expect(winner.value).toContain('--accent-soft')
    expect(winner.value).not.toContain('--chip-bg')
  })
})
