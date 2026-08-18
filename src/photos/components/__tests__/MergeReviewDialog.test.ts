// Task 8 (SP7-P5 People): MergeReviewDialog.vue — merge suggestion review dialog.
// Test per Vue2 PhotosPeopleView.vue:364-434 (template): count/confidence, asymmetric
// name lookup across two columns, reject/accept button emits, primary button text
// switching per intoName presence, square avatars (T5 additive extension), Esc close.
// index/suggestions clamping logic is not tested here — that is the parent component's
// (PhotosPeople.vue) responsibility; this component only emits (see component header).
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
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

  it('Esc (document level, bubbles:true) → emits update:open(false) and stopPropagation prevents further bubbling to window', () => {
    // Document-level bubble's next stop is window (as in AlbumPickerDialog.vue:70-100
    // lightbox example with listener on window) — placing spy on document cannot
    // verify stopPropagation, since other listeners on the same target are unaffected;
    // only "further bubbling to parent" gets blocked.
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    const windowSpy = vi.fn()
    window.addEventListener('keydown', windowSpy)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(windowSpy).not.toHaveBeenCalled()
    window.removeEventListener('keydown', windowSpy)
  })

  it('does not render when open=false; also does not render when index is out of bounds (suggestions empty), no crash', () => {
    const w = mountDialog({ open: false, suggestions, index: 0, people })
    expect(w.find('[data-test="mrd-overlay"]').exists()).toBe(false)

    const w2 = mountDialog({ open: true, suggestions: [], index: 0, people })
    expect(w2.find('[data-test="mrd-overlay"]').exists()).toBe(false)
  })

  it('after close (open=false → listener removed) Esc no longer triggers emit (regression: uncleaned listeners would fire repeatedly)', async () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    await w.setProps({ open: false })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(w.emitted('update:open')).toBeUndefined()
  })
})

// Plan D Task 4 (scoped zeroed out): this file used to have a set of tests for "the hover state's
// background doesn't get stolen by the base class's rule", reading the component's own
// <style scoped> source via `?raw` and asserting, using ./cssCascade's small CSS-priority
// calculator, which background declaration actually wins on hover (the same priority pitfall as
// ClusterActionDialog.test.ts — a full-repo scan at the time found only these two spots). This
// task deleted the component's entire <style scoped> block (the class names are unchanged, but
// styling authority has moved to the .mrd-* parity rules in
// src/photos/styles/vue2-parity/photos-people.scss — see the component's own script-header
// comment), so the source read in via `?raw` no longer has a <style> block to extract, and that
// test group's precondition no longer holds — deleted along with it. All that's pinned down here
// is one thing: the component's root class name is unaffected.
//
// Fix round 1 (final-review Important, corrected alongside the same spot in
// ClusterActionDialog.test.ts): the old comment above used to also say "once scoped is entirely
// zeroed out this can't recur, parity's own internal declaration order is correct as is" — **that
// sentence was wrong, and has been deleted.** The CSS cascade decides a winner per property, not
// per rule as a whole: even when parity's file writes a variant rule after the base class, as
// long as the variant's :hover doesn't re-declare some property itself, that property has no
// competing declaration from the variant at all, and the base class's value still wins.
// ClusterActionDialog's own `.cad-btn-danger:hover` reproduced the bug this way, unchanged, inside
// parity (see that test file's own comment at the same spot); on the MRD side, `.mrd-btn-primary:
// hover` was checked and has always had its own background, so it wasn't affected — but a
// regression assertion is still added here to stop it from being casually removed later.
describe('MergeReviewDialog.vue — Plan D Task 4: the root class names survive the scoped-style removal', () => {
  it('after mounting, [data-test="mrd-overlay"] still carries the mrd-overlay class (the class-name rework only touched PhotosPersonDetail.vue pd-*, not this component)', () => {
    const w = mountDialog({ open: true, suggestions, index: 0, people })
    expect(w.find('[data-test="mrd-overlay"]').classes()).toContain('mrd-overlay')
    expect(w.find('[data-test="mrd-panel"]').classes()).toContain('mrd-panel')
  })
})

// ── Plan D Task 4, fix round 1 (final-review Important): the merge-button hover regression
// guard ────────────
// The same approach as ClusterActionDialog.test.ts's own test group: reads the parity file's raw
// text directly via node:fs, pulls the rule body by selector name (the same read-off-disk
// approach already established by AppToast.zIndex.test.ts).
const PARITY_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../styles/vue2-parity/photos-people.scss',
)
const parityCss = readFileSync(PARITY_PATH, 'utf8')

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

describe('MergeReviewDialog.vue — Plan D Task 4 fix round 1: in parity, the merge button hover background is not stolen by .mrd-btn:hover', () => {
  it('.mrd-btn-primary:hover must re-declare background itself (otherwise the base class .mrd-btn:hover var(--surface-3) takes that property — the same class of bug fixed in ClusterActionDialog, verified unaffected here)', () => {
    const baseBg = backgroundOf(parityRuleBody('.mrd-btn:hover'))
    const primaryHoverBg = backgroundOf(parityRuleBody('.mrd-btn-primary:hover'))
    expect(baseBg).toBe('var(--surface-3)')
    expect(primaryHoverBg, '.mrd-btn-primary:hover has no background declaration — by the CSS cascade the base class .mrd-btn:hover background wins on that property').not.toBeNull()
    expect(primaryHoverBg).not.toBe(baseBg)
  })
})
