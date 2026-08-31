// SmartViewCreateDialog.vue — Smart view creation dialog tests. Each case
// corresponds to the 'required cases' list. Mounts Pinia + i18n
// (real zh_cn/en_us entries), mocks @nimotech/nimoos-service (only uses thumbnailUrl),
// uses real usePhotosSmartViews() store — directly reads/writes store.preview /
// store.createBusy to drive the right panel and button states; createSmartView is
// controlled via vi.spyOn for success/failure (following the existing pattern in this
// area: AlbumPickerDialog.test.ts does end-to-end with the real store, but this
// component's "confirm create" result needs precise control, so spyOn-ing the store
// method directly is cleaner than mocking the service layer again).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://thumb/${id}/${size}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import SmartViewCreateDialog from '../SmartViewCreateDialog.vue'
import smartViewCreateDialogRaw from '../SmartViewCreateDialog.vue?raw'
import { usePhotosSmartViews, type SmartView } from '../../stores/smartViews'
import { useToast } from '../../../stores/toast'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function mountDialog(
  props: { open?: boolean; embedded?: boolean; initialName?: string } = {},
  i18n = makeI18n(),
) {
  return mount(SmartViewCreateDialog, {
    props: { open: false, ...props },
    global: { plugins: [i18n] },
  })
}

function fullSv(overrides: Partial<SmartView> = {}): SmartView {
  return {
    id: 'sv-new', name: 'X', description: '', conds: [], threshold: 80, live: true, includeVideos: false,
    count: 0, addedThisWeek: 0, seeds: [], median: 0, storageBytes: 0, distribution: new Array(10).fill(0),
    evaluatedAt: '', createdAt: '', ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.thumbnailUrl.mockClear()
})
afterEach(() => {
  usePhotosSmartViews().__resetForTest()
  vi.restoreAllMocks()
})

// ── Structure inventory (6 left sections + 4 right sections + 5 templates + 2 footer buttons) ─
describe('structure inventory', () => {
  it('open:false → scrim does not render', () => {
    const w = mountDialog({ open: false })
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(false)
  })

  it('open:true → scrim renders, and left section has 6 parts / right section has 4 parts / 5 templates / footer has both buttons', async () => {
    const w = mountDialog({ open: true })
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(true)
    // Left section: 6 parts
    expect(w.find('[data-test="sv-name-input"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-desc-textarea"]').exists()).toBe(true)
    await w.find('[data-test="sv-desc-textarea"]').setValue('sunset in tokyo')
    expect(w.find('.sv-suggest').exists()).toBe(true) // Suggestion area (appears when desc is not empty)
    expect(w.find('.sv-chip-bin').exists()).toBe(true)
    expect(w.find('[data-test="pts-range"]').exists()).toBe(true)
    expect(w.findAll('.sv-switch')).toHaveLength(2)
    // Right section: 4 parts
    expect(w.find('.sv-preview-head').exists()).toBe(true)
    expect(w.find('.sv-preview-count').exists()).toBe(true)
    expect(w.find('.sv-preview-grid').exists()).toBe(true)
    expect(w.find('.sv-preview-help').exists()).toBe(true)
    // 5 templates
    expect(w.findAll('.sv-template-row')).toHaveLength(5)
    // Footer: 2 buttons
    expect(w.find('.sv-btn-ghost').exists()).toBe(true)
    expect(w.find('[data-test="sv-confirm-btn"]').exists()).toBe(true)
  })
})

// ── Persistent mount pitfall: draft reset happens in watch, not onMounted ──────────
describe('draft reset via watch (persistent mount pitfall)', () => {
  it('open → fill name → close → reopen → name is reset to empty', async () => {
    const w = mountDialog({ open: false })
    await w.setProps({ open: true })
    await w.find('[data-test="sv-name-input"]').setValue('My View')
    expect((w.find('[data-test="sv-name-input"]').element as HTMLInputElement).value).toBe('My View')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="sv-name-input"]').element as HTMLInputElement).value).toBe('')
  })
})

