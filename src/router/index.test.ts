import { describe, it, expect, vi } from 'vitest'

// router/index.ts pulls in Welcome.vue → lottie-web, which calls canvas getContext();
// jsdom has no canvas backend. Same mock as Welcome.test.ts to make router importable here.
vi.mock('lottie-web', () => ({ default: { loadAnimation: vi.fn(() => ({ addEventListener: vi.fn(), destroy: vi.fn() })) } }))

import { router } from './index'
// Review M5: this comment used to claim the full ordering / no-reorder assertion lives in
// PhotosPlaces.test.ts, but that file only uses `?raw` to read PhotosPlaces.vue's own style
// block for a pointer-events assertion, and never reads the source text of router/index.ts —
// that claim was inaccurate. The real ordering / no-reorder assertion lives right here instead,
// checked against the raw source via `?raw`.
import routerIndexRaw from './index.ts?raw'

describe('router', () => {
  it('/files/shares matches files-shares, not the catch-all files-path', () => {
    const m = router.resolve('/files/shares')
    expect(m.name).toBe('files-shares')
  })
  it('/files/NimoOS-HD/Documents still matches files-path', () => {
    const m = router.resolve('/files/NimoOS-HD/Documents')
    expect(m.name).toBe('files-path')
  })
  it('/photos/favorites matches the photos-favorites route', () => {
    const m = router.resolve('/photos/favorites')
    expect(m.name).toBe('photos-favorites')
  })
  it('/photos/trash matches the photos-trash route', () => {
    const m = router.resolve('/photos/trash')
    expect(m.name).toBe('photos-trash')
  })
  it('/photos/albums matches the photos-albums route', () => {
    const m = router.resolve('/photos/albums')
    expect(m.name).toBe('photos-albums')
  })
  it('/photos/albums/7 matches the photos-album-detail route, params.id is the string "7"', () => {
    const m = router.resolve('/photos/albums/7')
    expect(m.name).toBe('photos-album-detail')
    expect(m.params.id).toBe('7')
  })
  it('/photos/people matches the photos-people route', () => {
    const m = router.resolve('/photos/people')
    expect(m.name).toBe('photos-people')
  })
  it('/photos/people/7 matches the photos-person-detail route, params.id is the string "7"', () => {
    const m = router.resolve('/photos/people/7')
    expect(m.name).toBe('photos-person-detail')
    expect(m.params.id).toBe('7')
  })
  it('/photos/places matches the photos-places route', () => {
    const m = router.resolve('/photos/places')
    expect(m.name).toBe('photos-places')
  })

  // P6a-T11: append-only, no reordering — the new route must sit between /photos/people/:id
  // and /login, and their own relative order must not be disturbed (review M5: this assertion
  // used to exist only as an inaccurate comment; this backfills the real one).
  it('/photos/places is appended after /photos/people/:id and before /login (append-only, no reordering)', () => {
    const peopleDetailIdx = routerIndexRaw.indexOf(`{ path: '/photos/people/:id'`)
    const placesIdx = routerIndexRaw.indexOf(`{ path: '/photos/places'`)
    const loginIdx = routerIndexRaw.indexOf(`{ path: '/login'`)
    expect(peopleDetailIdx).toBeGreaterThan(-1)
    expect(placesIdx).toBeGreaterThan(peopleDetailIdx)
    expect(loginIdx).toBeGreaterThan(placesIdx)
  })

  // SP7-P7a-T4: /photos/smart-views matches the actually registered route (resolved for real
  // via the production router singleton's router.resolve, not a spy push — same established
  // pattern as every existing route assertion above).
  it('/photos/smart-views matches the photos-smart-views route', () => {
    const m = router.resolve('/photos/smart-views')
    expect(m.name).toBe('photos-smart-views')
  })

  // Append-only, no reordering — the new route must sit between /photos/places/:key and
  // /login, and their own relative order must not be disturbed (same established technique as
  // P6a-T11 above: compare line order in the source, not getRoutes() index — vue-router 4 sorts
  // dynamic-segment routes ahead of static ones, confirmed in P6b-T9, so comparing indexes
  // would reach the wrong conclusion).
  it('/photos/smart-views is appended after /photos/places/:key and before /login (append-only, no reordering)', () => {
    const placesKeyIdx = routerIndexRaw.indexOf(`{ path: '/photos/places/:key'`)
    const smartViewsIdx = routerIndexRaw.indexOf(`{ path: '/photos/smart-views'`)
    const loginIdx = routerIndexRaw.indexOf(`{ path: '/login'`)
    expect(placesKeyIdx).toBeGreaterThan(-1)
    expect(smartViewsIdx).toBeGreaterThan(placesKeyIdx)
    expect(loginIdx).toBeGreaterThan(smartViewsIdx)
  })

  // SP7-P7a-T6: /photos/smart-views/:id detail route, same established technique as above (line-order comparison + a real resolve).
  it('/photos/smart-views/7 matches the photos-smart-view-detail route, params.id is the string "7"', () => {
    const m = router.resolve('/photos/smart-views/7')
    expect(m.name).toBe('photos-smart-view-detail')
    expect(m.params.id).toBe('7')
  })

  it('/photos/smart-views/:id is appended after /photos/smart-views and before /login (append-only, no reordering)', () => {
    const listIdx = routerIndexRaw.indexOf(`{ path: '/photos/smart-views'`)
    const detailIdx = routerIndexRaw.indexOf(`{ path: '/photos/smart-views/:id'`)
    const loginIdx = routerIndexRaw.indexOf(`{ path: '/login'`)
    expect(listIdx).toBeGreaterThan(-1)
    expect(detailIdx).toBeGreaterThan(listIdx)
    expect(loginIdx).toBeGreaterThan(detailIdx)
  })

  it('the main route table has expanded the knowledge routes', async () => {
    const { router } = await import('./index')
    const paths = router.getRoutes().map((r) => r.path)
    expect(paths).toContain('/ai/knowledge')
    expect(paths).toContain('/ai/knowledge/notes')
    expect(paths).toContain('/ai/parser/test')
  })
})
