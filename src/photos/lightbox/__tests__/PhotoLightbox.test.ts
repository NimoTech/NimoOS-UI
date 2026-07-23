import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import PhotoLightbox from '../PhotoLightbox.vue'
import { useLightbox } from '../useLightbox'
import type { Photo } from '../../util/assetToPhoto'

// service mock —— bare shapes(URL 生成器 token 化 + 单例开态时调的水合/收藏三件套)
const favorite = vi.fn(() => Promise.resolve())
const unfavorite = vi.fn(() => Promise.resolve())
const listFavoriteIds = vi.fn<() => Promise<Array<string | number>>>(() => Promise.resolve([]))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      originalUrl: (id: string | number) => `/v1/photos/assets/${id}/original?token=t`,
      thumbnailUrl: (id: string | number, size = 'small') => `/v1/photos/assets/${id}/thumbnail?size=${size}&token=t`,
      liveUrl: (id: string | number) => `/v1/photos/assets/${id}/live?token=t`,
      recordView: () => Promise.resolve(),
      // reject → hydrateDetail 保留 list-item 占位,detail 恒等于测试 Photo(标题稳定)
      getAsset: () => Promise.reject(new Error('no hydrate in test')),
      getAssetOcr: () => Promise.resolve({ lines: [] }),
      listFavoriteIds: () => listFavoriteIds(),
      favorite: (id: string | number) => favorite(),
      unfavorite: (id: string | number) => unfavorite(),
    },
  },
}))

// jsdom 无媒体栈:video.play/pause 打桩
;(HTMLMediaElement.prototype as unknown as { play: () => Promise<void> }).play = vi.fn(() => Promise.resolve())
;(HTMLMediaElement.prototype as unknown as { pause: () => void }).pause = vi.fn()

function makePhoto(over: Partial<Photo> = {}): Photo {
  return {
    id: 'p1', title: 'Sunset', file: 'sunset.jpg', date: 'July 1, 2026', time: '12:00',
    takenAt: null, indexedAt: null, mimeType: 'image/jpeg', fileSize: 0,
    isVideo: false, hasOcr: false, isNew: false, isLivePhoto: false, livePhotoVideoId: null,
    duration: null, durationMs: 0, fav: false, status: undefined, filePath: '', width: null, height: null,
    dim: null, size: '', latitude: null, longitude: null, coords: null, place: null, camera: null,
    iso: null, shutter: null, aperture: null, focal: null, orientation: null, videoCodec: null,
    audioCodec: null, frameRate: null, bitRate: null, rotation: 0, matchScore: null, matchedBy: null,
    belowCut: false, tags: [], scene: null, faces: [], ...over,
  } as Photo
}

const IMG_A = makePhoto({ id: 'a', title: 'Alpha' })
const IMG_B = makePhoto({ id: 'b', title: 'Bravo' })
const IMG_C = makePhoto({ id: 'c', title: 'Charlie' })
const THREE = [IMG_A, IMG_B, IMG_C]

let wrapper: VueWrapper | null = null
function mountLb(): VueWrapper {
  wrapper = mount(PhotoLightbox, {
    global: { stubs: { PhotoImageViewer: { name: 'PhotoImageViewer', template: '<div class="stub-viewer" />' } } },
  })
  return wrapper
}

const lb = useLightbox()

beforeEach(() => {
  favorite.mockClear()
  unfavorite.mockClear()
  listFavoriteIds.mockReset()
  listFavoriteIds.mockResolvedValue([])
  lb.__resetForTest()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('PhotoLightbox 开合 + 标题/计数', () => {
  it('open=false 不渲染遮罩', () => {
    const w = mountLb()
    expect(w.find('.lightbox').exists()).toBe(false)
  })

  it('openAt 后渲染遮罩 + 标题 + 计数 1 / 3', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(w.find('.lightbox').exists()).toBe(true)
    expect(w.text()).toContain('Alpha')
    expect(w.text()).toContain('1 / 3')
  })
})

describe('PhotoLightbox 舞台分发', () => {
  it('视频项渲染原生 <video> 且 src=originalUrl,不渲染静图查看器', async () => {
    const w = mountLb()
    lb.openAt(makePhoto({ id: 'v1', title: 'Clip', isVideo: true, mimeType: 'video/mp4' }), [])
    await nextTick()
    const video = w.find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toBe('/v1/photos/assets/v1/original?token=t')
    expect(w.findComponent({ name: 'PhotoImageViewer' }).exists()).toBe(false)
  })

  it('图片项渲染 PhotoImageViewer(stub),不渲染 <video>', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(w.findComponent({ name: 'PhotoImageViewer' }).exists()).toBe(true)
    expect(w.find('video').exists()).toBe(false)
  })
})

describe('PhotoLightbox 关闭', () => {
  it('点关闭钮关灯箱(open→false)', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-close').trigger('click')
    expect(lb.open.value).toBe(false)
  })

  it('ESC 关灯箱', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(lb.open.value).toBe(false)
  })

  it('删除确认开时 ESC 只关模态不关灯箱', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
    await nextTick()
    expect(w.find('.lb-confirm').exists()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.find('.lb-confirm').exists()).toBe(false)
    expect(lb.open.value).toBe(true)
  })
})

