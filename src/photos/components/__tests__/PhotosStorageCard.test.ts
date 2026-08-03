// SP7-P8a-T3: PhotosStorageCard.vue —— 设置页存储卡。
// 回源坐标见 task-3-brief.md;Vue2 PhotosSettings.vue:39-126(模板)/:299-331(computed)/
// :382(fmt)/:405-457(fmtBytes/五个动作方法)。
//
// 测试基建偏离登记(brief 与本仓实际不符,以本仓实测为准):
// 1. brief 草稿用 `@pinia/testing` 的 `createTestingPinia({ stubActions: true })`,但本仓
//    package.json 未装该包(`node_modules/.pnpm` 无 `@pinia/testing` 任何版本)。改用本仓
//    settings.test.ts / AlbumPickerDialog.test.ts 的既定做法:`setActivePinia(createPinia())`
//    起一个真实 store 实例,用 `vi.spyOn(store, 'action')` 单独按需 stub 需要控制返回值的
//    action,其余走真实实现(mock 的是共享包 `@nimotech/nimoos-service`,不是 store 本身)。
// 2. brief Step7 引用的 `winningDeclaration(css, [...], 'background', {hover, dataActive})`
//    与 `readComponentStyle()` 在 `cssCascade.ts` 里都不存在——该文件实际只导出
//    `extractStyleBlock`/`winningHoverBackground`/`parseCssRules`/`ownBackground`。改用
//    `PhotosFilterChip.test.ts:107-114` 的既定写法:`?raw` 导入组件源码 → `extractStyleBlock`
//    → `winningHoverBackground(style, ['seg-btn'])`,断言胜出选择器同时含 `:hover` 与
//    `data-active`。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { fmtGB, fmtBytes, buildBreakdown } from '../../util/storagePalette'

describe('storage 卡纯函数', () => {
  it('fmtGB:>=100 取整,否则一位小数(Vue2 :382)', () => {
    expect(fmtGB(100)).toBe('100')
    expect(fmtGB(99.94)).toBe('99.9')
    expect(fmtGB(0)).toBe('0.0')
  })

  it('fmtBytes:逐级进位,>=100 取整(Vue2 :405-413)', () => {
    expect(fmtBytes(0)).toBe('0 B')
    expect(fmtBytes(-1)).toBe('0 B')
    expect(fmtBytes(512)).toBe('512 B') // 512 >= 100 ⇒ 取整
    expect(fmtBytes(1536)).toBe('1.5 KB')
    expect(fmtBytes(1024 ** 4 * 2)).toBe('2.0 TB')
    // 单位表到 TB 为止,更大的值继续用 TB 表示(while 的 i < len-1 上界)
    expect(fmtBytes(1024 ** 5)).toBe('1024 TB')
  })

  it('buildBreakdown:段序固定,other 仅在剩余 > 0.05 GB 时追加(Vue2 :327)', () => {
    const GB = 1024 ** 3
    const segs = buildBreakdown(
      { photosBytes: 3 * GB, videosBytes: 2 * GB, rawBytes: GB, cacheBytes: 0, aiBytes: 0 },
      10, // usedGB
    )
    expect(segs.map((s) => s.key)).toEqual(['photos', 'videos', 'raw', 'thumbs', 'ai', 'other'])
    expect(segs.find((s) => s.key === 'other')!.gb).toBeCloseTo(4, 5)
  })

  it('buildBreakdown:剩余恰好 0.05 GB 不追加 other(边界是严格大于)', () => {
    // 偏离登记(brief 自身的测试夹具数字有浮点误差,不是源码/brief 逻辑冲突):
    // brief 草稿原用 `{photosBytes: 1GB}, usedGB=1.05` 意图让 other = 1.05-1 恰好命中 0.05,
    // 但 `1.05 - 1` 在 IEEE-754 双精度下是 0.050000000000000044(> 0.05),不是精确的 0.05,
    // 导致这条"边界不追加"的用例在原数字下必然误判为"追加"——这是计算机浮点减法的固有噪声,
    // 与 buildBreakdown/Vue2 源的 `other > 0.05` 判据本身无关。改用 known=0(不含任何已知段)
    // + usedGB=0.05,让 other = Math.max(0, 0.05 - 0) 与实现里的字面量 0.05 是同一个双精度
    // 比特模式,真正落在边界上,不引入减法噪声。
    const segs = buildBreakdown(
      { photosBytes: 0, videosBytes: 0, rawBytes: 0, cacheBytes: 0, aiBytes: 0 },
      0.05,
    )
    expect(segs.map((s) => s.key)).not.toContain('other')
  })

  it('buildBreakdown:负数字节按 0 处理(Vue2 :317 的 Math.max(0, b))', () => {
    const segs = buildBreakdown(
      { photosBytes: -1, videosBytes: 0, rawBytes: 0, cacheBytes: 0, aiBytes: 0 },
      0,
    )
    expect(segs.find((s) => s.key === 'photos')!.gb).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 组件测试:真实 Pinia store + mock 共享包(不是 mock store 本身)
// ---------------------------------------------------------------------------
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      getStorage: vi.fn(),
      getAbout: vi.fn(),
      pruneCache: vi.fn(),
      rebuildIndex: vi.fn(),
      triggerScan: vi.fn(),
      reclusterFaces: vi.fn(),
    },
  },
}))

import PhotosStorageCard from '../PhotosStorageCard.vue'
import photosStorageCardRaw from '../PhotosStorageCard.vue?raw'
import { usePhotosSettingsStore } from '../../stores/settings'
import { extractStyleBlock, winningHoverBackground } from './cssCascade'

