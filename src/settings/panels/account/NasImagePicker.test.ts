import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn.sp9'
import NasImagePicker from './NasImagePicker.vue'

const storageList = vi.fn()
const raidList = vi.fn()
const folderGetList = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: { list: (...a: unknown[]) => storageList(...a) },
    raid: { list: (...a: unknown[]) => raidList(...a) },
    folder: { getList: (...a: unknown[]) => folderGetList(...a) },
    image: { imageUrl: (p: string, t?: string) => `/v1/image?path=${encodeURIComponent(p)}&type=${t}` },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const flush = () => new Promise((r) => setTimeout(r, 0))

// 真机口径:/v1/storage 的 children 里 size/avail 是**字符串**,系统盘 mount_point 是裸 "/"。
const STORAGE = [
  { path: '/dev/nvme0n1', disk_name: 'System', type: 'internal', children: [
    { uuid: 'u1', mount_point: '/', label: 'sys', drive_name: 'nvme0n1p7', size: '1000', avail: '400' },
    { uuid: 'u2', mount_point: '/mnt/Extra', label: 'Extra', drive_name: 'nvme0n1p8', size: '2000', avail: '1500' },
  ] },
]

// ⚠️ 花括号、不要链式返回 mock(会被当 teardown 回调,见 ChangePasswordForm.test.ts 的注释)
beforeEach(() => {
  storageList.mockReset()
  storageList.mockResolvedValue(STORAGE)
  raidList.mockReset()
  raidList.mockResolvedValue([])
  folderGetList.mockReset()
  folderGetList.mockResolvedValue({ content: [] })
})

function mountPicker() {
  return mount(NasImagePicker, { global: { plugins: [i18n] } })
}
type Exposed = { backToStorages(): void; openFolder(p: string): Promise<void> }