// ── Nimo suggestion chips ────────────────────────────────────────────────────────
describe('Nimo suggestions', () => {
  it('desc = "sunset in tokyo" → two suggestions appear: scene: sunset and place: Japan', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-desc-textarea"]').setValue('sunset in tokyo')
    const chips = w.findAll('.sv-suggest-chip').map((c) => c.text())
    expect(chips).toContain('+ scene: sunset')
    expect(chips).toContain('+ place: Japan')
  })

  it('click a suggestion → enters chip-bin and disappears from suggestion area, refreshPreview is called', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'refreshPreview')
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-desc-textarea"]').setValue('sunset in tokyo')
    spy.mockClear()
    const chip = w.findAll('.sv-suggest-chip').find((c) => c.text() === '+ scene: sunset')
    expect(chip).toBeDefined()
    await chip!.trigger('click')
    expect(w.findAll('.sv-chip-item').some((c) => c.text().includes('scene: sunset'))).toBe(true)
    expect(w.findAll('.sv-suggest-chip').some((c) => c.text() === '+ scene: sunset')).toBe(false)
    expect(spy).toHaveBeenCalled()
  })
})

// ── Chip add/remove ────────────────────────────────────────────────────────────
describe('chip add/remove', () => {
  it('enter "scene: x" + Enter → chip-bin gets one more item, input is cleared, refreshPreview is called', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'refreshPreview')
    const w = mountDialog({ open: true })
    spy.mockClear()
    const input = w.find('[data-test="sv-chip-input"]')
    await input.setValue('scene: x')
    await input.trigger('keydown.enter')
    expect(w.findAll('.sv-chip-item').some((c) => c.text().includes('scene: x'))).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(spy).toHaveBeenCalled()
  })

  it('input with comma → also submits one chip', async () => {
    const w = mountDialog({ open: true })
    const input = w.find('[data-test="sv-chip-input"]')
    await input.setValue('scene: y')
    await input.trigger('keydown', { key: ',' })
    expect(w.findAll('.sv-chip-item').some((c) => c.text().includes('scene: y'))).toBe(true)
  })

  it('duplicate input of the same item → chip is not duplicated', async () => {
    const w = mountDialog({ open: true })
    const input = w.find('[data-test="sv-chip-input"]')
    await input.setValue('scene: z')
    await input.trigger('keydown.enter')
    await input.setValue('scene: z')
    await input.trigger('keydown.enter')
    expect(w.findAll('.sv-chip-item').filter((c) => c.text().includes('scene: z'))).toHaveLength(1)
  })

  it('click .sv-chip-x → remove that chip, refreshPreview is called', async () => {
    const store = usePhotosSmartViews()
    const w = mountDialog({ open: true })
    const input = w.find('[data-test="sv-chip-input"]')
    await input.setValue('scene: gone')
    await input.trigger('keydown.enter')
    expect(w.findAll('.sv-chip-item').some((c) => c.text().includes('scene: gone'))).toBe(true)
    const spy = vi.spyOn(store, 'refreshPreview')
    await w.find('.sv-chip-x').trigger('click')
    expect(w.findAll('.sv-chip-item').some((c) => c.text().includes('scene: gone'))).toBe(false)
    expect(spy).toHaveBeenCalled()
  })
})

// ── Placeholder text dual states + hint ───────────────────────────────────────────
describe('chip input placeholder dual states', () => {
  it('chips empty → placeholder is photosSvTypeConditionEG, hint appears', () => {
    const w = mountDialog({ open: true })
    expect(w.find('[data-test="sv-chip-input"]').attributes('placeholder')).toBe(zh.photosSvTypeConditionEG)
    expect(w.text()).toContain(zh.photosSvPressEnterAddPick.replace('{enter}', 'Enter'))
  })

  it('chips not empty → placeholder changes to photosSvAddAnother, hint disappears', async () => {
    const w = mountDialog({ open: true })
    const input = w.find('[data-test="sv-chip-input"]')
    await input.setValue('scene: a')
    await input.trigger('keydown.enter')
    expect(w.find('[data-test="sv-chip-input"]').attributes('placeholder')).toBe(zh.photosSvAddAnother)
    expect(w.text()).not.toContain(zh.photosSvPressEnterAddPick.replace('{enter}', 'Enter'))
  })
})

