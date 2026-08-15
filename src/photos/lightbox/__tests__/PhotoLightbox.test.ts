import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import PhotoLightbox from '../PhotoLightbox.vue'
// 样式断言读组件源文本(scoped <style> 的声明在 jsdom 里拿不到,且 jsdom 不算级联)——
// 同 P6b-T7 已落地的「先锚定规则体、再断言属性」体例。
import LIGHTBOX_SRC from '../PhotoLightbox.vue?raw'
import { useLightbox } from '../useLightbox'
import { usePhotosFavorites } from '../../stores/favorites'
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
    global: {
      stubs: {
        PhotoImageViewer: { name: 'PhotoImageViewer', template: '<div class="stub-viewer" />' },
        // Task 9 起 PhotoLightbox 真挂了 T7/T8 —— 本文件只测灯箱壳(开合/翻页/收藏/删除/
        // chrome 自隐等),详情栏/缩略图条各自的行为在 PhotoInfoPanel.test.ts / PhotoFilmstrip.test.ts
        // 覆盖。stub 保留 visible 门控 + class="lb-info",维持既有「详情开关」断言不变。
        PhotoInfoPanel: {
          name: 'PhotoInfoPanel',
          props: ['photo', 'visible'],
          template: '<aside v-if="visible" class="lb-info" />',
        },
        PhotoFilmstrip: {
          name: 'PhotoFilmstrip',
          props: ['list', 'index'],
          template: '<div class="stub-filmstrip" />',
        },
      },
    },
  })
  return wrapper
}

// 只建一次 pinia(而非每个 beforeEach 重建):useLightbox 的 isFav computed 是模块级单例,
// 其 `current.value && fav.isFav(...)` 短路结构导致——当 current 引用值在两次求值间恰好复用
// 同一对象(本文件 IMG_A/B/C 是跨用例共享的模块级常量)时,Vue 判定“无变化”而跳过重新求值,
// isFav 会一直挂在上一个(已随 createPinia() 报废的)store 实例的 favIds 上,永远收不到新
// store 的翻转通知。保留同一个 pinia/store,改为每个用例用 store 自身的 __resetForTest()
// 清空状态——语义上等价于重构前「同一个模块级 favIds ref,每次用例重置 .value」的做法。
setActivePinia(createPinia())
const lb = useLightbox()

beforeEach(() => {
  favorite.mockClear()
  unfavorite.mockClear()
  listFavoriteIds.mockReset()
  listFavoriteIds.mockResolvedValue([])
  usePhotosFavorites().__resetForTest()
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

// Plan F Task 3: container re-shaped from a flex column to a CSS Grid mirroring Vue2/parity
// exactly (grid-template-rows 56px 1fr 88px; data-info="true" → columns 1fr 360px + named
// areas "top top"/"main info"/"strip info"; "false" → single column). Style assertions read
// the component's own source text (jsdom doesn't compute cascade), same idiom as the
// "顶栏是不透明流内 chrome" block below.
describe('PhotoLightbox 结构:容器 grid + data-info 契约(Plan F Task 3)', () => {
  const rule = (selector: string): string => {
    const m = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(LIGHTBOX_SRC)
    expect(m, `找不到规则 ${selector}`).not.toBeNull()
    return m![1]
  }

  it('.lightbox 是 display:grid,行高 56px 1fr 88px,z-index 200', () => {
    const body = rule('\\.lightbox')
    expect(body).toMatch(/display:\s*grid/)
    expect(body).toMatch(/grid-template-rows:\s*56px 1fr 88px/)
    expect(body).toMatch(/z-index:\s*200/)
    expect(body).toMatch(/position:\s*fixed/)
  })

  it('data-info="true":两列(1fr 360px)+ 三区域命名(top top / main info / strip info)', () => {
    const body = rule('\\.lightbox\\[data-info="true"\\]')
    expect(body).toMatch(/grid-template-columns:\s*1fr 360px/)
    expect(body).toMatch(/grid-template-areas:\s*"top top" "main info" "strip info"/)
  })

  it('data-info="false":单列 + 三区域各占一整行(top / main / strip)', () => {
    const body = rule('\\.lightbox\\[data-info="false"\\]')
    expect(body).toMatch(/grid-template-columns:\s*1fr;/)
    expect(body).toMatch(/grid-template-areas:\s*"top" "main" "strip"/)
  })

  it('.lb-main/.lb-nav[data-side]/.lb-strip/.lb-info 都是 .lightbox 的直接子元素(不再嵌套在 .lb-body 里)', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-info-toggle').trigger('click')
    await nextTick()
    const lightbox = w.get('.lightbox').element
    const main = w.get('.lb-main').element
    const info = w.get('.lb-info').element // PhotoInfoPanel 的 stub(见 mountLb 的 stubs)
    const strip = w.get('.stub-filmstrip').element // PhotoFilmstrip 的 stub
    expect(main.parentElement).toBe(lightbox)
    expect(info.parentElement).toBe(lightbox)
    expect(strip.parentElement).toBe(lightbox)
    // 不存在旧的 .lb-body 包裹元素
    expect(w.find('.lb-body').exists()).toBe(false)
  })

  it('翻页箭头用 data-side 属性而非 .lb-nav-prev/.lb-nav-next 修饰类', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    const prev = w.get('.lb-nav[data-side="prev"]')
    const next = w.get('.lb-nav[data-side="next"]')
    expect(prev.classes()).not.toContain('lb-nav-prev')
    expect(next.classes()).not.toContain('lb-nav-next')
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
    // Plan F Task 3: the media element carries parity's anchor `.lb-photo`
    // (`.lb-media > .lb-photo(img|video)`) alongside this component's own `.lb-video`.
    expect(video.classes()).toContain('lb-photo')
    expect(video.classes()).toContain('lb-video')
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
    expect((w.find('.lb-nav[data-side="prev"]').element as HTMLButtonElement).disabled).toBe(true)
    await w.find('.lb-nav[data-side="next"]').trigger('click')
    await nextTick()
    expect(w.text()).toContain('2 / 3')
  })

  it('末张 next 禁用', async () => {
    const w = mountLb()
    lb.openAt(IMG_C, THREE)
    await nextTick()
    expect((w.find('.lb-nav[data-side="next"]').element as HTMLButtonElement).disabled).toBe(true)
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
    await w.find('.trash-btn-cta-danger').trigger('click')
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
    await w.find('.trash-btn-ghost').trigger('click')
    await nextTick()
    expect(w.find('.lb-confirm').exists()).toBe(false)
    expect(lb.open.value).toBe(true)
    expect(w.emitted('delete')).toBeUndefined()
  })
})

