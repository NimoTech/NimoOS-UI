// SP15-P2a task 4 (carried-in defect fix): the moment detail page's two grids set
// `:data-selected` on their tiles, but scoped styles never cross a component boundary in
// this repo — every existing `[data-selected]` rule lived inside a *different* component's
// own scoped style (PhotosGrid.vue, PersonAssetGrid.vue, PhotosLibraryPicker.vue), so
// selection mode here drew the check badge with no highlight around the tile at all.
//
// jsdom does no layout and cannot show the outline/wash actually painting, so this test
// asserts the two things that are assertable: the attribute really reaches the DOM node
// (mount + interact), and this file's own stylesheet — not some other component's — carries
// a rule whose selector is able to match it. The CSS is read with node:fs rather than a
// `?raw` import of a stylesheet, per this repo's own documented trap (selectPopup.test.ts:32).
// Before the fix this file's own `<style>` block had no `[data-selected]` rule anywhere, so
// the second assertion below is what actually catches the regression.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { i18n } from '../../i18n'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://${id}/${size}`),
    listMoments: vi.fn(async (): Promise<unknown> => []),
    getMomentAssets: vi.fn(async (): Promise<unknown> => []),
    pinMomentAssets: vi.fn(async (): Promise<unknown> => ({})),
    excludeMomentAssets: vi.fn(async (): Promise<unknown> => ({})),
    getTimeline: vi.fn(async (): Promise<unknown> => []),
    getConfig: vi.fn(async (): Promise<unknown> => ({})),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

const lbMock = vi.hoisted(() => ({ openAt: vi.fn() }))
vi.mock('../../photos/lightbox/useLightbox', () => ({ useLightbox: () => lbMock }))

import PhotosMomentDetail from '../PhotosMomentDetail.vue'
import { usePhotosMoments, type Moment } from '../../photos/stores/moments'

function makeMoment(): Moment {
  return {
    id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', place: 'Bozeman',
    recipeKey: 'trip:1', coverAssetId: 'c1', featuredAssetIds: [],
    assetCount: 2, addedThisWeek: 0, coverRatio: 1.5,
    timeFrom: '2016-11-20T00:00:00Z', timeTo: '2016-11-22T00:00:00Z', updatedAt: '',
  }
}

async function mountDetail() {
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
      { path: '/photos/moments/:id', name: 'photos-moment-detail', component: PhotosMomentDetail },
    ],
  })
  await router.push('/photos/moments/m1')
  await router.isReady()
  i18n.global.locale.value = 'en_us'
  const w = mount(PhotosMomentDetail, { global: { plugins: [router] } })
  await new Promise((r) => setTimeout(r, 0))
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  svc.photos.listMoments.mockResolvedValue([])
  svc.photos.getConfig.mockResolvedValue({})
  svc.photos.pinMomentAssets.mockResolvedValue({})
  svc.photos.excludeMomentAssets.mockResolvedValue({})
  svc.photos.getTimeline.mockResolvedValue([])
})

describe('selection mode on the moment detail page marks the selected tile', () => {
  it('sets data-selected="true" on a tile once it is picked in selection mode', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id?: string, featured?: boolean) =>
      featured ? { assets: [], members: [], places: [] } : [{ id: 'a1' }, { id: 'a2' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const w = await mountDetail()

    const tiles = w.findAll('[data-test="mo-all-tile"]')
    expect(tiles[0].attributes('data-selected')).toBe('false')

    await w.find('[data-test="mo-select-toggle"]').trigger('click') // enter selection mode
    await tiles[0].trigger('click')                                 // pick it

    expect(tiles[0].attributes('data-selected')).toBe('true')
    expect(tiles[1].attributes('data-selected')).toBe('false') // the other tile stays untouched
  })

  // This is the assertion that actually fails without the fix: before this task, the
  // template already carried `:data-selected`, but no rule in this file's own `<style>`
  // block could ever match it — the only such rules on the repo lived in other components'
  // scoped styles. Reading the source with node:fs (never `?raw` on a stylesheet — that
  // import is documented elsewhere in this repo to come back empty and let a guard pass for
  // free) reproduces exactly what the browser sees: this SFC's own compiled style block.
  it('carries its own [data-selected="true"] rule reachable from a .tile element', () => {
    const filePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../PhotosMomentDetail.vue')
    const src = fs.readFileSync(filePath, 'utf8')
    const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)
    expect(styleMatch, 'PhotosMomentDetail.vue must have its own <style> block').not.toBeNull()
    const style = styleMatch![1].replace(/\/\*[\s\S]*?\*\//g, '') // strip comments per CSS semantics
    const rules = style.match(/[^{}]+\{[^{}]*\}/g) ?? []
    const reaches = rules.some((rule) => {
      const selector = rule.slice(0, rule.indexOf('{'))
      return /\.tile/.test(selector) && /\[data-selected(?:="true")?\]/.test(selector)
    })
    expect(reaches, 'no selector in this file\'s own <style> block can match .tile[data-selected]').toBe(true)
  })
})
