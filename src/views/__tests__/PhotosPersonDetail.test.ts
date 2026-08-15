// Task 14 (SP7-P5 people): PhotosPersonDetail.vue — the person-detail view container
// (**four-state gate** + co-appearance strip + three tabs + selection floating bar +
// **seven self-drawn dialogs** + lightbox wiring). Ported section by section from Vue2
// NimoOS-UI src/views/Photos/PhotosPersonDetail.vue (1561 lines).
// Four states = skeleton / load failed + retry / person not found / normal (state 4
// was added by coordinator ruling 4, expanding from three states).
// Seven dialogs = the six from the brief's checklist + Vue2 promptDialog's info mode
// (:845-851 "No photos available").
//
// Test strategy (one deliberate strengthening over the brief's suggestion, recorded in
// the report): the brief suggested "mock the shared package and usePersonDetail". Here
// only the shared package (service) is mocked — **usePersonDetail uses the real
// implementation** — because the optimistic-update (photo disappears immediately after
// detach), reconciliation refetch (load gets called again), and avatar-ver-change
// assertions only make sense against the real composable; mocking it would replace the
// orchestration contract under test with the mock's return values.
// "load was called" is always asserted indirectly via the call count of
// svc.photos.getPerson.
//
// The invariant recurring throughout the file: the backend id is a **number**, the
// route param is a **string**, cross-checked by normalizing through String().
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    // person detail data
    getPerson: vi.fn(),
    personPlaces: vi.fn(),
    getPersonAssets: vi.fn(),
    // people store
    listPersons: vi.fn(),
    mergeSuggestions: vi.fn(),
    updatePerson: vi.fn(),
    setPersonCover: vi.fn(),
    mergePersons: vi.fn(),
    purgePerson: vi.fn(),
    detachAssetsFromPerson: vi.fn(),
    // albums store (saveAsAlbum = createAlbum + batchAddToAlbum + fetchAlbums)
    createAlbum: vi.fn(),
    batchAddToAlbum: vi.fn(),
    listAlbums: vi.fn(),
    // lightbox + timeline
    deleteAsset: vi.fn(),
    getTimeline: vi.fn(),
    getAsset: vi.fn(),
    getAssetOcr: vi.fn(),
    recordView: vi.fn(),
    listFavoriteIds: vi.fn(),
    // url builders
    thumbnailUrl: vi.fn((id: string | number, size = 'small') => `mock://thumb/${id}/${size}`),
    personFaceThumbnailUrl: vi.fn((id: string | number, ver?: string | number | null) => `mock://face/${id}/${ver ?? ''}`),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// jsdom has no media stack (PhotoLightbox references it as soon as it mounts, same
// setup as PhotosAlbumDetail.test.ts).
;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

import PhotosPersonDetail from '../PhotosPersonDetail.vue'
import PersonHero from '../../photos/components/PersonHero.vue'
import PersonAssetGrid from '../../photos/components/PersonAssetGrid.vue'
import PersonPlacesTab from '../../photos/components/PersonPlacesTab.vue'
import PersonRelationsTab from '../../photos/components/PersonRelationsTab.vue'
import { usePhotosPeople } from '../../photos/stores/people'
import { useToast } from '../../stores/toast'
import { useLightbox } from '../../photos/lightbox/useLightbox'

const lb = useLightbox()
const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// The backend id is always given as a **number** (invariant cross-check: the route
// param is always a string).
function rawPerson(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: '妈妈',
    confidence: 0.95,
    count: 128,
    favorite: false,
    relation: '',
    coverFaceId: 'face-1',
    heroAssetId: null,
    firstSeen: '2019-03-04T00:00:00Z',
    lastSeen: '2026-05-01T00:00:00Z',
    placesCount: 4,
    ...overrides,
  }
}

function asset(id: string | number, takenAt = '2026-05-01T10:00:00Z') {
  return { id, takenAt, mimeType: 'image/jpeg', originalName: `${id}.jpg` }
}

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/people', name: 'photos-people', component: { template: '<div/>' } },
      { path: '/photos/people/:id', name: 'photos-person-detail', component: PhotosPersonDetail },
    ],
  })
}

