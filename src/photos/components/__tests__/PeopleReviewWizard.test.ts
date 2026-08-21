// PeopleReviewWizard.vue (people-confirm-polish, 2026-08-21) — the full-screen sequential review
// wizard that replaces the old per-group suggestion card grid + peek overlay in PhotosPeople.vue.
// This component owns its own store interaction (see its header comment for the division-of-
// labor rationale), so — unlike ClusterActionDialog.test.ts's own sibling comment, which mocks
// nothing but the rendered PersonAvatar's dependency — this file DOES seed a real Pinia store via
// fetchSuggestions(), mirroring PhotosPeople.suggestions.test.ts's own mounting convention.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    personFaceThumbnailUrl: vi.fn((id: string | number, ver?: string | number | null) => `mock://person-face/${id}/${ver ?? ''}`),
    faceThumbnailUrl: vi.fn((faceId: string) => `mock://face/${faceId}`),
    thumbnailUrl: vi.fn((id: string | number, size = 'small') => `mock://thumb/${id}/${size}`),
    listPersons: vi.fn().mockResolvedValue({ persons: [], facesIndexedUpTo: null }),
    listPersonSuggestions: vi.fn().mockResolvedValue({ groups: [] }),
    acceptPersonSuggestion: vi.fn().mockResolvedValue({ id: 's1', status: 'accepted' }),
    rejectPersonSuggestion: vi.fn().mockResolvedValue({ id: 's1', status: 'rejected' }),
    // Merge-cards feature (2026-08-21): cluster-merge questions, joining the review queue after
    // the face suggestions above.
    listMergeQuestions: vi.fn().mockResolvedValue({ pairs: [] }),
    acceptMergeQuestion: vi.fn().mockResolvedValue({ id: 'mq1', status: 'accepted' }),
    rejectMergeQuestion: vi.fn().mockResolvedValue({ id: 'mq1', status: 'rejected' }),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PeopleReviewWizard from '../PeopleReviewWizard.vue'
import { usePhotosPeople } from '../../stores/people'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function rawPerson(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'p1', name: 'Alice', confidence: 0.9, count: 5, favorite: false, relation: '',
    coverFaceId: 'cf1', heroAssetId: null, firstSeen: null, lastSeen: null, placesCount: 0,
    ...over,
  }
}
function rawSuggestion(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 's1', faceId: 'f1', assetId: 'a1', kind: 'join', score: 0.5, ...over }
}
function rawGroup(person: Record<string, unknown>, suggestions: Array<Record<string, unknown>>): Record<string, unknown> {
  return { person, suggestions }
}

const mounted: VueWrapper[] = []
function mountWizard(open = true) {
  const w = mount(PeopleReviewWizard, { props: { open }, global: { plugins: [i18n] } })
  mounted.push(w)
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.personFaceThumbnailUrl.mockClear()
  svc.photos.faceThumbnailUrl.mockClear()
  svc.photos.thumbnailUrl.mockClear()
  svc.photos.listPersons.mockClear().mockResolvedValue({ persons: [], facesIndexedUpTo: null })
  svc.photos.listPersonSuggestions.mockClear().mockResolvedValue({ groups: [] })
  svc.photos.acceptPersonSuggestion.mockClear().mockResolvedValue({ id: 's1', status: 'accepted' })
  svc.photos.rejectPersonSuggestion.mockClear().mockResolvedValue({ id: 's1', status: 'rejected' })
  svc.photos.listMergeQuestions.mockClear().mockResolvedValue({ pairs: [] })
  svc.photos.acceptMergeQuestion.mockClear().mockResolvedValue({ id: 'mq1', status: 'accepted' })
  svc.photos.rejectMergeQuestion.mockClear().mockResolvedValue({ id: 'mq1', status: 'rejected' })
})
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
  usePhotosPeople().__resetForTest()
})

async function seed(groups: Array<Record<string, unknown>>) {
  svc.photos.listPersonSuggestions.mockResolvedValueOnce({ groups })
  const store = usePhotosPeople()
  await store.fetchSuggestions()
  return store
}

