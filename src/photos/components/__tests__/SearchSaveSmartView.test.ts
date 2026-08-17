// SP7-P7a-T14: SearchSaveSmartView.vue — "Save as smart view" dialog test (D12 wired up).
// Mounts Pinia + i18n, real usePhotosSmartViews() store, createSmartView controlled
// precisely via vi.spyOn for success/failure (same pattern as SmartViewCreateDialog.test.ts).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {},
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import SearchSaveSmartView from '../SearchSaveSmartView.vue'
import searchSaveSmartViewRaw from '../SearchSaveSmartView.vue?raw'
import { usePhotosSmartViews, type SmartView } from '../../stores/smartViews'
import { useToast } from '../../../stores/toast'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from './cssCascade'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

type Props = { open: boolean; query: string; conditions: string[]; defaultName: string; ignoreEl?: HTMLElement | null }

function baseProps(overrides: Partial<Props> = {}): Props {
  return { open: false, query: 'sunset in tokyo', conditions: ['scene: sunset', 'place: Japan'], defaultName: 'Sunset Trips', ...overrides }
}

function mountDialog(props: Partial<Props> = {}, i18n = makeI18n()) {
  return mount(SearchSaveSmartView, { props: baseProps(props), global: { plugins: [i18n] } })
}

// fix round 1 · I1: clicking outside requires real DOM attachment to document so events
// bubble from target to document-level listener (same pattern as PlacesThemeMenu.test.ts).
function mountDialogAttached(props: Partial<Props> = {}, i18n = makeI18n()) {
  return mount(SearchSaveSmartView, { props: baseProps(props), global: { plugins: [i18n] }, attachTo: document.body })
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
})
afterEach(() => {
  usePhotosSmartViews().__resetForTest()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('Structure inventory', () => {
  it('open:false → does not render', () => {
    const w = mountDialog({ open: false })
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(false)
  })

  it('open:true → renders 4 sections (head/body three fields + switch/foot)', () => {
    const w = mountDialog({ open: true })
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
    expect(w.find('.save-pop-icon').exists()).toBe(true)
    expect(w.find('[data-test="ssv-name-input"]').exists()).toBe(true)
    expect(w.find('.save-pop-conds').exists()).toBe(true)
    expect(w.find('[data-test="pts-range"]').exists()).toBe(true)
    expect(w.find('[data-test="ssv-switch-live"]').exists()).toBe(true)
    expect(w.find('[data-test="ssv-cancel-btn"]').exists()).toBe(true)
    expect(w.find('[data-test="ssv-confirm-btn"]').exists()).toBe(true)
  })
})

describe('Reset on open:true via watch (persistent mount guard)', () => {
  it('after editing name, close then reopen → name reverts to defaultName; threshold reverts to 75', async () => {
    const w = mountDialog({ open: false, defaultName: 'Sunset Trips' })
    await w.setProps({ open: true })
    expect((w.find('[data-test="ssv-name-input"]').element as HTMLInputElement).value).toBe('Sunset Trips')
    await w.find('[data-test="ssv-name-input"]').setValue('My Custom Name')
    await w.find('[data-test="pts-range"]').setValue('92')
    expect(w.find('.save-pop-thresh-val').text()).toContain('92%')

    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="ssv-name-input"]').element as HTMLInputElement).value).toBe('Sunset Trips')
    expect(w.find('.save-pop-thresh-val').text()).toContain('75%')
  })
})

describe('Auto-focus', () => {
  it('name input auto-focuses on open', async () => {
    const w = mount(SearchSaveSmartView, {
      props: baseProps({ open: true }),
      global: { plugins: [makeI18n()] },
      attachTo: document.body,
    })
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(w.find('[data-test="ssv-name-input"]').element)
    w.unmount()
  })
})

describe('Condition display', () => {
  it('conditions non-empty → N .save-pop-cond elements', () => {
    const w = mountDialog({ open: true, conditions: ['scene: sunset', 'place: Japan', 'people: Sara'] })
    expect(w.findAll('.save-pop-cond')).toHaveLength(3)
    expect(w.find('.save-pop-conds-empty').exists()).toBe(false)
  })

  it('conditions empty → shows placeholder text', () => {
    const w = mountDialog({ open: true, conditions: [] })
    expect(w.findAll('.save-pop-cond')).toHaveLength(0)
    expect(w.get('.save-pop-conds-empty').text()).toBe(zh.photosSearchNoActiveFiltersSaves)
  })
})

describe('Primary button disabled state', () => {
  it('name empty (after trim) → disabled', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="ssv-name-input"]').setValue('   ')
    expect((w.find('[data-test="ssv-confirm-btn"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('store.createBusy=true → disabled (even if name has value)', async () => {
    const store = usePhotosSmartViews()
    const w = mountDialog({ open: true })
    store.createBusy = true
    await w.vm.$nextTick()
    expect((w.find('[data-test="ssv-confirm-btn"]').element as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('Confirm calls store (D12)', () => {
  it('success: createSmartView receives field-by-field object (conds is copy, not ref), saved event carries id, update:open emits false', async () => {
    const store = usePhotosSmartViews()
    const created = fullSv({ id: 'sv-abc' })
    const spy = vi.spyOn(store, 'createSmartView').mockResolvedValue(created)
    const conditions = ['scene: sunset', 'place: Japan']
    const w = mountDialog({ open: true, query: 'sunset in tokyo', conditions })
    await w.find('[data-test="pts-range"]').setValue('88')
    await w.find('[data-test="ssv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()

    expect(spy).toHaveBeenCalledTimes(1)
    const arg = spy.mock.calls[0]![0]
    expect(arg.name).toBe('Sunset Trips')
    expect(arg.description).toBe('sunset in tokyo')
    expect(arg.conds).toEqual(['scene: sunset', 'place: Japan'])
    expect(arg.threshold).toBe(88)
    expect(arg.live).toBe(true)
    expect(arg.includeVideos).toBe(false)

    // Copy vs same-ref falsifiable test (cleanup checklist item ③ tested this):
    // cannot directly use `expect(arg.conds).not.toBe(conditions)` — Vue's props are
    // reactive() Proxies, so even if implementation became `conds: props.conditions`
    // (no spread), the value read is already a Proxy wrapping the original array,
    // not the array itself; this reference check has no discrimination power for
    // "was it spread" (verified: deleting spread still passes all tests).
    // The real discriminator is "after the call, if the original array is mutated
    // in-place, does this emitted conds change?" — spread creates a snapshot at
    // that moment; later in-place push to the source won't show in the snapshot;
    // no spread means arg.conds is a live proxy to the source, in-place push is
    // immediately visible.
    conditions.push('people: Sara')
    expect(arg.conds).toEqual(['scene: sunset', 'place: Japan']) // not polluted by later mutation

    // fix wave F1: emit contract added second param name (parent composes save-success
    // toast text) — following contract here, not weakening assertion: name.value is
    // set by watch to props.defaultName ('Sunset Trips') when open becomes true;
    // this test never changes the name input, so second param is that default.
    expect(w.emitted('saved')).toEqual([['sv-abc', 'Sunset Trips']])
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  // fix round 1 · M5: when query is empty (or all whitespace), description must be
  // undefined, not empty string — `CreateSmartViewInput.description?` semantics are
  // "omit field if description is empty" (T5 same standard).
  it('query is whitespace string → description is undefined, not empty string (fix round 1 · M5)', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'createSmartView').mockResolvedValue(fullSv())
    const w = mountDialog({ open: true, query: '   ' })
    await w.find('[data-test="ssv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ description: undefined }))
  })

  it('failure: reject → toast called, update:open not emitted, saved not emitted, dialog stays open', async () => {
    const store = usePhotosSmartViews()
    vi.spyOn(store, 'createSmartView').mockRejectedValue(new Error('boom'))
    const toastSpy = vi.spyOn(useToast(), 'show')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const w = mountDialog({ open: true })
    await w.find('[data-test="ssv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.vm.$nextTick()

    expect(toastSpy).toHaveBeenCalledWith(zh.photosAlbumCreateFailed)
    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.emitted('saved')).toBeUndefined()
    // fix round 1 · M7 (review-verified): this is a tautological assertion itself —
    // `open` is parent-controlled prop; component cannot possibly change the v-if
    // condition by itself; test never setProps({ open: false }); so "dialog still
    // there" is completely unrelated to whether confirm() handles failure correctly.
    // What actually pins down "dialog stays open on failure" is the above
    // `emitted('update:open')).toBeUndefined()` — if implementation also emits
    // update:open(false) on the failure path, that would turn red. This line is kept
    // only as a readability anchor (explicitly spelling out "we expect dialog still
    // rendered"), not as a real behavior guard.
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
    errSpy.mockRestore()
  })
})

describe('Switch', () => {
  it('role=switch + aria-checked follows state + aria-label exists', async () => {
    const w = mountDialog({ open: true })
    const sw = w.find('[data-test="ssv-switch-live"]')
    expect(sw.attributes('role')).toBe('switch')
    expect(sw.attributes('aria-checked')).toBe('true') // default live=true
    expect(sw.attributes('aria-label')).toBeTruthy()
    await sw.trigger('click')
    expect(sw.attributes('aria-checked')).toBe('false')
  })
})

describe('Close entry points', () => {
  it('click close button → emit update:open(false)', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="ssv-close-btn"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('click Cancel → emit update:open(false)', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="ssv-cancel-btn"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })
})

describe('Esc close (no submit)', () => {
  it('when open:true, press Esc → emit update:open(false), createSmartView not called', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'createSmartView')
    const w = mountDialog({ open: true })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(spy).not.toHaveBeenCalled()
  })

  it('when open:false, press Esc → no emit (listener only mounted when open)', async () => {
    const w = mountDialog({ open: false })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })
})

// fix round 1 · I1 (review-verified rendering gap, fix round 2 · N2 corrects line numbers):
// Vue2 `_onDoc` (full :819-832, save dialog half-condition at :820-822) mousedown logic —
// "close only if both pop and btn don't contain(target)". Previously only did Esc; here
// we add outside-click close + new `ignoreEl` prop to override the trigger-button half-check.
describe('Outside mousedown close (fix round 1 · I1)', () => {
  it('click inside dialog → stays open', async () => {
    const w = mountDialogAttached({ open: true })
    w.get('[data-test="ssv-root"]').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    w.unmount()
  })

  it('click outside dialog → emit update:open(false)', async () => {
    const w = mountDialogAttached({ open: true })
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    outside.remove()
    w.unmount()
  })

  it('when ignoreEl passed, click inside ignoreEl → stays open (main guard for new prop)', async () => {
    const triggerBtn = document.createElement('button')
    document.body.appendChild(triggerBtn)
    const w = mountDialogAttached({ open: true, ignoreEl: triggerBtn })
    triggerBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    triggerBtn.remove()
    w.unmount()
  })

  it('when ignoreEl not passed, click on "would-be trigger" external node → still closes (degraded behavior; handoff note requires parent to pass ignoreEl)', async () => {
    const triggerBtn = document.createElement('button')
    document.body.appendChild(triggerBtn)
    const w = mountDialogAttached({ open: true }) // ignoreEl not passed
    triggerBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    triggerBtn.remove()
    w.unmount()
  })

  it('when open:false, click outside → no emit (listener only mounted when open)', async () => {
    const w = mountDialogAttached({ open: false })
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    outside.remove()
    w.unmount()
  })

  it('after parent closes (open:false), click outside → no longer fires (listener removed by watch(open))', async () => {
    const w = mountDialogAttached({ open: true })
    // Standalone mount doesn't auto-wire emit(update:open) back to props like real parent-child —
    // here we explicitly setProps to simulate parent receiving emit and setting open:false,
    // so listener should be removed too.
    await w.setProps({ open: false })
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined() // listener already removed, no emit
    outside.remove()
    w.unmount()
  })

  it('on unmount, clean up document listeners (mousedown and keydown both removed)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const w = mountDialogAttached({ open: true })
    const addedMousedown = addSpy.mock.calls.find((c) => c[0] === 'mousedown') as [string, EventListener] | undefined
    expect(addedMousedown).toBeDefined()
    w.unmount()
    expect(removeSpy).toHaveBeenCalledWith('mousedown', addedMousedown![1])
  })
})

describe('Foreground color compliance: .save-pop-icon is accent solid + --on-accent', () => {
  it('positive assertion', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.save-pop-icon')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('background: var(--accent)')
    expect(rule?.body).toContain('color: var(--on-accent)')
  })

  // fix round 1 · I2 (review mutation-tested): previously 28×28/9px had zero assertions —
  // changing it to T5 .sv-modal-icon's 32×32/10px, 23 tests still all passed. C11 explicitly
  // flagged "these two size locations must be verified independently, cannot reuse values";
  // adding a reverse anchor assertion to prevent next copy-paste from welding them together.
  it('.save-pop-icon size is 28×28, border-radius:9px (not T5 .sv-modal-icon\'s 32×32/10px)', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.save-pop-icon')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 28px')
    expect(rule?.body).toContain('height: 28px')
    expect(rule?.body).toContain('border-radius: 9px')
  })
})

// fix round 1 · I2 (review-verified, second instance of zero assertion): .save-pop
// positioning/z-index/size contract previously had no programmatic assertions
// (plan explicitly requires non-color visual properties to have assertions).
describe('.save-pop positioning contract', () => {
  it('width: 360px / z-index: 50 / top: calc(100% + 8px) / right: 0', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.save-pop')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 360px')
    expect(rule?.body).toContain('z-index: 50')
    expect(rule?.body).toContain('top: calc(100% + 8px)')
    expect(rule?.body).toContain('right: 0')
  })
})

// fix round 1 · I2 (review-verified, third zero-assertion instance, same pattern as T12-I1):
// sparkles/x glyph `d` path strings had no assertions pinning them down — "svg exists" is
// insufficient to catch "copy-paste path with one wrong character" bugs (T12-I1 lesson:
// change one char, 15 tests still passed). After character-by-character audit against
// PhotosIcon.vue:21-22 (sparkles)/:52 (x), pinning down here.
describe('Glyph d strings (fix round 1 · I2, same T12-I1 lesson)', () => {
  it('two sparkles (head 28×28 icon block + primary button) and one x (close button) path d exactly correct char-by-char', () => {
    const sparklesD = 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1'
    const xD = 'm6 6 12 12M18 6 6 18'
    const sparklesCount = searchSaveSmartViewRaw.split(sparklesD).length - 1
    expect(sparklesCount).toBe(2) // head icon block + primary button, one each
    expect(searchSaveSmartViewRaw).toContain(xD)
    // sparkles center <circle> also char-by-char verified (PhotosIcon.vue:22 second geometric element).
    const circleCount = searchSaveSmartViewRaw.split('<circle cx="12" cy="12" r="3" />').length - 1
    expect(circleCount).toBe(2)
  })
})

describe('Hover cascade (cssCascade)', () => {
  it('.sv-btn-primary hover winning rule contains :hover and -primary', () => {
    const style = extractStyleBlock(searchSaveSmartViewRaw)
    const win = winningHoverBackground(style, ['sv-btn-primary'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('-primary')
  })

  it('.sv-btn-ghost hover winning rule contains :hover and -ghost', () => {
    const style = extractStyleBlock(searchSaveSmartViewRaw)
    const win = winningHoverBackground(style, ['sv-btn-ghost'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('-ghost')
  })
})

describe('C7: save-pop transition (Vue3 class -enter-from, not Vue2 -enter)', () => {
  it('style block contains -enter-from/-leave-active rules, and lacks Vue2 bare -enter class', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const active = rules.find((r) => r.selectors.includes('.save-pop-enter-active') && r.selectors.includes('.save-pop-leave-active'))
    expect(active).toBeDefined()
    expect(active?.body).toContain('opacity 0.16s ease')
    expect(active?.body).toContain('transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)')
    expect(active?.body).toContain('transform-origin: top right')

    const enterFrom = rules.find((r) => r.selectors.includes('.save-pop-enter-from') && r.selectors.includes('.save-pop-leave-to'))
    expect(enterFrom).toBeDefined()
    expect(enterFrom?.body).toContain('opacity: 0')
    expect(enterFrom?.body).toContain('translateY(-4px) scale(0.97)')

    // Negative assertion: should not have Vue2 bare `.save-pop-enter {` (no -from suffix) —
    // this is a silent-failure trap learned in T6 fix round.
    expect(searchSaveSmartViewRaw).not.toMatch(/\.save-pop-enter\s*[,{]/)
  })

  it('Transition component name is "save-pop"', () => {
    expect(searchSaveSmartViewRaw).toContain('name="save-pop"')
  })
})

describe('.sv-switch track transition + thumb shadow (C5 T8 M1 fix, don\'t drop it again)', () => {
  it('.sv-switch track background change has transition', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('transition: background 0.15s')
  })

  it('.sv-switch::after thumb has shadow (color-mix, not literal rgba)', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch::after')
    expect(rule).toBeDefined()
    expect(rule?.body).toMatch(/box-shadow:\s*0 1px 3px color-mix\(/)
  })

  it('.sv-switch size is 32×18, thumb 14×14, [data-on]::after left:16px (photos-smartview.scss effective value, not photos.scss:2817-2825\'s 36×20/left:18px)', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const track = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch')
    expect(track?.body).toContain('width: 32px')
    expect(track?.body).toContain('height: 18px')
    const thumb = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch::after')
    expect(thumb?.body).toContain('width: 14px')
    expect(thumb?.body).toContain('height: 14px')
    const onThumb = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch[data-on="true"]::after')
    expect(onThumb?.body).toContain('left: 16px')
  })

  // Fix-5 (owner acceptance, 2026-08-14): straight bug fix, not a deviation from Vue2 -- parity's
  // own `.photos-root .sv-switch[data-on="true"]::after` (photos-smartview.scss:786-789) only
  // moves the knob; it never overrides `background`, so Vue2's knob is the same colour in both
  // states. This file's own copy used to add `background: var(--on-accent)` here (the C5 ruling
  // pinned it to SmartViewCreateDialog.vue's then-buggy value), making the knob track state
  // instead of staying constant.
  it('.sv-switch[data-on="true"]::after does not override background (one knob colour in both states, unaffected by data-on)', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const onKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch[data-on="true"]::after')
    expect(onKnob?.body).not.toMatch(/background\s*:/)
  })

  // Fix-6 (owner decision, 2026-08-14): knob is invariant white across EVERY theme, not just
  // both on/off states -- Fix-5's `var(--text-1)` correctly stayed constant across on/off but is
  // itself a theme-flipping token (dark under `.photos-root.is-light`), so the owner's actual
  // requirement ("white in both themes and both states") was still unmet. `--text-1` is no
  // longer used for the knob at all; light mode gets a paired border+shadow rule to keep a flat
  // white knob visible against its own near-white off-track.
  it('.sv-switch::after knob background is a literal white, not var(--text-1)', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const baseKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch::after')
    expect(baseKnob).toBeDefined()
    expect(baseKnob?.body).toMatch(/background\s*:\s*#fff\b/)
    expect(baseKnob?.body).not.toContain('var(--text-1)')
  })

  it('.photos-root.is-light .sv-switch::after gives the white knob a light-theme border + shadow, shared by both states', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const lightKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.photos-root.is-light .sv-switch::after')
    expect(lightKnob, 'the light-theme knob-specific border/shadow override rule is missing').toBeDefined()
    expect(lightKnob?.body).toMatch(/border\s*:\s*1px solid var\(--line-strong\)/)
    expect(lightKnob?.body).toMatch(/box-shadow\s*:/)
    const onKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch[data-on="true"]::after')
    expect(onKnob?.body).not.toMatch(/border\s*:|box-shadow\s*:/)
  })
})
