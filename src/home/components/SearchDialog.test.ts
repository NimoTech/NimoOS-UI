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

async function open(): Promise<void> {
  useHomeUiStore().openSearch()
  wrapper = mount(SearchDialog, { attachTo: document.body })
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

  it('真机响应渲染成两行:一个文档行 + 一张相册卡(图片进相册卡)', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.querySelectorAll('.result').length).toBe(1)
    expect(document.body.textContent).toContain('Receipt.pdf')
    expect(document.body.querySelectorAll('.album-thumb').length).toBe(1)
  })

  it('reasons 渲染成中文标签,不是写死的英文 demo 标签', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    expect(document.body.textContent).toContain('文件名命中')
    expect(document.body.textContent).not.toContain('Exact filename match')
  })

  it('来源徽标取代准确率百分比:相册卡缩略图上不再出现 % 数字', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    const acc = document.body.querySelector('.album-acc') as HTMLElement
    expect(acc.textContent).toBe('文件名')
    expect(document.body.textContent).not.toMatch(/\d+%/)
  })

  it('文档行路径显示所在文件夹(不是 demo 写死的 /files/… 虚拟串)', async () => {
    agentTool.mockResolvedValue(REAL)
    await open()
    await search('receipt')
    const path = document.body.querySelector('.result-path') as HTMLElement
    expect(path.textContent).toBe('/DATA/Documents/Recipes')
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
      expect(String(openSpy.mock.calls[0]?.[0])).toMatch(/#\/files\/DATA\/Documents\/Recipes$/)
      ;(document.body.querySelector('.row-open') as HTMLElement).click()
      await nextTick()
      expect(String(openSpy.mock.calls[1]?.[0])).toMatch(/#\/files\/DATA\/Documents$/)
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
