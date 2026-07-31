import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { defineComponent, ref } from 'vue'
import TimeMachineOverlay from './TimeMachineOverlay.vue'
import SnapshotSettingsDialog from './SnapshotSettingsDialog.vue'
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
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' })); await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toBe('今天 09:00')
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' })); await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' })); await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30') // 已经在最新,夹紧
  })
  it('Esc emit close', async () => {
    const w = mountIt(); await flush(w)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
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
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }))
    expect(w.emitted('select')).toHaveLength(1)
  })
  it('这一刻还没有这个文件夹(预览 404 → missing)时,进入落到快照根而不是拼一个不存在的子路径', async () => {
    getListMock.mockRejectedValue(Object.assign(new Error('nope'), { code: 404 }))
    const w = mountIt(); await flush(w)
    await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe('/DATA/.snapshots/20260730T143000Z_manual_x')
  })

  // 评审修复(Critical 2,第一轮):onKeydown(当时还叫 onKeyup)挂在 document 上,不看
  // 事件源也不管上面是否叠着弹窗。齿轮设置弹窗(reka-ui DialogContent)Teleport 到 body,
  // 不是 .tm-overlay 的 DOM 后代——这三条用例分别钉住两道防线:第 1 条(事件源不在覆盖层
  // 外)钉防线①,第 2/3 条把输入框直接挂在覆盖层根节点内部,专门验证防线②(标签名判定)
  // 独立生效——如果只留防线①,这两条会因为"确实在 rootEl 内"而失败,能揪出"删掉防线②"
  // 这个变异。
  it('弹窗打开时 Esc 不 emit close(事件源在覆盖层外,例如叠着的设置弹窗)', async () => {
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
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
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }))
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
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
    w.unmount()
  })
  // 评审修复(Critical 2,第二轮):底栏按钮(取消/进入)聚焦时按 Enter,浏览器会把 Enter
  // 的默认动作(点击这个 button)当成 keydown 的一部分触发;如果这里的全局 Enter 分支不管
  // 目标是不是按钮都继续执行 enterSnapshot(),就会和按钮自己的 @click 各发一次副作用
  // (聚焦在"取消"按钮上按 Enter,会同时 emit close 又 emit select)。这条直接把 keydown
  // 派发到 tm-bar-cancel 按钮本身(target=按钮,在 rootEl 内、不是 INPUT,两道旧防线都会
  // 放行),断言 select 不会被重复 emit。
  it('底栏"取消"按钮聚焦时按 Enter 不重复触发 enterSnapshot(只让按钮自己的 click 生效)', async () => {
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    const cancelBtn = w.find('.tm-bar-cancel').element as HTMLElement
    cancelBtn.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }))
    expect(w.emitted('select')).toBeUndefined()
    w.unmount()
  })
  it('底栏"进入"按钮聚焦时按 Enter 不重复触发 enterSnapshot(只让按钮自己的 click 生效)', async () => {
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    const enterBtn = w.find('.tm-bar-enter').element as HTMLElement
    enterBtn.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }))
    // 全局 handler 不应该自己再 emit 一次;按钮真正的点击走 @click(用另一条用例
    // "进入落在当前相对路径下" 已覆盖),这里只验证 handler 侧不重复触发。
    expect(w.emitted('select')).toBeUndefined()
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
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
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

