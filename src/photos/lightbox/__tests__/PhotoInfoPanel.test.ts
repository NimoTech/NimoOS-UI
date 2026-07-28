import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import PhotoInfoPanel from '../PhotoInfoPanel.vue'
import { osmEmbedSrc } from '../util/osmMap'
import { usePhotosPeople } from '../../stores/people'
import type { Photo } from '../../util/assetToPhoto'

// 复用既有剪贴板 util(src/files/util/clipboard.ts 的 HTTP 非安全上下文兜底写法)——打桩验证调用,
// 不重复测 copyText 内部降级逻辑(那部分已有 src/files/util/clipboard.test.ts 覆盖)。
const copyText = vi.fn((_text: string) => Promise.resolve())
vi.mock('../../../files/util/clipboard', () => ({ copyText: (t: string) => copyText(t) }))

// Task 15B(SP7-P5 两笔记账收口):灯箱人脸 chip 引入 usePhotosPeople() 后,本组件依赖
// Pinia——三处宿主(时间线/收藏/相册详情)已各自 setActivePinia,这里补上组件自身单测的
// 同款前置(P3 T4 的同类教训:忘挂 Pinia 会红,不是本组件逻辑错)。
const svc = vi.hoisted(() => ({
  photos: {
    listPersons: vi.fn(
      (): Promise<{ persons: Array<Record<string, unknown>>; facesIndexedUpTo: string | null }> =>
        Promise.resolve({ persons: [], facesIndexedUpTo: null }),
    ),
    personFaceThumbnailUrl: vi.fn(
      (id: string | number, ver?: string | number | null) => `mock://face/${id}?ver=${ver ?? ''}`,
    ),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

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

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.listPersons.mockClear().mockResolvedValue({ persons: [], facesIndexedUpTo: null })
  svc.photos.personFaceThumbnailUrl.mockClear()
})

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

  it('renders face and tag chips; no unique person match → text/placeholder only (no img)', async () => {
    const photo = makePhoto({ faces: ['Alice', 'Bob'], tags: ['beach', 'sunset'], scene: 'Outdoor' })
    const w = mountPanel(photo)
    await w.vm.$nextTick()
    expect(w.find('[data-section="people"]').exists()).toBe(true)
    expect(w.findAll('.face-chip')).toHaveLength(2)
    expect(w.find('.face-chip img').exists()).toBe(false) // people list empty → no unique match, placeholder only
    expect(w.find('[data-section="nimo-sees"]').exists()).toBe(true)
    expect(w.findAll('.tag-chip')).toHaveLength(2)
  })

  // Task 15B(SP7-P5 两笔记账收口):人脸 chip 真头像。前置事实纠正(见 task-15-brief.md):
  // 后端没有 asset-scoped face-thumbnail 端点,Photo.faces 只是人名字符串数组——这里做的是
  // 「用人名反查人物列表拿 personId,唯一命中才显示真头像」的增强,超出 Vue2 原有的首字母占位。
  describe('人脸 chip 真头像(增强,超出 Vue2 1:1,登记为偏离)', () => {
    it('faces 非空且人物列表里有唯一同名 → 渲染 <img>,src 走 personFaceThumbnailUrl 且带 ver', async () => {
      svc.photos.listPersons.mockResolvedValue({
        persons: [{ id: 'pid-1', name: 'Alice', coverFaceId: 'face-9' }],
        facesIndexedUpTo: null,
      })
      const photo = makePhoto({ faces: ['Alice'] })
      const w = mountPanel(photo)
      await Promise.resolve() // fetchPeople 的 await
      await Promise.resolve()
      await w.vm.$nextTick()

      const img = w.find('.face-chip img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('mock://face/pid-1?ver=face-9')
      expect(svc.photos.personFaceThumbnailUrl).toHaveBeenCalledWith('pid-1', 'face-9')
    })

    it('重名(两个人同名)→ 仍是首字母占位,且首字母大写(personInitial,顺带修正 f[0] 未大写的坏点)', async () => {
      svc.photos.listPersons.mockResolvedValue({
        persons: [
          { id: 'pid-1', name: 'alice', coverFaceId: 'face-1' },
          { id: 'pid-2', name: 'alice', coverFaceId: 'face-2' },
        ],
        facesIndexedUpTo: null,
      })
      const photo = makePhoto({ faces: ['alice'] })
      const w = mountPanel(photo)
      await Promise.resolve()
      await Promise.resolve()
      await w.vm.$nextTick()

      expect(w.find('.face-chip img').exists()).toBe(false)
      expect(w.find('.face-avatar').text()).toBe('A') // personInitial('alice') = 'A',不是未大写的 'a'
    })

    it('faces 为空 → 不触发 fetchPeople(负向断言,避免每次开图白拉一次)', async () => {
      const photo = makePhoto({ faces: [] })
      mountPanel(photo)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      expect(svc.photos.listPersons).not.toHaveBeenCalled()
    })

    it('faces 非空且 people.peopleLoaded 已是 true(上游已加载过)→ 不重复 fetchPeople', async () => {
      const people = usePhotosPeople()
      await people.fetchPeople() // 预置成已加载
      svc.photos.listPersons.mockClear()

      const photo = makePhoto({ faces: ['Alice'] })
      mountPanel(photo)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      expect(svc.photos.listPersons).not.toHaveBeenCalled()
    })
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
