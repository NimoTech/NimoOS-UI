// ClusterActionDialog.vue — unlabeled person three-state action dialog.
// This component only collects input and emits, does not call store/toast (division of labor
// in component header comment), so we don't mock @nimotech/nimoos-service here, only inject
// i18n (using real zh_cn entries, core behavior is text interpolation itself).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import zh from '../../../i18n/zh_cn'

// This component doesn't call service itself, but the rendered PersonAvatar child does —
// follow the existing mock in PersonAvatar.test.ts.
const svc = vi.hoisted(() => ({
  photos: {
    personFaceThumbnailUrl: vi.fn((id: string | number) => `mock://face/${id}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import ClusterActionDialog from '../ClusterActionDialog.vue'
import type { Person } from '../../util/peopleView'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: 'u1',
    name: '',
    confidence: 0.87,
    count: 9,
    favorite: false,
    relation: '',
    coverFaceId: null,
    heroAssetId: null,
    firstSeen: null,
    lastSeen: null,
    placesCount: 0,
    ...overrides,
  }
}

// Each component instance's watch(open, {immediate:true}) attaches a keydown listener to
// document on mount — if the previous test doesn't unmount, it persists; the same Escape is
// then caught by multiple stale instance listeners, making stopPropagation call count
// assertions false-positive. afterEach uniformly unmounts all instances created by this file.
const mounted: VueWrapper[] = []
function mountDialog(props: { open: boolean; mode: 'name' | 'merge' | 'delete'; person: Person | null; candidates: Person[] }) {
  const w = mount(ClusterActionDialog, {
    props,
    global: { plugins: [i18n] },
    attachTo: document.body, // focus assertions need real mount into document
  })
  mounted.push(w)
  return w
}

beforeEach(() => {
  document.body.innerHTML = ''
})
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
})

describe('ClusterActionDialog.vue — three-state rendering', () => {
  it('mode=name: renders title, subtitle, label, input field; no candidate list or danger button', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    expect(w.find('[data-test="cad-title"]').text()).toBe('为这个人命名')
    expect(w.find('[data-test="cad-subtitle"]').text()).toContain('9 张照片')
    expect(w.find('[data-test="cad-subtitle"]').text()).toContain('87%')
    // Coordinator verification fix: add Vue2's <label> (per Vue2 :272, New-UI key photosPersonNameLabel).
    expect(w.find('[data-test="cad-name-label"]').text()).toBe('名称')
    expect(w.find('[data-test="cad-name-input"]').exists()).toBe(true)
    expect(w.find('[data-test="cad-save-name"]').exists()).toBe(true)
    expect(w.find('[data-test="cad-merge-input"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-confirm-delete"]').exists()).toBe(false)
  })

  // Coordinator verification fix: header avatar decoration ring — add Vue2's 2px accent-soft
  // ring (48px outer border-box, PersonAvatar body passed size=44, 44 + 2*2 = 48 for same
  // geometry). The ring's 48px/2px stroke uses a scoped CSS class; jsdom can't compute real
  // layout values, so we assert structure instead (ring node exists + inner avatar size is
  // 44, not 48).
  it('header avatar decoration ring exists; inner PersonAvatar gets size=44 (not 48)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    const ring = w.get('[data-test="cad-avatar-ring"]')
    const avatar = ring.find('.person-avatar')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('style')).toContain('width: 44px')
    expect(avatar.attributes('style')).toContain('height: 44px')
  })

  it('mode=merge: renders search box + candidate list; no main button (only cancel)', async () => {
    const w = mountDialog({
      open: true, mode: 'merge', person: person(),
      candidates: [person({ id: 'a', name: 'Amy', count: 5 })],
    })
    await w.vm.$nextTick()
    expect(w.find('[data-test="cad-title"]').text()).toBe('合并到已有人物')
    expect(w.find('[data-test="cad-merge-input"]').exists()).toBe(true)
    expect(w.find('[data-test="cad-name-input"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-save-name"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-confirm-delete"]').exists()).toBe(false)
    expect(w.findAll('[data-test="cad-cancel"]')).toHaveLength(1)
  })

  // Review required regression 1: delete mode has three different texts in three slots (header
  // title / warning card title row / warning card gray body), verify 1-to-1 against Vue2
  // :259-262 and :337-343; they must not be swapped.
  it('mode=delete: header title, warning title row + body each in place; danger confirm button; no input field', async () => {
    const w = mountDialog({ open: true, mode: 'delete', person: person(), candidates: [] })
    await w.vm.$nextTick()
    // Header title (Vue2 :262 $t('Delete face cluster')) — NOT the one in the warning card.
    expect(w.find('[data-test="cad-title"]').text()).toBe('删除这组人脸')
    // Warning card's own title row (Vue2 :341 $t('Delete this person group?')).
    expect(w.find('[data-test="cad-delete-warning-title"]').text()).toBe('删除这个人物分组？')
    // Warning card's gray small-text body (Vue2 :342-343).
    expect(w.find('[data-test="cad-delete-warning-body"]').text()).toBe(
      '照片会保留。人物分组与识别记录将被永久删除。你可以在 5 秒内撤销。',
    )
    expect(w.find('[data-test="cad-name-input"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-merge-input"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-confirm-delete"]').exists()).toBe(true)
  })
})

describe('ClusterActionDialog.vue — naming', () => {
  it('main button disabled when input is empty; not disabled after input', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    const btn = w.get<HTMLButtonElement>('[data-test="cad-save-name"]')
    expect(btn.element.disabled).toBe(true)
    await w.get('[data-test="cad-name-input"]').setValue('Sara')
    expect(btn.element.disabled).toBe(false)
  })

  it('Enter to submit → emit submit-name with trimmed value', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    const input = w.get('[data-test="cad-name-input"]')
    await input.setValue('  Sara  ')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('submit-name')).toEqual([['Sara']])
  })

  it('whitespace input on Enter does not emit (empty after trim)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    const input = w.get('[data-test="cad-name-input"]')
    await input.setValue('   ')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('submit-name')).toBeUndefined()
  })

  it('clicking save button (when not disabled) also emits submit-name', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('Lily')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    expect(w.emitted('submit-name')).toEqual([['Lily']])
  })

  it('input field gets focus automatically on open', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(w.get('[data-test="cad-name-input"]').element)
  })
})

// Task 7 (Plan D): naming with an already-existing name switches to the dupconfirm substate,
// with three actions (Merge into existing / Name anyway / Cancel), instead of directly emitting
// submit-name.
describe('ClusterActionDialog.vue — naming: duplicate-name dupconfirm', () => {
  const ADA = person({ id: 42, name: 'Ada', count: 30 })

  it('typing a name that already exists (case- and whitespace-insensitive) and saving → dupconfirm appears and submit-name is not emitted', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [ADA] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('  ada ')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    expect(w.find('[data-test="cad-dupconfirm"]').exists()).toBe(true)
    expect(w.emitted('submit-name')).toBeUndefined()
    // The regular input/action row is replaced, not stacked alongside it.
    expect(w.find('[data-test="cad-name-input"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-save-name"]').exists()).toBe(false)
  })

  it('submitting a duplicate with Enter also switches to dupconfirm (not only via the button)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [ADA] })
    await w.vm.$nextTick()
    const input = w.get('[data-test="cad-name-input"]')
    await input.setValue('Ada')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.find('[data-test="cad-dupconfirm"]').exists()).toBe(true)
  })

  it('the header title switches to the same-name-exists copy while the avatar and subtitle stay put', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person({ count: 9, confidence: 0.87 }), candidates: [ADA] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('Ada')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    expect(w.find('[data-test="cad-title"]').text()).toContain('Ada')
    expect(w.find('[data-test="cad-subtitle"]').text()).toContain('9')
    expect(w.find('[data-test="cad-subtitle"]').text()).toContain('87%')
  })

  it('a non-duplicate name → submit-name is emitted directly and no dupconfirm appears', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [ADA] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('Nobody')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    expect(w.emitted('submit-name')).toEqual([['Nobody']])
    expect(w.find('[data-test="cad-dupconfirm"]').exists()).toBe(false)
  })

  it('"Merge into existing" → emits submit-merge with the existing person id', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [ADA] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('Ada')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    await w.get('[data-test="cad-dup-merge"]').trigger('click')
    expect(w.emitted('submit-merge')).toEqual([[42]])
    expect(w.emitted('submit-name')).toBeUndefined()
  })

  it('"Name anyway" → emits submit-name with the originally typed name (after trim)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [ADA] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('  ada ')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    await w.get('[data-test="cad-dup-name-anyway"]').trigger('click')
    expect(w.emitted('submit-name')).toEqual([['ada']])
    expect(w.emitted('submit-merge')).toBeUndefined()
  })

  it('"Cancel" → closes the whole dialog (emits update:open false) rather than falling back to the plain naming state', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [ADA] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('Ada')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    await w.get('[data-test="cad-dup-cancel"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('reopening the dialog clears the dupconfirm state (it never reappears carrying the previous sub-state)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [ADA] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-name-input"]').setValue('Ada')
    await w.get('[data-test="cad-save-name"]').trigger('click')
    expect(w.find('[data-test="cad-dupconfirm"]').exists()).toBe(true)

    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await w.vm.$nextTick()
    expect(w.find('[data-test="cad-dupconfirm"]').exists()).toBe(false)
    expect(w.find('[data-test="cad-name-input"]').exists()).toBe(true)
  })
})

describe('ClusterActionDialog.vue — merging', () => {
  // 7 non-self candidates: verify "empty query takes first 6, by count descending, tie-break
  // by name ascending"
  const SELF = person({ id: 'u1', name: '' })
  const CANDIDATES_SORT = [
    SELF, // must be excluded even if count is highest
    person({ id: 'zoe', name: 'Zoe', count: 10 }),
    person({ id: 'amy', name: 'Amy', count: 10 }), // same count as Zoe, name ascending should rank first
    person({ id: 'bob', name: 'Bob', count: 8 }),
    person({ id: 'cara', name: 'Cara', count: 6 }),
    person({ id: 'dan', name: 'Dan', count: 5 }),
    person({ id: 'eve', name: 'Eve', count: 3 }),
    person({ id: 'fay', name: 'Fay', count: 1 }), // 7th entry, should be cut off by 6-item limit
  ]

  it('empty query → at most 6, exclude self, sort by count descending, tie-break by name ascending', async () => {
    const w = mountDialog({ open: true, mode: 'merge', person: SELF, candidates: CANDIDATES_SORT })
    await w.vm.$nextTick()
    const ids = w.findAll('[data-test="cad-candidate"]').map((n) => n.attributes('data-id'))
    expect(ids).toEqual(['amy', 'zoe', 'bob', 'cara', 'dan', 'eve'])
  })

  it('search "al" → only candidates with "al" in name (lowercase includes), at most 8', async () => {
    const many = Array.from({ length: 9 }, (_, i) => person({ id: `alice${i}`, name: `Alice${i}`, count: 9 - i }))
    const noMatch = person({ id: 'frank', name: 'Frank', count: 50 })
    const w = mountDialog({ open: true, mode: 'merge', person: SELF, candidates: [...many, noMatch] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-merge-input"]').setValue('al')
    const cards = w.findAll('[data-test="cad-candidate"]')
    expect(cards).toHaveLength(8)
    expect(cards.map((n) => n.attributes('data-id'))).not.toContain('frank')
  })

  it('click candidate → emit submit-merge with that id; no separate confirm button', async () => {
    const w = mountDialog({
      open: true, mode: 'merge', person: SELF,
      candidates: [person({ id: 'amy', name: 'Amy', count: 5 })],
    })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-candidate"]').trigger('click')
    expect(w.emitted('submit-merge')).toEqual([['amy']])
  })

  it('numeric id candidate click → emit original numeric id (no String conversion)', async () => {
    const w = mountDialog({
      open: true, mode: 'merge', person: SELF,
      candidates: [person({ id: 42, name: 'Alice', count: 5 })],
    })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-candidate"]').trigger('click')
    expect(w.emitted('submit-merge')).toEqual([[42]])
  })

  it('no match → empty state text', async () => {
    const w = mountDialog({
      open: true, mode: 'merge', person: SELF,
      candidates: [person({ id: 'amy', name: 'Amy', count: 5 })],
    })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-merge-input"]').setValue('zzz-no-match')
    expect(w.find('[data-test="cad-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="cad-empty"]').text()).toBe('没有匹配的人物')
  })

  it('search field gets focus automatically on open', async () => {
    const w = mountDialog({ open: true, mode: 'merge', person: SELF, candidates: [] })
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(w.get('[data-test="cad-merge-input"]').element)
  })
})

describe('ClusterActionDialog.vue — deletion', () => {
  it('click danger button → emit submit-delete', async () => {
    const w = mountDialog({ open: true, mode: 'delete', person: person(), candidates: [] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-confirm-delete"]').trigger('click')
    expect(w.emitted('submit-delete')).toEqual([[]])
  })
})

describe('ClusterActionDialog.vue — close interaction', () => {
  it('click overlay (not panel itself) → emit update:open(false)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-overlay"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('click panel itself does not close (click.self only handles overlay itself)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-panel"]').trigger('click')
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('click close button → emit update:open(false)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-close"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('click cancel → emit update:open(false)', async () => {
    const w = mountDialog({ open: true, mode: 'delete', person: person(), candidates: [] })
    await w.vm.$nextTick()
    await w.get('[data-test="cad-cancel"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  // Document-level dispatch (bubbles:true) — can't just .trigger('keydown') on the panel or input
  // element, that won't test the real scenario "Esc closes even when focus is outside panel"
  // (P4 false-positive lesson: document-dispatched events don't bubble by default; without
  // explicit bubbles:true you get a false pass).
  it('press Esc (document-level dispatch, bubbles:true) → emit update:open(false)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('Esc branch calls stopPropagation (spy assertion)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    const spy = vi.spyOn(evt, 'stopPropagation')
    document.dispatchEvent(evt)
    await w.vm.$nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('non-Escape key does not trigger close, does not call stopPropagation', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    const evt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    const spy = vi.spyOn(evt, 'stopPropagation')
    document.dispatchEvent(evt)
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
  })

  it('after panel closes (open===false), Esc has no effect (listener removed)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('after unmount, document keydown listener is cleanly removed (compare function refs)', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    const added = addSpy.mock.calls.find((c) => c[0] === 'keydown') as [string, EventListener] | undefined
    expect(added).toBeDefined()
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    expect(removeSpy).toHaveBeenCalledWith('keydown', added![1])
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

// This file used to have a set of tests for "the hover
// state's background doesn't get stolen by the base class's rule", reading the component's own
// <style scoped> source via `?raw` and asserting, using ./cssCascade's small CSS-priority
// calculator, which background declaration actually wins on hover. The component's entire
// <style scoped> block was deleted (the class names are unchanged, but styling authority
// has moved to the .cad-* parity rules in src/photos/styles/vue2-parity/photos-people.scss — see
// the component's own script-header comment), so the source read in via `?raw` no longer has a
// <style> block to extract, and that test group's precondition no longer holds — deleted along
// with it. All that's pinned down here is one thing: the component's root class name is unaffected.
//
// The old comment above used to also say "once scoped is
// entirely zeroed out this can't recur, parity's own internal declaration order is correct as
// is" — **that sentence was wrong, and has been deleted.** The CSS cascade decides a winner per
// property, not per rule as a whole: `.cad-btn:hover { background: var(--surface-3); ... }` and
// `.cad-btn-danger:hover { filter: brightness(1.08); }` (before the fix) tie in specificity
// (0,2,0) — even though parity's own `.cad-btn-danger:hover` is written after `.cad-btn:hover` in
// the file, as long as it doesn't re-declare background itself, that property has no competing
// declaration from the variant rule at all, so `.cad-btn:hover`'s background still wins — the
// scoped version's bug reappeared wearing a different face, reproduced as-is inside parity (the
// delete-confirm button data-test="cad-confirm-delete" lost its danger tone on hover). What
// actually prevents this from recurring isn't "delete the local scoped block" by itself, it's
// "every variant's hover rule must re-declare background itself" — the test group below reads the
// parity file directly and asserts against that requirement rule-by-rule, no longer depending on
// whether the component's local scoped block has been deleted.
describe('ClusterActionDialog.vue — the root class names survive the scoped-style removal', () => {
  it('after mounting, [data-test="cad-overlay"] still carries the cad-overlay class (the class-name rework only touched PhotosPersonDetail.vue pd-*, not this component)', async () => {
    const w = mountDialog({ open: true, mode: 'name', person: person(), candidates: [] })
    await w.vm.$nextTick()
    expect(w.find('[data-test="cad-overlay"]').classes()).toContain('cad-overlay')
    expect(w.find('[data-test="cad-panel"]').classes()).toContain('cad-panel')
  })
})

// ── the delete-confirm button hover
// regression guard ──────────
//
// jsdom neither computes the CSS cascade nor can enter a real hover state, and the real source of
// styling now lives outside this component file entirely (the whole <style scoped> block is
// deleted, all the class-name rules moved into photos-people.scss), so this test group reads the
// parity file's own raw text via node:fs and pulls the rule body by selector (the same read-off-
// disk approach already established by AppToast.zIndex.test.ts), rather than going through
// ./cssCascade's older approach of "extract <style> from the component via ?raw, then compute
// priority". The selectors here are all simple top-level class/pseudo-class combinations with no
// nesting, so a one-shot regex pulling the rule body by "selector name { brace contents }" is
// already precise enough — no need to bring in a full CSS parser.
const PARITY_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../styles/vue2-parity/photos-people.scss',
)
const parityCss = readFileSync(PARITY_PATH, 'utf8')

/** Precisely pulls one rule's brace contents by selector name (safe enough for simple button
 *  rules with no nested braces). */
function parityRuleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(parityCss)
  if (!m) throw new Error(`Rule not found in parity file: ${selector}`)
  return m[1]
}

function backgroundOf(body: string): string | null {
  const m = /background\s*:\s*([^;]+)/.exec(body)
  return m ? m[1].trim() : null
}

describe('ClusterActionDialog.vue — in parity, a variant button hover background is not stolen by .cad-btn:hover', () => {
  it('.cad-btn-danger:hover must re-declare background itself (otherwise the base class .cad-btn:hover var(--surface-3) takes that property, regressing the fixed bug)', () => {
    const baseBg = backgroundOf(parityRuleBody('.cad-btn:hover'))
    const dangerHoverBg = backgroundOf(parityRuleBody('.cad-btn-danger:hover'))
    const dangerBaseBg = backgroundOf(parityRuleBody('.cad-btn-danger'))
    expect(baseBg).toBe('var(--surface-3)')
    expect(dangerHoverBg, '.cad-btn-danger:hover has no background declaration — by the CSS cascade the base class .cad-btn:hover background wins on that property').not.toBeNull()
    // The value must match its own resting state (Vue2 uses an inline style, so the background
    // never actually changes on hover — see the component's own comment about this); it can't
    // just be "non-null, whatever it is".
    expect(dangerHoverBg).toBe(dangerBaseBg)
    expect(dangerHoverBg).not.toBe(baseBg)
  })

  it('.cad-btn-primary:hover already re-declares background correctly (a regression guard — verified unaffected this round, do not drop it in later changes)', () => {
    const baseBg = backgroundOf(parityRuleBody('.cad-btn:hover'))
    const primaryHoverBg = backgroundOf(parityRuleBody('.cad-btn-primary:hover'))
    expect(primaryHoverBg).not.toBeNull()
    expect(primaryHoverBg).not.toBe(baseBg)
  })
})