describe('PhotoLightbox chrome 自隐', () => {
  // 用户 2026-07-31 验收要求改了自隐的范围:顶栏是不透明流内 chrome、**恒显不自隐**
  // (它一收起舞台就变高、图片会跳);只有叠在照片上的翻页箭头仍然 5s 自隐。
  it('鼠标不动 5s 后只有箭头收起、顶栏留着,mousemove 复现箭头', async () => {
    vi.useFakeTimers()
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(w.find('.lb-top').exists()).toBe(true)
    expect(w.find('.lb-nav[data-side="next"]').exists()).toBe(true)
    vi.advanceTimersByTime(5000)
    await nextTick()
    // 顶栏不再受 isMoving 管辖 —— 删掉模板里那个 v-if 的守卫就靠这一条
    expect(w.find('.lb-top').exists()).toBe(true)
    expect(w.find('.lb-nav[data-side="next"]').exists()).toBe(false)
    await w.find('.lightbox').trigger('mousemove')
    expect(w.find('.lb-nav[data-side="next"]').exists()).toBe(true)
  })
})

describe('PhotoLightbox 顶栏是不透明流内 chrome(用户 2026-07-31 验收要求)', () => {
  // 样式断言:先锚定 .lb-top 规则体再断言属性(全文件级 toContain 是恒真的)。
  const topRule = (): string => {
    const m = /\.lb-top\s*\{([^}]*)\}/.exec(LIGHTBOX_SRC)
    expect(m).not.toBeNull()
    return m![1]
  }

  it('实底 --popup-bg,不是渐变、不是绝对定位', () => {
    const body = topRule()
    expect(body).toMatch(/background:\s*var\(--popup-bg\)/)
    expect(body).not.toMatch(/position:\s*absolute/)
    expect(body).not.toMatch(/linear-gradient/)
  })

  // Plan F Task 3: the container switched from a flex column to a CSS Grid (parity's own
  // row/column/area shape) -- `.lb-top` now claims its row via `grid-area: top` instead of
  // `flex: 0 0 auto`. The underlying user-facing requirement (an opaque row of its own, with a
  // separating line from the stage below) is unchanged; only the layout mechanism is.
  it('占据网格自己的一行(grid-area: top)并与舞台之间有分隔线(图片因此夹在上下两栏之间)', () => {
    const body = topRule()
    expect(body).toMatch(/grid-area:\s*top/)
    expect(body).toMatch(/border-bottom:\s*1px solid var\(--card-border\)/)
  })

  it('详情栏上边距不再为顶栏让位(64px → 16px,否则比同排舞台下沉一截)', () => {
    // Plan F Task 3: PhotoInfoPanel's root renamed `.info-panel` → `.lb-info`.
    const m = /:deep\(\.lb-info\)\s*\{([^}]*)\}/.exec(LIGHTBOX_SRC)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/margin:\s*16px 16px 16px 0/)
  })
})

