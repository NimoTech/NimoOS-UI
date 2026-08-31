// SearchSaveSmartView.vue — tests for the "save as smart view" popover, wired against the
// real store. Mounts Pinia + i18n, uses the real usePhotosSmartViews() store; createSmartView
// is precisely controlled via vi.spyOn for success/failure (the same established approach as
// SmartViewCreateDialog.test.ts).
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
import { readFileSync } from 'node:fs'
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

// The "close on outside mousedown" test cases need to actually attach to document, so the
// event can bubble from the target node up to the document-level listener (the same
// established approach as PlacesThemeMenu.test.ts).
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

describe('structure inventory', () => {
  it('open:false → does not render', () => {
    const w = mountDialog({ open: false })
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(false)
  })

  it('open:true → renders 4 sections (head/body three fields+switch/foot)', () => {
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

describe('reset on open turning true goes through watch (persistent-mount pitfall guard)', () => {
  it('after editing name, closing and reopening → name resets to defaultName; thresh resets to 75', async () => {
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

describe('autofocus', () => {
  it('name input autofocuses after opening', async () => {
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

describe('conditions echo', () => {
  it('conditions non-empty → N .save-pop-cond elements', () => {
    const w = mountDialog({ open: true, conditions: ['scene: sunset', 'place: Japan', 'people: Sara'] })
    expect(w.findAll('.save-pop-cond')).toHaveLength(3)
    expect(w.find('.save-pop-conds-empty').exists()).toBe(false)
  })

  it('conditions empty → shows placeholder copy', () => {
    const w = mountDialog({ open: true, conditions: [] })
    expect(w.findAll('.save-pop-cond')).toHaveLength(0)
    expect(w.get('.save-pop-conds-empty').text()).toBe(zh.photosSearchNoActiveFiltersSaves)
  })
})

describe('primary disabled state', () => {
  it('name empty (after trim) → disabled', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="ssv-name-input"]').setValue('   ')
    expect((w.find('[data-test="ssv-confirm-btn"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('store.createBusy=true → disabled (even with a name value)', async () => {
    const store = usePhotosSmartViews()
    const w = mountDialog({ open: true })
    store.createBusy = true
    await w.vm.$nextTick()
    expect((w.find('[data-test="ssv-confirm-btn"]').element as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('confirm actually calls the store', () => {
  it('success: createSmartView receives a per-field object (conds is a copy, not the same reference), saved emits with id, update:open emits false', async () => {
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

    // A falsifiable check that this is a copy, not the same reference (verified in practice at
    // mutation-test checkpoint 3): comparing directly with
    // `expect(arg.conds).not.toBe(conditions)` doesn't work — Vue's props are wrapped in a
    // reactive() Proxy, so even if the implementation were changed to `conds: props.conditions`
    // (no spread), the value read back is already a Proxy wrapping the original array, not the
    // original array itself — this reference comparison has no power to distinguish "was it
    // spread or not" (verified: removing the spread still leaves this assertion green). What
    // actually has discriminating power is "after the call, does the emitted conds mutate when
    // the original array is mutated in place" — spreading produces a snapshot frozen at that
    // moment, so a later in-place push on the original array won't show up in the snapshot;
    // without spreading, arg.conds is a live proxy over the original array, and an in-place push
    // is immediately visible through it.
    conditions.push('people: Sara')
    expect(arg.conds).toEqual(['scene: sunset', 'place: Japan']) // not polluted by the later in-place mutation

    // The emit contract added a second parameter, name (the host needs it to compose the save-
    // success toast copy) — this follows the contract, it's not a weakened assertion: name.value
    // gets set to props.defaultName ('Sunset Trips') by a watch when open turns true, and this
    // test case never touched the name input, so the second argument is just that default name.
    expect(w.emitted('saved')).toEqual([['sv-abc', 'Sunset Trips']])
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  // When query is empty (or all whitespace), description must be undefined, not an empty
  // string — `CreateSmartViewInput.description?`'s established semantics are "an empty
  // description omits the field" (the same convention used elsewhere).
  it('query is a whitespace-only string → description is undefined, not an empty string', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'createSmartView').mockResolvedValue(fullSv())
    const w = mountDialog({ open: true, query: '   ' })
    await w.find('[data-test="ssv-confirm-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ description: undefined }))
  })

  it('failure: reject → toast is called, update:open not emitted, saved not emitted, popover stays open', async () => {
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
    // This assertion by itself is a tautology — `open` is a parent-controlled prop, and there's
    // no implementation under which this component would change its own v-if condition, and the
    // test never calls setProps({ open: false }) either, so "the popover is still there" has
    // nothing to do with whether confirm() correctly handled the failure. What actually pins
    // down "the popover doesn't close on failure" is the
    // `emitted('update:open')).toBeUndefined()` assertion above — that's what turns red if the
    // implementation also emits update:open(false) on the failure path. This line is kept purely
    // as a readability anchor (spelling out in plain words "we expect the popover to still be
    // rendering"), not as an effective behavioral guard anymore.
    expect(w.find('[data-test="ssv-root"]').exists()).toBe(true)
    errSpy.mockRestore()
  })
})

describe('switch', () => {
  it('role=switch + aria-checked follows state + aria-label present', async () => {
    const w = mountDialog({ open: true })
    const sw = w.find('[data-test="ssv-switch-live"]')
    expect(sw.attributes('role')).toBe('switch')
    expect(sw.attributes('aria-checked')).toBe('true') // defaults to live=true
    expect(sw.attributes('aria-label')).toBeTruthy()
    await sw.trigger('click')
    expect(sw.attributes('aria-checked')).toBe('false')
  })
})

describe('close entry points', () => {
  it('clicking the close button → emits update:open(false)', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="ssv-close-btn"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('clicking Cancel → emits update:open(false)', async () => {
    const w = mountDialog({ open: true })
    await w.find('[data-test="ssv-cancel-btn"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })
})

describe('Esc closes (without submitting)', () => {
  it('pressing Esc while open:true → emits update:open(false), createSmartView not called', async () => {
    const store = usePhotosSmartViews()
    const spy = vi.spyOn(store, 'createSmartView')
    const w = mountDialog({ open: true })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(spy).not.toHaveBeenCalled()
  })

  it('pressing Esc while open:false → does not emit (document listener only mounted while open)', async () => {
    const w = mountDialog({ open: false })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })
})

// Vue2's `_onDoc` (as a whole :819-832, with the save-popover half of the criteria at
// :820-822) mousedown criterion is: "close only if neither pop nor btn contains(target)".
// Previously only Esc was implemented; this fills in close-on-outside-click plus a new
// `ignoreEl` prop to cover the trigger-button half of that criterion.
describe('outside mousedown closes', () => {
  it('clicking inside the popover → does not close', async () => {
    const w = mountDialogAttached({ open: true })
    w.get('[data-test="ssv-root"]').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    w.unmount()
  })

  it('clicking outside the popover → emits update:open(false)', async () => {
    const w = mountDialogAttached({ open: true })
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    outside.remove()
    w.unmount()
  })

  it('with ignoreEl passed, clicking inside ignoreEl → does not close (the new prop\'s main guard)', async () => {
    const triggerBtn = document.createElement('button')
    document.body.appendChild(triggerBtn)
    const w = mountDialogAttached({ open: true, ignoreEl: triggerBtn })
    triggerBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    triggerBtn.remove()
    w.unmount()
  })

  it('without ignoreEl, clicking the node that "should be" the trigger button → still closes (degraded behavior, the host must pass ignoreEl)', async () => {
    const triggerBtn = document.createElement('button')
    document.body.appendChild(triggerBtn)
    const w = mountDialogAttached({ open: true }) // 不传 ignoreEl
    triggerBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    triggerBtn.remove()
    w.unmount()
  })

  it('clicking outside while open:false → does not emit (listener only mounted while open)', async () => {
    const w = mountDialogAttached({ open: false })
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    outside.remove()
    w.unmount()
  })

  it('after the host sets open back to false, clicking outside → no longer fires (listener removed by watch(open))', async () => {
    const w = mountDialogAttached({ open: true })
    // An isolated mount doesn't automatically wire an emitted update:open back into props the
    // way a real parent/child pair would — this explicitly calls setProps to simulate the host
    // receiving the emit and genuinely setting open back to false; the listener should then be
    // removed.
    await w.setProps({ open: false })
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined() // listener already removed, won't fire again
    outside.remove()
    w.unmount()
  })

  it('unmounting removes the document listeners (both mousedown and keydown)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const w = mountDialogAttached({ open: true })
    const addedMousedown = addSpy.mock.calls.find((c) => c[0] === 'mousedown') as [string, EventListener] | undefined
    expect(addedMousedown).toBeDefined()
    w.unmount()
    expect(removeSpy).toHaveBeenCalledWith('mousedown', addedMousedown![1])
  })
})

describe('foreground color compliance: .save-pop-icon is solid accent + --on-accent', () => {
  it('positive assertion', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.save-pop-icon')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('background: var(--accent)')
    expect(rule?.body).toContain('color: var(--on-accent)')
  })

  // Previously there was zero assertion on the 28×28/9px values — changing them to
  // .sv-modal-icon's 32×32/10px still left all 23 cases green. These two sizes need to be
  // verified independently rather than assuming one implies the other, so this adds a reverse
  // anchor assertion to pin them apart and guard against a future copy-paste welding the two
  // together.
  it('.save-pop-icon size is 28×28, border-radius:9px (not .sv-modal-icon\'s 32×32/10px)', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.save-pop-icon')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 28px')
    expect(rule?.body).toContain('height: 28px')
    expect(rule?.body).toContain('border-radius: 9px')
  })
})

// This used to parse the CONDITION off the component's own scoped
// `.save-pop` rule, but that rule is deleted now (see the <style> block's own header comment) —
// it was a byte-for-byte duplicate of vue2-parity/photos.scss's own `.save-pop` (:2892-2896)
// once the wrong generic glass token names were swapped for the local ones parity actually
// uses. The positioning/z-index/size contract itself hasn't changed (Vue2's own values, still
// true), so the assertion moves to reading parity directly instead of asserting the component
// no longer has an opinion on it.
describe('.save-pop positioning contract (now owned by parity, this component no longer has its own rule)', () => {
  it('this component\'s scoped style no longer contains a .save-pop rule (fully handed over to parity)', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    expect(rules.some((r) => r.selectors.length === 1 && r.selectors[0] === '.save-pop')).toBe(false)
  })

  it('parity scss: .save-pop rule contains width: 360px / z-index: 50 / top: calc(100% + 8px) / right: 0', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find((r) => r.selectors.length === 1 && r.selectors[0] === '.save-pop')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('width: 360px')
    expect(rule?.body).toContain('z-index: 50')
    expect(rule?.body).toContain('top: calc(100% + 8px)')
    expect(rule?.body).toContain('right: 0')
  })

  // The one real bug this cleanup fixed: `.save-pop-cond`'s border used to reference
  // `var(--accent-soft-bd)`, a GLOBAL theme.css token (blue family) never locally redefined by
  // `.photos-root` — parity's own value is the Photos-local purple literal below.
  it('parity scss: .save-pop-cond border is a local purple literal (not the global --accent-soft-bd blue token)', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find((r) => r.selectors.length === 1 && r.selectors[0] === '.save-pop-cond')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('border: 1px solid rgba(110,91,255,0.3)')
    // Only checks the style block (not the whole raw source): explanatory comments in the
    // script/template areas may still mention this token name for historical context — only an
    // actual declaration inside the style block is a real problem.
    expect(extractStyleBlock(searchSaveSmartViewRaw)).not.toContain('--accent-soft-bd')
  })

  // Sweep: every scoped rule this cleanup deleted (all byte-identical duplicates of parity's
  // own bare selectors) should be gone from the component's style block, not just absent from
  // the parsed selector list (guards against a stray leftover rule under a slightly different
  // selector spelling that parseCssRules might not catch). Checked against the COMMENT-STRIPPED
  // style block, not the raw file — this file's own header comment legitimately names several
  // of these selectors in prose to explain what was removed and why; only a live declaration
  // (survives comment-stripping) counts as a regression.
  it('this component\'s style block no longer contains the selectors handed over to parity: .save-pop-body/.save-pop-field/.save-pop-label/.save-pop-input/.save-pop-conds{/.save-pop-toggle{/.save-pop-foot/.save-pop-enter-active', () => {
    const style = extractStyleBlock(searchSaveSmartViewRaw)
    const deleted = [
      /\n\.save-pop-body\s*\{/,
      /\n\.save-pop-field\s*\{/,
      /\n\.save-pop-label\s*\{/,
      /\n\.save-pop-input\s*\{/,
      /\n\.save-pop-conds\s*\{/, // does not match .save-pop-conds-empty (the hyphen continuation means it never hits `\{`)
      /\n\.save-pop-cond\s*\{/, // same as above, does not match .save-pop-conds-empty
      /\n\.save-pop-toggle\s*\{/, // does not match .save-pop-toggle-text/-label/-desc
      /\n\.save-pop-foot\s*\{/,
      /\.save-pop-enter-active/,
      /\.save-pop-leave-active/,
    ]
    for (const re of deleted) {
      expect(style, `样式块不应再匹配 ${re}`).not.toMatch(re)
    }
    // Survivors are still there.
    expect(style).toMatch(/\n\.save-pop-conds-empty\s*\{/)
    expect(style).toMatch(/\n\.save-pop-toggle-text\s*\{/)
    expect(style).toMatch(/\n\.save-pop-enter-from,/)
  })
})

// Previously there was zero assertion pinning down the glyph `d` strings for the three
// sparkles/x icons — "the svg exists" isn't enough to catch a defect like "a path got one
// character wrong during copy-paste" (the same lesson learned before: changing one character
// still left 15 cases green). Verified character-for-character against PhotosIcon.vue:21-22
// (sparkles) / :52 (x).
describe('glyph d strings', () => {
  it('the two sparkles paths (head 28×28 icon block + primary button) and the one x path (close button) have byte-correct d strings', () => {
    const sparklesD = 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1'
    const xD = 'm6 6 12 12M18 6 6 18'
    const sparklesCount = searchSaveSmartViewRaw.split(sparklesD).length - 1
    expect(sparklesCount).toBe(2) // head 图标块 + primary 按钮各一处
    expect(searchSaveSmartViewRaw).toContain(xD)
    // The sparkles' <circle> center dot is likewise verified character-for-character (the second geometry element at PhotosIcon.vue:22).
    const circleCount = searchSaveSmartViewRaw.split('<circle cx="12" cy="12" r="3" />').length - 1
    expect(circleCount).toBe(2)
  })
})

describe('hover cascade (cssCascade)', () => {
  it('.sv-btn-primary\'s winning hover rule contains :hover and -primary', () => {
    const style = extractStyleBlock(searchSaveSmartViewRaw)
    const win = winningHoverBackground(style, ['sv-btn-primary'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('-primary')
  })

  it('.sv-btn-ghost\'s winning hover rule contains :hover and -ghost', () => {
    const style = extractStyleBlock(searchSaveSmartViewRaw)
    const win = winningHoverBackground(style, ['sv-btn-ghost'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('-ghost')
  })
})

describe('save-pop transition animation (Vue3 class name -enter-from, not Vue2\'s -enter)', () => {
  // `-enter-active`/`-leave-active` is no longer asserted against
  // the component's OWN style block — that rule was a byte-identical duplicate of parity's own
  // `.save-pop-enter-active, .save-pop-leave-active` (same selector name in both Vue2 and Vue3,
  // only the non-`-active` half was renamed), so it was handed over to parity. Only
  // `-enter-from`/`-leave-to` survives locally, since parity's own rule for that half uses
  // Vue2's dead `.save-pop-enter` name and can never match a real Vue3 transition class.
  it('this component\'s style only keeps -enter-from/-leave-to (-enter-active/-leave-active handed over to parity)', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const active = rules.find((r) => r.selectors.includes('.save-pop-enter-active') || r.selectors.includes('.save-pop-leave-active'))
    expect(active, '.save-pop-enter-active/-leave-active 应已移交 parity,不应再是本组件自己的规则').toBeUndefined()

    const enterFrom = rules.find((r) => r.selectors.includes('.save-pop-enter-from') && r.selectors.includes('.save-pop-leave-to'))
    expect(enterFrom).toBeDefined()
    expect(enterFrom?.body).toContain('opacity: 0')
    expect(enterFrom?.body).toContain('translateY(-4px) scale(0.97)')

    // Reverse assertion: the bare Vue2 `.save-pop-enter {` (without the -from suffix) should
    // never appear — this is a silent-failure pitfall learned the hard way before.
    expect(searchSaveSmartViewRaw).not.toMatch(/\.save-pop-enter\s*[,{]/)
  })

  it('parity scss: .save-pop-enter-active, .save-pop-leave-active match this component\'s former values byte-for-byte', () => {
    const parityScss = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
    const rule = parseCssRules(parityScss).find(
      (r) => r.selectors.includes('.save-pop-enter-active') && r.selectors.includes('.save-pop-leave-active'),
    )
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('opacity 0.16s ease')
    expect(rule?.body).toContain('transform-origin: top right')
    expect(rule?.body).toMatch(/transform 0\.2s cubic-bezier\(0\.2,\s*0\.8,\s*0\.2,\s*1\)/)
  })

  it('the Transition component\'s name is "save-pop"', () => {
    expect(searchSaveSmartViewRaw).toContain('name="save-pop"')
  })
})

describe('.sv-switch track transition + thumb shadow (fixed before, don\'t regress)', () => {
  it('.sv-switch track background color change has a transition', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('transition: background 0.15s')
  })

  it('.sv-switch::after thumb has a shadow (color-mix, not a literal rgba)', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch::after')
    expect(rule).toBeDefined()
    expect(rule?.body).toMatch(/box-shadow:\s*0 1px 3px color-mix\(/)
  })

  it('.sv-switch size is 32×18, thumb 14×14, [data-on]::after left:16px (the effective value from photos-smartview.scss, not photos.scss:2817-2825\'s 36×20/left:18px)', () => {
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

  // Note: straight bug fix, not a deviation from Vue2 -- parity's
  // own `.photos-root .sv-switch[data-on="true"]::after` (photos-smartview.scss:786-789) only
  // moves the knob; it never overrides `background`, so Vue2's knob is the same colour in both
  // states. This file's own copy used to add `background: var(--on-accent)` here (pinned
  // to SmartViewCreateDialog.vue's then-buggy value), making the knob track state
  // instead of staying constant.
  it('.sv-switch[data-on="true"]::after does not override background (knob is the same color in both states, doesn\'t change with data-on)', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const onKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch[data-on="true"]::after')
    expect(onKnob?.body).not.toMatch(/background\s*:/)
  })

  // Follow-up: knob is invariant white across EVERY theme, not just
  // both on/off states -- the previous fix's `var(--text-1)` correctly stayed constant across on/off but is
  // itself a theme-flipping token (dark under `.photos-root.is-light`), so the actual
  // requirement ("white in both themes and both states") was still unmet. `--text-1` is no
  // longer used for the knob at all; light mode gets a paired border+shadow rule to keep a flat
  // white knob visible against its own near-white off-track.
  it('.sv-switch::after\'s knob background is literal white, not var(--text-1)', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const baseKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch::after')
    expect(baseKnob).toBeDefined()
    expect(baseKnob?.body).toMatch(/background\s*:\s*#fff\b/)
    expect(baseKnob?.body).not.toContain('var(--text-1)')
  })

  it('.photos-root.is-light .sv-switch::after gives the white knob a light-theme border + shadow, applying to both states', () => {
    const rules = parseCssRules(extractStyleBlock(searchSaveSmartViewRaw))
    const lightKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.photos-root.is-light .sv-switch::after')
    expect(lightKnob, '浅色主题下 knob 专属的描边/投影覆盖规则不存在').toBeDefined()
    expect(lightKnob?.body).toMatch(/border\s*:\s*1px solid var\(--line-strong\)/)
    expect(lightKnob?.body).toMatch(/box-shadow\s*:/)
    const onKnob = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-switch[data-on="true"]::after')
    expect(onKnob?.body).not.toMatch(/border\s*:|box-shadow\s*:/)
  })
})