// Merge-cards feature (2026-08-21).
function rawPair(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'mq1',
    dist: 0.42,
    from: rawPerson({ id: 'pA', name: '', coverFaceId: null }),
    into: rawPerson({ id: 'pB', name: 'Bob', count: 20, coverFaceId: 'cf-b' }),
    fromFaceIds: ['ff1', 'ff2'],
    intoFaceIds: ['if1', 'if2'],
    ...over,
  }
}
async function seedMerge(pairs: Array<Record<string, unknown>>) {
  svc.photos.listMergeQuestions.mockResolvedValueOnce({ pairs })
  const store = usePhotosPeople()
  await store.fetchMergeQuestions()
  return store
}

describe('PeopleReviewWizard.vue — open/closed', () => {
  it('renders nothing when open=false', async () => {
    await seed([rawGroup(rawPerson(), [rawSuggestion()])])
    const w = mountWizard(false)
    expect(w.find('[data-test="prw-overlay"]').exists()).toBe(false)
  })

  it('renders the overlay when open=true', async () => {
    await seed([rawGroup(rawPerson(), [rawSuggestion()])])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-overlay"]').exists()).toBe(true)
  })

  it('the close button emits update:open(false)', async () => {
    await seed([rawGroup(rawPerson(), [rawSuggestion()])])
    const w = mountWizard(true)
    await w.find('[data-test="prw-close"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('Escape emits update:open(false)', async () => {
    await seed([rawGroup(rawPerson(), [rawSuggestion()])])
    const w = mountWizard(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('clicking the backdrop (not the panel) emits update:open(false)', async () => {
    await seed([rawGroup(rawPerson(), [rawSuggestion()])])
    const w = mountWizard(true)
    await w.find('[data-test="prw-overlay"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })
})

describe('PeopleReviewWizard.vue — pattern ① default view', () => {
  it('shows the context photo and the face-crop inset for the current suggestion', async () => {
    await seed([rawGroup(rawPerson(), [rawSuggestion({ id: 's1', faceId: 'f1', assetId: 'a1' })])])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-body-original"]').exists()).toBe(true)
    expect(w.find('[data-test="prw-context-photo"] img').attributes('src')).toBe('mock://thumb/a1/large')
    expect(w.find('[data-test="prw-inset-face"]').attributes('src')).toBe('mock://face/f1')
  })

  it('the question line and person name reflect the current suggestion\'s person', async () => {
    await seed([rawGroup(rawPerson({ name: 'Alice' }), [rawSuggestion()])])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-person-name"]').text()).toBe('Alice')
    expect(w.find('[data-test="prw-question"]').text()).toBe(zh.photosPeopleSuggestTitle.replace('{name}', 'Alice'))
  })

  it('an unnamed person falls back to the Unnamed-person copy', async () => {
    await seed([rawGroup(rawPerson({ name: '' }), [rawSuggestion()])])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-person-name"]').text()).toBe(zh.photosPersonUnnamedTitle)
  })
})

describe('PeopleReviewWizard.vue — exemplarFaceIds (reference faces)', () => {
  it('present — renders up to 5 reference-face thumbnails', async () => {
    await seed([rawGroup(rawPerson({ exemplarFaceIds: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'] }), [rawSuggestion()])])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-reference"]').exists()).toBe(true)
    expect(w.findAll('.prw-reference-thumb')).toHaveLength(5)
  })

  it('absent (older backend) — no reference row, no crash', async () => {
    await seed([rawGroup(rawPerson(), [rawSuggestion()])])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-reference"]').exists()).toBe(false)
    expect(w.find('[data-test="prw-header"]').exists()).toBe(true) // cover avatar still renders fine
  })

  // Fast-follow (review minor): the backend contract excludes coverFaceId from exemplarFaceIds,
  // but the header already renders that face via PersonAvatar right next to this row — the
  // component defensively dedupes it too, so a future backend regression can't double-render it.
  it('a coverFaceId that leaks into exemplarFaceIds is deduped — renders once, not twice', async () => {
    await seed([rawGroup(rawPerson({ coverFaceId: 'cf1', exemplarFaceIds: ['cf1', 'e2', 'e3'] }), [rawSuggestion()])])
    const w = mountWizard(true)
    const srcs = w.findAll('.prw-reference-thumb').map((img) => img.attributes('src'))
    expect(srcs).toEqual(['mock://face/e2', 'mock://face/e3'])
    expect(srcs.filter((s) => s === 'mock://face/cf1')).toHaveLength(0)
  })
})

describe('PeopleReviewWizard.vue — pattern ② compare toggle', () => {
  it('the segmented control switches from the default view to the side-by-side compare view', async () => {
    await seed([rawGroup(rawPerson({ name: 'Alice', coverFaceId: 'cf1' }), [rawSuggestion({ faceId: 'f1', kind: 'review', score: 0.8 })])])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-body-compare"]').exists()).toBe(false)

    await w.find('[data-test="prw-view-compare"]').trigger('click')

    expect(w.find('[data-test="prw-body-original"]').exists()).toBe(false)
    expect(w.find('[data-test="prw-body-compare"]').exists()).toBe(true)
    expect(w.find('[data-test="prw-compare-name"]').text()).toBe('Alice')
    expect(w.find('[data-test="prw-compare-candidate-img"]').attributes('src')).toBe('mock://face/f1')
    expect(w.find('[data-test="prw-kind-badge"]').text()).toBe(zh.photosPeopleReviewBadge)
    expect(w.find('[data-test="prw-score"]').text()).toBe('80%')
  })

  it('kind="join" shows the join badge, not the review badge', async () => {
    await seed([rawGroup(rawPerson(), [rawSuggestion({ kind: 'join' })])])
    const w = mountWizard(true)
    await w.find('[data-test="prw-view-compare"]').trigger('click')
    expect(w.find('[data-test="prw-kind-badge"]').text()).toBe(zh.photosPeopleJoinBadge)
  })
})

describe('PeopleReviewWizard.vue — Yes/No/Skip and auto-advance', () => {
  it('Yes calls decideSuggestion(id, true) and advances to the next suggestion', async () => {
    const s = await seed([rawGroup(rawPerson({ name: 'Alice' }), [
      rawSuggestion({ id: 's1', faceId: 'f1' }),
      rawSuggestion({ id: 's2', faceId: 'f2' }),
    ])])
    const spy = vi.spyOn(s, 'decideSuggestion')
    const w = mountWizard(true)

    await w.find('[data-test="prw-yes"]').trigger('click')
    await w.vm.$nextTick()
    await Promise.resolve()
    await w.vm.$nextTick()

    expect(spy).toHaveBeenCalledWith('s1', true)
    expect(w.find('[data-test="prw-inset-face"]').attributes('src')).toBe('mock://face/f2')
  })

  it('No calls decideSuggestion(id, false)', async () => {
    const s = await seed([rawGroup(rawPerson(), [rawSuggestion({ id: 's1', faceId: 'f1' })])])
    const spy = vi.spyOn(s, 'decideSuggestion')
    const w = mountWizard(true)

    await w.find('[data-test="prw-no"]').trigger('click')

    expect(spy).toHaveBeenCalledWith('s1', false)
  })

  it('Skip advances to the next suggestion WITHOUT calling the store', async () => {
    const s = await seed([rawGroup(rawPerson({ name: 'Alice' }), [
      rawSuggestion({ id: 's1', faceId: 'f1' }),
      rawSuggestion({ id: 's2', faceId: 'f2' }),
    ])])
    const spy = vi.spyOn(s, 'decideSuggestion')
    const w = mountWizard(true)

    await w.find('[data-test="prw-skip"]').trigger('click')

    expect(spy).not.toHaveBeenCalled()
    expect(w.find('[data-test="prw-inset-face"]').attributes('src')).toBe('mock://face/f2')
  })

  // Fast-follow (review minor): `flat` is built by flattening ALL groups in order, so advancing
  // past group A's last item must move the header on to group B's person, not just to the next
  // face within the same group.
  it('walking past the last suggestion in one group moves the header on to the next group\'s person', async () => {
    await seed([
      rawGroup(rawPerson({ id: 'p1', name: 'Alice', coverFaceId: 'cf1' }), [rawSuggestion({ id: 's1', faceId: 'f1' })]),
      rawGroup(rawPerson({ id: 'p2', name: 'Bob', coverFaceId: 'cf2' }), [rawSuggestion({ id: 's2', faceId: 'f2' })]),
    ])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-person-name"]').text()).toBe('Alice')

    await w.find('[data-test="prw-skip"]').trigger('click')

    expect(w.find('[data-test="prw-person-name"]').text()).toBe('Bob')
    expect(w.find('[data-test="prw-inset-face"]').attributes('src')).toBe('mock://face/f2')
    // The cover avatar (PersonAvatar's <img>) also switched to Bob's own cover slot.
    expect(w.find('[data-test="avatar-img"]').attributes('src')).toBe('mock://person-face/p2/cf2')
  })

  // Fast-follow (review minor): deciding the LAST remaining suggestion must transition straight
  // to the done state, with no error surfaced and decideSuggestion still called normally.
  it('deciding (Yes) the last remaining suggestion goes straight to the done state', async () => {
    const s = await seed([rawGroup(rawPerson(), [rawSuggestion({ id: 's1' })])])
    const spy = vi.spyOn(s, 'decideSuggestion')
    const w = mountWizard(true)

    await w.find('[data-test="prw-yes"]').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith('s1', true)
    expect(w.find('[data-test="prw-done"]').exists()).toBe(true)
    expect(w.find('[data-test="prw-question"]').exists()).toBe(false)
  })

  it('the progress indicator advances on both decide and skip', async () => {
    await seed([rawGroup(rawPerson(), [
      rawSuggestion({ id: 's1' }), rawSuggestion({ id: 's2' }), rawSuggestion({ id: 's3' }),
    ])])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-progress"]').text()).toBe('0 / 3')

    await w.find('[data-test="prw-skip"]').trigger('click')
    expect(w.find('[data-test="prw-progress"]').text()).toBe('1 / 3')

    await w.find('[data-test="prw-yes"]').trigger('click')
    await w.vm.$nextTick()
    await Promise.resolve()
    await w.vm.$nextTick()
    expect(w.find('[data-test="prw-progress"]').text()).toBe('2 / 3')
  })
})

describe('PeopleReviewWizard.vue — done state', () => {
  it('shows the done state once every suggestion has been decided/skipped, and its close button emits update:open(false)', async () => {
    await seed([rawGroup(rawPerson(), [rawSuggestion({ id: 's1' })])])
    const w = mountWizard(true)

    await w.find('[data-test="prw-skip"]').trigger('click')

    expect(w.find('[data-test="prw-done"]').exists()).toBe(true)
    expect(w.find('[data-test="prw-question"]').exists()).toBe(false)
    await w.find('[data-test="prw-done-close"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('opening with zero pending suggestions goes straight to the done state (no crash)', async () => {
    await seed([])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-done"]').exists()).toBe(true)
  })
})

describe('PeopleReviewWizard.vue — zoom lightbox (pattern ① photo click)', () => {
  it('clicking the context photo opens a zoomed lightbox showing the same image', async () => {
    await seed([rawGroup(rawPerson(), [rawSuggestion({ assetId: 'a1' })])])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-lightbox"]').exists()).toBe(false)

    await w.find('[data-test="prw-context-photo"]').trigger('click')

    expect(w.find('[data-test="prw-lightbox"]').exists()).toBe(true)
    expect(w.find('[data-test="prw-lightbox-img"]').attributes('src')).toBe('mock://thumb/a1/large')
  })

  it('Escape closes the lightbox first, without closing the wizard', async () => {
    await seed([rawGroup(rawPerson(), [rawSuggestion()])])
    const w = mountWizard(true)
    await w.find('[data-test="prw-context-photo"]').trigger('click')
    expect(w.find('[data-test="prw-lightbox"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()

    expect(w.find('[data-test="prw-lightbox"]').exists()).toBe(false)
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('the lightbox close button closes just the lightbox', async () => {
    await seed([rawGroup(rawPerson(), [rawSuggestion()])])
    const w = mountWizard(true)
    await w.find('[data-test="prw-context-photo"]').trigger('click')

    await w.find('[data-test="prw-lightbox-close"]').trigger('click')

    expect(w.find('[data-test="prw-lightbox"]').exists()).toBe(false)
  })
})

describe('PeopleReviewWizard.vue — busy state', () => {
  it('while a decision is in flight, Yes/No/Skip stay disabled even after auto-advancing to the next suggestion', async () => {
    // Two items: after Yes on s1, the store's optimistic removal (synchronous, before the
    // network call resolves) advances `current` to s2 while acceptPersonSuggestion('s1') is
    // still pending -- busy is a single wizard-wide flag, so s2's buttons must stay disabled
    // until that in-flight request settles, not just s1's (which has already vanished).
    let resolveFn: (v: unknown) => void = () => {}
    svc.photos.acceptPersonSuggestion.mockImplementationOnce(() => new Promise((resolve) => { resolveFn = resolve }))
    await seed([rawGroup(rawPerson(), [rawSuggestion({ id: 's1', faceId: 'f1' }), rawSuggestion({ id: 's2', faceId: 'f2' })])])
    const w = mountWizard(true)

    await w.find('[data-test="prw-yes"]').trigger('click')
    await w.vm.$nextTick()

    expect(w.find('[data-test="prw-inset-face"]').attributes('src')).toBe('mock://face/f2') // advanced already
    expect(w.find('[data-test="prw-yes"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="prw-no"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="prw-skip"]').attributes('disabled')).toBeDefined()

    resolveFn({ id: 's1', status: 'accepted' })
    await flushPromises()

    expect(w.find('[data-test="prw-yes"]').attributes('disabled')).toBeUndefined()
  })
})

describe('PeopleReviewWizard.vue — merge cards (merge-cards feature, 2026-08-21)', () => {
  it('renders both sides of the pair: collage faces, photo count, and name', async () => {
    await seedMerge([rawPair()])
    const w = mountWizard(true)

    expect(w.find('[data-test="prw-merge-sides"]').exists()).toBe(true)
    expect(w.find('[data-test="prw-merge-from-name"]').text()).toBe(zh.photosPersonUnnamedTitle)
    expect(w.find('[data-test="prw-merge-into-name"]').text()).toBe('Bob')
    expect(w.find('[data-test="prw-merge-from-count"]').text()).toBe(zh.photosPeoplePhotosCount.replace('{n}', '5'))
    expect(w.find('[data-test="prw-merge-into-count"]').text()).toBe(zh.photosPeoplePhotosCount.replace('{n}', '20'))

    const fromSrcs = w.find('[data-test="prw-merge-side-from"]').findAll('img').map((img) => img.attributes('src'))
    expect(fromSrcs).toEqual(['mock://face/ff1', 'mock://face/ff2'])
    const intoSrcs = w.find('[data-test="prw-merge-side-into"]').findAll('img').map((img) => img.attributes('src'))
    expect(intoSrcs).toEqual(['mock://face/if1', 'mock://face/if2'])
  })

  it('caps each side\'s collage at 4 preview faces even when the backend sends more', async () => {
    await seedMerge([rawPair({ fromFaceIds: ['a', 'b', 'c', 'd', 'e'], intoFaceIds: ['x', 'y', 'z', 'w', 'v'] })])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-merge-side-from"]').findAll('img')).toHaveLength(4)
    expect(w.find('[data-test="prw-merge-side-into"]').findAll('img')).toHaveLength(4)
  })

  it('shows the merge question, the distance, and the merge/different/skip buttons', async () => {
    await seedMerge([rawPair({ dist: 0.123 })])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-question"]').text()).toBe(zh.photosPeopleMergeQuestionTitle)
    expect(w.find('[data-test="prw-merge-dist"]').text()).toBe(zh.photosPeopleMergeDistLabel.replace('{dist}', '0.123'))
    expect(w.find('[data-test="prw-yes"]').text()).toBe(zh.photosPeopleMergeAccept)
    expect(w.find('[data-test="prw-no"]').text()).toBe(zh.photosPeopleMergeReject)
    expect(w.find('[data-test="prw-skip"]').text()).toBe(zh.photosPeopleReviewSkip) // shared with the face flow
  })

  it('does not render the face-suggestion header/toggle for a merge card', async () => {
    await seedMerge([rawPair()])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-header"]').exists()).toBe(false)
    expect(w.find('[data-test="prw-view-toggle"]').exists()).toBe(false)
  })

  it('Merge (accept) calls decideMergeQuestion(id, true)', async () => {
    const s = await seedMerge([rawPair({ id: 'mq1' })])
    const spy = vi.spyOn(s, 'decideMergeQuestion')
    const w = mountWizard(true)

    await w.find('[data-test="prw-yes"]').trigger('click')

    expect(spy).toHaveBeenCalledWith('mq1', true)
  })

  it('Different (reject) calls decideMergeQuestion(id, false)', async () => {
    const s = await seedMerge([rawPair({ id: 'mq1' })])
    const spy = vi.spyOn(s, 'decideMergeQuestion')
    const w = mountWizard(true)

    await w.find('[data-test="prw-no"]').trigger('click')

    expect(spy).toHaveBeenCalledWith('mq1', false)
  })

  it('accepting the only merge card advances straight to the done state', async () => {
    const s = await seedMerge([rawPair({ id: 'mq1' })])
    const spy = vi.spyOn(s, 'decideMergeQuestion')
    const w = mountWizard(true)

    await w.find('[data-test="prw-yes"]').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith('mq1', true)
    expect(w.find('[data-test="prw-done"]').exists()).toBe(true)
  })

  it('Skip advances to the next merge pair WITHOUT calling the store', async () => {
    const s = await seedMerge([rawPair({ id: 'mq1' }), rawPair({ id: 'mq2', into: rawPerson({ id: 'pC', name: 'Carol', count: 9 }) })])
    const spy = vi.spyOn(s, 'decideMergeQuestion')
    const w = mountWizard(true)

    await w.find('[data-test="prw-skip"]').trigger('click')

    expect(spy).not.toHaveBeenCalled()
    expect(w.find('[data-test="prw-merge-into-name"]').text()).toBe('Carol')
  })

  it('the done state is reached once every merge card has been decided/skipped, closing the wizard from there', async () => {
    await seedMerge([rawPair({ id: 'mq1' })])
    const w = mountWizard(true)

    await w.find('[data-test="prw-skip"]').trigger('click')

    expect(w.find('[data-test="prw-done"]').exists()).toBe(true)
    await w.find('[data-test="prw-done-close"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })
})

describe('PeopleReviewWizard.vue — mixed queue ordering (merge-cards feature)', () => {
  it('face suggestions come first, merge questions after; progress/total count both', async () => {
    await seed([rawGroup(rawPerson({ id: 'p1', name: 'Alice' }), [rawSuggestion({ id: 's1', faceId: 'f1' })])])
    await seedMerge([rawPair({ id: 'mq1' })])
    const w = mountWizard(true)

    // Total is 2 (1 face + 1 merge); starts on the face item.
    expect(w.find('[data-test="prw-progress"]').text()).toBe('0 / 2')
    expect(w.find('[data-test="prw-body-original"]').exists()).toBe(true)
    expect(w.find('[data-test="prw-person-name"]').text()).toBe('Alice')

    // Deciding the face item advances to the merge card, not past it.
    await w.find('[data-test="prw-yes"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-test="prw-progress"]').text()).toBe('1 / 2')
    expect(w.find('[data-test="prw-merge-sides"]').exists()).toBe(true)
    expect(w.find('[data-test="prw-body-original"]').exists()).toBe(false)
  })

  it('skipping the face item still lands on the merge card next (order preserved across skip too)', async () => {
    await seed([rawGroup(rawPerson({ id: 'p1', name: 'Alice' }), [rawSuggestion({ id: 's1', faceId: 'f1' })])])
    await seedMerge([rawPair({ id: 'mq1' })])
    const w = mountWizard(true)

    await w.find('[data-test="prw-skip"]').trigger('click')

    expect(w.find('[data-test="prw-merge-sides"]').exists()).toBe(true)
  })

  it('deciding both the face item and the merge question reaches the done state, count includes both', async () => {
    await seed([rawGroup(rawPerson(), [rawSuggestion({ id: 's1' })])])
    await seedMerge([rawPair({ id: 'mq1' })])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-progress"]').text()).toBe('0 / 2')

    await w.find('[data-test="prw-yes"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="prw-yes"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-test="prw-done"]').exists()).toBe(true)
  })

  it('opening with zero items of both kinds goes straight to the done state', async () => {
    await seed([])
    await seedMerge([])
    const w = mountWizard(true)
    expect(w.find('[data-test="prw-done"]').exists()).toBe(true)
  })
})
