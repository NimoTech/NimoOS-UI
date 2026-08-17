// Task 5 (SP7-P4 相册): AlbumPickerDialog.vue —— 「加入相册」选择器。
// 挂 Pinia + i18n(用真实 zh_cn 词条,不用手写迷你 locale——本组件的核心行为就是插值文案本身)。
// mock 共享包 @nimotech/nimoos-service,经由真实 usePhotosAlbums()/useToast() store 端到端验证:
// 点相册项 → 断言底层 service.photos.batchAddToAlbum 真的被调(而不是 mock 掉 store 本身),
// 这样能测出 T2 store 与本组件的实际接线,不是纯白盒断言。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import zh from '../../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    listAlbums: vi.fn(),
    createAlbum: vi.fn(),
    getAlbum: vi.fn(),
    batchAddToAlbum: vi.fn(),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import AlbumPickerDialog from '../AlbumPickerDialog.vue'
import { useToast } from '../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountDialog(props: { open: boolean; assetIds: Array<string | number> }) {
  return mount(AlbumPickerDialog, { props, global: { plugins: [i18n] } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.listAlbums.mockReset().mockResolvedValue([
    { id: 1, name: 'Trip', assetCount: 3 },
    { id: 2, name: 'Family', assetCount: 10 },
  ])
  svc.photos.createAlbum.mockReset()
  svc.photos.getAlbum.mockReset().mockResolvedValue({ assets: [] })
  svc.photos.batchAddToAlbum.mockReset().mockResolvedValue(undefined)
  svc.photos.thumbnailUrl.mockClear()
})