// ── Threshold slider + preview-help three levels ──────────────────────────────────
describe('threshold slider', () => {
  it('drag to 92 → .sv-thresh-val displays ≥ 92%, refreshPreview is called', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'refreshPreview')
    const w = mountDialog({ open: true })
    spy.mockClear()
    const range = w.find('[data-test="pts-range"]')
    await range.setValue('92')
    expect(w.find('.sv-thresh-val').text()).toContain('92%')
    expect(spy).toHaveBeenCalled()
  })

  it('92 → strict copy; 60 → loose copy; 75 (and boundary 88/65) → balanced copy', async () => {
    const w = mountDialog({ open: true })
    const range = w.find('[data-test="pts-range"]')
    await range.setValue('92')
    expect(w.find('.sv-preview-help').text()).toBe(zh.photosSvStrictOnlyHighestConfidence)
    await range.setValue('60')
    expect(w.find('.sv-preview-help').text()).toBe(zh.photosSvLooseExpectSomeFalse)
    await range.setValue('75')
    expect(w.find('.sv-preview-help').text()).toBe(zh.photosSvBalancedHealthyMixCertainty)
    // Boundary: 88 and 65 both fall into balanced (else branch)
    await range.setValue('88')
    expect(w.find('.sv-preview-help').text()).toBe(zh.photosSvBalancedHealthyMixCertainty)
    await range.setValue('65')
    expect(w.find('.sv-preview-help').text()).toBe(zh.photosSvBalancedHealthyMixCertainty)
  })
})

// ── threshMuted: empty form does not count as inactive ────────────────────────────
describe('threshMuted', () => {
  it('thresholdActive=false + chips/desc both empty → hint does not appear', () => {
    const store = usePhotosSmartViews()
    store.preview = { count: 0, seeds: [], thresholdActive: false }
    const w = mountDialog({ open: true })
    expect(w.text()).not.toContain(zh.photosSvCurrentConditionsMatchExactly)
  })

  it('same thresholdActive=false, but add one chip → hint appears', async () => {
    const store = usePhotosSmartViews()
    store.preview = { count: 0, seeds: [], thresholdActive: false }
    const w = mountDialog({ open: true })
    const input = w.find('[data-test="sv-chip-input"]')
    await input.setValue('scene: x')
    await input.trigger('keydown.enter')
    expect(w.text()).toContain(zh.photosSvCurrentConditionsMatchExactly)
  })
})

// ── Two switches: accessible name + live does not trigger / videos triggers refreshPreview ────
describe('two switches', () => {
  it('both have role=switch / aria-checked / aria-label, and change with state', async () => {
    const w = mountDialog({ open: true })
    const live = w.find('[data-test="sv-switch-live"]')
    expect(live.attributes('role')).toBe('switch')
    expect(live.attributes('aria-checked')).toBe('true') // draft.live defaults to true
    expect(live.attributes('aria-label')).toBeTruthy()
    await live.trigger('click')
    expect(live.attributes('aria-checked')).toBe('false')

    const videos = w.find('[data-test="sv-switch-videos"]')
    expect(videos.attributes('role')).toBe('switch')
    expect(videos.attributes('aria-checked')).toBe('false') // Defaults to false
    expect(videos.attributes('aria-label')).toBeTruthy()
  })

  it('click includeVideos → refreshPreview is called', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'refreshPreview')
    const w = mountDialog({ open: true })
    spy.mockClear()
    await w.find('[data-test="sv-switch-videos"]').trigger('click')
    expect(spy).toHaveBeenCalled()
  })

  it('click live → refreshPreview is not called (carried over from Vue2 :127)', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'refreshPreview')
    const w = mountDialog({ open: true })
    spy.mockClear()
    await w.find('[data-test="sv-switch-live"]').trigger('click')
    expect(spy).not.toHaveBeenCalled()
  })
})

