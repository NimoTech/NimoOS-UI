// AssetDetailDrawer — the right-side drawer for an album-asset hit (`file_id` = `photos:<id>`).
//
// Before this component, clicking a photo/video card in KB search did a full `router.push` to
// the album lightbox — the user lost the result list. Now the click opens this drawer (same
// shell/animation as FileDetailDrawer: click the scrim, Esc, or "← results" to collapse) and
// the lightbox is one explicit button away ("Open in Photos").
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '../../../i18n'
import type { FileVM } from '../util/searchAggregate'
import AssetDetailDrawer from './AssetDetailDrawer.vue'

const ASSET = 'b615bb4a-5397-4113-b524-0c574d0fa46e'

function makeAsset(over: Partial<FileVM> = {}): FileVM {
  return {
    id: `photos:${ASSET}`,
    name: '肝疾病1.mp4',
    path: '/media/RAID_raid10/知识库/',
    fullPath: '/media/RAID_raid10/知识库/肝疾病1.mp4',
    kind: 'doc',
    mime: 'video/mp4',
    mtimeMs: 1784600000000,
    score: 0.57,
    chunks: [
      { id: `photos:${ASSET}:caption:0`, kind: 'caption', chunkNo: 0, page: null, score: 0.57, snippet: 'A presenter explains the liver on a slide' },
    ],
    photoAssetId: ASSET,
    thumbnailUrl: `/v1/photos/assets/${ASSET}/thumbnail?size=small`,
    ...over,
  }
}

describe('AssetDetailDrawer — media', () => {
  it('a video asset renders <video controls> streaming /original with the large thumbnail as poster', () => {
    const w = mount(AssetDetailDrawer, { props: { file: makeAsset(), query: 'liver' } })
    const v = w.find('video.k-asset-media')
    expect(v.exists()).toBe(true)
    expect(v.attributes('src')).toBe(`/v1/photos/assets/${ASSET}/original`)
    expect(v.attributes('poster')).toBe(`/v1/photos/assets/${ASSET}/thumbnail?size=large`)
    expect(v.attributes()).toHaveProperty('controls')
    expect(w.find('img.k-asset-media').exists()).toBe(false)
  })

  it('a photo asset renders the large thumbnail <img> and no <video>', () => {
    const w = mount(AssetDetailDrawer, { props: { file: makeAsset({ mime: 'image/jpeg', name: 'cat.jpg' }) } })
    const img = w.find('img.k-asset-media')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(`/v1/photos/assets/${ASSET}/thumbnail?size=large`)
    expect(w.find('video').exists()).toBe(false)
  })
})

describe('AssetDetailDrawer — header and caption', () => {
  it('shows the real file name, its folder and the Photo/Video kind label', () => {
    const w = mount(AssetDetailDrawer, { props: { file: makeAsset() } })
    expect(w.find('.k-drawer-filename').text()).toBe('肝疾病1.mp4')
    expect(w.find('.path').text()).toBe('/media/RAID_raid10/知识库/')
    expect(w.find('.k-asset-kind').text()).toBe(i18n.global.t('aiKbSrVideoAsset'))
  })

  it('falls back to the photo-library locator when Photos gave no path', () => {
    const w = mount(AssetDetailDrawer, { props: { file: makeAsset({ path: '', fullPath: '', name: i18n.global.t('aiKbSrVideoAsset') }) } })
    expect(w.find('.path').text()).toBe(i18n.global.t('aiKbSrPhotoLibrary'))
  })

  it('renders the matched caption with the query highlighted', () => {
    const w = mount(AssetDetailDrawer, { props: { file: makeAsset(), query: 'liver' } })
    const cap = w.find('.k-asset-caption-text')
    expect(cap.text()).toContain('A presenter explains the liver on a slide')
    expect(cap.find('mark').text()).toBe('liver')
  })

  it('escapes HTML in the caption before highlighting (K49 — v-html surface)', () => {
    const w = mount(AssetDetailDrawer, {
      props: { file: makeAsset({ chunks: [{ id: 'c', kind: 'caption', chunkNo: 0, page: null, score: 0.5, snippet: '<img src=x onerror=alert(1)> cat' }] }), query: 'cat' },
    })
    const cap = w.find('.k-asset-caption-text')
    expect(cap.find('img').exists()).toBe(false)
    expect(cap.html()).toContain('&lt;img')
  })
})

describe('AssetDetailDrawer — actions', () => {
  it('"Open in Photos" emits open-photos with the asset id (the old default click behaviour, now explicit)', async () => {
    const w = mount(AssetDetailDrawer, { props: { file: makeAsset() } })
    await w.find('.k-asset-open-photos').trigger('click')
    expect(w.emitted('open-photos')).toEqual([[ASSET]])
  })

  it('scrim click, the back button and Escape all emit close; clicks inside the panel do not', async () => {
    const w = mount(AssetDetailDrawer, { props: { file: makeAsset() }, attachTo: document.body })
    await w.find('.k-asset-media').trigger('click')
    expect(w.emitted('close')).toBeUndefined()
    await w.find('.k-drawer-bg').trigger('click')
    await w.find('.k-drawer-back').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(3)
    w.unmount()
  })
})
