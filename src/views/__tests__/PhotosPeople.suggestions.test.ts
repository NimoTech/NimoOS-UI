// Plan C Task 2 (2026-08-20 people-suggestions-ui): the "待确认/To confirm" suggestion
// confirmation cards on the People page — per-face join/review suggestions grouped by person,
// sitting above the named-people area. Kept in its own file rather than folded into
// PhotosPeople.test.ts (which the brief explicitly names as an existing test to never
// overwrite) — same mounting conventions (mount Pinia + i18n + a real router, mock the shared
// package's photos methods), scoped to only the suggestion-card behaviors.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    listPersons: vi.fn().mockResolvedValue({ persons: [], facesIndexedUpTo: null }),
    mergeSuggestions: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn().mockResolvedValue({}),
    personFaceThumbnailUrl: vi.fn((id: string | number, ver?: string | number | null) => `mock://person-face/${id}/${ver ?? ''}`),
    // Plan C Task 2: distinct from personFaceThumbnailUrl above — keyed by bare faceId, no
    // owning person's cover slot involved (see the header comment on faceThumbnailUrl in
    // packages/service/src/photos.ts).
    faceThumbnailUrl: vi.fn((faceId: string) => `mock://face/${faceId}`),
    // Item 2 (2026-08-20 people-confirm-polish): the peek overlay's full-asset image URL.
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    listHiddenPersons: vi.fn().mockResolvedValue([]),
    listPersonSuggestions: vi.fn().mockResolvedValue({ groups: [] }),
    acceptPersonSuggestion: vi.fn().mockResolvedValue({ id: 's1', status: 'accepted' }),
    rejectPersonSuggestion: vi.fn().mockResolvedValue({ id: 's1', status: 'rejected' }),
    batchPersonSuggestions: vi.fn().mockResolvedValue({ results: {} }),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosPeople from '../PhotosPeople.vue'
import { usePhotosPeople } from '../../photos/stores/people'
import { useToast } from '../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/people', name: 'photos-people', component: PhotosPeople },
      { path: '/photos/people/:id', name: 'photos-person', component: { template: '<div/>' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/photos/people')
  await router.isReady()
  const w = mount(PhotosPeople, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

function rawSuggestion(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 's1', faceId: 'f1', assetId: 'a1', kind: 'join', score: 0.5, ...over }
}
function rawGroup(person: Record<string, unknown>, suggestions: Array<Record<string, unknown>>): Record<string, unknown> {
  return { person, suggestions }
}

const ALICE = { id: 'p1', name: 'Alice', coverFaceId: 'cf1', count: 5, confidence: 0.9, favorite: false, relation: '' }
const UNNAMED = { id: 'p2', name: '', coverFaceId: null, count: 2, confidence: 0.8, favorite: false, relation: '' }

// Alice's group has one 'join' and one 'review' item; the unnamed person's group has one 'join'
// item — total open count is 3.
const TWO_GROUPS = [
  rawGroup(ALICE, [rawSuggestion({ id: 's1', faceId: 'f1' }), rawSuggestion({ id: 's2', faceId: 'f2', kind: 'review', score: 0.8 })]),
  rawGroup(UNNAMED, [rawSuggestion({ id: 's3', faceId: 'f3' })]),
]

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  svc.photos.listPersons.mockClear().mockResolvedValue({ persons: [], facesIndexedUpTo: null })
  svc.photos.mergeSuggestions.mockClear().mockResolvedValue([])
  svc.photos.getConfig.mockClear().mockResolvedValue({})
  svc.photos.personFaceThumbnailUrl.mockClear()
  svc.photos.faceThumbnailUrl.mockClear()
  svc.photos.originalUrl.mockClear()
  svc.photos.listHiddenPersons.mockClear().mockResolvedValue([])
  svc.photos.listPersonSuggestions.mockClear().mockResolvedValue({ groups: [] })
  svc.photos.acceptPersonSuggestion.mockClear().mockResolvedValue({ id: 's1', status: 'accepted' })
  svc.photos.rejectPersonSuggestion.mockClear().mockResolvedValue({ id: 's1', status: 'rejected' })
  svc.photos.batchPersonSuggestions.mockClear().mockResolvedValue({ results: {} })
})
// Same isolation lesson as PhotosPeople.test.ts's own afterEach: the store's module-scoped
// `_pendingSuggestionIds` guard (people.ts) isn't reset by setActivePinia(createPinia()) alone.
afterEach(() => {
  usePhotosPeople().__resetForTest()
})