async function mountView(id: string | number = '7') {
  const router = makeRouter()
  await router.push(`/photos/people/${id}`)
  await router.isReady()
  const w = mount(PhotosPersonDetail, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

/** Open the Edit menu and click one of its items (PersonHero's internal menu, data-test names from T10). */
async function pickEditMenu(w: ReturnType<typeof mount>, which: 'rename' | 'merge' | 'delete') {
  await w.find('[data-test="hero-edit-trigger"]').trigger('click')
  await w.find(`[data-test="hero-edit-${which}"]`).trigger('click')
  await flushPromises()
}

/** document-level Esc (must set bubbles: true — the invariant for cross-target event tests). */
function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

beforeEach(() => {
  setActivePinia(createPinia())
  // The people store's undo window (_purgeTimers) is **module-level** state and does not
  // get rebuilt with pinia — a delete-person test would leave behind a 5-second timer and
  // a filter entry; without clearing it, a later test's fetchPeople would filter that id out.
  usePhotosPeople().__resetForTest()
  lb.__resetForTest()
  svc.photos.getPerson.mockReset().mockResolvedValue({ person: rawPerson(), relations: [] })
  svc.photos.personPlaces.mockReset().mockResolvedValue([])
  svc.photos.getPersonAssets.mockReset().mockResolvedValue([asset('a1'), asset('a2')])
  svc.photos.listPersons.mockReset().mockResolvedValue({ persons: [rawPerson()], facesIndexedUpTo: null })
  svc.photos.mergeSuggestions.mockReset().mockResolvedValue([])
  svc.photos.updatePerson.mockReset().mockResolvedValue({})
  svc.photos.setPersonCover.mockReset().mockResolvedValue({ coverFaceId: 'face-9' })
  svc.photos.mergePersons.mockReset().mockResolvedValue(undefined)
  svc.photos.purgePerson.mockReset().mockResolvedValue(undefined)
  svc.photos.detachAssetsFromPerson.mockReset().mockResolvedValue(undefined)
  svc.photos.createAlbum.mockReset().mockResolvedValue({ id: 'alb-1', name: 'x' })
  svc.photos.batchAddToAlbum.mockReset().mockResolvedValue(undefined)
  svc.photos.listAlbums.mockReset().mockResolvedValue([])
  svc.photos.deleteAsset.mockReset().mockResolvedValue(undefined)
  svc.photos.getTimeline.mockReset().mockResolvedValue([])
  svc.photos.getAsset.mockReset().mockRejectedValue(new Error('no hydrate in test'))
  svc.photos.getAssetOcr.mockReset().mockResolvedValue({ lines: [] })
  svc.photos.recordView.mockReset().mockResolvedValue(undefined)
  svc.photos.listFavoriteIds.mockReset().mockResolvedValue([])
  svc.photos.personFaceThumbnailUrl.mockClear()
  svc.photos.thumbnailUrl.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  lb.__resetForTest()
})

describe('PhotosPersonDetail.vue — four-state gate (skeleton / load failed+retry / person not found / normal)', () => {
  it('loading with no person → skeleton', async () => {
    // getPerson that never resolves: stays stuck in the loading state
    svc.photos.getPerson.mockReturnValue(new Promise(() => {}))
    const router = makeRouter()
    await router.push('/photos/people/7')
    const w = mount(PhotosPersonDetail, { global: { plugins: [i18n, router] } })
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-skeleton"]').exists()).toBe(true)
    expect(w.find('[data-test="person-not-found"]').exists()).toBe(false)
    expect(w.findComponent(PersonHero).exists()).toBe(false)
  })

  it('load finished but the person does not exist → not-found + back button', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: null, relations: [] })
    const { w, router } = await mountView('7')
    expect(w.find('[data-test="person-not-found"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosPersonNotFound)
    await w.find('[data-test="person-not-found-back"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/people')
  })

  // Coordinator ruling 4: a load failure must be distinguishable from "person does not
  // exist" (T9's failed flag was added exactly for this).
  it('load failure → dedicated error copy + retry button (does not reuse "找不到这个人物")', async () => {
    svc.photos.getPerson.mockRejectedValue(new Error('network down'))
    const { w } = await mountView('7')
    expect(w.find('[data-test="person-load-failed"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosPersonLoadFailed)
    // Must not fall into the "person does not exist" branch
    expect(w.find('[data-test="person-not-found"]').exists()).toBe(false)
    expect(w.find('[data-test="person-skeleton"]').exists()).toBe(false)
  })

  it('clicking "Retry" in the failed state → load gets called again; flips to normal content on success', async () => {
    svc.photos.getPerson.mockRejectedValueOnce(new Error('network down'))
    const { w } = await mountView('7')
    expect(w.find('[data-test="person-load-failed"]').exists()).toBe(true)
    const before = svc.photos.getPerson.mock.calls.length

    await w.find('[data-test="person-retry"]').trigger('click')
    await flushPromises()
    expect(svc.photos.getPerson.mock.calls.length).toBe(before + 1)
    expect(svc.photos.getPerson).toHaveBeenLastCalledWith('7')
    expect(w.find('[data-test="person-load-failed"]').exists()).toBe(false)
    expect(w.find('[data-test="hero-name"]').text()).toBe('妈妈')
  })

  it('does not fire a duplicate request while a retry is in flight (loading short-circuit + button disabled)', async () => {
    svc.photos.getPerson.mockRejectedValueOnce(new Error('network down'))
    const { w } = await mountView('7')
    let release: (() => void) | null = null
    svc.photos.getPerson.mockImplementation(
      () => new Promise((res) => { release = () => res({ person: rawPerson(), relations: [] }) }),
    )
    const before = svc.photos.getPerson.mock.calls.length
    const btn = w.find('[data-test="person-retry"]')
    await btn.trigger('click')
    // load() sets loading synchronously before the await — the gate flips back to the
    // skeleton immediately, and the retry button is already gone from the DOM
    expect(w.find('[data-test="person-retry"]').exists()).toBe(false)
    expect(w.find('[data-test="person-skeleton"]').exists()).toBe(true)
    expect(svc.photos.getPerson.mock.calls.length).toBe(before + 1)
    release!()
    await flushPromises()
  })

  it('normal state → hero + tabs + asset grid', async () => {
    const { w } = await mountView('7')
    expect(w.find('[data-test="person-skeleton"]').exists()).toBe(false)
    expect(w.findComponent(PersonHero).exists()).toBe(true)
    expect(w.findComponent(PersonAssetGrid).exists()).toBe(true)
    expect(w.find('[data-test="hero-name"]').text()).toBe('妈妈')
  })
})

describe('PhotosPersonDetail.vue — route param invariant', () => {
  it('personId goes through String(route.params.id): number backend id / string route param stay cross-consistent', async () => {
    await mountView(7)
    expect(svc.photos.getPerson).toHaveBeenCalledWith('7')
    expect(svc.photos.personPlaces).toHaveBeenCalledWith('7')
    expect(svc.photos.getPersonAssets).toHaveBeenCalledWith('7', 300, 0)
  })

  it('route.params.id changes → reload + clear selection + tab reset (hash router does not remount the same component)', async () => {
    const { w, router } = await mountView('7')
    // First switch to the places tab + select one
    await w.find('[data-test="person-tab-places"]').trigger('click')
    expect(w.findComponent(PersonPlacesTab).exists()).toBe(true)
    await w.find('[data-test="person-tab-timeline"]').trigger('click')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-selection-bar"]').exists()).toBe(true)
    await w.find('[data-test="person-tab-places"]').trigger('click')

    const before = svc.photos.getPerson.mock.calls.length
    await router.push('/photos/people/9')
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.getPerson.mock.calls.length).toBe(before + 1)
    expect(svc.photos.getPerson).toHaveBeenLastCalledWith('9')
    // Selection cleared → floating bar disappears
    expect(w.find('[data-test="person-selection-bar"]').exists()).toBe(false)
    // tab resets to timeline
    expect(w.findComponent(PersonPlacesTab).exists()).toBe(false)
    expect(w.findComponent(PersonAssetGrid).exists()).toBe(true)
  })

  it('route.params.id changes → closes any open dialog', async () => {
    const { w, router } = await mountView('7')
    await pickEditMenu(w, 'rename')
    expect(w.find('[data-test="person-rename-dialog"]').exists()).toBe(true)
    await router.push('/photos/people/9')
    await flushPromises()
    expect(w.find('[data-test="person-rename-dialog"]').exists()).toBe(false)
  })
})

describe('PhotosPersonDetail.vue — three tabs', () => {
  it('switching tabs renders the matching child component, and only that one', async () => {
    const { w } = await mountView('7')
    expect(w.findComponent(PersonAssetGrid).exists()).toBe(true)
    expect(w.findComponent(PersonPlacesTab).exists()).toBe(false)
    expect(w.findComponent(PersonRelationsTab).exists()).toBe(false)

    await w.find('[data-test="person-tab-places"]').trigger('click')
    expect(w.findComponent(PersonAssetGrid).exists()).toBe(false)
    expect(w.findComponent(PersonPlacesTab).exists()).toBe(true)

    await w.find('[data-test="person-tab-relations"]').trigger('click')
    expect(w.findComponent(PersonPlacesTab).exists()).toBe(false)
    expect(w.findComponent(PersonRelationsTab).exists()).toBe(true)
  })

  it('the places tab has the container compute PlaceGroup[] and pass it to the relations tab (groupPlaces normalizes the unknown-place copy)', async () => {
    svc.photos.personPlaces.mockResolvedValue([
      { placeName: '东京', latitude: 35.6, longitude: 139.7 },
      { placeName: '东京', latitude: 35.6, longitude: 139.7 },
      { placeName: null, latitude: null, longitude: null },
    ])
    const { w } = await mountView('7')
    await w.find('[data-test="person-tab-relations"]').trigger('click')
    const groups = w.findComponent(PersonRelationsTab).props('places')
    expect(groups.map((g) => [g.name, g.count])).toEqual([['东京', 2], [zh.photosPersonUnknownPlace, 1]])
  })
})

describe('PhotosPersonDetail.vue — co-appearance strip', () => {
  it('only shows at the top of the timeline tab, sorted by count descending, clicking navigates to that person (number id → string route)', async () => {
    svc.photos.getPerson.mockResolvedValue({
      person: rawPerson(),
      relations: [
        { personId: 11, name: '小明', coverFaceId: 'f11', count: 12 },
        { personId: 12, name: '小红', coverFaceId: 'f12', count: 40 },
      ],
    })
    const { w, router } = await mountView('7')
    const cards = w.findAll('[data-test="coappear-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('小红')   // count 40 comes first
    expect(cards[1].text()).toContain('小明')
    await cards[0].trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/people/12')

    // Strip disappears after switching to the places tab
    await w.find('[data-test="person-tab-places"]').trigger('click')
    expect(w.findAll('[data-test="coappear-card"]')).toHaveLength(0)
  })
})

describe('PhotosPersonDetail.vue — favorite toggle (deviation record 3)', () => {
  it('success: optimistic patch takes effect', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('toggle-fav')
    await flushPromises()
    expect(svc.photos.updatePerson).toHaveBeenCalledWith('7', { favorite: true })
    expect(w.findComponent(PersonHero).props('person').favorite).toBe(true)
  })

  it('failure: local favorite reverts to the original value + toast', async () => {
    svc.photos.updatePerson.mockRejectedValue(new Error('boom'))
    const { w } = await mountView('7')
    const toast = useToast()
    w.findComponent(PersonHero).vm.$emit('toggle-fav')
    await flushPromises()
    expect(w.findComponent(PersonHero).props('person').favorite).toBe(false)
    expect(toast.msg).toBe(zh.photosPersonFavFailed)
  })

  it('clicking twice fires only one request (reentrancy guard)', async () => {
    let release: (() => void) | null = null
    svc.photos.updatePerson.mockImplementation(() => new Promise<void>((res) => { release = () => res() }))
    const { w } = await mountView('7')
    const hero = w.findComponent(PersonHero)
    hero.vm.$emit('toggle-fav')
    await w.vm.$nextTick()
    hero.vm.$emit('toggle-fav')
    await w.vm.$nextTick()
    expect(svc.photos.updatePerson).toHaveBeenCalledTimes(1)
    release!()
    await flushPromises()
  })
})

describe('PhotosPersonDetail.vue — relation grouping (deviation record 4)', () => {
  it('success: optimistic patch takes effect', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('pick-relation', 'family')
    await flushPromises()
    expect(svc.photos.updatePerson).toHaveBeenCalledWith('7', { relation: 'family' })
    expect(w.findComponent(PersonHero).props('person').relation).toBe('family')
  })

  it('failure: rolls back + toast', async () => {
    svc.photos.updatePerson.mockRejectedValue(new Error('boom'))
    const { w } = await mountView('7')
    const toast = useToast()
    w.findComponent(PersonHero).vm.$emit('pick-relation', 'work')
    await flushPromises()
    expect(w.findComponent(PersonHero).props('person').relation).toBe('')
    expect(toast.msg).toBe(zh.photosPersonRelationFailed)
  })

  it('clicking twice fires only one request (reentrancy guard)', async () => {
    let release: (() => void) | null = null
    svc.photos.updatePerson.mockImplementation(() => new Promise<void>((res) => { release = () => res() }))
    const { w } = await mountView('7')
    const hero = w.findComponent(PersonHero)
    hero.vm.$emit('pick-relation', 'family')
    await w.vm.$nextTick()
    hero.vm.$emit('pick-relation', 'friend')
    await w.vm.$nextTick()
    expect(svc.photos.updatePerson).toHaveBeenCalledTimes(1)
    release!()
    await flushPromises()
  })
})

describe('PhotosPersonDetail.vue — rename dialog', () => {
  it('success: hero shows the new name + dialog closes', async () => {
    const { w } = await mountView('7')
    await pickEditMenu(w, 'rename')
    const input = w.find('[data-test="person-rename-input"]')
    expect((input.element as HTMLInputElement).value).toBe('妈妈')
    await input.setValue('老妈')
    await w.find('[data-test="person-rename-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.photos.updatePerson).toHaveBeenCalledWith('7', { name: '老妈' })
    expect(w.find('[data-test="hero-name"]').text()).toBe('老妈')
    expect(w.find('[data-test="person-rename-dialog"]').exists()).toBe(false)
  })

  it('failure: toast, and the dialog stays open (so it can be corrected)', async () => {
    svc.photos.updatePerson.mockRejectedValue(new Error('boom'))
    const { w } = await mountView('7')
    const toast = useToast()
    await pickEditMenu(w, 'rename')
    await w.find('[data-test="person-rename-input"]').setValue('老妈')
    await w.find('[data-test="person-rename-confirm"]').trigger('click')
    await flushPromises()
    expect(toast.msg).toBe(zh.photosPersonRenamedFailed)
    expect(w.find('[data-test="person-rename-dialog"]').exists()).toBe(true)
  })

  it('unchanged name / empty name → closes the dialog directly without firing a request (matches Vue2 :911)', async () => {
    const { w } = await mountView('7')
    await pickEditMenu(w, 'rename')
    await w.find('[data-test="person-rename-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.photos.updatePerson).not.toHaveBeenCalled()
    expect(w.find('[data-test="person-rename-dialog"]').exists()).toBe(false)
  })

  it('clicking twice fires only one request (reentrancy guard)', async () => {
    let release: (() => void) | null = null
    svc.photos.updatePerson.mockImplementation(() => new Promise<void>((res) => { release = () => res() }))
    const { w } = await mountView('7')
    await pickEditMenu(w, 'rename')
    await w.find('[data-test="person-rename-input"]').setValue('老妈')
    await w.find('[data-test="person-rename-confirm"]').trigger('click')
    await w.find('[data-test="person-rename-confirm"]').trigger('click')
    expect(svc.photos.updatePerson).toHaveBeenCalledTimes(1)
    release!()
    await flushPromises()
  })
})

// ── Final review Important 3: identity guard (in-flight request + person switch) ──────
// This group is a different thing from the "reentrancy guard": the reentrancy guard
// prevents clicking twice on the same person, the identity guard prevents "the user
// switches people while a request is in flight, and the late response writes A's data
// onto B". A manually resolve/reject-able deferred promise is used to reproduce this
// timing precisely; navigating is done via router.push (equivalent to the browser back
// button — hash routing, no need to click through the overlay).
describe('PhotosPersonDetail.vue — identity guard (in-flight request across people)', () => {
  // A = id 7 (name "妈妈"), B = id 8 (name "爸爸").
  function twoPeople(bOverrides: Record<string, unknown> = {}, aOverrides: Record<string, unknown> = {}) {
    svc.photos.getPerson.mockImplementation((id: string | number) =>
      Promise.resolve({
        person: String(id) === '8'
          ? rawPerson({ id: 8, name: '爸爸', ...bOverrides })
          : rawPerson(aOverrides),
        relations: [],
      }))
  }

  it('the PATCH from A\'s rename resolves only after switching to B → the name is **not** written onto B', async () => {
    let release: (() => void) | null = null
    svc.photos.updatePerson.mockImplementation(() => new Promise<void>((res) => { release = () => res() }))
    twoPeople()
    const { w, router } = await mountView('7')

    await pickEditMenu(w, 'rename')
    await w.find('[data-test="person-rename-input"]').setValue('张三')
    await w.find('[data-test="person-rename-confirm"]').trigger('click')
    expect(svc.photos.updatePerson).toHaveBeenCalledWith('7', { name: '张三' })

    // Go back to B (component is reused → route watch reloads)
    await router.push('/photos/people/8')
    await flushPromises()
    expect(w.find('[data-test="hero-name"]').text()).toBe('爸爸')

    release!()                                   // A's PATCH only comes back now
    await flushPromises()
    expect(w.find('[data-test="hero-name"]').text()).toBe('爸爸')
  })

  it('A\'s favorite-failure **rollback** happens only after switching to B → B\'s favorite state is not changed, and no toast belonging to A pops up', async () => {
    let fail: (() => void) | null = null
    svc.photos.updatePerson.mockImplementation(() => new Promise<void>((_res, rej) => {
      fail = () => rej(new Error('boom'))
    }))
    // A is already a favorite (one click → optimistic unfavorite), B is not — the rollback
    // value true differs from B's false, otherwise the contamination wouldn't be observable.
    twoPeople({ favorite: false }, { favorite: true })
    const { w, router } = await mountView('7')
    const toast = useToast()

    await w.find('[data-test="hero-fav"]').trigger('click')
    expect(svc.photos.updatePerson).toHaveBeenCalledWith('7', { favorite: false })

    await router.push('/photos/people/8')
    await flushPromises()
    expect(w.findComponent(PersonHero).props('person')).toMatchObject({ id: 8, favorite: false })

    fail!()                                      // A's failure only comes back now → without the guard, the rollback would write to B
    await flushPromises()
    expect(w.findComponent(PersonHero).props('person')).toMatchObject({ id: 8, favorite: false })
    expect(toast.toasts).toEqual([])
  })
})

describe('PhotosPersonDetail.vue — selection state and key photo', () => {
  it('single selection shows "Set as key photo", multi-selection does not', async () => {
    const { w } = await mountView('7')
    const grid = w.findComponent(PersonAssetGrid)
    grid.vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-set-key-photo"]').exists()).toBe(true)
    grid.vm.$emit('toggle-select', 'a2')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-set-key-photo"]').exists()).toBe(false)
    expect(w.find('[data-test="person-selection-bar"]').text()).toContain('2')
  })

  it('setting the key photo succeeds: setPersonCover + avatar ver swaps to the new coverFaceId + toast + exits selection state', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    svc.photos.personFaceThumbnailUrl.mockClear()
    await w.find('[data-test="person-set-key-photo"]').trigger('click')
    await flushPromises()
    expect(svc.photos.setPersonCover).toHaveBeenCalledWith('7', 'a1')
    expect(useToast().msg).toBe(zh.photosPersonKeyPhotoToast)
    expect(w.find('[data-test="person-selection-bar"]').exists()).toBe(false)
    // The avatar URL used the new coverFaceId (cache-bust)
    expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith(7, 'face-9')
  })

  // Review must-fix 1: when the backend returns `200 {}` (success but without
  // coverFaceId), the local cover **must keep its original value** — an unconditional
  // patch would wipe it to null, PersonHero's isFallback would go true on the spot, and
  // the hero would fall back to the gradient placeholder.
  it('setting the key photo: backend has no coverFaceId (200 {}) → local cover keeps its original value, hero does not degrade', async () => {
    svc.photos.setPersonCover.mockResolvedValue({})
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    await w.find('[data-test="person-set-key-photo"]').trigger('click')
    await flushPromises()
    expect(svc.photos.setPersonCover).toHaveBeenCalledWith('7', 'a1')
    // The original value 'face-1' must still be there (not null)
    expect(w.findComponent(PersonHero).props('person').coverFaceId).toBe('face-1')
    // Has a cover ⇒ not the gradient fallback state
    expect(w.find('[data-test="hero-bg"]').classes()).not.toContain('is-fallback')
    expect(useToast().msg).toBe(zh.photosPersonKeyPhotoToast)
  })

  // Pairs with the previous case: an **explicit** null from the backend means "clear the
  // cover", and in that case it must be written through (the two cases must not be conflated).
  it('setting the key photo: backend explicitly returns coverFaceId: null → writes null (clears the cover)', async () => {
    svc.photos.setPersonCover.mockResolvedValue({ coverFaceId: null })
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    await w.find('[data-test="person-set-key-photo"]').trigger('click')
    await flushPromises()
    expect(w.findComponent(PersonHero).props('person').coverFaceId).toBeNull()
  })

  it('setting the key photo 404 → dedicated copy "那张照片里没有这个人的脸"', async () => {
    svc.photos.setPersonCover.mockRejectedValue({ response: { status: 404 } })
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    await w.find('[data-test="person-set-key-photo"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosPersonKeyPhotoNoFace)
  })

  it('setting the key photo, other errors → generic failure copy', async () => {
    svc.photos.setPersonCover.mockRejectedValue({ response: { status: 500 } })
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    await w.find('[data-test="person-set-key-photo"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosPersonKeyPhotoFailed)
  })

  it('clicking twice fires only one request (reentrancy guard)', async () => {
    let release: (() => void) | null = null
    svc.photos.setPersonCover.mockImplementation(
      () => new Promise((res) => { release = () => res({ coverFaceId: 'face-9' }) }),
    )
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    const btn = w.find('[data-test="person-set-key-photo"]')
    await btn.trigger('click')
    await btn.trigger('click')
    expect(svc.photos.setPersonCover).toHaveBeenCalledTimes(1)
    release!()
    await flushPromises()
  })

  it('cancel exits selection state', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    await w.find('[data-test="person-selection-cancel"]').trigger('click')
    expect(w.find('[data-test="person-selection-bar"]').exists()).toBe(false)
  })
})

describe('PhotosPersonDetail.vue — detach asset', () => {
  it('after confirming, the photo disappears from the grid immediately (optimistic), then load runs once more to reconcile', async () => {
    // The request is deliberately left hanging: this way "a1 is already gone from the
    // grid" can only come from the optimistic update, never from a refetch.
    let settle: (() => void) | null = null
    svc.photos.detachAssetsFromPerson.mockImplementation(() => new Promise<void>((res) => { settle = () => res() }))
    const { w } = await mountView('7')
    const before = svc.photos.getPerson.mock.calls.length
    w.findComponent(PersonAssetGrid).vm.$emit('detach', ['a1'])
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-detach-dialog"]').exists()).toBe(true)

    await w.find('[data-test="person-detach-confirm"]').trigger('click')
    await w.vm.$nextTick()
    // The request hasn't settled yet: a1 is already gone from the grid (optimistic),
    // the dialog and selection state have already closed in sync
    expect(w.findComponent(PersonAssetGrid).props('months').flatMap((m) => m.photos.map((p) => p.id)))
      .toEqual(['a2'])
    expect(w.find('[data-test="person-detach-dialog"]').exists()).toBe(false)
    expect(svc.photos.getPerson.mock.calls.length).toBe(before)

    settle!()
    await flushPromises()
    expect(svc.photos.detachAssetsFromPerson).toHaveBeenCalledWith('7', ['a1'])
    expect(svc.photos.getPerson.mock.calls.length).toBe(before + 1)
  })

  it('a failure still reconciles with a refetch + toast', async () => {
    svc.photos.detachAssetsFromPerson.mockRejectedValue(new Error('boom'))
    const { w } = await mountView('7')
    const before = svc.photos.getPerson.mock.calls.length
    w.findComponent(PersonAssetGrid).vm.$emit('detach', ['a1'])
    await w.vm.$nextTick()
    await w.find('[data-test="person-detach-confirm"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosPersonDetachFailed)
    expect(svc.photos.getPerson.mock.calls.length).toBe(before + 1)
  })

  it('bulk detach from selection state: uses every selected id, and exits selection state', async () => {
    const { w } = await mountView('7')
    const grid = w.findComponent(PersonAssetGrid)
    grid.vm.$emit('toggle-select', 'a1')
    grid.vm.$emit('toggle-select', 'a2')
    await w.vm.$nextTick()
    await w.find('[data-test="person-remove-from"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="person-detach-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.photos.detachAssetsFromPerson).toHaveBeenCalledWith('7', ['a1', 'a2'])
    expect(w.find('[data-test="person-selection-bar"]').exists()).toBe(false)
  })

  it('closing the dialog synchronously is itself a natural reentrancy guard: the confirm button is already gone on the second click', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('detach', ['a1'])
    await w.vm.$nextTick()
    await w.find('[data-test="person-detach-confirm"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-detach-confirm"]').exists()).toBe(false)
    await flushPromises()
    expect(svc.photos.detachAssetsFromPerson).toHaveBeenCalledTimes(1)
  })
})

describe('PhotosPersonDetail.vue — delete person', () => {
  it('purgePersonWithUndo + navigates back to the list + 5-second undoable toast', async () => {
    vi.useFakeTimers()
    const { w, router } = await mountView('7')
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    await pickEditMenu(w, 'delete')
    expect(w.find('[data-test="person-delete-dialog"]').exists()).toBe(true)
    await w.find('[data-test="person-delete-confirm"]').trigger('click')
    await w.vm.$nextTick()

    expect(showSpy).toHaveBeenCalledTimes(1)
    const [text, duration, arg] = showSpy.mock.calls[0]
    // SP8-P6-T3 merge point: show()'s third arg is now a discriminated union
    // (string = tier / object = action); narrow back to action via typeof.
    const action = typeof arg === 'string' ? undefined : arg
    expect(text).toContain('妈妈')
    expect(duration).toBe(5000)
    expect(action).toBeTruthy()
    expect(action!.label).toBe(zh.photosPersonUndo)
    expect(typeof action!.onClick).toBe('function')

    // The undo closure can insert the person back into the list
    const people = usePhotosPeople()
    expect(people.people).toHaveLength(0)
    action!.onClick()
    expect(people.people).toHaveLength(1)

    await vi.runOnlyPendingTimersAsync()
    vi.useRealTimers()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/people')
  })

  // Review Minor 4: the title must be Vue2 :304's "删除人物?", not T7's warning-strip
  // string "删除这个人物分组?"
  it('the delete dialog title uses the person-specific key, does not reuse T7\'s warning-strip string', async () => {
    const { w } = await mountView('7')
    await pickEditMenu(w, 'delete')
    const dlg = w.find('[data-test="person-delete-dialog"]')
    expect(dlg.text()).toContain(zh.photosPersonDeletePersonTitle)
    expect(dlg.text()).not.toContain(zh.photosPersonDeleteTitle)
  })

  // Review Minor 6: the body text has two gray tiers — the second sentence sits in its
  // own <span> (only that way can it take the dimmer token)
  it('the delete dialog body splits into two tiers: the body sentence + the dimmer "undoable within 5 seconds"', async () => {
    const { w } = await mountView('7')
    await pickEditMenu(w, 'delete')
    const dlg = w.find('[data-test="person-delete-dialog"]')
    expect(dlg.text()).toContain(zh.photosPersonDeleteKeptBody)
    const dim = dlg.find('.pd-body-dim')
    expect(dim.exists()).toBe(true)
    expect(dim.text()).toBe(zh.photosPersonDeleteUndoHint)
  })

  it('an unnamed person uses the placeholder label', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: rawPerson({ name: '' }), relations: [] })
    const { w } = await mountView('7')
    const showSpy = vi.spyOn(useToast(), 'show')
    await pickEditMenu(w, 'delete')
    await w.find('[data-test="person-delete-confirm"]').trigger('click')
    await w.vm.$nextTick()
    expect(showSpy.mock.calls[0][0]).toContain(zh.photosPersonUnnamedLabel)
  })

  it('closing the dialog synchronously is itself a natural reentrancy guard: the confirm button is already gone on the second click', async () => {
    const { w } = await mountView('7')
    await pickEditMenu(w, 'delete')
    await w.find('[data-test="person-delete-confirm"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-delete-confirm"]').exists()).toBe(false)
  })
})

