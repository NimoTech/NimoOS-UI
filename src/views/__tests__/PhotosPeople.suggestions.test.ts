// Plan C Task 2 (2026-08-20 people-suggestions-ui) → people-confirm-polish (2026-08-21, Apple-
// style review wizard, user-picked pattern ① primary + pattern ② integrated after a three-pattern
// demo): the "待确认/To confirm" section on the People page.
//
// Rework note: this file used to cover the per-group card grid with inline ✓/✕ buttons, group-
// level Confirm-all/Reject-all, and a standalone click-to-enlarge peek overlay — all of that UI
// is now DELETED (replaced by a compact entry card + a full-screen sequential review wizard,
// PeopleReviewWizard.vue). What's left here is scoped to the entry card itself (count, preview
// thumbnails, the Start-review button, and the two feature-detection/empty gates, which are
// unaffected by the rework). The wizard's own open/close/accept/reject/skip/exemplar-faces
// behavior has its own component-level test file:
// src/photos/components/__tests__/PeopleReviewWizard.test.ts (kept separate rather than folded
// in here, same rationale this file's own original header comment gave for splitting out of
// PhotosPeople.test.ts — one file per surface, not one giant file per view).
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
    // Distinct from personFaceThumbnailUrl above — keyed by bare faceId, no owning person's cover
    // slot involved (see the header comment on faceThumbnailUrl in packages/service/src/photos.ts).
    faceThumbnailUrl: vi.fn((faceId: string) => `mock://face/${faceId}`),
    // The wizard's context-photo/lightbox image URL (thumbnailUrl(assetId,'large'), not
    // originalUrl — a suggestion's assetId can point at a video, see PeopleReviewWizard.vue's
    // own header comment for why).
    thumbnailUrl: vi.fn((id: string | number, size = 'small') => `mock://thumb/${id}/${size}`),
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

// 8 suggestions across two groups — for the preview-row cap test (entry card shows at most 6).
const EIGHT_SUGGESTIONS = [
  rawGroup(ALICE, [1, 2, 3, 4, 5].map((n) => rawSuggestion({ id: `a${n}`, faceId: `fa${n}` }))),
  rawGroup(UNNAMED, [1, 2, 3].map((n) => rawSuggestion({ id: `b${n}`, faceId: `fb${n}` }))),
]

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  svc.photos.listPersons.mockClear().mockResolvedValue({ persons: [], facesIndexedUpTo: null })
  svc.photos.mergeSuggestions.mockClear().mockResolvedValue([])
  svc.photos.getConfig.mockClear().mockResolvedValue({})
  svc.photos.personFaceThumbnailUrl.mockClear()
  svc.photos.faceThumbnailUrl.mockClear()
  svc.photos.thumbnailUrl.mockClear()
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

describe('PhotosPeople.vue — "To confirm" entry card (people-confirm-polish rework)', () => {
  it('renders the section with the correct total count and the entry card', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    const { w } = await mountView()
    expect(w.find('[data-test="people-suggestions"]').exists()).toBe(true)
    expect(w.find('[data-test="section-suggestions"]').text()).toContain('3')
    expect(w.find('[data-test="suggestion-entry-card"]').exists()).toBe(true)
  })

  it('the preview row shows one thumbnail per open suggestion when there are 6 or fewer', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    const { w } = await mountView()
    expect(w.findAll('[data-test="suggestion-entry-thumb"]')).toHaveLength(3)
  })

  it('the preview row is capped at 6 thumbnails even when there are more open suggestions', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: EIGHT_SUGGESTIONS })
    const { w } = await mountView()
    expect(w.find('[data-test="section-suggestions"]').text()).toContain('8')
    expect(w.findAll('[data-test="suggestion-entry-thumb"]')).toHaveLength(6)
  })

  it('the Start-review button opens the full-screen review wizard', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: TWO_GROUPS })
    const { w } = await mountView()
    expect(w.find('[data-test="prw-overlay"]').exists()).toBe(false)
    await w.find('[data-test="suggestion-start-review"]').trigger('click')
    expect(w.find('[data-test="prw-overlay"]').exists()).toBe(true)
  })

  it('a backend 404 (suggestionsSupported=false) → the whole section is absent, including the title', async () => {
    svc.photos.listPersonSuggestions.mockRejectedValue(Object.assign(new Error('not found'), { response: { status: 404 } }))
    const { w } = await mountView()
    expect(w.find('[data-test="people-suggestions"]').exists()).toBe(false)
    expect(w.text()).not.toContain(zh.photosPeopleSuggestions)
  })

  it('zero open suggestions (an empty groups array) → the section is absent', async () => {
    svc.photos.listPersonSuggestions.mockResolvedValue({ groups: [] })
    const { w } = await mountView()
    expect(w.find('[data-test="people-suggestions"]').exists()).toBe(false)
  })
})