describe('PhotosPeople.vue — suggestion confirmation cards (Plan C Task 2)', () => {
  it('① two groups render two cards, and the section header carries the correct total count', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    const { w } = await mountView()
    expect(w.find('[data-test="people-suggestions"]').exists()).toBe(true)
    expect(w.findAll('[data-test="suggestion-card"]')).toHaveLength(2)
    expect(w.find('[data-test="section-suggestions"]').text()).toContain('3')
  })

  it('② clicking a single face\'s ✓ calls decideSuggestion(id, true), and that face disappears', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    const { w } = await mountView()
    const people = usePhotosPeople()
    const spy = vi.spyOn(people, 'decideSuggestion')
    const face = w.find('[data-test="suggestion-face"][data-id="s1"]')
    await face.find('[data-test="suggestion-face-accept"]').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith('s1', true)
    expect(w.find('[data-test="suggestion-face"][data-id="s1"]').exists()).toBe(false)
  })

  it('a single face\'s ✕ calls decideSuggestion(id, false)', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    const { w } = await mountView()
    const people = usePhotosPeople()
    const spy = vi.spyOn(people, 'decideSuggestion')
    const face = w.find('[data-test="suggestion-face"][data-id="s3"]')
    await face.find('[data-test="suggestion-face-reject"]').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith('s3', false)
    expect(w.find('[data-test="suggestion-face"][data-id="s3"]').exists()).toBe(false)
  })

  it('③ "Reject all" calls decideGroup(personId, false), and the whole group disappears', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    svc.photos.batchPersonSuggestions.mockResolvedValueOnce({ results: { s3: { status: 'rejected' } } })
    const { w } = await mountView()
    const people = usePhotosPeople()
    const spy = vi.spyOn(people, 'decideGroup')
    await w.find('[data-test="suggestion-card"][data-person-id="p2"] [data-test="suggestion-reject-all"]').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith('p2', false)
    expect(w.find('[data-test="suggestion-card"][data-person-id="p2"]').exists()).toBe(false)
  })

  it('"Confirm all" calls decideGroup(personId, true)', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    svc.photos.batchPersonSuggestions.mockResolvedValueOnce({
      results: { s1: { status: 'accepted' }, s2: { status: 'accepted' } },
    })
    const { w } = await mountView()
    const people = usePhotosPeople()
    const spy = vi.spyOn(people, 'decideGroup')
    await w.find('[data-test="suggestion-card"][data-person-id="p1"] [data-test="suggestion-confirm-all"]').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith('p1', true)
    expect(w.find('[data-test="suggestion-card"][data-person-id="p1"]').exists()).toBe(false)
  })

  it('④ a backend 404 (suggestionsSupported=false) → the whole section is absent, including the title', async () => {
    svc.photos.listPersonSuggestions.mockRejectedValue(Object.assign(new Error('not found'), { response: { status: 404 } }))
    const { w } = await mountView()
    expect(w.find('[data-test="people-suggestions"]').exists()).toBe(false)
    expect(w.text()).not.toContain(zh.photosPeopleSuggestions)
  })

  it('④ zero open suggestions (an empty groups array) → the section is absent', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: [] })
    const { w } = await mountView()
    expect(w.find('[data-test="people-suggestions"]').exists()).toBe(false)
  })

  it('⑥ an unnamed person\'s card title falls back to the Unnamed-person copy', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({
      groups: [rawGroup(UNNAMED, [rawSuggestion({ id: 's3', faceId: 'f3' })])],
    })
    const { w } = await mountView()
    const card = w.find('[data-test="suggestion-card"][data-person-id="p2"]')
    expect(card.find('.suggestion-card-title').text()).toBe(
      zh.photosPeopleSuggestTitle.replace('{name}', zh.photosPersonUnnamedTitle),
    )
  })

  it('a kind="review" suggestion renders the Review badge; a kind="join" one does not', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    const { w } = await mountView()
    const joinFace = w.find('[data-test="suggestion-face"][data-id="s1"]')
    const reviewFace = w.find('[data-test="suggestion-face"][data-id="s2"]')
    expect(joinFace.find('[data-test="suggestion-review-badge"]').exists()).toBe(false)
    expect(reviewFace.find('[data-test="suggestion-review-badge"]').exists()).toBe(true)
    expect(reviewFace.find('[data-test="suggestion-review-badge"]').text()).toBe(zh.photosPeopleReviewBadge)
  })

  // decideGroup always resolves (never throws) with a per-id failure count (see its header
  // comment in people.ts) — this is the partial-failure toast wired on top of that contract.
  it('partial failure: decideGroup resolving {failed:2} shows a partial-failure notice carrying n=2', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({
      groups: [rawGroup(ALICE, [rawSuggestion({ id: 's1', faceId: 'f1' }), rawSuggestion({ id: 's2', faceId: 'f2' })])],
    })
    svc.photos.batchPersonSuggestions.mockResolvedValueOnce({
      results: { s1: { status: 'error' }, s2: { status: 'error' } },
    })
    const { w } = await mountView()
    const toast = useToast()
    await w.find('[data-test="suggestion-card"][data-person-id="p1"] [data-test="suggestion-confirm-all"]').trigger('click')
    await flushPromises()

    expect(toast.toasts.some((tt) => tt.text === zh.photosPeopleSuggestPartialFail.replace('{n}', '2'))).toBe(true)
  })

  it('a full-success group action does not show the partial-failure notice', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    svc.photos.batchPersonSuggestions.mockResolvedValueOnce({ results: { s3: { status: 'rejected' } } })
    const { w } = await mountView()
    const toast = useToast()
    await w.find('[data-test="suggestion-card"][data-person-id="p2"] [data-test="suggestion-reject-all"]').trigger('click')
    await flushPromises()

    expect(toast.toasts).toHaveLength(0)
  })
})