describe('PhotosPersonDetail.vue — merge into another person', () => {
  const others = [
    rawPerson({ id: 8, name: '小明', count: 20 }),
    rawPerson({ id: 9, name: '小红', count: 90 }),
    rawPerson({ id: 10, name: '', count: 300 }),   // unnamed: the candidate pool only takes named entries, should be excluded
  ]

  it('candidates = named, excludes self, sorted by count descending, no truncation; search filters', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [rawPerson(), ...others], facesIndexedUpTo: null })
    const { w } = await mountView('7')
    await pickEditMenu(w, 'merge')
    let rows = w.findAll('[data-test="person-merge-candidate"]')
    expect(rows.map((r) => r.attributes('data-person-id'))).toEqual(['9', '8'])
    await w.find('[data-test="person-merge-search"]').setValue('明')
    rows = w.findAll('[data-test="person-merge-candidate"]')
    expect(rows.map((r) => r.attributes('data-person-id'))).toEqual(['8'])
  })

  it('success: toast + navigates back to the person list', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [rawPerson(), ...others], facesIndexedUpTo: null })
    const { w, router } = await mountView('7')
    await pickEditMenu(w, 'merge')
    await w.findAll('[data-test="person-merge-candidate"]')[0].trigger('click')
    await w.find('[data-test="person-merge-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.photos.mergePersons).toHaveBeenCalledWith('7', 9)
    expect(useToast().msg).toBe('已合并到「小红」')
    expect(router.currentRoute.value.path).toBe('/photos/people')
    expect(w.find('[data-test="person-merge-dialog"]').exists()).toBe(false)
  })

  it('failure: toast + stays on the current page + closes the dialog', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [rawPerson(), ...others], facesIndexedUpTo: null })
    svc.photos.mergePersons.mockRejectedValue(new Error('boom'))
    const { w, router } = await mountView('7')
    await pickEditMenu(w, 'merge')
    await w.findAll('[data-test="person-merge-candidate"]')[0].trigger('click')
    await w.find('[data-test="person-merge-confirm"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosPersonMergeFailed)
    expect(router.currentRoute.value.path).toBe('/photos/people/7')
    expect(w.find('[data-test="person-merge-dialog"]').exists()).toBe(false)
  })

  it('confirm button is disabled when no target is selected', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [rawPerson(), ...others], facesIndexedUpTo: null })
    const { w } = await mountView('7')
    await pickEditMenu(w, 'merge')
    expect(w.find('[data-test="person-merge-confirm"]').attributes('disabled')).toBeDefined()
  })

  it('clicking twice fires only one request (reentrancy guard)', async () => {
    svc.photos.listPersons.mockResolvedValue({ persons: [rawPerson(), ...others], facesIndexedUpTo: null })
    let release: (() => void) | null = null
    svc.photos.mergePersons.mockImplementation(() => new Promise<void>((res) => { release = () => res() }))
    const { w } = await mountView('7')
    await pickEditMenu(w, 'merge')
    await w.findAll('[data-test="person-merge-candidate"]')[0].trigger('click')
    const btn = w.find('[data-test="person-merge-confirm"]')
    await btn.trigger('click')
    await btn.trigger('click')
    expect(svc.photos.mergePersons).toHaveBeenCalledTimes(1)
    release!()
    await flushPromises()
  })
})

