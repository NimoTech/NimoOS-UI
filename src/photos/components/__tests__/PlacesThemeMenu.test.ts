// PlacesThemeMenu.vue — the "map theme" pill button in the map toolbar plus its
// dropdown popover (4 presets + two custom color pickers). Covers the required test checklist item by item.
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
  return { mapTheme: 'default', customDotColor: '#6E5BFF', customCityColor: '#9C8EFF', ...overrides }
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
  it('text uses the i18n key photosPlacesMapTheme', () => {
    const w = mountMenu()
    expect(w.get('[data-test="mtm-chip"]').text()).toContain('地图主题')
  })

  it('clicking the chip emits update:open toggled', async () => {
    const w = mountMenu({ open: false })
    await w.get('[data-test="mtm-chip"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[true]])
  })
})

// ── the four presets ────────────────────────────────────────────────────────────────
describe('preset list', () => {
  it('renders four .mtp-item elements in order default/ocean/sand/mono', () => {
    const w = mountMenu({ open: true })
    const items = w.findAll('[data-test="mtm-preset"]')
    expect(items).toHaveLength(4)
    expect(items.map((it) => it.attributes('data-theme-id'))).toEqual(['default', 'ocean', 'sand', 'mono'])
  })

  it('the current item (matching mapTheme) has .is-active and a check icon, the rest do not', () => {
    const w = mountMenu({ open: true, selection: defaultSelection({ mapTheme: 'ocean' }) })
    const items = w.findAll('[data-test="mtm-preset"]')
    expect(items[1].classes()).toContain('is-active')
    expect(items[1].find('[data-test="mtm-check"]').exists()).toBe(true)
    for (const i of [0, 2, 3]) {
      expect(items[i].classes()).not.toContain('is-active')
      expect(items[i].find('[data-test="mtm-check"]').exists()).toBe(false)
    }
  })

  it('none of the four presets has .is-active when mapTheme=custom (custom is not any preset)', () => {
    const w = mountMenu({ open: true, selection: defaultSelection({ mapTheme: 'custom' }) })
    const items = w.findAll('[data-test="mtm-preset"]')
    for (const i of items) expect(i.classes()).not.toContain('is-active')
  })

  it('preset name/description use i18n keys (asserts the Chinese copy, not the literal "Ocean")', () => {
    const w = mountMenu({ open: true })
    const items = w.findAll('[data-test="mtm-preset"]')
    expect(items[1].get('.mtp-name').text()).toBe('海洋')
    expect(items[1].get('.mtp-desc').text()).toBe('青绿调 + 深色背景')
    expect(items[1].text()).not.toContain('Ocean')
  })

  it('the .mtp-swatch background and inner dot color switch with isLight', () => {
    const dark = mountMenu({ open: true, isLight: false })
    const darkSwatch = dark.findAll('[data-test="mtm-swatch"]')[1]
    expect(darkSwatch.attributes('style')).toContain('background-color: rgb(10, 18, 26)') // #0a121a
    expect(darkSwatch.get('.mtp-dot').attributes('style')).toContain('background: rgb(90, 200, 250)') // #5AC8FA

    const light = mountMenu({ open: true, isLight: true })
    const lightSwatch = light.findAll('[data-test="mtm-swatch"]')[1]
    expect(lightSwatch.attributes('style')).toContain('oklch(0.97 0.008 230)')
    expect(lightSwatch.get('.mtp-dot').attributes('style')).toContain('background: rgb(10, 132, 194)') // #0A84C2
  })

  // Note: `.mtp-dot` used to carry no geometry
  // anywhere in this repo — only its `background` was bound (asserted above) — so it
  // rendered as an invisible zero-size inline span: "preset swatches render as near-empty
  // dark squares (no visible dot)". Vue2 draws this dot via an inline style object
  // (PhotosPlacesView.vue:1005): absolutely centered, 4x4px, fully rounded. This guard pins
  // that geometry to this file's own raw `<style>` text (jsdom does not compute layout, so a
  // rendered-DOM assertion can't catch a missing width/height the way a real browser would).
  it('.mtp-dot has real geometry (absolutely centered, 4x4 circle), no longer a zero-size bare <span>', () => {
    const style = extractStyleBlock(placesThemeMenuRaw)
    const m = /\.mtp-dot\s*\{([^}]*)\}/.exec(style)
    expect(m, '未找到 .mtp-dot 规则').not.toBeNull()
    const decls = m![1]
    expect(decls).toMatch(/position:\s*absolute/)
    expect(decls).toMatch(/top:\s*50%/)
    expect(decls).toMatch(/left:\s*50%/)
    expect(decls).toMatch(/transform:\s*translate\(-50%,\s*-50%\)/)
    expect(decls).toMatch(/width:\s*4px/)
    expect(decls).toMatch(/height:\s*4px/)
    expect(decls).toMatch(/border-radius:\s*99px/)
  })

  it('clicking a preset emits update:selection (mapTheme changes to that id, color fields stay unchanged) and emits update:open(false)', async () => {
    const original = defaultSelection({ customDotColor: '#123456', customCityColor: '#abcdef' })
    const w = mountMenu({ open: true, selection: original })
    await w.get('[data-theme-id="sand"]').trigger('click')
    const next = w.emitted('update:selection')![0][0] as MapThemeSelection
    expect(next).toEqual({ ...original, mapTheme: 'sand' })
    expect(w.emitted('update:open')).toEqual([[false]])
  })
})

