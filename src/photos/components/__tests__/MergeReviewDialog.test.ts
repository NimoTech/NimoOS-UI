// Task 8 (SP7-P5 People): MergeReviewDialog.vue — merge suggestion review dialog.
// Test per Vue2 PhotosPeopleView.vue:364-434 (template): count/confidence, asymmetric
// name lookup across two columns, reject/accept button emits, primary button text
// switching per intoName presence, square avatars (T5 additive extension), Esc close.
// index/suggestions clamping logic is not tested here — that is the parent component's
// (PhotosPeople.vue) responsibility; this component only emits (see component header).
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zhCn from '../../../i18n/zh_cn'
import enUs from '../../../i18n/en_us'
import type { Person } from '../../util/peopleView'

const svc = vi.hoisted(() => ({
  photos: {
    personFaceThumbnailUrl: vi.fn(
      (id: string | number, ver?: string | number | null) =>
        `mock://face/${id}${ver != null && ver !== '' ? `?v=${ver}` : ''}`,
    ),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import MergeReviewDialog, { type MergeSuggestion } from '../MergeReviewDialog.vue'
// Raw source text (Vite `?raw`) + cascade helpers: jsdom neither computes cascade
// styles nor enters real hover state, so we must parse the raw <style> block and
// judge CSS precedence ourselves. Mechanism is identical to ClusterActionDialog.test.ts.
import mergeReviewDialogRaw from '../MergeReviewDialog.vue?raw'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'

const i18n = createI18n({
  legacy: false,
  locale: 'zh_cn',
  messages: { zh_cn: zhCn, en_us: enUs },
})

function makePerson(over: Partial<Person> = {}): Person {
  return {
    id: 'p1', name: 'Alice', confidence: 0.9, count: 3, favorite: false,
    relation: '', coverFaceId: null, heroAssetId: null, firstSeen: null, lastSeen: null,
    placesCount: 0, ...over,
  }
}

function mountDialog(props: {
  open: boolean
  suggestions: MergeSuggestion[]
  index: number
  people: Person[]
}) {
  return mount(MergeReviewDialog, { props, global: { plugins: [i18n] } })
}

// Core test data: the name of people[fromId] is "Old Name From List" (looked up),
// while intoName is "Snapshot Name" from the suggestion — intentionally different
// to prove left/right columns take two different code paths (brief explicitly
// requires copying this asymmetry; it is not an oversight).
const suggestions: MergeSuggestion[] = [
  { id: 's1', fromId: 'p1', intoId: 'p2', intoName: 'Snapshot Name', confidence: 0.87 },
  { id: 's2', fromId: 'p3', intoId: 'p4', confidence: 0.6 },
  { id: 's3', fromId: 'p5', intoId: 'p6', intoName: 'Third', confidence: 0.5 },
]
const people: Person[] = [
  makePerson({ id: 'p1', name: 'Old Name From List', coverFaceId: 'face-1' }),
  makePerson({ id: 'p2', name: 'Current Name In List (stale vs intoName)', coverFaceId: 'face-2' }),
]

describe('MergeReviewDialog', () => {
  it('renders index/total count and confidence percentage', () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    expect(w.get('[data-test="mrd-title"]').text()).toBe('可能的合并 1 / 3')
    expect(w.get('[data-test="mrd-confidence"]').text()).toBe('置信度 87%')
  })

  it('index/total changes with index prop (second suggestion is 2 / 3)', () => {
    const w = mountDialog({ open: true, suggestions, index: 1, people })
    expect(w.get('[data-test="mrd-title"]').text()).toBe('可能的合并 2 / 3')
  })

  it('fidelity assertion: left side looks up name from people (via PersonAvatar \
name prop affecting initial fallback), right side uses intoName directly; \
different values prove they take different code paths', () => {
    // Both sides have no real avatar (mock URL returns a value, but we want to
    // see the fallback initial), so force img error to trigger fallback, then
    // compare whether initials come from people lookup vs intoName respectively.
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    const fromImgs = w.get('[data-test="mrd-side-from"]').findAll('[data-test="avatar-img"]')
    const intoImgs = w.get('[data-test="mrd-side-into"]').findAll('[data-test="avatar-img"]')
    expect(fromImgs).toHaveLength(1)
    expect(intoImgs).toHaveLength(1)
    return Promise.all([fromImgs[0].trigger('error'), intoImgs[0].trigger('error')]).then(() => {
      // Left side: people[p1].name is 'Old Name From List' → initial 'O'
      expect(w.get('[data-test="mrd-side-from"] [data-test="avatar-initial"]').text()).toBe('O')
      // Right side: suggestion.intoName is 'Snapshot Name' → initial 'S' (not people[p2]'s 'C')
      expect(w.get('[data-test="mrd-side-into"] [data-test="avatar-initial"]').text()).toBe('S')
    })
  })

  it('left side defaults to empty string when fromId not found in people (no crash, same as Vue2 `|| ""`)', async () => {
    const w = mountDialog({ open: true, suggestions: [suggestions[1]], index: 0, people: [] })
    // suggestions[1] has no intoName, and fromId=p3 is not in people → both sides'
    // names collapse to empty string. personId itself is non-empty (p3/p4), so
    // PersonAvatar's first fallback level still tries real image first, then
    // falls through to 'personInitial("") === "" → person icon' after error.
    await w.get('[data-test="mrd-side-from"] [data-test="avatar-img"]').trigger('error')
    await w.get('[data-test="mrd-side-into"] [data-test="avatar-img"]').trigger('error')
    expect(w.find('[data-test="mrd-side-from"] [data-test="avatar-icon"]').exists()).toBe(true)
    expect(w.find('[data-test="mrd-side-into"] [data-test="avatar-icon"]').exists()).toBe(true)
  })

  it('avatars on both sides are square (shape=square, verify T5 additive extension works)', () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    const avatars = w.findAll('.person-avatar')
    expect(avatars).toHaveLength(2)
    for (const a of avatars) expect(a.classes()).toContain('is-square')
  })

  it('clicking "Not a match" → emits reject with current suggestion id', async () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    await w.get('[data-test="mrd-reject"]').trigger('click')
    expect(w.emitted('reject')).toEqual([['s1']])
    expect(w.emitted('accept')).toBeUndefined()
  })

  it('clicking primary button → emits accept with current suggestion id', async () => {
    const w = mountDialog({ open: true, suggestions, index: 1, people })
    await w.get('[data-test="mrd-accept"]').trigger('click')
    expect(w.emitted('accept')).toEqual([['s2']])
    expect(w.emitted('reject')).toBeUndefined()
  })

  it('primary button text: when intoName exists → "Merge as {name}"', () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    expect(w.get('[data-test="mrd-accept"]').text()).toContain('合并为 Snapshot Name')
  })

  it('primary button text: when intoName missing → use "Same person" fallback', () => {
    const w = mountDialog({ open: true, suggestions, index: 1, people })
    expect(w.get('[data-test="mrd-accept"]').text()).toContain('合并为 同一个人')
  })

  it('clicking overlay (click.self) → emits update:open(false)', async () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    await w.get('[data-test="mrd-overlay"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('clicking close button → emits update:open(false)', async () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    await w.get('[data-test="mrd-close"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('Esc(document 级,bubbles:true)→ emit update:open(false),且 stopPropagation 挡住继续向上冒泡到 window', () => {
    // document 冒泡的下一站是 window(同 AlbumPickerDialog.vue:70-100 先例里灯箱在 window
    // 上挂监听的场景)——把 spy 放在 document 上不能验证 stopPropagation,因为同一 target
    // 上的其它监听器不受 stopPropagation 影响,只有「继续向上冒泡到父级」才会被挡。
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    const windowSpy = vi.fn()
    window.addEventListener('keydown', windowSpy)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(windowSpy).not.toHaveBeenCalled()
    window.removeEventListener('keydown', windowSpy)
  })

  it('open=false 时不渲染;index 越界(suggestions 已空)时也不渲染,不崩', () => {
    const w = mountDialog({ open: false, suggestions, index: 0, people })
    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(false)

    const w2 = mountDialog({ open: true, suggestions: [], index: 0, people })
    expect(w2.find('[data-test="mrd-overlay"]').exists()).toBe(false)
  })

  it('关闭后(open=false→拆掉监听)Esc 不再触发 emit(回归:监听没摘干净会重复触发)', async () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    await w.setProps({ open: false })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(w.emitted('update:open')).toBeUndefined()
  })
})

// 与 ClusterActionDialog 同款的优先级坑(全仓扫描只余这一处):基类 `.mrd-btn:hover`
// 带伪类 (0,2,0),压过只有一个类的 `.mrd-btn-primary` (0,1,0),hover 时把 accent 实底
// 换成近白的 --chip-bg-hi,文字仍是 --on-accent → 「合并」键整颗看不见。原来的
// `.mrd-btn-primary:hover` 里只有 filter、没有 background,所以拦不住。
describe('MergeReviewDialog.vue — hover 态下主行动键的背景不被 .mrd-btn:hover 夺走', () => {
  const styleText = extractStyleBlock(mergeReviewDialogRaw)

  it('合并键 hover 时生效的 background 仍是 --accent,不是 --chip-bg-hi', () => {
    const win = winningHoverBackground(styleText, ['mrd-btn', 'mrd-btn-primary'])
    expect(win.value).toContain('--accent')
    expect(win.value).not.toContain('--chip-bg-hi')
  })

  it('「不是同一个人」键(只有基类)hover 时才该拿到 --chip-bg-hi', () => {
    const win = winningHoverBackground(styleText, ['mrd-btn'])
    expect(win.value).toContain('--chip-bg-hi')
  })
})