describe('PhotosPersonDetail.vue — background-picker dialog', () => {
  it('preselects the current heroAssetId on open; grid data = the full photo set', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: rawPerson({ heroAssetId: 'a2' }), relations: [] })
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    const tiles = w.findAll('[data-test="hero-picker-tile"]')
    expect(tiles).toHaveLength(2)
    expect(tiles[1].attributes('data-selected')).toBe('true')
    expect(w.find('[data-test="person-hero-save"]').attributes('disabled')).toBeUndefined()
  })

  // Review Minor 7: when the backend echoes "no hero" back verbatim as an empty string,
  // it must not fall into the "selected" state — otherwise no tile would be highlighted
  // yet the save button would still be clickable, and clicking it would resend the empty
  // string and still report "背景已更新".
  it('heroAssetId is an empty string → treated as unselected (no tile highlighted + save button disabled)', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: rawPerson({ heroAssetId: '' }), relations: [] })
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    const tiles = w.findAll('[data-test="hero-picker-tile"]')
    expect(tiles.every((n) => n.attributes('data-selected') === 'false')).toBe(true)
    expect(w.find('[data-test="person-hero-save"]').attributes('disabled')).toBeDefined()
  })

  it('save button is disabled when nothing is selected; after picking one it can be saved → patch + toast + closes the dialog', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-hero-save"]').attributes('disabled')).toBeDefined()
    await w.findAll('[data-test="hero-picker-tile"]')[0].trigger('click')
    await w.find('[data-test="person-hero-save"]').trigger('click')
    await flushPromises()
    expect(svc.photos.updatePerson).toHaveBeenCalledWith('7', { heroAssetId: 'a1' })
    expect(w.findComponent(PersonHero).props('person').heroAssetId).toBe('a1')
    expect(useToast().msg).toBe(zh.photosPersonHeroSavedToast)
    expect(w.find('[data-test="person-hero-dialog"]').exists()).toBe(false)
  })

  // Coordinator ruling 3: the two entry points have different toast semantics ("reset
  // back to the key photo" vs "changed to the selected one") and must not be merged.
  it('"使用关键照片" = clears heroAssetId, and uses the **reset**-specific toast (not "背景已更新")', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: rawPerson({ heroAssetId: 'a2' }), relations: [] })
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    await w.find('[data-test="person-hero-use-key"]').trigger('click')
    await flushPromises()
    expect(svc.photos.updatePerson).toHaveBeenCalledWith('7', { heroAssetId: '' })
    expect(w.findComponent(PersonHero).props('person').heroAssetId).toBe(null)
    expect(useToast().msg).toBe(zh.photosPersonHeroResetToast)
    expect(useToast().msg).not.toBe(zh.photosPersonHeroSavedToast)
  })

  it('"使用关键照片" failure → **reset**-specific failure copy', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: rawPerson({ heroAssetId: 'a2' }), relations: [] })
    svc.photos.updatePerson.mockRejectedValue(new Error('boom'))
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    await w.find('[data-test="person-hero-use-key"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosPersonHeroResetFailed)
    expect(w.find('[data-test="person-hero-dialog"]').exists()).toBe(true)
  })

  it('failure: toast and the dialog stays open', async () => {
    svc.photos.updatePerson.mockRejectedValue(new Error('boom'))
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    await w.findAll('[data-test="hero-picker-tile"]')[0].trigger('click')
    await w.find('[data-test="person-hero-save"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosPersonHeroFailed)
    expect(w.find('[data-test="person-hero-dialog"]').exists()).toBe(true)
  })

  it('clicking twice fires only one request (reentrancy guard)', async () => {
    let release: (() => void) | null = null
    svc.photos.updatePerson.mockImplementation(() => new Promise<void>((res) => { release = () => res() }))
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    await w.findAll('[data-test="hero-picker-tile"]')[0].trigger('click')
    const btn = w.find('[data-test="person-hero-save"]')
    await btn.trigger('click')
    await btn.trigger('click')
    expect(svc.photos.updatePerson).toHaveBeenCalledTimes(1)
    release!()
    await flushPromises()
  })
})