// ── Templates: descEn contract ──────────────────────────────────────────────
describe('templates', () => {
  it('click the 1st template row → name/desc become i18n values, threshold becomes 75, chips are derived from descEn (includes family gathering)', async () => {
    const w = mountDialog({ open: true })
    await w.findAll('.sv-template-row')[0]!.trigger('click')
    expect((w.find('[data-test="sv-name-input"]').element as HTMLInputElement).value).toBe(zh.photosSvFamilyWeekends)
    expect((w.find('[data-test="sv-desc-textarea"]').element as HTMLTextAreaElement).value).toBe(zh.photosSvFamilyWeekendsPark)
    expect(w.find('.sv-thresh-val').text()).toContain('75%')
    const chipTexts = w.findAll('.sv-chip-item').map((c) => c.text())
    expect(chipTexts.length).toBeGreaterThan(0)
    expect(chipTexts.length).toBeLessThanOrEqual(4)
    expect(chipTexts.some((c) => c.includes('scene: family gathering'))).toBe(true)
  })
})

// ── canSubmit ────────────────────────────────────────────────────────────
describe('canSubmit', () => {
  it('name empty → primary disabled', () => {
    const w = mountDialog({ open: true })
    expect((w.find('[data-test="sv-confirm-btn"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('name has value but chips and desc both empty → still disabled', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-name-input"]').setValue('Foo')
    expect((w.find('[data-test="sv-confirm-btn"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('name + desc → can click', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-name-input"]').setValue('Foo')
    await w.find('[data-test="sv-desc-textarea"]').setValue('bar')
    expect((w.find('[data-test="sv-confirm-btn"]').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('store.createBusy = true → disabled (even if other conditions are met)', async () => {
    const store = usePhotosSmartViews()
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-name-input"]').setValue('Foo')
    await w.find('[data-test="sv-desc-textarea"]').setValue('bar')
    store.createBusy = true
    await w.vm.$nextTick()
    expect((w.find('[data-test="sv-confirm-btn"]').element as HTMLButtonElement).disabled).toBe(true)
  })
})

// ── Confirm success/failure ─────────────────────────────────────────────────────
describe('confirm', () => {
  it('success: createSmartView receives object asserted field-by-field (including description: undefined), emit created + update:open(false)', async () => {
    const store = usePhotosSmartViews()
    const created = fullSv({ id: 'sv-123' })
    const spy = vi.spyOn(store, 'createSmartView').mockResolvedValue(created)
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-name-input"]').setValue('  Foo  ')
    const input = w.find('[data-test="sv-chip-input"]')
    await input.setValue('scene: a')
    await input.trigger('keydown.enter')
    await w.find('[data-test="sv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(spy).toHaveBeenCalledWith({
      name: 'Foo',
      description: undefined,
      conds: ['scene: a'],
      threshold: 80,
      live: true,
      includeVideos: false,
    })
    expect(w.emitted('created')).toEqual([['sv-123']])
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('when desc is not empty, description is the trimmed string, not undefined', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'createSmartView').mockResolvedValue(fullSv())
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-name-input"]').setValue('Foo')
    await w.find('[data-test="sv-desc-textarea"]').setValue('  bar desc  ')
    await w.find('[data-test="sv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ description: 'bar desc' }))
  })

  it('failure: createSmartView reject → toast.show is called, update:open not emitted (dialog does not close)', async () => {
    const store = usePhotosSmartViews()
    vi.spyOn(store, 'createSmartView').mockRejectedValue(new Error('boom'))
    const toastSpy = vi.spyOn(useToast(), 'show')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-name-input"]').setValue('Foo')
    await w.find('[data-test="sv-desc-textarea"]').setValue('bar')
    await w.find('[data-test="sv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.vm.$nextTick()
    // Assert toast.show directly (not relying on "no update:open" as an indirect signal)—
    // removing the catch in confirm() would change this from "indeed called toast" to
    // "unhandled promise rejection"; this assertion cleanly catches that difference
    // without relying on vitest's unhandled-rejection detection (which would cause the
    // whole test file to exit with non-zero status, but doesn't attach to a specific
    // assertion).
    expect(toastSpy).toHaveBeenCalledWith(zh.photosAlbumCreateFailed)
    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(true)
    errSpy.mockRestore()
  })
})

// ── Close entry points ─────────────────────────────────────────────────────────────
describe('close', () => {
  it('click close button → emit update:open(false)', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-close-btn"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('click Cancel → emit update:open(false)', async () => {
    const w = mountDialog({ open: true })
    await w.find('.sv-btn-ghost').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('click scrim itself (click.self) → emit update:open(false)', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="sv-modal-scrim"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })
})

// ── Hover cascade (cssCascade) ───────────────────────────────────────────────────
describe('hover state background', () => {
  it('.sv-btn-primary hover background belongs to rule containing :hover and -primary', () => {
    const style = extractStyleBlock(smartViewCreateDialogRaw)
    const win = winningHoverBackground(style, ['sv-btn-primary'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('-primary')
  })

  it('.sv-btn-ghost hover background belongs to rule containing :hover and -ghost', () => {
    const style = extractStyleBlock(smartViewCreateDialogRaw)
    const win = winningHoverBackground(style, ['sv-btn-ghost'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('-ghost')
  })
})

// ── Foreground color compliance: .sv-modal-icon is the only element in this component
// that literally asserts --on-accent usage (the other two --on-accent usages —
// .sv-switch[data-on]'s knob, .sv-btn-primary's text — are already covered elsewhere
// in this file and are already documented in the component file's own header comment;
// we don't repeat the assertion here to avoid dual maintenance of truth between
// assertion and comment). The component has no
// other photo-bearing elements (.sv-preview-grid img is pure image, no overlay text). ──
describe('foreground color compliance', () => {
  it('.sv-modal-icon uses --accent solid fill + --on-accent foreground', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewCreateDialogRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-modal-icon')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('background: var(--accent)')
    expect(rule?.body).toContain('color: var(--on-accent)')
  })
})

// ── Narrow screen rules ────────────────────────────────────────────────────────────
describe('narrow screen rules', () => {
  it('style block contains max-width: 768px, and .sv-modal-body changes to single column in that media block', () => {
    expect(smartViewCreateDialogRaw).toContain('max-width: 768px')
    const m = /@media \(max-width: 768px\)\s*\{([\s\S]*?)\n\}/.exec(smartViewCreateDialogRaw)
    expect(m, 'narrow screen media block not found').not.toBeNull()
    const rules = parseCssRules(m![1])
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-modal-body')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('grid-template-columns: 1fr')
  })
})

// ══════════════════════════════ Token-family and knob-color follow-ups ══════════════════════════════

// ── Template row sparkles icon color ────────────────────────────────────────────
describe('template row icon color', () => {
  // Note: the token family this file's whole style
  // block uses switched from New-UI's global tokens (--accent-text/--fg/--chip-bg/etc, none
  // shadowed on `.photos-root`, so none followed the private photos-is-light toggle) to
  // parity's own (--accent-hi/--text-1/--surface-*/etc). This spot-check follows suit.
  it('.sv-template-row svg uses --accent-hi, not the inherited container foreground (the container itself is --text-1)', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewCreateDialogRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-template-row svg')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('color: var(--accent-hi)')
  })
})

// ── The other --on-accent positive assertion (.sv-modal-icon is covered in the "foreground color compliance" describe) ──
// Note: the `.sv-switch[data-on="true"]::after` case below this
// comment used to assert the knob turns `--on-accent` when on -- that was the bug itself
// (the knob picked up the accent tone on toggle-on in this repo's dark theme, contradicting
// Vue2's own invariant knob colour, which stays one colour in both
// states). Replaced with the corrected assertion in the describe block further
// down ("the switch knob keeps one colour in both states").
describe('foreground color compliance supplementary (the other --on-accent positive assertion)', () => {
  it('.sv-btn-primary uses --accent solid fill + --on-accent foreground', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewCreateDialogRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-btn-primary')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('background: var(--accent)')
    expect(rule?.body).toContain('color: var(--on-accent)')
  })
})

// ── Invariant switch-knob colour: the knob keeps one colour in both states, it
//    does not change with on/off ──────────
// Root cause: parity's own `.photos-root .sv-switch[data-on="true"]::after`
// (photos-smartview.scss:786-789) only moves the knob (`left: 16px`) -- it never overrides
// `background`, so Vue2's knob is the exact same colour whether the switch is on or off. This
// file's own `[data-on="true"]::after` rule used to add `background: var(--on-accent)`, making
// the knob track state (near-white off, `--on-accent`'s dark-navy value on, in this repo's dark
// theme) -- a straight bug, not a deviation from Vue2, reproduced in a screenshot of the running
// app (Keep it live toggled on).
describe('the switch knob keeps one colour in both states (it does not change with data-on)', () => {
  it('.sv-switch[data-on="true"]::after only moves the knob, it never overrides background (one knob colour in both states)', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewCreateDialogRaw))
    const onKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch[data-on="true"]::after')
    expect(onKnob).toBeDefined()
    expect(onKnob?.body).toContain('left: 16px')
    // The state rule body no longer declares background -- the knob colour always comes from the
    // base rule and does not vary with data-on.
    expect(onKnob?.body).not.toMatch(/background\s*:/)
  })
})

// ── Follow-up: knob is invariant white across EVERY theme, not just
// both on/off states -- the previous fix's `var(--text-1)` correctly stayed constant across on/off but is
// itself a theme-flipping token (dark under `.photos-root.is-light`), so the actual
// requirement ("white in both themes and both states") was still unmet. `--text-1` is no longer
// used for the knob at all; light mode gets a paired border+shadow rule to keep a flat white
// knob visible against its own near-white off-track. ──────────────────────────────────────
describe('the switch knob stays white across themes (no longer the theme-flipping --text-1)', () => {
  it('.sv-switch::after knob background is a literal white, not var(--text-1)', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewCreateDialogRaw))
    const baseKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch::after')
    expect(baseKnob).toBeDefined()
    expect(baseKnob?.body).toMatch(/background\s*:\s*#fff\b/)
    expect(baseKnob?.body).not.toContain('var(--text-1)')
  })

  it('.photos-root.is-light .sv-switch::after gives the white knob a light-theme border + shadow, shared by both states', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewCreateDialogRaw))
    const lightKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.photos-root.is-light .sv-switch::after')
    expect(lightKnob, 'the light-theme knob-specific border/shadow override rule is missing').toBeDefined()
    expect(lightKnob?.body).toMatch(/border\s*:\s*1px solid var\(--line-strong\)/)
    expect(lightKnob?.body).toMatch(/box-shadow\s*:/)
    // This rule is not split by on/off; it applies in both states (the data-on rule does not
    // override border/box-shadow either).
    const onKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch[data-on="true"]::after')
    expect(onKnob?.body).not.toMatch(/border\s*:|box-shadow\s*:/)
  })
})

// ── Esc close (previously undeclared net-new, retroactively registered + test) ────
describe('Esc close', () => {
  it('when open:true, press Esc → emit update:open(false)', async () => {
    const w = mountDialog({ open: true })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('when open:false, press Esc → do not emit (document listener only mounted when open)', async () => {
    const w = mountDialog({ open: false })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })
})

// ── .sv-preview-grid img rendering path had zero coverage before (seeds always empty in 33 cases) ─
describe('preview-grid rendering', () => {
  it('store.preview.seeds not empty → renders corresponding number of img, src from thumbnailUrl(seed,"large"), with loading=lazy', () => {
    const store = usePhotosSmartViews()
    store.preview = { count: 2, seeds: ['seed-a', 'seed-b'], thresholdActive: true }
    const w = mountDialog({ open: true })
    const imgs = w.findAll('.sv-preview-grid img')
    expect(imgs).toHaveLength(2)
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('seed-a', 'large')
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('seed-b', 'large')
    expect(imgs[0]!.attributes('loading')).toBe('lazy')
  })
})

// ── Autofocus + keyboard operability had zero assertion before ──
describe('autofocus', () => {
  it('open:true → name input field automatically receives focus', async () => {
    const w = mount(SmartViewCreateDialog, {
      props: { open: true },
      global: { plugins: [makeI18n()] },
      attachTo: document.body,
    })
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(w.find('[data-test="sv-name-input"]').element)
    w.unmount()
  })
})

describe('switch keyboard operability (added tabindex + Enter/Space)', () => {
  it('both switches have tabindex=0, and both Enter/Space can toggle', async () => {
    const w = mountDialog({ open: true })
    const live = w.find('[data-test="sv-switch-live"]')
    expect(live.attributes('tabindex')).toBe('0')
    await live.trigger('keydown.enter')
    expect(live.attributes('aria-checked')).toBe('false')
    await live.trigger('keydown.space')
    expect(live.attributes('aria-checked')).toBe('true')
  })
})

// ── onUnmounted did not call store.cancelPreview() before (orphaned preview requests when leaving route) ──
describe('unmount', () => {
  it('component unmounts → store.cancelPreview() is called', () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'cancelPreview')
    const w = mountDialog({ open: true })
    w.unmount()
    expect(spy).toHaveBeenCalled()
  })
})

// ═════════════════════ Style parity follow-ups ═════════════════════

// ── .sv-switch missed transition/box-shadow contributed by low-priority rule at photos.scss:2819-2820 ──
describe('.sv-switch track transition + thumb shadow', () => {
  it('.sv-switch track background change has transition', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewCreateDialogRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('transition: background 0.15s')
  })

  it('.sv-switch::after knob has shadow (color-mix replica, not literal rgba)', () => {
    const rules = parseCssRules(extractStyleBlock(smartViewCreateDialogRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch::after')
    expect(rule).toBeDefined()
    expect(rule?.body).toMatch(/box-shadow:\s*0 1px 3px color-mix\(/)
  })
})

// ══════════════════════════ Embedded mode ══════════════════════════
// Vue2 939a7d3a:PhotosSmartAlbumCreate.vue:20-21 (two-layer wrapper), :232-241 (props),
// :271-277 (effectiveName/canSubmit), :325 (onScrimClick). The Albums page mounts this
// dialog embedded in place of its own footer when the "Let Nimo draft it" fill option is
// picked; standalone mode (PhotosSmartViews.vue's own mount) is untouched.
describe('embedded mode', () => {
  it('embedded mode drops its own scrim, header, and name field', async () => {
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-close-btn"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-name-input"]').exists()).toBe(false)
  })

  // Note: focus went to nameInputRef unconditionally, and in embedded mode
  // that ref is null (the name field is v-if="!embedded"), so opening the fused panel
  // focused nothing.
  it('focuses the description in embedded mode, the name field otherwise', async () => {
    const embedded = mount(SmartViewCreateDialog, {
      props: { open: false, embedded: true, initialName: 'Trip' },
      global: { plugins: [makeI18n()] },
      attachTo: document.body,
    })
    await embedded.setProps({ open: true })
    await nextTick()
    expect(document.activeElement).toBe(embedded.find('[data-test="sv-desc-textarea"]').element)
    embedded.unmount()

    const standalone = mount(SmartViewCreateDialog, {
      props: { open: false },
      global: { plugins: [makeI18n()] },
      attachTo: document.body,
    })
    await standalone.setProps({ open: true })
    await nextTick()
    expect(document.activeElement).toBe(standalone.find('[data-test="sv-name-input"]').element)
    standalone.unmount()
  })

  it('embedded mode submits the host-supplied name, live as the host edits it', async () => {
    const w = mountDialog({ open: true, embedded: true, initialName: '' })
    // Empty host name => cannot submit even with a description present.
    await w.find('[data-test="sv-desc-textarea"]').setValue('sunsets')
    expect(w.find('[data-test="sv-confirm-btn"]').attributes('disabled')).toBeDefined()
    // The host field is the single source of truth, not a copy seeded on open, so a name
    // typed after picking the nimo option still arrives.
    await w.setProps({ initialName: 'Trip' })
    expect(w.find('[data-test="sv-confirm-btn"]').attributes('disabled')).toBeUndefined()
    const store = usePhotosSmartViews()
    const createSmartView = vi.spyOn(store, 'createSmartView').mockResolvedValue(fullSv())
    await w.find('[data-test="sv-confirm-btn"]').trigger('click')
    expect(createSmartView).toHaveBeenCalledWith(expect.objectContaining({ name: 'Trip' }))
  })

  it('standalone mode still owns its scrim, header and name field', () => {
    const w = mountDialog({ open: true })
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-name-input"]').exists()).toBe(true)
  })

  it('embedded mode does not close on a click inside its own root', async () => {
    // The host panel owns the scrim; a stray self-click here must not shut the panel.
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    await w.find('[data-test="sv-embed-host"]').trigger('click')
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('embedded mode leaves Escape to the host', async () => {
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    // Also assert 'close' was never emitted, not just 'update:open': dismiss() itself already
    // branches on embedded and would emit 'close' if this listener fired, so checking
    // update:open alone cannot tell "the listener never fired" apart from "it fired and took
    // the embedded branch" -- both leave update:open undefined either way.
    expect(w.emitted('close')).toBeUndefined()
  })

  it('embedded mode emits close (not update:open) on successful create', async () => {
    const store = usePhotosSmartViews()
    vi.spyOn(store, 'createSmartView').mockResolvedValue(fullSv({ id: 'sv-embed-1' }))
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    await w.find('[data-test="sv-desc-textarea"]').setValue('sunsets')
    await w.find('[data-test="sv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.emitted('close')).toBeTruthy()
    expect(w.emitted('created')).toEqual([['sv-embed-1']])
    expect(w.emitted('update:open')).toBeUndefined()
  })

  // In embedded mode the ghost Cancel
  // button is the *only* way to back out without submitting — it is not gated by
  // v-if="!embedded" the way the header close button and Name field are, and the Escape
  // listener is never attached in embedded mode (see the test above), so it cannot cover
  // this path either. This was previously untested: dismiss()'s embedded branch and
  // confirm()'s success-path embedded branch used to be two separately-written copies of
  // the same decision, and only the confirm() copy had a test.
  it('embedded mode emits close (not update:open) when Cancel is clicked', async () => {
    const w = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    await w.find('.sv-btn-ghost').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('embedded mode uses the "Create Smart Album" label, standalone keeps "Create Smart View"', () => {
    const embedded = mountDialog({ open: true, embedded: true, initialName: 'Trip' })
    expect(embedded.find('[data-test="sv-confirm-btn"]').text()).toContain(zh.photosSvCreateSmartAlbum)
    const standalone = mountDialog({ open: true })
    expect(standalone.find('[data-test="sv-confirm-btn"]').text()).toContain(zh.photosSvCreateSmartView)
  })
})
