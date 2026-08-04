import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import type { NormalizedAggregate } from '@nimotech/nimoos-service'

// 共享包整体 mock:search.agentTool 是本期主角;image.thumbUrl 被媒体行消费;
// storage.list 被 files store 的 loadRoots() → foldersStore.loadDisks() 拖进来
// (简报草稿写的是 folder.listDisks —— 实际调用链是 service.storage.list,
//  照抄会让 loadDisks 走 catch 并往 stderr 打 "[home] disk load failed",已订正)。
const agentTool = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    search: { agentTool: (...a: unknown[]) => agentTool(...a) },
    image: { thumbUrl: (p: string) => '/thumb?path=' + encodeURIComponent(p) },
    storage: { list: async () => [] },
  },
}))

import { useHomeUiStore } from '../stores/homeUi'
import { useFoldersStore } from '../stores/folders'
import { useViewer } from '../../files/viewers/useViewer'
import SearchDialog from './SearchDialog.vue'

// i18n 已由 vitest.setup.ts 全局装好(默认 zh_cn),**不要在测试里另建 createI18n**。
let wrapper: VueWrapper | null = null

function agg(over: Partial<NormalizedAggregate> = {}): NormalizedAggregate {
  return {
    semantic: [], filenames: [], images: [], notes: [],
    stats: { fileindexStatus: 'ready', totalCandidates: 0 }, warnings: [], ...over,
  }
}

// spec §7.10a 的真机响应(query=receipt)
const REAL = agg({
  filenames: [
    { path: '/DATA/Documents/Recipes/Receipt.pdf', name: 'Receipt.pdf', ext: 'pdf', size: 53866, mtimeMs: 1784715139167, isDir: false, match: 2 },
    { path: "/DATA/Documents/life/Nick's receipt.jpg", name: "Nick's receipt.jpg", ext: 'jpg', size: 42943, mtimeMs: 1783651328200, isDir: false, match: 1.5 },
  ],
  stats: { fileindexStatus: 'ready', totalCandidates: 2 },
  warnings: ['images_unavailable'],
})

// F1 的对照组:images 源(Photos CLIP)命中 —— 这一档才是相册真认得的行,相册卡照常出现。
// badge 由 buildSearchView 的 badgeOf 派生:images 源 fromFilename=false / fromOcr=false → 'semantic'。
const FROM_IMAGES = agg({
  images: [
    { assetId: 'a1', name: 'beach.jpg', path: '/DATA/Gallery/beach.jpg', score: 0.42,
      takenAt: '2026-01-01T00:00:00Z', thumbnailUrl: '/v1/photos/a1/thumbnail', caption: 'a beach at sunset' },
  ],
  stats: { fileindexStatus: 'ready', totalCandidates: 1 },
})

// 种一块真磁盘,让 displayNames = { '/DATA': 'NimoOS-HD' } —— 否则 displayNames 恒为 {},
// toVirtualPath 退化成恒等函数,「路径翻成虚拟路径」这件事就无从断言(空转)。
// 做法照 src/views/Files.test.ts:61 的既有惯例。
function seedDisks(): void {
  const folders = useFoldersStore()
  folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] })
}

async function open(): Promise<void> {
  seedDisks()
  useHomeUiStore().openSearch()
  wrapper = mount(SearchDialog, { attachTo: document.body })
  await flushPromises() // 等 onMounted 的 loadRoots() 落地,displayNames 才就绪
  await nextTick()
}
async function search(q: string): Promise<void> {
  const input = document.body.querySelector('.searchbox') as HTMLInputElement
  input.value = q
  input.dispatchEvent(new Event('input'))
  await nextTick()
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
  await flushPromises()
  await nextTick()
}