// ── custom color pickers ──────────────────────────────────────────────────────────────
describe('custom color pickers', () => {
  it('the custom title uses the i18n key photosPlacesMapThemeCustom', () => {
    const w = mountMenu({ open: true })
    expect(w.text()).toContain('自定义')
  })

  it('both <input type="color"> elements exist', () => {
    const w = mountMenu({ open: true })
    expect(w.get('[data-test="mtm-dot-input"]').attributes('type')).toBe('color')
    expect(w.get('[data-test="mtm-grid-input"]').attributes('type')).toBe('color')
  })

  it('the land-dot color @input emits a payload with mapTheme===custom and customDotColor updated, customCityColor unchanged', async () => {
    const original = defaultSelection({ mapTheme: 'ocean', customCityColor: '#abcdef' })
    const w = mountMenu({ open: true, selection: original })
    const input = w.get<HTMLInputElement>('[data-test="mtm-dot-input"]')
    input.element.value = '#ff00ff'
    await input.trigger('input')
    const next = w.emitted('update:selection')![0][0] as MapThemeSelection
    expect(next.mapTheme).toBe('custom')
    expect(next.customDotColor).toBe('#ff00ff')
    expect(next.customCityColor).toBe('#abcdef')
  })

  it('the city-light color @input emits a payload with mapTheme===custom and customCityColor updated, customDotColor unchanged', async () => {
    const original = defaultSelection({ mapTheme: 'sand', customDotColor: '#123456' })
    const w = mountMenu({ open: true, selection: original })
    const input = w.get<HTMLInputElement>('[data-test="mtm-grid-input"]')
    input.element.value = '#00ffff'
    await input.trigger('input')
    const next = w.emitted('update:selection')![0][0] as MapThemeSelection
    expect(next.mapTheme).toBe('custom')
    expect(next.customCityColor).toBe('#00ffff')
    expect(next.customDotColor).toBe('#123456')
  })

  it('the color picker does not close the popover (unlike clicking a preset, it does not emit update:open)', async () => {
    const w = mountMenu({ open: true })
    const input = w.get<HTMLInputElement>('[data-test="mtm-dot-input"]')
    input.element.value = '#ff00ff'
    await input.trigger('input')
    expect(w.emitted('update:open')).toBeUndefined()
  })
})

// ── popover conventions: document mousedown / keydown ───────────────────────────────
describe('popover conventions', () => {
  it('when open=true, a document mousedown outside the container emits update:open(false)', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    outside.remove()
  })

  it('when open=true, a document mousedown inside the container (inside the popover) does not emit', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    w.get('[data-test="mtm-pop"]').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('Escape (dispatched at document level, bubbles: true) emits update:open(false)', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('a non-Escape key does not trigger closing', async () => {
    const w = mountMenu({ open: true })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('when open=false, document mousedown/keydown no longer trigger an emit (listeners removed)', async () => {
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

  it('listeners on document are fully removed after unmount (compares function references)', async () => {
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
  it('chip and preset copy switch to English under en_us', () => {
    const w = mountMenu({ open: true }, makeI18n('en_us'))
    expect(w.get('[data-test="mtm-chip"]').text()).toContain('Map theme')
    const items = w.findAll('[data-test="mtm-preset"]')
    expect(items[1].get('.mtp-name').text()).toBe('Ocean')
  })
})

// ── theme-exception comment compliance (per color-guard's exemption-window rules) ────────────────────
describe('theme-exception comment compliance', () => {
  it('any bare color literal in the style block must be covered by an adjacent theme-exception exemption window', () => {
    // Reproduces verbatim the exemption-window state machine from src/styles/color-guard.test.ts:
    // exempt turns on after a theme-exception comment and turns off at the next ; or }. This
    // doesn't assume the component necessarily needs an exception (unlike the PlacesMap.vue
    // case, this component is expected to have zero literal colors — everything goes through a
    // token or is bound via :style outside the style block), so it deliberately doesn't also
    // assert comments.length > 0: if the implementation genuinely has no literal colors at all,
    // an empty offenders array is a pass, matching the same standard as the repo-wide
    // color-guard.test.ts; if someone later adds a literal color here and forgets the exemption
    // comment, this test will catch it before the full color-guard suite does.
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
    expect(offenders, `bare color not covered by an exemption window:\n${offenders.join('\n')}`).toEqual([])
  })
})

// ── style cascade: .mtp-item.is-active:hover ownership variant (the hover-cascade rule) ─────────────────
describe('cssCascade: .mtp-item.is-active:hover ownership variant', () => {
  const styleText = extractStyleBlock(placesThemeMenuRaw)

  it('.mtp-item.is-active:hover background follows the ownership-variant rule (wins on specificity, not source-order tie-break)', () => {
    // Same lesson already learned in PlacesFilterMenu.test.ts: asserting only that winner.value
    // contains the expected token isn't enough — once the variant's own :hover rule is deleted,
    // winningHoverBackground can fall back to the "same-priority, later in source order wins"
    // tie-break rule and coincidentally pick the same background value, so the test never turns
    // RED. This additionally pins down that winner.selector must itself carry an explicit
    // :hover, proving it wins on higher specificity rather than by tie-break.
    const winner = winningHoverBackground(styleText, ['map-theme-pop', 'mtp-item', 'is-active'])
    expect(winner.selector).toContain('is-active')
    expect(winner.selector).toContain(':hover')
    expect(winner.value).toContain('--accent-soft')
    expect(winner.value).not.toContain('--chip-bg')
  })
})