describe('NasImagePicker —— 对位 Vue2 state 6(:763-846)', () => {
  it('挂载即取存储列表,/DATA 卡恒排第一', async () => {
    const w = mountPicker()
    await flush()
    const names = w.findAll('[data-test="nas-storage"]').map((n) => n.find('.set-nas-name').text())
    expect(names[0]).toBe('NimoOS-HD')
    expect(names).toContain('Extra')
  })

  it('有容量的卡显示「已用 / 总量」,/DATA 卡不显示容量(Vue2 v-if="s.size")', async () => {
    const w = mountPicker()
    await flush()
    const cards = w.findAll('[data-test="nas-storage"]')
    expect(cards[0].find('.set-nas-sub').exists()).toBe(false)
    const extra = cards.find((c) => c.find('.set-nas-name').text() === 'Extra')!
    expect(extra.find('.set-nas-sub').text()).toBe('500 Bytes / 1.95 KB')
  })

  it('取存储列表失败 → 显示错误,不显示空网格', async () => {
    storageList.mockImplementation(async () => { throw new Error('boom') })
    const w = mountPicker()
    await flush()
    expect(w.find('.set-danger').exists()).toBe(true)
    expect(w.findAll('[data-test="nas-storage"]')).toHaveLength(0)
  })

  it('raid.list 失败不拖垮整屏(Vue2 :280 单独 catch 成空)', async () => {
    raidList.mockImplementation(async () => { throw new Error('no raid') })
    const w = mountPicker()
    await flush()
    expect(w.findAll('[data-test="nas-storage"]').length).toBeGreaterThan(0)
    expect(w.find('.set-danger').exists()).toBe(false)
  })

  it('点存储卡进浏览视图,按该卡路径列目录', async () => {
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(folderGetList).toHaveBeenCalledWith('/DATA')
    expect(w.find('[data-test="nas-crumbs"]').exists()).toBe(true)
  })

  it('浏览视图只列目录与图片,隐藏项被滤掉', async () => {
    folderGetList.mockResolvedValue({ content: [
      { name: 'sub', path: '/DATA/sub', is_dir: true },
      { name: '.git', path: '/DATA/.git', is_dir: true },
      { name: 'a.png', path: '/DATA/a.png', is_dir: false },
      { name: 'b.txt', path: '/DATA/b.txt', is_dir: false },
    ] })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(w.findAll('[data-test="nas-item"]').map((n) => n.find('.set-nas-item-name').text())).toEqual(['sub', 'a.png'])
  })

  it('点目录下钻,面包屑逐段增长(分隔符跟在非末段后面,同 Vue2 :804)', async () => {
    folderGetList.mockResolvedValue({ content: [{ name: 'sub', path: '/DATA/sub', is_dir: true }] })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    await w.findAll('[data-test="nas-item"]')[0].trigger('click')
    await flush()
    expect(folderGetList).toHaveBeenLastCalledWith('/DATA/sub')
    expect(w.findAll('[data-test="nas-crumb"]').map((n) => n.text())).toEqual(['NimoOS-HD/', 'sub'])
  })

  it('点面包屑中间段可回上层,点最后一段不发请求(Vue2 的 i < len-1 守卫)', async () => {
    folderGetList.mockResolvedValue({ content: [{ name: 'sub', path: '/DATA/sub', is_dir: true }] })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    await w.findAll('[data-test="nas-item"]')[0].trigger('click')
    await flush()
    const before = folderGetList.mock.calls.length
    await w.findAll('[data-test="nas-crumb"]')[1].trigger('click') // 末段
    await flush()
    expect(folderGetList.mock.calls.length).toBe(before)
    await w.findAll('[data-test="nas-crumb"]')[0].trigger('click') // 根段
    await flush()
    expect(folderGetList).toHaveBeenLastCalledWith('/DATA')
  })

  it('点图片发 pick,src 是 /v1/image 的 original URL(plan C11:不走 arraybuffer)', async () => {
    folderGetList.mockResolvedValue({ content: [{ name: 'a.png', path: '/DATA/a.png', is_dir: false }] })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    await w.findAll('[data-test="nas-item"]')[0].trigger('click')
    expect(w.emitted('pick')).toEqual([[`/v1/image?path=${encodeURIComponent('/DATA/a.png')}&type=original`]])
  })

  it('目录为空 → 显示「此处没有图片文件」', async () => {
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(w.text()).toContain(zh.settingsAccNoImagesHere)
  })

  it('列目录失败 → 显示「加载文件夹失败」', async () => {
    folderGetList.mockImplementation(async () => { throw new Error('nope') })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(w.find('.set-danger').text()).toBe(zh.settingsAccLoadFolderFailed)
  })

  it('在根目录时「上一层」按钮 disabled(B6:断属性)', async () => {
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(w.find('[data-test="nas-up"]').attributes('disabled')).toBeDefined()
  })

  it('下钻后「上一层」回到父目录', async () => {
    folderGetList.mockResolvedValue({ content: [{ name: 'sub', path: '/DATA/sub', is_dir: true }] })
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    await w.findAll('[data-test="nas-item"]')[0].trigger('click')
    await flush()
    await w.find('[data-test="nas-up"]').trigger('click')
    await flush()
    expect(folderGetList).toHaveBeenLastCalledWith('/DATA')
  })

  it('backToStorages 回到存储卡网格并清掉浏览态', async () => {
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    ;(w.vm as unknown as Exposed).backToStorages()
    await w.vm.$nextTick()
    expect(w.findAll('[data-test="nas-storage"]').length).toBeGreaterThan(0)
    expect(w.find('[data-test="nas-crumbs"]').exists()).toBe(false)
  })

  it('快速切目录时旧请求落定不许覆盖新目录(就地代际守卫,plan C8)', async () => {
    // 第一次列目录卡住,第二次立刻返回;旧的后落定时不许把列表改回去
    let resolveFirst!: (v: unknown) => void
    folderGetList
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockImplementationOnce(async () => ({ content: [{ name: 'new.png', path: '/DATA/sub/new.png', is_dir: false }] }))
    const w = mountPicker()
    await flush()
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click') // 第一次:卡住
    ;(w.vm as unknown as Exposed).openFolder('/DATA/sub') // 第二次:立刻回
    await flush()
    resolveFirst({ content: [{ name: 'old.png', path: '/DATA/old.png', is_dir: false }] })
    await flush()
    expect(w.findAll('[data-test="nas-item"]').map((n) => n.find('.set-nas-item-name').text())).toEqual(['new.png'])
  })
})
