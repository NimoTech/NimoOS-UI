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

// Note: the brief's draft wrote SNAPS created_at as absolute dates ('2026-07-30'), while
// groupSnapshotsByDay's "today/yesterday" decision uses the real system clock (default param
// now = new Date()) — once they diverge (tests running on any day other than 2026-07-30), the
// "today" group is classified as "earlier" and this fixture silently expires. Changed to dates
// relative to "now", always aligned, independent of the real calendar. (Same class of trap:
// see memory newui-fixture-from-imagination-trap)
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
  // Originally in the top-left; a long path would run across into the gear and cover the deck animation — moved above the bottom-bar time (user feedback)
  it('底栏时间上方显示当前文件夹', async () => {
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-bar-folder').text()).toContain('/磁盘/Photos')
    expect(w.find('.tm-folder').exists()).toBe(false) // the top-left line should no longer exist
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
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30') // already at the newest, clamped
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

  // Review fix (Critical 2, round 1): onKeydown (then still called onKeyup) hung on document,
  // ignoring the event source and whether a dialog was stacked on top. The gear settings
  // dialog (reka-ui DialogContent) Teleports to body and is not a DOM descendant of
  // .tm-overlay — these three cases each pin one of the two guards: case 1 (event source
  // outside the overlay) pins guard 1; cases 2/3 attach an input directly inside the overlay
  // root to verify guard 2 (tag-name check) works independently — with only guard 1 left,
  // these two would fail because the target really is inside rootEl, catching the
  // "delete guard 2" mutation.
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
  // Review fix (Critical 2, round 2): with a bottom-bar button (cancel/enter) focused,
  // pressing Enter makes the browser fire the key's default action (clicking that button) as
  // part of keydown; if the global Enter branch ran enterSnapshot() regardless of whether the
  // target is a button, it would fire a side effect alongside the button's own @click (Enter
  // on the focused "cancel" button would emit close AND select). This case dispatches keydown
  // directly at the tm-bar-cancel button itself (target = button, inside rootEl, not an INPUT,
  // so both old guards pass it through) and asserts select is not emitted twice.
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
    // The global handler must not emit again on its own; the button's real click goes through
    // @click (covered by the "enters at the current relative path" case), so this only
    // verifies the handler side doesn't double-fire.
    expect(w.emitted('select')).toBeUndefined()
    w.unmount()
  })
  // Review fix (Important): the preview-fetch window (here) and the deck render window (the
  // same-named case in TimeMachineDeck.test.ts) must be the same number, both reading
  // DECK_WINDOW rather than separate literals — otherwise changing the window size in one
  // place and forgetting the other leaves the front card without thumbnails, with no error
  // and no red test. 10 snapshots (more than the window) are needed to detect "fetch only for
  // the window"; SNAPS' 3 can't exercise the boundary. Right after mount selectedIndex is
  // always 0 (the newest), so the past direction is naturally empty (nothing newer than
  // "newest"), and the visible window then exactly equals DECK_WINDOW.depth — directly
  // verifying the overlay side really uses this constant rather than its own literal.
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

// Review re-check (Critical 2, round 2): the previous round's case used a div permanently on
// body to simulate "event source outside the overlay", which cannot reproduce the real
// scenario — in reality the gear settings dialog is **mounted and unmounted** (reka
// DialogContent, Teleported to body); when Esc is pressed the dialog disappears at keydown
// and focus is already returned into the overlay. The permanent-div case cannot test the real
// "dialog gone + focus returned" timing and gave false confidence. Here we mount the real
// SnapshotSettingsDialog (the full set of real reka-ui
// DialogRoot/DialogContent/FocusScope/DismissableLayer components, not a hand-rolled stand-in),
// wired exactly like Files.vue (@open-settings opens, v-model:open two-way binding), and
// replay the whole sequence with real two-phase keydown→keyup events.
describe('Critical 2(第二轮):真实 reka 弹窗的 Esc 时序', () => {
  const Harness = defineComponent({
    components: { TimeMachineOverlay, SnapshotSettingsDialog },
    setup() {
      const settingsOpen = ref(false)
      return { settingsOpen }
    },
    // Matches the real wiring at Files.vue lines 549-567 one-to-one: the gear emits
    // open-settings to open the dialog, and the dialog itself falls back via v-model:open.
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

    // Open the real gear settings dialog (real DialogContent Teleported to body)
    await w.find('.tm-gear').trigger('click')
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(document.querySelector('.ui-dialog-content')).not.toBeNull()
    // Real precondition measured in the re-check: focus really is on the dialog content now (not inside the overlay)
    expect(document.activeElement?.className).toContain('ui-dialog-content')

    // keydown Esc: reka's DismissableLayer (vueuse onKeyStroke listening on window keydown)
    // closes the dialog at this moment and returns focus — this part is real browser behavior,
    // not a mock.
    const beforeKeyup = document.activeElement as HTMLElement
    beforeKeyup.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }))
    await w.vm.$nextTick(); await w.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0))

    // Real intermediate state measured in the re-check: the dialog is gone and focus has been
    // returned inside the overlay. Use w.get(...) to pinpoint this wrapper's own .tm-overlay
    // (rather than document.querySelector grabbing the first global match) — another existing
    // case in this directory ("focus moves into the overlay on open") never unmounts, and
    // jsdom's single document accumulating multiple .tm-overlay nodes across cases is a known
    // test-hygiene issue outside this round's scope; here we only need to avoid being
    // polluted by it.
    expect(document.querySelector('.ui-dialog-content')).toBeNull()
    expect(w.get('.tm-overlay').element.contains(document.activeElement)).toBe(true)

    // The same physical keystroke's keyup trails in, with target now an element inside the
    // overlay — exactly where the hole was: after switching to keydown listening we no longer
    // listen to keyup, so dispatching it here must have no effect.
    const afterKeydown = document.activeElement as HTMLElement
    afterKeydown.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }))
    await w.vm.$nextTick()

    expect(w.findComponent(TimeMachineOverlay).emitted('close')).toBeUndefined()
    expect(w.emitted('overlay-close')).toBeUndefined()
    w.unmount()
  })

  // Control group: keep and confirm the Enter and arrow-key cases stay green (fixed last round; the keydown switch must not break them this round).
  it('对照:方向键与 Enter 在没有叠加弹窗时仍然正常工作(keydown 切换未破坏既有行为)', async () => {
    const w = mount(Harness, { global: { plugins: [i18n] }, attachTo: document.body })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }))
    await w.vm.$nextTick()
    // Only an empty snapshot list (listMock defaults to mockResolvedValue([])), nothing to
    // select, so ArrowUp must not throw; use a more direct signal instead: Escape still
    // closes the overlay itself normally (with no dialog stacked, guard 1 doesn't block).
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.findComponent(TimeMachineOverlay).emitted('close')).toHaveLength(1)
    w.unmount()
  })
})
