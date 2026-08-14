// Task 7 (SP7-P5 People): ClusterActionDialog.vue — unlabeled person three-state action dialog.
// This component only collects input and emits, does not call store/toast (division of labor
// in component header comment), so we don't mock @nimotech/nimoos-service here, only inject
// i18n (using real zh_cn entries, core behavior is text interpolation itself).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
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
// Raw source text (Vite `?raw`), only for end-of-file test group
// "hover background not overridden by base class rules" — jsdom neither calculates cascading
// styles nor enters real hover state, so we parse the <style> raw text and judge by CSS
// specificity ourselves (following precedent in PersonAssetGrid.test.ts:210-243).
import clusterActionDialogRaw from '../ClusterActionDialog.vue?raw'
import { extractStyleBlock, ownBackground, winningHoverBackground } from './cssCascade'
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

// ── hover background not overridden by base class rules (found on device: delete confirm
// button turns completely white on hover)──
//
// Bug mechanism: two variant classes (`.cad-btn-danger` / `.cad-btn-primary`) and base
// `.cad-btn` are on the same <button>. Base `.cad-btn:hover` has a pseudo-class, specificity
// (0,2,0); variant rules have just one class, specificity (0,1,0). Higher specificity wins
// regardless of source order; when the cursor enters the button, the variant's solid or
// gradient background is replaced entirely by base's `var(--chip-bg-hi)` (light theme
// #f2efe7 off-white, dark theme near-white semi-transparent gradient), but text color
// `#fff` / `var(--on-accent)` still comes from variant — white-on-white, button and text
// both vanish.
//
// This test group doesn't assert "what the fix looks like", instead it calculates the
// actual winning background declaration under hover using CSS specificity (helper in
// ./cssCascade.ts), then asserts it belongs to the variant rule — any approach that re-applies
// the variant background passes, but giving hover background back to base fails red. Detail
// page PhotosPersonDetail.vue:1142/1151 already has the correct pattern (variant supplies
// its own :hover background).

describe('ClusterActionDialog.vue — variant button background not stolen by .cad-btn:hover on hover', () => {
  const styleText = extractStyleBlock(clusterActionDialogRaw)

  it('delete button hover: effective background is still danger red gradient, not --chip-bg-hi', () => {
    const win = winningHoverBackground(styleText, ['cad-btn', 'cad-btn-danger'])
    expect(win.value).toContain('--remove-')
    expect(win.value).not.toContain('--chip-bg-hi')
  })

  it('primary action button hover: effective background is still --accent, not --chip-bg-hi', () => {
    const win = winningHoverBackground(styleText, ['cad-btn', 'cad-btn-primary'])
    expect(win.value).toContain('--accent')
    expect(win.value).not.toContain('--chip-bg-hi')
  })

  // Delete button hover background is the base gradient repeated verbatim (no local alias
  // variable introduced, see comment in component). This assertion pins both places to stay
  // in sync: change base gradient but forget hover → red test.
  it('delete button hover background matches base background verbatim (prevent drift in two places)', () => {
    const base = ownBackground(styleText, '.cad-btn-danger')
    const hover = winningHoverBackground(styleText, ['cad-btn', 'cad-btn-danger']).value
    expect(hover).toBe(base)
  })

  it('cancel button (base class only) on hover should get --chip-bg-hi', () => {
    const win = winningHoverBackground(styleText, ['cad-btn'])
    expect(win.value).toContain('--chip-bg-hi')
  })
})
