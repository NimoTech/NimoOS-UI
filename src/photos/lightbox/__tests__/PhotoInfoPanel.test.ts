import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import PhotoInfoPanel from '../PhotoInfoPanel.vue'
// 样式断言读组件源文本(scoped <style> 的声明在 jsdom 里拿不到)——同 P6b-T7 的
// 「先锚定规则体、再断言属性」体例。
import PANEL_SRC from '../PhotoInfoPanel.vue?raw'
// Plan F Task 5: `.lb-info`'s `grid-area`/`.map-mini`'s `height` no longer have local copies
// (retired -- both were byte-duplicates of parity's own `.photos-root .lb-info`/`.map-mini`, see
// PhotoInfoPanel.vue's scoped-style retirement note). Read parity's source instead now that it's
// what actually governs.
// Read via node:fs rather than a Vite `?raw` import -- Vite's CSS/SCSS handling intercepts
// `.scss?raw` before the raw-loader can return it (empirically empty in this project's vitest
// setup); every other guard test reading vue2-parity/*.scss uses fs for the same reason.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const PARITY_SRC = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../styles/vue2-parity/photos.scss'),
  'utf8',
)
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

  // Plan F Task 3: root class renamed from the invented `.info-panel` to parity's real anchor
  // `.lb-info` (grid-area: info), and `.map-mini`'s height corrected to parity's 132px.
  // Plan F Task 5: both style assertions below are retargeted to parity's source -- `grid-area`/
  // `height` no longer have local copies (retired as byte-duplicates, see PhotoInfoPanel.vue's
  // scoped-style retirement note); parity's `.photos-root .lb-info`/`.photos-root .map-mini`
  // solely govern now that this component nests inside `.photos-root`.
  describe('结构:.lb-info 锚点 + grid-area(Plan F Task 3, retargeted to parity in Task 5)', () => {
    it('根元素渲染为 .lb-info(不是旧的 .info-panel)', () => {
      const w = mountPanel(makePhoto())
      expect(w.find('.lb-info').exists()).toBe(true)
      expect(w.find('.info-panel').exists()).toBe(false)
    })

    it('.lb-info 规则里带 grid-area: info(作为 PhotoLightbox 网格的直接子元素)', () => {
      const m = /\.photos-root \.lb-info\s*\{([^}]*)\}/.exec(PARITY_SRC)
      expect(m).not.toBeNull()
      expect(m![1]).toMatch(/grid-area:\s*info/)
    })

    it('.map-mini 高度对齐 Vue2/parity 的 132px(此前是 140px)', () => {
      const m = /\.photos-root \.map-mini\s*\{([^}]*)\}/.exec(PARITY_SRC)
      expect(m).not.toBeNull()
      expect(m![1]).toMatch(/height:\s*132px/)
    })
  })

  // I3 (final review, 2026-08-15): `.lb-info { display:flex; flex-direction:column; gap:16px }` +
  // `.info-section { ...; gap:6px }` were an unregistered pixel deviation -- Vue2 stacks sections
  // flush (padding 12px 20px + border-bottom, no gap at all, parity :690-691), not with a 16px/6px
  // flex gap layered on top. Assert both rules stop declaring flex/flex-direction/gap so parity's
  // flush stacking governs.
  describe('.lb-info / .info-section 不再叠加 flex gap(I3, 对齐 Vue2 的贴靠堆叠)', () => {
    // 只在真正的 <style scoped> 块内找规则 -- 本文件顶部 template 注释里就引用过
    // "`.lb-info { grid-area: info; ... }`" 这样一段解释性文字(描述 parity 的规则长什么样),
    // 若直接对整份 PANEL_SRC 用无锚定正则,会先命中注释里的这段示例文本而不是真正的 CSS 规则,
    // 静默产生假阳性(2026-08-15 final review 排查实证过)。
    const STYLE_BLOCK = /<style[^>]*>([\s\S]*)<\/style>/.exec(PANEL_SRC)![1]

    it('.lb-info 本地规则不声明 display/flex-direction/gap', () => {
      const m = /\.lb-info\s*\{([^}]*)\}/.exec(STYLE_BLOCK)
      expect(m, '找不到 .lb-info 规则').not.toBeNull()
      expect(m![1]).not.toMatch(/display:\s*flex/)
      expect(m![1]).not.toMatch(/flex-direction/)
      expect(m![1]).not.toMatch(/gap/)
    })

    it('.info-section 本地规则不声明 display/flex-direction/gap', () => {
      const m = /(?<!\.)\.info-section\s*\{([^}]*)\}/.exec(STYLE_BLOCK)
      expect(m, '找不到 .info-section 规则').not.toBeNull()
      expect(m![1]).not.toMatch(/display:\s*flex/)
      expect(m![1]).not.toMatch(/flex-direction/)
      expect(m![1]).not.toMatch(/gap/)
    })

    it('parity 的 .photos-root .info-section 仍是 padding + border-bottom 的贴靠堆叠', () => {
      const m = /\.photos-root \.info-section\s*\{([^}]*)\}/.exec(PARITY_SRC)
      expect(m, '找不到 parity 的 .photos-root .info-section').not.toBeNull()
      expect(m![1]).toMatch(/padding:\s*12px 20px/)
      expect(m![1]).toMatch(/border-bottom/)
    })
  })

  // 用户 2026-07-31 验收要求:去掉 OSM 内嵌页自带的页脚文字(Report a problem /
  // Make a Donation / Website and API terms)。iframe 跨域、内部元素无法用 CSS 隐藏,
  // 只能外层裁切;裁切必须上下对称,否则 OSM 自己的标记会掉到 .map-pin 下方错位。
  describe('OSM 页脚裁切(用户 2026-07-31 验收要求)', () => {
    const rule = (sel: string): string => {
      const m = new RegExp(`${sel}\\s*\\{([^}]*)\\}`).exec(PANEL_SRC)
      expect(m).not.toBeNull()
      return m![1]
    }

    it('iframe 上下对称加高并上移(裁掉页脚 + 地图中心仍对齐盒子中心)', () => {
      const body = rule('\\.map-mini iframe')
      expect(body).toMatch(/top:\s*-48px/)
      expect(body).toMatch(/height:\s*calc\(100% \+ 96px\)/) // 2 × 48,对称
      expect(body).toMatch(/position:\s*absolute/)
    })

    it('补了自绘归属声明(ODbL 要求署名,不能连 credit 一起裁掉)', () => {
      const photo = makePhoto({ latitude: 31.23, longitude: 121.47, place: 'Shanghai' })
      const w = mountPanel(photo)
      const credit = w.find('.map-credit')
      expect(credit.exists()).toBe(true)
      expect(credit.text()).toContain('OpenStreetMap')
    })

    it('归属声明的固定浅色带 theme-exception(压在任意瓦片上,颜色不可预测)', () => {
      const body = rule('\\.map-credit')
      // color-guard 的豁免窗口是逐行状态机 —— 注释必须紧贴被豁免的那一条声明
      expect(PANEL_SRC).toMatch(/theme-exception[^\n]*\n\s*color:\s*rgba\(255, 255, 255, 0\.72\)/)
      expect(body).toMatch(/pointer-events:\s*none/)
    })
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
    // Plan F Task 3: renamed from `.tag-chip` to parity's real anchor `.tag[data-kind="ai"]`.
    expect(w.findAll('.tag[data-kind="ai"]')).toHaveLength(2)
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
    expect(w.find('.lb-info').exists()).toBe(false)
  })

  it('renders nothing when photo is null', () => {
    const w = mountPanel(null, true)
    expect(w.find('.lb-info').exists()).toBe(false)
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