describe('PhotosPersonDetail.vue — create album', () => {
  it('saveAsAlbum receives the full set of photo ids + toast + closes the dialog', async () => {
    svc.photos.getPersonAssets.mockResolvedValue([asset('a1'), asset('a2'), asset('a3', '2026-04-02T00:00:00Z')])
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('make-album')
    await w.vm.$nextTick()
    const input = w.find('[data-test="person-album-input"]')
    expect((input.element as HTMLInputElement).value).toBe('妈妈')     // default name = person name
    expect(w.find('[data-test="person-album-dialog"]').text()).toContain('3')
    await input.setValue('和妈妈的旅行')
    await w.find('[data-test="person-album-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.photos.createAlbum).toHaveBeenCalledWith('和妈妈的旅行')
    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith('alb-1', ['a1', 'a2', 'a3'])
    expect(useToast().msg).toBe('已创建相册 · 和妈妈的旅行')
    expect(w.find('[data-test="person-album-dialog"]').exists()).toBe(false)
  })

  it('an unnamed person uses photosPersonAlbumNameFallback as the default name (a number id does not blow up either)', async () => {
    svc.photos.getPerson.mockResolvedValue({ person: rawPerson({ id: 1234567890, name: '' }), relations: [] })
    const { w } = await mountView('1234567890')
    w.findComponent(PersonHero).vm.$emit('make-album')
    await w.vm.$nextTick()
    expect((w.find('[data-test="person-album-input"]').element as HTMLInputElement).value).toBe('人物 12345678')
  })

  it('409 → duplicate-name copy; other errors → generic failure copy', async () => {
    svc.photos.createAlbum.mockRejectedValue({ response: { status: 409 } })
    const { w } = await mountView('7')
    const toast = useToast()
    w.findComponent(PersonHero).vm.$emit('make-album')
    await w.vm.$nextTick()
    await w.find('[data-test="person-album-confirm"]').trigger('click')
    await flushPromises()
    expect(toast.msg).toBe(zh.photosAlbumNameExists)
    expect(w.find('[data-test="person-album-dialog"]').exists()).toBe(true)

    svc.photos.createAlbum.mockRejectedValue(new Error('boom'))
    await w.find('[data-test="person-album-confirm"]').trigger('click')
    await flushPromises()
    expect(toast.msg).toBe(zh.photosPersonAlbumFailed)
  })

  it('shows the "暂无可用照片" prompt when there are no photos, and does not fire a request', async () => {
    svc.photos.getPersonAssets.mockResolvedValue([])
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('make-album')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-no-photos-dialog"]').exists()).toBe(true)
    expect(w.find('[data-test="person-album-dialog"]').exists()).toBe(false)
    expect(svc.photos.createAlbum).not.toHaveBeenCalled()
  })

  it('clicking twice fires only one request (reentrancy guard)', async () => {
    let release: (() => void) | null = null
    svc.photos.createAlbum.mockImplementation(
      () => new Promise((res) => { release = () => res({ id: 'alb-1', name: 'x' }) }),
    )
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('make-album')
    await w.vm.$nextTick()
    const btn = w.find('[data-test="person-album-confirm"]')
    await btn.trigger('click')
    await btn.trigger('click')
    expect(svc.photos.createAlbum).toHaveBeenCalledTimes(1)
    release!()
    await flushPromises()
  })
})

describe('PhotosPersonDetail.vue — lightbox wiring', () => {
  it('clicking a tile opens the lightbox, the paging set is the uncropped full set (a 20-photo month, grid only renders 16)', async () => {
    const many = Array.from({ length: 20 }, (_, i) => asset(`p${i}`))
    svc.photos.getPersonAssets.mockResolvedValue(many)
    const { w } = await mountView('7')
    // The grid renders only 16 by default (T11 contract)
    expect(w.findAll('.person-grid .tile')).toHaveLength(16)
    await w.findAll('.person-grid .tile')[0].trigger('click')
    await flushPromises()
    expect(lb.open.value).toBe(true)
    expect(lb.list.value).toHaveLength(20)
    expect(lb.list.value[19].id).toBe('p19')
  })

  it('灯箱删除 → deleteAssets + toast + 重新对账 load', async () => {
    const { w } = await mountView('7')
    const before = svc.photos.getPerson.mock.calls.length
    await w.findAll('.person-grid .tile')[0].trigger('click')
    await flushPromises()
    w.findComponent({ name: 'PhotoLightbox' }).vm.$emit('delete', 'a1')
    await flushPromises()
    expect(svc.photos.deleteAsset).toHaveBeenCalledWith('a1')
    expect(useToast().msg).toBe('1 项已移入最近删除')
    expect(svc.photos.getPerson.mock.calls.length).toBe(before + 1)
  })
})

// 评审必修 2(界面 1:1 红线):Vue2 这四个按钮/角标内各有一个图标,原实现漏渲染。
describe('PhotosPersonDetail.vue —— 按钮内图标(Vue2 有的都要有)', () => {
  it('选择态移除钮内有 x 图标(Vue2 :240)', async () => {
    const { w } = await mountView('7')
    w.findComponent(PersonAssetGrid).vm.$emit('toggle-select', 'a1')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-remove-from"] svg').exists()).toBe(true)
  })

  it('删除确认钮内有 trash 图标(Vue2 :319)', async () => {
    const { w } = await mountView('7')
    await pickEditMenu(w, 'delete')
    expect(w.find('[data-test="person-delete-confirm"] svg').exists()).toBe(true)
  })

  it('合并确认钮:选中目标后才出 sparkles 图标(Vue2 :427 的 v-if)', async () => {
    svc.photos.listPersons.mockResolvedValue({
      persons: [rawPerson(), rawPerson({ id: 9, name: '小红', count: 90 })], facesIndexedUpTo: null,
    })
    const { w } = await mountView('7')
    await pickEditMenu(w, 'merge')
    expect(w.find('[data-test="person-merge-confirm"] svg').exists()).toBe(false)
    await w.findAll('[data-test="person-merge-candidate"]')[0].trigger('click')
    expect(w.find('[data-test="person-merge-confirm"] svg').exists()).toBe(true)
  })

  it('背景网格视频角标有 ▶ + 时长(Vue2 :352;同 T11 PersonAssetGrid 的同一元素)', async () => {
    svc.photos.getPersonAssets.mockResolvedValue([
      { id: 'v1', takenAt: '2026-05-01T10:00:00Z', mimeType: 'video/mp4', originalName: 'v1.mp4', durationMs: 5000 },
    ])
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('open-hero-picker')
    await w.vm.$nextTick()
    const badge = w.find('.hero-picker-vid')
    expect(badge.exists()).toBe(true)
    expect(badge.find('.vid-play').text()).toBe('▶')
    expect(badge.text()).toContain('0:05')
  })
})

describe('PhotosPersonDetail.vue —— 七个弹窗的 Esc 都要挡住灯箱(六 + info 提示)', () => {
  const cases: Array<[string, string, (w: ReturnType<typeof mount>) => Promise<void>]> = [
    ['改名', 'person-rename-dialog', async (w) => { await pickEditMenu(w, 'rename') }],
    ['合并', 'person-merge-dialog', async (w) => { await pickEditMenu(w, 'merge') }],
    ['删除', 'person-delete-dialog', async (w) => { await pickEditMenu(w, 'delete') }],
    ['背景', 'person-hero-dialog', async (w) => {
      w.findComponent(PersonHero).vm.$emit('open-hero-picker'); await w.vm.$nextTick()
    }],
    ['建相册', 'person-album-dialog', async (w) => {
      w.findComponent(PersonHero).vm.$emit('make-album'); await w.vm.$nextTick()
    }],
    ['移出', 'person-detach-dialog', async (w) => {
      w.findComponent(PersonAssetGrid).vm.$emit('detach', ['a1']); await w.vm.$nextTick()
    }],
  ]

  for (const [label, testId, open] of cases) {
    it(`${label}弹窗:Esc 只关弹窗,灯箱不受影响`, async () => {
      const { w } = await mountView('7')
      // 先开灯箱(它在 window 上挂 keydown)
      await w.findAll('.person-grid .tile')[0].trigger('click')
      await flushPromises()
      expect(lb.open.value).toBe(true)

      await open(w)
      expect(w.find(`[data-test="${testId}"]`).exists()).toBe(true)

      pressEscape()
      await w.vm.$nextTick()
      expect(w.find(`[data-test="${testId}"]`).exists()).toBe(false)
      expect(lb.open.value).toBe(true)      // 灯箱没被同一次 Esc 一起关掉
    })
  }

  it('「暂无可用照片」提示也能被 Esc 关掉,且不连累灯箱', async () => {
    svc.photos.getPersonAssets.mockResolvedValue([])
    const { w } = await mountView('7')
    w.findComponent(PersonHero).vm.$emit('make-album')
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-no-photos-dialog"]').exists()).toBe(true)
    pressEscape()
    await w.vm.$nextTick()
    expect(w.find('[data-test="person-no-photos-dialog"]').exists()).toBe(false)
  })

  it('没有弹窗打开时不挂 document 监听(Esc 应能照常关灯箱)', async () => {
    const { w } = await mountView('7')
    await w.findAll('.person-grid .tile')[0].trigger('click')
    await flushPromises()
    expect(lb.open.value).toBe(true)
    pressEscape()
    await w.vm.$nextTick()
    expect(lb.open.value).toBe(false)
  })
})
