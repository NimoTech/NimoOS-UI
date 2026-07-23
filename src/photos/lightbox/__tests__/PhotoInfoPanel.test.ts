import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import PhotoInfoPanel from '../PhotoInfoPanel.vue'
import { osmEmbedSrc } from '../util/osmMap'
import type { Photo } from '../../util/assetToPhoto'

// 复用既有剪贴板 util(src/files/util/clipboard.ts 的 HTTP 非安全上下文兜底写法)——打桩验证调用,
// 不重复测 copyText 内部降级逻辑(那部分已有 src/files/util/clipboard.test.ts 覆盖)。
const copyText = vi.fn((_text: string) => Promise.resolve())
vi.mock('../../../files/util/clipboard', () => ({ copyText: (t: string) => copyText(t) }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makePhoto(over: Partial<Photo> = {}): Photo {
  return {
    id: 'p1', title: 'Sunset', file: 'sunset.jpg', date: 'July 1, 2026', time: '12:00',
    takenAt: null, indexedAt: null, mimeType: 'image/jpeg', fileSize: 0,
    isVideo: false, hasOcr: false, isNew: false, isLivePhoto: false, livePhotoVideoId: null,
    duration: null, durationMs: 0, fav: false, status: undefined, filePath: '/DATA/Gallery/sunset.jpg',
    width: null, height: null, dim: null, size: '', latitude: null, longitude: null, coords: null,
    place: null, camera: null, iso: null, shutter: null, aperture: null, focal: null, orientation: null,
    videoCodec: null, audioCodec: null, frameRate: null, bitRate: null, rotation: 0, matchScore: null,
    matchedBy: null, belowCut: false, tags: [], scene: null, faces: [], ...over,
  } as Photo
}

function mountPanel(photo: Photo | null, visible = true) {
  return mount(PhotoInfoPanel, {
    props: { photo, visible },
    global: { plugins: [i18n] },
  })
}

afterEach(() => {
  copyText.mockClear()
})

describe('PhotoInfoPanel', () => {
  it('renders the camera section with populated fields, omitting empty ones', () => {
    const photo = makePhoto({ camera: 'Canon EOS R5', iso: 200, dim: '4000 × 3000', size: '3.2 MB', aperture: null })
    const w = mountPanel(photo)
    const text = w.text()
    expect(text).toContain('Canon EOS R5')
    expect(text).toContain('200')
    expect(text).toContain('4000 × 3000')
    expect(text).toContain('3.2 MB')
    // aperture is null → its row must not render at all
    expect(w.find('[data-field="aperture"]').exists()).toBe(false)
    expect(text).not.toContain('f/')
  })

  it('formats aperture and focal length like the Vue2 source', () => {
    const photo = makePhoto({ aperture: 1.8, focal: 35 })
    const w = mountPanel(photo)
    expect(w.text()).toContain('f/1.8')
    expect(w.text()).toContain('35 mm')
  })

  it('renders the video section (not the camera section) for a video photo', () => {
    const photo = makePhoto({ isVideo: true, duration: '1:23', dim: '1920 × 1080', videoCodec: 'h264' })
    const w = mountPanel(photo)
    expect(w.find('[data-field="duration"]').exists()).toBe(true)
    expect(w.find('[data-field="video-codec"]').exists()).toBe(true)
    expect(w.find('[data-field="camera"]').exists()).toBe(false)
  })

  it('renders an OSM iframe with osmEmbedSrc when lat/lon are present', () => {
    const photo = makePhoto({ latitude: 31.23, longitude: 121.47, place: 'Shanghai', coords: '31.230000, 121.470000' })
    const w = mountPanel(photo)
    const iframe = w.find('iframe')
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('src')).toBe(osmEmbedSrc(31.23, 121.47))
    expect(iframe.attributes('loading')).toBe('lazy')
    expect(w.find('.map-pin').exists()).toBe(true)
  })

  it('omits the location section entirely when lat/lon are absent', () => {
    const photo = makePhoto({ latitude: null, longitude: null })
    const w = mountPanel(photo)
    expect(w.find('iframe').exists()).toBe(false)
  })

  it('hides the people/nimo-sees sections when faces/tags are empty (P2 timeline path)', () => {
    const photo = makePhoto({ faces: [], tags: [], scene: null })
    const w = mountPanel(photo)
    expect(w.find('[data-section="people"]').exists()).toBe(false)
    expect(w.find('[data-section="nimo-sees"]').exists()).toBe(false)
  })

  it('renders face and tag chips without an asset-scoped face-thumbnail when present', () => {
    const photo = makePhoto({ faces: ['Alice', 'Bob'], tags: ['beach', 'sunset'], scene: 'Outdoor' })
    const w = mountPanel(photo)
    expect(w.find('[data-section="people"]').exists()).toBe(true)
    expect(w.findAll('.face-chip')).toHaveLength(2)
    expect(w.find('.face-chip img').exists()).toBe(false) // no face-thumbnail asset, text/placeholder only
    expect(w.find('[data-section="nimo-sees"]').exists()).toBe(true)
    expect(w.findAll('.tag-chip')).toHaveLength(2)
  })

  it('does not render the ask-nimo hand-off button (removed delta)', () => {
    const w = mountPanel(makePhoto())
    expect(w.text()).not.toContain('Nimo')
    expect(w.find('.give-nimo').exists()).toBe(false)
  })

  it('renders nothing when visible=false', () => {
    const w = mountPanel(makePhoto(), false)
    expect(w.find('.info-panel').exists()).toBe(false)
  })

  it('renders nothing when photo is null', () => {
    const w = mountPanel(null, true)
    expect(w.find('.info-panel').exists()).toBe(false)
  })

  it('copies the file path via the clipboard util and flips to the copied label for ~2s', async () => {
    vi.useFakeTimers()
    const photo = makePhoto({ filePath: '/DATA/Gallery/sunset.jpg' })
    const w = mountPanel(photo)
    const btn = w.find('.copy-btn')
    expect(w.text()).toContain('/DATA/Gallery/sunset.jpg')
    await btn.trigger('click')
    expect(copyText).toHaveBeenCalledWith('/DATA/Gallery/sunset.jpg')
    await Promise.resolve()
    expect(w.text()).toContain(zh.photosCopied)
    vi.advanceTimersByTime(2100)
    await Promise.resolve()
    expect(w.text()).not.toContain(zh.photosCopied)
    vi.useRealTimers()
  })
})