const GB = 1024 ** 3

function mountCard() {
  const wrapper = mount(PhotosStorageCard)
  const store = usePhotosSettingsStore()
  return { wrapper, store }
}

describe('PhotosStorageCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('storageError 时大数字位显示破折号 + 不可用副行', async () => {
    const { wrapper, store } = mountCard()
    store.storage = null
    store.storageError = true
    await nextTick()
    expect(wrapper.get('[data-test="storage-headline"]').text()).toContain('—')
    expect(wrapper.text()).toContain('不可用')
  })

  it('retention 5 档,当前档带 data-active', async () => {
    const { wrapper, store } = mountCard()
    store.retentionDays = 30
    await nextTick()
    const btns = wrapper.findAll('[data-test="retention-seg"] button')
    expect(btns).toHaveLength(5)
    expect(btns.filter((b) => b.attributes('data-active') === 'true')).toHaveLength(1)
    expect(btns[2]!.attributes('data-active')).toBe('true') // [7,15,30,60,90] 的第三档
  })

  it('点 retention 档位调 setRetention;失败时 emit toast', async () => {
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'setRetention').mockResolvedValue(false)
    await wrapper.findAll('[data-test="retention-seg"] button')[4]!.trigger('click')
    expect(store.setRetention).toHaveBeenCalledWith(90)
    await flushPromises()
    expect(wrapper.emitted('toast')).toBeTruthy()
  })

  it('点 retention 档位成功不 emit toast', async () => {
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'setRetention').mockResolvedValue(true)
    await wrapper.findAll('[data-test="retention-seg"] button')[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('toast')).toBeFalsy()
  })

  it('scanInterval 5 档,off 档的值走 i18n(其余四档是单位缩写字面量,不过 $t)', async () => {
    const { wrapper } = mountCard()
    const btns = wrapper.findAll('[data-test="scan-seg"] button')
    expect(btns).toHaveLength(5)
    expect(btns.map((b) => b.text())).toEqual([
      expect.not.stringMatching(/^\d/), '6h', '12h', '24h', '7d',
    ])
  })

  it('点 scanInterval 档位调 setScanInterval;失败时 emit toast', async () => {
    const { wrapper, store } = mountCard()
    vi.spyOn(store, 'setScanInterval').mockResolvedValue(false)
    await wrapper.findAll('[data-test="scan-seg"] button')[1]!.trigger('click')
    expect(store.setScanInterval).toHaveBeenCalledWith(360)
    await flushPromises()
    expect(wrapper.emitted('toast')).toBeTruthy()
  })

  it('缓存按钮:prunableBytes 为 0 时禁用', async () => {
    const { wrapper, store } = mountCard()
    store.storage = {
      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 0,
      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
    }
    await nextTick()
    expect(wrapper.get('[data-test="clear-cache"]').attributes('disabled')).toBeDefined()
  })

  it('缓存按钮:prunableBytes > 0 时可点', async () => {
    const { wrapper, store } = mountCard()
    store.storage = {
      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
    }
    await nextTick()
    expect(wrapper.get('[data-test="clear-cache"]').attributes('disabled')).toBeUndefined()
  })

  it('清缓存成功后重拉 storage(Vue2 :423)且 emit 成功 toast', async () => {
    const { wrapper, store } = mountCard()
    store.storage = {
      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
    }
    await nextTick()
    vi.spyOn(store, 'pruneCache').mockResolvedValue(1024 * 1024)
    const fetchSpy = vi.spyOn(store, 'fetchStorage').mockResolvedValue(undefined)
    await wrapper.get('[data-test="clear-cache"]').trigger('click')
    await flushPromises()
    expect(fetchSpy).toHaveBeenCalled()
    expect(wrapper.emitted('toast')).toBeTruthy()
  })

  it('清缓存失败:emit 失败 toast,不重拉 storage', async () => {
    const { wrapper, store } = mountCard()
    store.storage = {
      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
    }
    await nextTick()
    vi.spyOn(store, 'pruneCache').mockRejectedValue(new Error('boom'))
    const fetchSpy = vi.spyOn(store, 'fetchStorage').mockResolvedValue(undefined)
    await wrapper.get('[data-test="clear-cache"]').trigger('click')
    await flushPromises()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(wrapper.emitted('toast')).toBeTruthy()
  })

  it('容量条段数 = breakdown 段数 + 1 个 free 段', async () => {
    const { wrapper, store } = mountCard()
    store.storage = {
      diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
      photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
    }
    await nextTick()
    expect(wrapper.findAll('[data-test="bar-seg"]').length).toBeGreaterThanOrEqual(5)
    expect(wrapper.findAll('[data-test="bar-free"]')).toHaveLength(1)
  })

  it('mount 时自取一次 storage(fetchStorage 被调,矫正 T3 Consumes 接口列表里点名的动作)', () => {
    const fetchSpy = vi.spyOn(usePhotosSettingsStore(), 'fetchStorage')
    mount(PhotosStorageCard)
    expect(fetchSpy).toHaveBeenCalled()
  })
})

describe('样式:分段器 [data-active] 变体自带 hover 背景(本区已栽四次)', () => {
  it('seg-btn 的 hover 胜出规则同时含 :hover 与 data-active', () => {
    const style = extractStyleBlock(photosStorageCardRaw)
    expect(style.length).toBeGreaterThan(0)
    const winner = winningHoverBackground(style, ['seg-btn'])
    expect(winner.selector).toContain(':hover')
    expect(winner.selector).toContain('data-active')
  })
})