describe('AlbumPickerDialog.vue', () => {
  it('open false→true → 拉取相册列表,渲染相册项(标题+计数)与「+ 新建相册」行', async () => {
    const w = mountDialog({ open: false, assetIds: ['a1'] })
    expect(svc.photos.listAlbums).not.toHaveBeenCalled()
    await w.setProps({ open: true })
    await flushPromises()
    expect(svc.photos.listAlbums).toHaveBeenCalledTimes(1)
    const items = w.findAll('[data-test="album-picker-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Trip')
    expect(items[0]!.text()).toContain('3')
    expect(items[1]!.text()).toContain('Family')
    expect(items[1]!.text()).toContain('10')
    expect(w.find('[data-test="album-picker-new"]').exists()).toBe(true)
    expect(w.text()).toContain('新建相册')
  })

  it('点某相册项 → addAssetsToAlbum(该id, assetIds) 被调 → emit added + update:open(false) + toast', async () => {
    const w = mountDialog({ open: true, assetIds: ['a1', 'a2'] })
    await flushPromises()
    const toast = useToast()
    const items = w.findAll('[data-test="album-picker-item"]')
    await items[1]!.trigger('click') // Family, id=2
    await flushPromises()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith(2, ['a1', 'a2'])
    expect(w.emitted('added')).toEqual([[2, 2]])
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(toast.toasts.length).toBe(1)
    expect(toast.toasts[0]!.text).toContain('Family')
    expect(toast.toasts[0]!.text).toContain('2')
  })

  it('store 抛错(addAssetsToAlbum 失败)→ 面板仍 open,toast 为失败文案', async () => {
    svc.photos.batchAddToAlbum.mockRejectedValueOnce(new Error('boom'))
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    const toast = useToast()
    const items = w.findAll('[data-test="album-picker-item"]')
    await items[0]!.trigger('click')
    await flushPromises()

    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.emitted('added')).toBeUndefined()
    expect(toast.toasts.length).toBe(1)
    expect(toast.toasts[0]!.text).toBe(zh.photosAlbumAddFailed)
  })

  it('点「+ 新建相册」→ 出现输入框;输入名+回车 → createAlbum 然后 addAssetsToAlbum 依次被调', async () => {
    svc.photos.createAlbum.mockResolvedValueOnce({ id: 99, name: 'New Trip' })
    // createAlbum 内部会 fetchAlbums 一次(store 行为),让新相册出现在列表里
    svc.photos.listAlbums
      .mockResolvedValueOnce([{ id: 1, name: 'Trip', assetCount: 3 }])
      .mockResolvedValueOnce([
        { id: 1, name: 'Trip', assetCount: 3 },
        { id: 99, name: 'New Trip', assetCount: 0 },
      ])
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()

    await w.get('[data-test="album-picker-new"]').trigger('click')
    const input = w.get('[data-test="album-picker-new-input"]')
    await input.setValue('New Trip')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    const callOrder: string[] = []
    // 断言调用顺序:createAlbum 先于 batchAddToAlbum
    expect(svc.photos.createAlbum).toHaveBeenCalledWith('New Trip')
    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith(99, ['a1'])
    const createOrder = svc.photos.createAlbum.mock.invocationCallOrder[0]!
    const addOrder = svc.photos.batchAddToAlbum.mock.invocationCallOrder[0]!
    expect(createOrder).toBeLessThan(addOrder)
    void callOrder
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('createAlbum 抛 409 → 显示重名提示,addAssetsToAlbum 未被调,输入内容仍在', async () => {
    const err = Object.assign(new Error('conflict'), { response: { status: 409 } })
    svc.photos.createAlbum.mockRejectedValueOnce(err)
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    const toast = useToast()

    await w.get('[data-test="album-picker-new"]').trigger('click')
    const input = w.get('[data-test="album-picker-new-input"]')
    await input.setValue('Trip')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(svc.photos.batchAddToAlbum).not.toHaveBeenCalled()
    expect(toast.toasts[0]!.text).toBe(zh.photosAlbumNameExists)
    // 面板未关,输入框还在且内容保留
    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.get<HTMLInputElement>('[data-test="album-picker-new-input"]').element.value).toBe('Trip')
  })

  it('createAlbum 抛非409错误 → 显示创建失败提示', async () => {
    svc.photos.createAlbum.mockRejectedValueOnce(new Error('server error'))
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    const toast = useToast()

    await w.get('[data-test="album-picker-new"]').trigger('click')
    const input = w.get('[data-test="album-picker-new-input"]')
    await input.setValue('Trip')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(toast.toasts[0]!.text).toBe(zh.photosAlbumCreateFailed)
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('createAlbum 抛无 response 字段但 message 含 409 的错误 → 仍判定为重名(brief 的 message 兜底)', async () => {
    svc.photos.createAlbum.mockRejectedValueOnce(new Error('request failed with status code 409'))
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    const toast = useToast()

    await w.get('[data-test="album-picker-new"]').trigger('click')
    const input = w.get('[data-test="album-picker-new-input"]')
    await input.setValue('Trip')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(toast.toasts[0]!.text).toBe(zh.photosAlbumNameExists)
    expect(toast.toasts[0]!.text).not.toBe(zh.photosAlbumCreateFailed)
  })

  it('相册列表为空 → 渲染 photosAddToAlbumEmpty,「新建」行仍在', async () => {
    svc.photos.listAlbums.mockResolvedValue([])
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()

    expect(w.findAll('[data-test="album-picker-item"]')).toHaveLength(0)
    expect(w.text()).toContain(zh.photosAddToAlbumEmpty)
    expect(w.find('[data-test="album-picker-new"]').exists()).toBe(true)
  })

  it('assetIds 为空 → 相册项 disabled,点击不触发 store;「+ 新建相册」入口同样 disabled(避免建了相册却无反馈)', async () => {
    const w = mountDialog({ open: true, assetIds: [] })
    await flushPromises()

    const items = w.findAll('[data-test="album-picker-item"]')
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect((item.element as HTMLButtonElement).disabled).toBe(true)
    }
    await items[0]!.trigger('click')
    await flushPromises()
    expect(svc.photos.batchAddToAlbum).not.toHaveBeenCalled()

    const newBtn = w.get<HTMLButtonElement>('[data-test="album-picker-new"]')
    expect(newBtn.element.disabled).toBe(true)
    await newBtn.trigger('click')
    await flushPromises()
    expect(svc.photos.createAlbum).not.toHaveBeenCalled()
    expect(w.find('[data-test="album-picker-new-input"]').exists()).toBe(false)
  })

  // 焦点在真实使用中大概率不落在面板 DOM 子树内(用户从触发按钮打开面板、不点面板内部
  // 直接按 Esc),所以必须在 document 上派发 keydown 才是真的场景——绝不在 overlay/input
  // 元素上 .trigger('keydown'),那只测得到"元素恰好持有焦点"这个不成立的前提。
  it('Esc 分层(document 级派发,不依赖真实焦点):输入展开时先收起输入行,再次 Esc 才关闭面板', async () => {
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    await w.get('[data-test="album-picker-new"]').trigger('click')
    expect(w.find('[data-test="album-picker-new-input"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.find('[data-test="album-picker-new-input"]').exists()).toBe(false)
    expect(w.emitted('update:open')).toBeUndefined()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('面板关闭(open===false)后 Esc 不再有任何效果(监听已摘除)', async () => {
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    await w.setProps({ open: false })
    await flushPromises()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('封面缺失时不调用 thumbnailUrl(渲染渐变占位而非拼 URL)', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 5, name: 'NoCover', assetCount: 0 }])
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    expect(svc.photos.thumbnailUrl).not.toHaveBeenCalled()
    expect(w.find('[data-test="album-picker-cover-empty"]').exists()).toBe(true)
  })

  it('有封面时通过 service.photos.thumbnailUrl 生成图片 URL(不手拼)', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 6, name: 'Cover', assetCount: 1, coverAssetId: 'asset-77' }])
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('asset-77', 'small')
    const img = w.get('[data-test="album-picker-item"] img')
    expect(img.attributes('src')).toBe('mock://thumb/asset-77/small')
  })

  it('点击遮罩(非面板本体)关闭整个面板', async () => {
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    await w.get('[data-test="album-picker-overlay"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  // 终审必修 2:submitCreate 绑在 @keydown.enter,`creating` 只是「输入行是否展开」的显示
  // 标志,不是 in-flight 守卫——长按/连按回车会重复发 createAlbum。这是本期第三次出现的同类
  // bug(T7 PhotosAlbums.vue `creating`、T10 PhotosFavorites.vue `saveAlbumSaving` 都已补过
  // 守卫),AlbumPickerDialog 的内联新建是四个入口里唯一还没补的。
  it('必修2回归:连按两次回车提交新建相册(第二次在第一次未 resolve 前触发)→ createAlbum 只被调一次', async () => {
    let resolveCreate: ((v: { id: number; name: string }) => void) | undefined
    svc.photos.createAlbum.mockImplementation(
      () => new Promise((resolve) => { resolveCreate = resolve }),
    )
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()

    await w.get('[data-test="album-picker-new"]').trigger('click')
    const input = w.get('[data-test="album-picker-new-input"]')
    await input.setValue('Dup Trip')
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('keydown', { key: 'Enter' }) // 第二次回车在第一次未 resolve 前触发
    await flushPromises()

    expect(svc.photos.createAlbum).toHaveBeenCalledTimes(1)
    resolveCreate?.({ id: 101, name: 'Dup Trip' })
    await flushPromises()
  })

  // 终审必修 2(同一类守卫的另一半):pick() 本身也没有 in-flight 守卫,连点同一个相册项会
  // 对同一批 assetIds 重复发 addAssetsToAlbum。
  it('必修2回归:连点两次同一相册项(第二次在第一次未 resolve 前触发)→ addAssetsToAlbum 只被调一次', async () => {
    let resolveAdd: (() => void) | undefined
    svc.photos.batchAddToAlbum.mockImplementation(
      () => new Promise((resolve) => { resolveAdd = () => resolve(undefined) }),
    )
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    const items = w.findAll('[data-test="album-picker-item"]')

    await items[0]!.trigger('click')
    await items[0]!.trigger('click') // 第二次点击在第一次未 resolve 前触发
    await flushPromises()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledTimes(1)
    resolveAdd?.()
    await flushPromises()
  })
})

// Fix-2 item 3 (owner acceptance, 2026-08-16): enlarge the dialog + make it viewport-responsive
// (screenshot showed a small fixed 280px/360px box that no longer fits real cover thumbnails +
// title/count rows). jsdom doesn't compute cascade/specificity, so this is a raw-source assertion
// (same idiom as color-guard.test.ts/photosGlassSurfaces.test.ts's own rule-body reads) rather
// than a rendered-DOM measurement.
describe('AlbumPickerDialog.vue 尺寸(Fix-2 item 3:放大 + 视口响应)', () => {
  const SRC = fs.readFileSync(path.resolve(__dirname, '../AlbumPickerDialog.vue'), 'utf8')
  const PARITY_SRC = fs.readFileSync(
    path.resolve(__dirname, '../../styles/vue2-parity/photos.scss'),
    'utf8',
  )

  function ruleBody(text: string, selector: string): string {
    const i = text.indexOf(selector)
    expect(i, `找不到选择器 ${selector}`).toBeGreaterThan(-1)
    const open = text.indexOf('{', i)
    const close = text.indexOf('}', open)
    return text.slice(open + 1, close)
  }

  it('本地 .album-picker-panel 覆盖为 width: min(520px, 90vw); max-height: min(640px, 80vh)', () => {
    const styleBlock = /<style[^>]*>([\s\S]*)<\/style>/.exec(SRC)![1]
    const body = ruleBody(styleBlock, '.album-picker-panel')
    expect(body).toMatch(/width:\s*min\(520px,\s*90vw\)/)
    expect(body).toMatch(/max-height:\s*min\(640px,\s*80vh\)/)
  })

  it('parity 自己的 280px/360px 小尺寸原值未被误改(本地覆盖赢在同特异性平局，不是改了共享真源）', () => {
    const body = ruleBody(PARITY_SRC, '.photos-root .album-picker-panel')
    expect(body).toMatch(/width:\s*280px/)
    expect(body).toMatch(/max-height:\s*360px/)
  })

  it('.album-picker-body 仍是 parity 的内部滚动(overflow-y: auto; flex: 1),放大后长列表不撑破对话框', () => {
    const body = ruleBody(PARITY_SRC, '.photos-root .album-picker-body')
    expect(body).toMatch(/overflow-y:\s*auto/)
    expect(body).toMatch(/flex:\s*1/)
  })

  // Fix-3 (owner acceptance, 2026-08-17, screenshot image copy 77.png): "Add to album" header
  // title rendered white-on-light in Photos' private light theme -- invisible. Root cause: this
  // dialog mounts as a SIBLING of `.app` (not inside it, see e.g. PhotosSearch.vue's template),
  // and `.photos-root .app` is the only ancestor that explicitly sets `color: var(--text-1)`
  // (this area's own is-light-aware token, photos.scss:104-116). Mounted outside `.app`, the
  // title span's inherited `color` instead falls all the way through to the GLOBAL
  // `src/styles/theme.css` `body { color: var(--fg) }` -- which only follows the app-wide
  // `[data-theme]` attribute, not Photos' private `.photos-root.is-light` toggle. Same defect
  // class as Fix-2 item 4 (Places/lightbox), a third independent surfacing of it. jsdom doesn't
  // compute cross-stylesheet cascade/inheritance, so this is a raw-source assertion (same idiom
  // as this describe block's own sizing checks above) rather than a computed-style read.
  it('.album-picker-title-text 有显式局部 color: var(--text-1)(不再靠继承落到全局 --fg)', () => {
    const styleBlock = /<style[^>]*>([\s\S]*)<\/style>/.exec(SRC)![1]
    // 锚定真正的规则(选择器紧跟 `{`),不是这条规则上方注释里同名的反引号引用
    // (那条注释本身还提到了 `body { color: var(--fg) }` 这样的字面示例,朴素的
    // indexOf(selector) 会先命中注释里的类名提及,再抓到注释自己那对花括号里的示例文本)。
    const body = ruleBody(styleBlock, '.album-picker-title-text {')
    expect(body).toMatch(/color:\s*var\(--text-1\)/)
  })

  it('.album-picker-close(✕ 按钮)已是局部 --text-2/--text-1,不受本次修复影响(先行核对未回归)', () => {
    const styleBlock = /<style[^>]*>([\s\S]*)<\/style>/.exec(SRC)![1]
    const base = ruleBody(styleBlock, '.album-picker-close {')
    expect(base).toMatch(/color:\s*var\(--text-2\)/)
    const hover = ruleBody(styleBlock, '.album-picker-close:hover')
    expect(hover).toMatch(/color:\s*var\(--text-1\)/)
  })
})