describe('PhotoLightbox 翻页', () => {
  it('首张 prev 禁用、点 next 前进到 2 / 3', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect((w.find('.lb-nav-prev').element as HTMLButtonElement).disabled).toBe(true)
    await w.find('.lb-nav-next').trigger('click')
    await nextTick()
    expect(w.text()).toContain('2 / 3')
  })

  it('末张 next 禁用', async () => {
    const w = mountLb()
    lb.openAt(IMG_C, THREE)
    await nextTick()
    expect((w.find('.lb-nav-next').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('ArrowRight 前进、ArrowLeft 后退', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await nextTick()
    expect(w.text()).toContain('2 / 3')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    await nextTick()
    expect(w.text()).toContain('1 / 3')
  })
})

describe('PhotoLightbox 收藏', () => {
  it('点收藏钮调 favorite 并 emit toggle-fav,星变实心', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-fav').trigger('click')
    await nextTick()
    expect(favorite).toHaveBeenCalledTimes(1)
    expect(w.emitted('toggle-fav')?.[0]).toEqual(['a', true])
    expect(w.find('.lb-fav').classes()).toContain('is-fav')
  })

  it('已收藏项(listFavoriteIds 返回其 id)星为实心', async () => {
    listFavoriteIds.mockResolvedValue(['a'])
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await flushPromises()
    await nextTick()
    expect(w.find('.lb-fav').classes()).toContain('is-fav')
  })

  it('f 键切换收藏', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))
    await nextTick()
    expect(favorite).toHaveBeenCalledTimes(1)
  })
})

describe('PhotoLightbox 下载', () => {
  it('下载链接 href=originalUrl,带 download 属性', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    const a = w.find('a.lb-download')
    expect(a.attributes('href')).toBe('/v1/photos/assets/a/original?token=t')
    expect(a.attributes('download')).toBeDefined()
  })
})

describe('PhotoLightbox 详情开关', () => {
  it('点详情钮 toggle showInfo(挂载 Task 7 面板占位)', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(w.find('.lb-info').exists()).toBe(false)
    await w.find('.lb-info-toggle').trigger('click')
    await nextTick()
    expect(w.find('.lb-info').exists()).toBe(true)
    await w.find('.lb-info-toggle').trigger('click')
    await nextTick()
    expect(w.find('.lb-info').exists()).toBe(false)
  })
})

describe('PhotoLightbox 删除确认', () => {
  it('点垃圾桶开模态,确认 emit delete 携 current.id 并关灯箱', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-delete').trigger('click')
    await nextTick()
    expect(w.find('.lb-confirm').exists()).toBe(true)
    await w.find('.lb-confirm-ok').trigger('click')
    await nextTick()
    expect(w.emitted('delete')?.[0]).toEqual(['a'])
    expect(lb.open.value).toBe(false)
  })

  it('取消只关模态', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-delete').trigger('click')
    await nextTick()
    await w.find('.lb-confirm-cancel').trigger('click')
    await nextTick()
    expect(w.find('.lb-confirm').exists()).toBe(false)
    expect(lb.open.value).toBe(true)
    expect(w.emitted('delete')).toBeUndefined()
  })
})

describe('PhotoLightbox chrome 自隐', () => {
  it('鼠标不动 5s 后工具栏与箭头收起,mousemove 复现', async () => {
    vi.useFakeTimers()
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    // onMounted 触发一次 onMouseMove → 工具栏可见
    expect(w.find('.lb-top').exists()).toBe(true)
    expect(w.find('.lb-nav-next').exists()).toBe(true)
    vi.advanceTimersByTime(5000)
    await nextTick()
    expect(w.find('.lb-top').exists()).toBe(false)
    expect(w.find('.lb-nav-next').exists()).toBe(false)
    await w.find('.lightbox').trigger('mousemove')
    expect(w.find('.lb-top').exists()).toBe(true)
  })
})

describe('PhotoLightbox 实况照片', () => {
  it('实况项渲染实况徽标;按住播 <video src=liveUrl>,松开消失', async () => {
    const w = mountLb()
    lb.openAt(makePhoto({ id: 'lp', title: 'Live', isLivePhoto: true, livePhotoVideoId: 'lpv' }), [])
    await nextTick()
    const badge = w.find('.lb-live-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('实况')
    expect(w.find('video.lb-live-video').exists()).toBe(false)
    await badge.trigger('pointerdown')
    await nextTick()
    const lv = w.find('video.lb-live-video')
    expect(lv.exists()).toBe(true)
    expect(lv.attributes('src')).toBe('/v1/photos/assets/lp/live?token=t')
    await badge.trigger('pointerup')
    await nextTick()
    expect(w.find('video.lb-live-video').exists()).toBe(false)
  })
})