describe('PhotoLightbox 视频起播位续播', () => {
  // 关键回归:组件持久挂载,openAt 先于 loadedmetadata 把 open 由假变真,
  // 锚点须在 open 变真时捕获(而非 onMounted 时,那一刻灯箱未开、current 为空)。
  function trackCurrentTime(el: HTMLVideoElement, durationS: number): () => number {
    Object.defineProperty(el, 'duration', { value: durationS, configurable: true })
    let ct = 0
    Object.defineProperty(el, 'currentTime', {
      get: () => ct,
      set: (v: number) => { ct = v },
      configurable: true,
    })
    return () => ct
  }

  it('悬停位打开视频,loadedmetadata 后真的 seek 到 16s(startMs 16000)', async () => {
    const VID_A = makePhoto({ id: 'vA', title: 'ClipA', isVideo: true, mimeType: 'video/mp4' })
    const w = mountLb()
    lb.openAt(VID_A, [VID_A], 16000)
    await nextTick()
    const video = w.find('video')
    expect(video.exists()).toBe(true)
    const readCt = trackCurrentTime(video.element as HTMLVideoElement, 60)
    await video.trigger('loadedmetadata')
    expect(readCt()).toBe(16) // 16000ms / 1000 = 16s
  })

  it('翻页到另一视频不再 seek(startApplied 一次性守卫)', async () => {
    const VID_A = makePhoto({ id: 'vA', title: 'ClipA', isVideo: true, mimeType: 'video/mp4' })
    const VID_B = makePhoto({ id: 'vB', title: 'ClipB', isVideo: true, mimeType: 'video/mp4' })
    const w = mountLb()
    lb.openAt(VID_A, [VID_A, VID_B], 16000)
    await nextTick()
    const readA = trackCurrentTime(w.find('video').element as HTMLVideoElement, 60)
    await w.find('video').trigger('loadedmetadata')
    expect(readA()).toBe(16)
    // 翻页到第二个视频:元素按 id 重建,新视频不应被 seek 到 16s
    lb.next()
    await nextTick()
    const readB = trackCurrentTime(w.find('video').element as HTMLVideoElement, 60)
    await w.find('video').trigger('loadedmetadata')
    expect(readB()).toBe(0)
  })
})

describe('PhotoLightbox 持久挂载:onMounted 时灯箱未开', () => {
  // 回归(评审 finding #1):父级只挂载一次、内部靠 v-if="lb.open.value" 自门控,onMounted 时
  // 灯箱通常还关着 —— 若 isMoving 的 5s 自隐计时只在 onMounted arm 一次,组件常年挂着、这个计时
  // 早就过期,真正 openAt 打开时顶栏 + 翻页箭头会因 isMoving=false 而全部不可见,看起来像没渲染。
  it('mount 时灯箱已关、且早于任何 openAt 的 5s 计时已过期 —— openAt 后工具栏 + 翻页箭头必须可见', async () => {
    vi.useFakeTimers()
    const w = mountLb() // 挂载时 lb.open.value === false(beforeEach 已 __resetForTest)
    expect(w.find('.lightbox').exists()).toBe(false)
    // 早于任何 open 就把 onMounted 里 arm 的计时熬过期
    vi.advanceTimersByTime(5000)
    lb.openAt(IMG_A, THREE)
    await nextTick()
    expect(w.find('.lightbox').exists()).toBe(true)
    expect(w.find('.lb-top').exists()).toBe(true) // 顶栏工具栏(收藏/下载/详情/删除等)
    expect(w.find('.lb-nav[data-side="next"]').exists()).toBe(true) // 翻页箭头
  })

  it('open 时 showInfo 复位为 false,即便上一次打开曾切到 true', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-info-toggle').trigger('click')
    await nextTick()
    expect(w.find('.lb-info').exists()).toBe(true) // 上一次打开切开了详情栏
    lb.close()
    await nextTick()
    lb.openAt(IMG_B, THREE)
    await nextTick()
    expect(w.find('.lb-info').exists()).toBe(false) // 重开应默认收起
  })
})

describe('PhotoLightbox 加入相册(Task 9)', () => {
  it('顶栏在收藏按钮与下载按钮之间渲染「加入相册」按钮', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    const btns = Array.from(w.find('.lb-top').element.querySelectorAll('button, a'))
    const favIdx = btns.findIndex((b) => b.classList.contains('lb-fav'))
    const addIdx = btns.findIndex((b) => b.classList.contains('lb-add-album'))
    const dlIdx = btns.findIndex((b) => b.classList.contains('lb-download'))
    expect(favIdx).toBeGreaterThanOrEqual(0)
    expect(addIdx).toBeGreaterThan(favIdx)
    expect(addIdx).toBeLessThan(dlIdx)
  })

  it('点「加入相册」emit add-to-album(current.id),灯箱保持打开', async () => {
    const w = mountLb()
    lb.openAt(IMG_A, THREE)
    await nextTick()
    await w.find('.lb-add-album').trigger('click')
    await nextTick()
    expect(w.emitted('add-to-album')?.[0]).toEqual(['a'])
    expect(lb.open.value).toBe(true)
    expect(w.find('.lightbox').exists()).toBe(true)
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