// ── Click-to-enlarge peek (item 2, 2026-08-20 people-confirm-polish) ──
// Thumbnails are too small to judge identity from; clicking one opens an overlay showing the
// full asset photo (via service.photos.originalUrl(assetId), not the cropped face) for context.
// No existing photo-viewer wiring on this page to reuse (see the comment above
// openSuggestionPeek in PhotosPeople.vue for why PhotoLightbox/useLightbox is the wrong tool
// here) — this is a minimal self-contained overlay.
describe('PhotosPeople.vue — suggestion peek overlay (Plan C Task 2 follow-up, click to enlarge)', () => {
  it('clicking a suggestion face thumbnail opens the peek overlay showing that suggestion\'s asset (originalUrl(assetId), not the face crop)', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({
      groups: [rawGroup(ALICE, [rawSuggestion({ id: 's1', faceId: 'f1', assetId: 'asset-42' })])],
    })
    const { w } = await mountView()
    expect(w.find('[data-test="suggestion-peek-overlay"]').exists()).toBe(false)

    await w.find('[data-test="suggestion-face"][data-id="s1"]').trigger('click')

    expect(w.find('[data-test="suggestion-peek-overlay"]').exists()).toBe(true)
    expect(w.find('[data-test="suggestion-peek-img"]').attributes('src')).toBe('mock://original/asset-42')
    expect(svc.photos.originalUrl).toHaveBeenCalledWith('asset-42')
  })

  it('Escape closes the peek overlay', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    const { w } = await mountView()
    await w.find('[data-test="suggestion-face"][data-id="s1"]').trigger('click')
    expect(w.find('[data-test="suggestion-peek-overlay"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()

    expect(w.find('[data-test="suggestion-peek-overlay"]').exists()).toBe(false)
  })

  it('clicking the backdrop (not the image) closes the peek overlay', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    const { w } = await mountView()
    await w.find('[data-test="suggestion-face"][data-id="s1"]').trigger('click')
    expect(w.find('[data-test="suggestion-peek-overlay"]').exists()).toBe(true)

    await w.find('[data-test="suggestion-peek-overlay"]').trigger('click')

    expect(w.find('[data-test="suggestion-peek-overlay"]').exists()).toBe(false)
  })

  it('the close button closes the peek overlay', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    const { w } = await mountView()
    await w.find('[data-test="suggestion-face"][data-id="s1"]').trigger('click')

    await w.find('[data-test="suggestion-peek-close"]').trigger('click')

    expect(w.find('[data-test="suggestion-peek-overlay"]').exists()).toBe(false)
  })

  it('clicking the ✓/✕ hover buttons decides the suggestion and does NOT also open the peek (click.stop)', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    const { w } = await mountView()
    const people = usePhotosPeople()
    const spy = vi.spyOn(people, 'decideSuggestion')

    await w.find('[data-test="suggestion-face"][data-id="s1"] [data-test="suggestion-face-accept"]').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith('s1', true)
    expect(w.find('[data-test="suggestion-peek-overlay"]').exists()).toBe(false)
  })

  it('deciding a suggestion from the card still works after opening and closing its peek', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    const { w } = await mountView()
    const people = usePhotosPeople()
    const spy = vi.spyOn(people, 'decideSuggestion')

    await w.find('[data-test="suggestion-face"][data-id="s1"]').trigger('click')
    expect(w.find('[data-test="suggestion-peek-overlay"]').exists()).toBe(true)
    await w.find('[data-test="suggestion-peek-close"]').trigger('click')
    expect(w.find('[data-test="suggestion-peek-overlay"]').exists()).toBe(false)

    await w.find('[data-test="suggestion-face"][data-id="s1"] [data-test="suggestion-face-accept"]').trigger('click')
    await flushPromises()

    expect(spy).toHaveBeenCalledWith('s1', true)
    expect(w.find('[data-test="suggestion-face"][data-id="s1"]').exists()).toBe(false)
  })
})
