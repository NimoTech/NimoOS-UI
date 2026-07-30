import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import TimeMachineOverlay from './TimeMachineOverlay.vue'
import { DECK_WINDOW } from '../util/timeMachineMath'
import zh from '../../i18n/zh_cn'

const listMock = vi.fn()
const getListMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    snapshot: {
      list: (...a: unknown[]) => listMock(...a),
      listVolumes: vi.fn().mockResolvedValue([]), getPolicy: vi.fn(), patchPolicy: vi.fn(),
      togglePolicy: vi.fn(), create: vi.fn(), remove: vi.fn(),
    },
    folder: { getList: (p: string) => getListMock(p) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${p}` },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// 注意:brief 原稿把 SNAPS 的 created_at 写成绝对日期('2026-07-30'),而 groupSnapshotsByDay
// 的"今天/昨天"判定用的是真实系统时钟(默认参数 now = new Date())——两者一旦脱节(测试在
// 非 2026-07-30 那天跑),"今天"分组就会判成"更早",这条 fixture 会静默过期。改成相对
// "现在"取日期,永远对齐,不看真实日历。（同一类坑见记忆 newui-fixture-from-imagination-trap）
const NOW = new Date()
const relDay = (daysAgo: number, h: number, m = 0) =>
  new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, h, m).toISOString()
const SNAPS = [
  { id: 1, name: '20260730T143000Z_manual_x', label: '改版前', type: 'manual', created_at: relDay(0, 14, 30) },
  { id: 2, name: '20260730T090000Z_auto', label: '', type: 'auto-hourly', created_at: relDay(0, 9) },
  { id: 3, name: '20260729T090000Z_preop', label: '', type: 'preop', created_at: relDay(1, 9) },
]

const mountIt = (props = {}) =>
  mount(TimeMachineOverlay, {
    props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos', ...props },
    global: { plugins: [i18n] },
  })
const flush = async (w: ReturnType<typeof mountIt>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}

beforeEach(() => {
  setActivePinia(createPinia()); vi.clearAllMocks()
  listMock.mockResolvedValue(SNAPS)
  getListMock.mockResolvedValue({ content: [] })
})

describe('TimeMachineOverlay 三态', () => {
  it('挂载即按卷拉快照列表', async () => {
    const w = mountIt(); await flush(w)
    expect(listMock).toHaveBeenCalledWith('u-data')
  })
  it('加载中显示骨架', async () => {
    listMock.mockImplementation(() => new Promise(() => {}))
    const w = mountIt(); await w.vm.$nextTick()
    expect(w.find('.tm-skeleton').exists()).toBe(true)
  })
  it('空列表显示空态,且齿轮仍可用', async () => {
    listMock.mockResolvedValue([])
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-empty').exists()).toBe(true)
    expect(w.find('.tm-gear').exists()).toBe(true)
  })
  it('请求失败按空态处理,不抛错', async () => {
    listMock.mockRejectedValue(new Error('404'))
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-empty').exists()).toBe(true)
  })
  it('就绪后底栏显示最新一张的时刻(默认选中最新),日期分组文案走本仓库既有 i18n key(非空壳:曾错误映射成恒为"昨天")', async () => {
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
  })
  it('顶部显示当前文件夹', async () => {
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-folder').text()).toContain('/磁盘/Photos')
  })
  it('就绪后渲染卡堆,最前那张是最新快照', async () => {
    const w = mountIt(); await flush(w)
    const front = w.findAll('.tm-card').find((c) => c.classes().includes('is-front'))!
    expect(front.text()).toContain('14:30')
  })
  it('就绪后同时渲染卡堆与刻度尺,刻度数 = 快照数', async () => {
    const w = mountIt(); await flush(w)
    expect(w.findAll('.tm-tick-main')).toHaveLength(3)
  })
  it('点刻度换选中,底栏时刻跟着变', async () => {
    const w = mountIt(); await flush(w)
    await w.findAll('.tm-tick-main')[2].trigger('click')
    expect(w.find('.tm-bar-moment').text()).toContain('昨天')
  })
})

describe('TimeMachineOverlay 选择与进入', () => {
  it('↑ 往更早、↓ 往更晚,两端夹紧', async () => {
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' })); await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toBe('今天 09:00')
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' })); await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' })); await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30') // 已经在最新,夹紧
  })
  it('Esc emit close', async () => {
    const w = mountIt(); await flush(w)
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(1)
  })
  it('进入落在当前相对路径下,而不是快照根(对 Vue2 的改正)', async () => {
    const w = mountIt(); await flush(w)
    await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe('/DATA/.snapshots/20260730T143000Z_manual_x/Photos')
  })
  it('在卷根打开时进入快照根', async () => {
    const w = mountIt({ relPath: '' }); await flush(w)
    await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe('/DATA/.snapshots/20260730T143000Z_manual_x')
  })
  it('Enter 键等价于点进入', async () => {
    const w = mountIt(); await flush(w)
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter' }))
    expect(w.emitted('select')).toHaveLength(1)
  })
  it('这一刻还没有这个文件夹(预览 404 → missing)时,进入落到快照根而不是拼一个不存在的子路径', async () => {
    getListMock.mockRejectedValue(Object.assign(new Error('nope'), { code: 404 }))
    const w = mountIt(); await flush(w)
    await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe('/DATA/.snapshots/20260730T143000Z_manual_x')
  })

  // 评审修复(Critical 2):onKeyup 挂在 document 上,不看事件源也不管上面是否叠着弹窗。
  // 齿轮设置弹窗(reka-ui DialogContent)Teleport 到 body,不是 .tm-overlay 的 DOM 后代——
  // 这三条用例分别钉住两道防线:第 1 条(事件源不在覆盖层外)钉防线①,第 2/3 条把输入框
  // 直接挂在覆盖层根节点内部,专门验证防线②(标签名判定)独立生效——如果只留防线①,
  // 这两条会因为"确实在 rootEl 内"而失败,能揪出"删掉防线②"这个变异。
  it('弹窗打开时 Esc 不 emit close(事件源在覆盖层外,例如叠着的设置弹窗)', async () => {
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', bubbles: true }))
    expect(w.emitted('close')).toBeUndefined()
    w.unmount(); outside.remove()
  })
  it('覆盖层内部的输入框(防御性兜底)按 Enter 不 emit select', async () => {
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    const input = document.createElement('input')
    w.find('.tm-overlay').element.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter', bubbles: true }))
    expect(w.emitted('select')).toBeUndefined()
    w.unmount()
  })
  it('覆盖层内部的输入框(防御性兜底)方向键不改变 selectedIndex', async () => {
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
    const input = document.createElement('input')
    w.find('.tm-overlay').element.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
    w.unmount()
  })
  // 评审修复(Important):拉预览的窗口(这里)与卡堆渲染的窗口(TimeMachineDeck.test.ts
  // 的同名用例)必须是同一个数,两处都从 DECK_WINDOW 取值而不是各写各的字面量——否则改
  // 窗口大小时改一处忘另一处,最前的卡会拿不到缩略图且没有任何报错/红测试。用 10 张快照
  // (超过窗口大小)才能测出"只给窗口内的拉",凑够 SNAPS 的 3 张测不出边界。刚挂载时
  // selectedIndex 恒为 0(最新一张),past 方向天然是空的(没有比"最新"更新的快照了),
  // 所以这时可见窗口就精确等于 DECK_WINDOW.depth——直接验证 overlay 这一侧真的在用
  // 这个常量,而不是自己另写一份字面量。
  it('只给卡堆窗口内的快照拉预览(depth 张),不是全部快照', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: i, name: `202607${String(30 - i).padStart(2, '0')}T090000Z_manual_${i}`, label: '', type: 'manual',
      created_at: relDay(i, 9),
    }))
    listMock.mockResolvedValue(many)
    const w = mountIt(); await flush(w)
    expect(getListMock).toHaveBeenCalledTimes(DECK_WINDOW.depth)
  })

  it('齿轮 emit open-settings', async () => {
    const w = mountIt(); await flush(w)
    await w.find('.tm-gear').trigger('click')
    expect(w.emitted('open-settings')).toHaveLength(1)
  })
  it('卸载后键盘监听解除(不会对已销毁组件继续 emit)', async () => {
    const w = mountIt(); await flush(w)
    w.unmount()
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape' }))
    expect(w.emitted('close')).toBeUndefined()
  })
})

describe('焦点管理', () => {
  it('打开时焦点移入覆盖层', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger); trigger.focus()
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: '', folderLabel: '/磁盘' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    expect(document.activeElement).toBe(w.find('.tm-overlay').element)
  })
  it('关闭时焦点归还给打开它的元素', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger); trigger.focus()
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: '', folderLabel: '/磁盘' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    w.unmount()
    expect(document.activeElement).toBe(trigger)
  })
})