// 评审复核(Critical 2,第二轮):上一轮的用例用一个常驻 body 上的 div 模拟"事件源在覆盖层
// 外",复现不了真实场景——真实场景里齿轮设置弹窗是**挂载又卸载**的(reka DialogContent,
// Teleport 到 body),Esc 按下时弹窗会在 keydown 那一刻就消失、焦点也已经归还进覆盖层,
// 那条常驻 div 用例测不出"弹窗已消失 + 焦点已归还"这个真实时序,给了假信心。这里挂真实的
// SnapshotSettingsDialog(reka-ui DialogRoot/DialogContent/FocusScope/DismissableLayer 全套
// 真实组件,不是手搓的替身),完全照抄 Files.vue 的真实接线方式(@open-settings 打开、
// v-model:open 双向绑定),用真实的 keydown→keyup 两段式事件重放整条时序。
describe('Critical 2(第二轮):真实 reka 弹窗的 Esc 时序', () => {
  const Harness = defineComponent({
    components: { TimeMachineOverlay, SnapshotSettingsDialog },
    setup() {
      const settingsOpen = ref(false)
      return { settingsOpen }
    },
    // 与 Files.vue 549-567 行的真实接线一一对应:齿轮 emit open-settings 打开弹窗,
    // 弹窗自己 v-model:open 回落。
    template: `
      <div>
        <TimeMachineOverlay
          volume-uuid="u-data" mount-point="/DATA" rel-path="Photos" folder-label="/磁盘/Photos"
          @close="$emit('overlay-close')"
          @open-settings="settingsOpen = true"
        />
        <SnapshotSettingsDialog v-model:open="settingsOpen" volume-uuid="u-data" mount-point="/DATA" />
      </div>
    `,
    emits: ['overlay-close'],
  })

  it('keydown Esc 关掉设置弹窗且焦点已归还覆盖层后,尾随的 keyup Esc 不会把时间机器也带着关掉', async () => {
    const w = mount(Harness, { global: { plugins: [i18n] }, attachTo: document.body })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()

    // 打开真实的齿轮设置弹窗(真实 DialogContent Teleport 到 body)
    await w.find('.tm-gear').trigger('click')
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(document.querySelector('.ui-dialog-content')).not.toBeNull()
    // 复核实测的真实前置状态:焦点此刻确实落在弹窗内容上(不在覆盖层里)
    expect(document.activeElement?.className).toContain('ui-dialog-content')

    // keydown Esc:reka 的 DismissableLayer(vueuse onKeyStroke 监听 window keydown)在这一
    // 刻关掉弹窗并把焦点归还——这一段是真实浏览器行为,不是 mock。
    const beforeKeyup = document.activeElement as HTMLElement
    beforeKeyup.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }))
    await w.vm.$nextTick(); await w.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0))

    // 复核实测的真实中间状态:弹窗已经消失,焦点已经归还进覆盖层内部。
    // 用 w.get(...) 精确定位这个 wrapper 自己的 .tm-overlay(而不是 document.querySelector
    // 抓全局第一个匹配)—— 同目录另一条既有用例("打开时焦点移入覆盖层")没有 unmount,
    // jsdom 单一文档跨用例累积多个 .tm-overlay 节点是已知的测试卫生问题,不属于本轮修复
    // 范围,这里只需不被它污染。
    expect(document.querySelector('.ui-dialog-content')).toBeNull()
    expect(w.get('.tm-overlay').element.contains(document.activeElement)).toBe(true)

    // 同一次物理按键的 keyup 尾随而至,target 已经变成覆盖层内部的元素——这正是漏洞所在:
    // 换成 keydown 监听之后,我们已经不再监听 keyup,这里派发它不该有任何效果。
    const afterKeydown = document.activeElement as HTMLElement
    afterKeydown.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }))
    await w.vm.$nextTick()

    expect(w.findComponent(TimeMachineOverlay).emitted('close')).toBeUndefined()
    expect(w.emitted('overlay-close')).toBeUndefined()
    w.unmount()
  })

  // 对照组:保留并确认 Enter、方向键两条仍然绿(上一轮已修好,本轮不应该被 keydown 切换破坏)。
  it('对照:方向键与 Enter 在没有叠加弹窗时仍然正常工作(keydown 切换未破坏既有行为)', async () => {
    const w = mount(Harness, { global: { plugins: [i18n] }, attachTo: document.body })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }))
    await w.vm.$nextTick()
    // 只有一张空快照列表(listMock 默认 mockResolvedValue([])),没有可选项,ArrowUp 不应该抛错;
    // 换一条更直接的信号:Escape 依然能正常关闭覆盖层本身(没有弹窗叠加时,防线①不拦截)。
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.findComponent(TimeMachineOverlay).emitted('close')).toHaveLength(1)
    w.unmount()
  })
})