describe('SearchDialog', () => {
  beforeEach(() => { setActivePinia(createPinia()); agentTool.mockReset() })
  afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

  it('关闭时 DOM 里没有搜索框', async () => {
    wrapper = mount(SearchDialog, { attachTo: document.body })
    await nextTick()
    expect(document.body.querySelector('.searchbox')).toBeNull()
  })

  it('打开时是空态:只有提示语,没有建议词(demo 期的 chips 已删)', async () => {
    await open()
    expect(document.body.querySelector('.searchbox')).not.toBeNull()
    expect(document.body.querySelectorAll('.chip').length).toBe(0)
    expect(document.body.textContent).toContain('输入关键词')
  })

  it('回车才发请求,且用 trim 过的查询词', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    const input = document.body.querySelector('.searchbox') as HTMLInputElement
    input.value = '  receipt  '
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(agentTool).not.toHaveBeenCalled()   // 输入不触发(不做输入即搜)
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    await flushPromises()
    expect(agentTool).toHaveBeenCalledWith('receipt')
  })

  // ── F1(申报偏离 6):相册卡只收 images / OCR 源的行 ─────────────────────────
  // 真机 fixture 两条命中全来自 filenames 源,其中 Nick's receipt.jpg 在 /DATA/Documents/life/,
  // 相册库里根本没有 —— 旧行为把它渲染成相册卡(CTA「打开相册」→ 跳空页)。
  it('真机响应(两条全是文件名命中)→ 一个文档行 + 一个媒体单行,不出相册卡', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.querySelectorAll('.result').length).toBe(1)
    expect(document.body.textContent).toContain('Receipt.pdf')
    // 相册卡整块不许出现(卡本身 + 卡里的缩略图格子)
    expect(document.body.querySelector('.album')).toBeNull()
    expect(document.body.querySelectorAll('.album-thumb').length).toBe(0)
    // 改成媒体单行,且确实是那张 jpg(缩略图 URL 指向它的真实路径,不是"随便一行")
    const media = document.body.querySelectorAll('.media-row')
    expect(media.length).toBe(1)
    expect(media[0]?.querySelector('img')?.getAttribute('src'))
      .toBe('/thumb?path=' + encodeURIComponent("/DATA/Documents/life/Nick's receipt.jpg"))
  })

  // ── 申报偏离 7:媒体单行补文件名 + 路径 ─────────────────────────────────────
  // F1 把文件名命中的图片分流到 .media-row 之后,那一行原本只有缩略图 + 来源徽标 ——
  // 用户搜 receipt 命中 Nick's receipt.jpg,却在行里看不到自己搜的这个名字。
  // ⚠️ 路径断言靠 open() 里的 seedDisks() 撑着:不种盘时 displayNames 恒为 {},
  //    toVirtualPath 退化成恒等函数,'/DATA/Documents/life' 也会过,断言就空转了。
  it('媒体单行显示文件名与所在文件夹的**虚拟路径**(/DATA → /NimoOS-HD)', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    const row = document.body.querySelector('.media-row') as HTMLElement
    expect(row).not.toBeNull()
    expect(row.querySelector('.result-name')?.textContent).toBe("Nick's receipt.jpg")
    expect(row.querySelector('.result-path')?.textContent).toBe('/NimoOS-HD/Documents/life')
    // 徽标与 CTA 仍在同一行里(补文字没把它们挤走)
    expect(row.querySelector('.media-acc-num')?.textContent).toBe('文件名')
    expect(row.querySelector('.row-open')).not.toBeNull()
  })

  it('文件名命中的图片:左键就地预览,右上 CTA 是「打开文件夹」而不是「打开相册」', async () => {
    agentTool.mockResolvedValue(REAL)
    const viewer = useViewer()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      await open()
      await search('receipt')
      const row = document.body.querySelector('.media-row') as HTMLElement
      // CTA 文案:「打开文件夹 ›」而不是「打开相册 ›」
      const cta = row.querySelector('.row-open') as HTMLElement
      expect(cta.textContent).toContain('打开文件夹')
      expect(cta.textContent).not.toContain('打开相册')
      // 左键 → ViewerHost 就地预览这张 jpg;openPhotos 会先 closeSearch(),面板必须还开着
      row.click()
      await nextTick()
      expect(viewer.open.value).toBe(true)
      expect(viewer.currentItem.value?.path).toBe("/DATA/Documents/life/Nick's receipt.jpg")
      expect(useHomeUiStore().searchOpen).toBe(true)
      // CTA 走 openFolder(新窗口到所在目录的虚拟路径),不是 openPhotos 的同页跳转
      cta.click()
      await nextTick()
      expect(String(openSpy.mock.calls[0]?.[0])).toMatch(/#\/files\/NimoOS-HD\/Documents\/life$/)
    } finally {
      viewer.close()
      openSpy.mockRestore()
    }
  })

  // openMediaRow 的 badge 分支只在「预览器打不开这个媒体」时才可见 —— 而这条路很好走:
  // VIDEO_X_GENERIC 有 19 个扩展名,panelMap 的 video-player 只收 BROWSER_PLAYABLE_VIDEO 5 个,
  // .mkv/.avi/.wmv 在 NAS 上遍地都是。旧行为在这里回退进 /#/photos(空页),新行为回退进所在目录。
  it('文件名命中的不可预览媒体(.mkv):左键回退到所在文件夹,不回退进空相册', async () => {
    agentTool.mockResolvedValue(agg({
      filenames: [{ path: '/DATA/Media/holiday.mkv', name: 'holiday.mkv', ext: 'mkv', size: 900, mtimeMs: 1, isDir: false, match: 2 }],
    }))
    const viewer = useViewer()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      await open()
      await search('holiday')
      const row = document.body.querySelector('.media-row') as HTMLElement
      expect(row).not.toBeNull()
      row.click()
      await nextTick()
      expect(viewer.open.value).toBe(false)                       // mkv 没有预览面板,确实走了回退
      expect(String(openSpy.mock.calls[0]?.[0])).toMatch(/#\/files\/NimoOS-HD\/Media$/)
      expect(useHomeUiStore().searchOpen).toBe(true)              // openPhotos 会 closeSearch(),没走
    } finally {
      viewer.close()
      openSpy.mockRestore()
    }
  })

  it('对照组:images 源命中时相册卡照常出现(相册真认得的行没被误伤)', async () => {
    agentTool.mockResolvedValue(FROM_IMAGES)
    await open()
    await search('beach')
    expect(document.body.querySelector('.album')).not.toBeNull()
    expect(document.body.querySelectorAll('.album-thumb').length).toBe(1)
    expect(document.body.textContent).toContain('打开相册')
    // 没有被分流成媒体单行
    expect(document.body.querySelector('.media-row')).toBeNull()
  })

  it('reasons 渲染成中文标签,不是写死的英文 demo 标签', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.textContent).toContain('文件名命中')
    expect(document.body.textContent).not.toContain('Exact filename match')
  })

  // F1 后真机 fixture 不再有相册卡,这条改看媒体单行上的徽标(同一件事:徽标取代百分比)。
  it('来源徽标取代准确率百分比:媒体单行上不再出现 % 数字', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    const acc = document.body.querySelector('.media-acc-num') as HTMLElement
    expect(acc.textContent).toBe('文件名')
    expect(document.body.textContent).not.toMatch(/\d+%/)
  })

  it('来源徽标取代准确率百分比:相册卡缩略图上不再出现 % 数字', async () => {
    agentTool.mockResolvedValue(FROM_IMAGES)
    await open()
    await search('beach')
    const acc = document.body.querySelector('.album-acc') as HTMLElement
    expect(acc.textContent).toBe('语义')
    expect(document.body.textContent).not.toMatch(/\d+%/)
  })

  it('文档行路径显示所在文件夹的**虚拟路径**(/DATA → /NimoOS-HD)', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    const path = document.body.querySelector('.result-path') as HTMLElement
    // 断言的是翻译后的虚拟路径:磁盘已种,若 folderOf 不过 toVirtualPath 就会是 /DATA/... 而红
    expect(path.textContent).toBe('/NimoOS-HD/Documents/Recipes')
  })

  it('images_unavailable → 结果区顶部挂降级提示条(不是 toast、不遮结果)', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    const notice = document.body.querySelector('.search-notice') as HTMLElement
    expect(notice).not.toBeNull()
    expect(notice.textContent).toContain('图片搜索不可用')
    expect(document.body.querySelectorAll('.result').length).toBe(1)  // 结果照常显示
  })

  it('认不出的 warning 原样透出,不静默吞掉', async () => {
    agentTool.mockResolvedValue(agg({ ...REAL, warnings: ['brand_new_source_exploded'] }))
    await open()
    await search('receipt')
    const notice = document.body.querySelector('.search-notice') as HTMLElement
    expect(notice).not.toBeNull()
    expect(notice.textContent).toContain('brand_new_source_exploded')
  })

  it('四源全在(warnings 为空)时不挂提示条', async () => {
    agentTool.mockResolvedValue(agg({ ...REAL, warnings: [] }))
    await open()
    await search('receipt')
    expect(document.body.querySelector('.search-notice')).toBeNull()
    expect(document.body.querySelectorAll('.result').length).toBe(1)
  })

  it('零结果且无 warning → 「没有匹配的文件」空态', async () => {
    agentTool.mockResolvedValue(agg())
    await open()
    await search('zzz')
    expect(document.body.textContent).toContain('没有匹配的文件')
  })

  it('零结果但有 warning → 「搜索后端未就绪」,与「没搜到」区分', async () => {
    agentTool.mockResolvedValue(agg({ warnings: ['semantic_unavailable', 'images_unavailable'] }))
    await open()
    await search('zzz')
    expect(document.body.textContent).toContain('搜索后端未就绪')
    expect(document.body.textContent).not.toContain('没有匹配的文件')
    // backend_not_ready 时标题下还要列出到底哪几源没参与
    const sub = document.body.querySelector('.search-empty-sub') as HTMLElement
    expect(sub.textContent).toContain('语义搜索不可用')
    expect(sub.textContent).toContain('图片搜索不可用')
  })

  it('无可搜索目录 → 「没有可搜索的目录」,与另外两种空态区分', async () => {
    agentTool.mockResolvedValue(agg({ warnings: ['no_accessible_roots'] }))
    await open()
    await search('zzz')
    expect(document.body.textContent).toContain('没有可搜索的目录')
    expect(document.body.textContent).not.toContain('搜索后端未就绪')
  })

  // no_roots 空态同样要列出哪几源没参与:deriveDegrade 见到 no_accessible_roots 就把
  // empty 定成 'no_roots',同一批 warnings 里的 images_unavailable 仍会进 noticeItems ——
  // 若把副标题的条件钉死在 'backend_not_ready',这行信息算出来了却无处渲染,被静默吞掉。
  it('no_roots 空态也列出未参与的源(不是只有 backend_not_ready 才列)', async () => {
    agentTool.mockResolvedValue(agg({ warnings: ['no_accessible_roots', 'images_unavailable'] }))
    await open()
    await search('zzz')
    expect(document.body.textContent).toContain('没有可搜索的目录')
    const sub = document.body.querySelector('.search-empty-sub') as HTMLElement
    expect(sub).not.toBeNull()
    expect(sub.textContent).toContain('图片搜索不可用')
  })

  it('请求失败 → 错误态 + 重试按钮,绝不显示成空结果', async () => {
    agentTool.mockRejectedValue(new Error('ai down'))
    await open()
    await search('receipt')
    expect(document.body.textContent).toContain('搜索失败')
    expect(document.body.textContent).not.toContain('没有匹配的文件')
    const retry = document.body.querySelector('.search-retry') as HTMLElement
    expect(retry).not.toBeNull()

    agentTool.mockResolvedValue(REAL)
    retry.click()
    await flushPromises()
    await nextTick()
    expect(document.body.querySelectorAll('.result').length).toBe(1)
  })

  it('先成功再失败 → 错误态不与上一轮结果同屏(view 不清空,只能靠 state 挡)', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.querySelectorAll('.result').length).toBe(1)
    // 不改查询词(改词会 reset 把 view 清掉,就抓不到这个陷阱了),直接再回车一次让它失败
    agentTool.mockReset()
    agentTool.mockRejectedValue(new Error('ai down'))
    ;(document.body.querySelector('.searchbox') as HTMLInputElement)
      .dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    await flushPromises()
    await nextTick()
    expect(document.body.querySelector('.search-error')).not.toBeNull()
    expect(document.body.querySelectorAll('.result').length).toBe(0)
    expect(document.body.querySelector('.album')).toBeNull()
  })

  it('搜索中不显示上一轮结果(state 是唯一开关,view 不清空)', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.querySelectorAll('.result').length).toBe(1)
    // 第二次搜索挂起不 resolve —— 界面必须切到 Searching…,旧结果不许继续挂着
    let release: ((v: NormalizedAggregate) => void) | undefined
    agentTool.mockReturnValue(new Promise<NormalizedAggregate>((r) => { release = r }))
    const input = document.body.querySelector('.searchbox') as HTMLInputElement
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    await nextTick()
    expect(document.body.querySelector('.searching')).not.toBeNull()
    expect(document.body.querySelector('.result')).toBeNull()
    release?.(REAL)
    await flushPromises()
  })

  it('改查询词回到空态,需要再次回车', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.querySelectorAll('.result').length).toBe(1)
    const input = document.body.querySelector('.searchbox') as HTMLInputElement
    input.value = 'receipts'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(document.body.querySelector('.result')).toBeNull()
  })

  it('目录行左键进该目录本身,「打开文件夹」才进上级', async () => {
    agentTool.mockResolvedValue(agg({
      filenames: [{ path: '/DATA/Documents/Recipes', name: 'Recipes', ext: '', size: 4096, mtimeMs: 1784715139167, isDir: true, match: 2 }],
    }))
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      await open()
      await search('recipes')
      ;(document.body.querySelector('.result') as HTMLElement).click()
      await nextTick()
      expect(String(openSpy.mock.calls[0]?.[0])).toMatch(/#\/files\/NimoOS-HD\/Documents\/Recipes$/)
      ;(document.body.querySelector('.row-open') as HTMLElement).click()
      await nextTick()
      expect(String(openSpy.mock.calls[1]?.[0])).toMatch(/#\/files\/NimoOS-HD\/Documents$/)
    } finally {
      openSpy.mockRestore()
    }
  })

  it('路径里的 # ? % 逐段编码,不裸拼进 hash', async () => {
    // 裸拼时 `#` 会截断 hash（跳到父目录）、`?` 后半段被当 query、`%` 让 vue-router 解码失败。
    agentTool.mockResolvedValue(agg({
      filenames: [{ path: '/DATA/Project #2/50% off?.pdf', name: '50% off?.pdf', ext: 'pdf', size: 10, mtimeMs: 1, isDir: false, match: 2 }],
    }))
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      await open()
      await search('off')
      ;(document.body.querySelector('.row-open') as HTMLElement).click()
      await nextTick()
      const url = String(openSpy.mock.calls[0]?.[0])
      expect(url).toMatch(/#\/files\/NimoOS-HD\/Project%20%232$/)
      // hash 里除了 `#/files` 的那个引导井号,不许再出现裸 # / ? / 未编码的 %
      expect(url.slice(url.indexOf('#/files') + 1)).not.toMatch(/[#?]/)
    } finally {
      openSpy.mockRestore()
    }
  })

  it('关掉面板再打开 → 查询词与结果都清空', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.querySelectorAll('.result').length).toBe(1)
    const ui = useHomeUiStore()
    ui.closeSearch()
    await nextTick()
    ui.openSearch()
    await nextTick()
    expect(document.body.querySelector('.result')).toBeNull()
    expect((document.body.querySelector('.searchbox') as HTMLInputElement).value).toBe('')
    expect(document.body.textContent).toContain('输入关键词')
  })

  it('关闭按钮清 searchOpen', async () => {
    await open()
    ;(document.body.querySelector('.close-btn') as HTMLElement).click()
    await nextTick()
    expect(useHomeUiStore().searchOpen).toBe(false)
  })
})
