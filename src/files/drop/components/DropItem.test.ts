import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import DropItem from './DropItem.vue'
import { i18n } from '../../../i18n'

const device = (over = {}) => ({ id: 'a', name: { model: 'desktop', deviceName: 'd', displayName: 'MyPC' }, rtcSupported: true, ...over })
const mountItem = (props = {}) =>
  mount(DropItem, {
    props: { device: device(), isSelf: false, isFloat: true, ...props },
    // i18n is already installed globally by vitest.setup.ts; only Pinia needs
    // wiring here (re-passing i18n double-installs the plugin and emits a
    // hidden [Vue warn] that the default reporter swallows).
    global: { plugins: [createPinia()] },
  })

describe('DropItem', () => {
  it('显示设备名与在线图标', () => {
    const w = mountItem()
    expect(w.text()).toContain('MyPC')
    expect(w.find('img.drop-ic').attributes('src')).toContain('desktop_online')
  })
  it('离线灰显且不可点', () => {
    const w = mountItem({ device: device({ offline: true }) })
    expect(w.find('.drop-bubble').classes()).toContain('offline')
    expect(w.find('input[type=file]').attributes('disabled')).toBeDefined()
  })
  it('self 显示 self 图标且无 file input 交互', () => {
    const w = mountItem({ isSelf: true })
    expect(w.find('img.drop-ic').attributes('src')).toContain('self')
    expect(w.find('input[type=file]').attributes('disabled')).toBeDefined()
  })
  it('选文件 emit select-files', async () => {
    const w = mountItem()
    const input = w.find('input[type=file]')
    const file = new File(['x'], 'x.txt')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    expect(w.emitted('select-files')![0][0]).toEqual([file])
  })
  it('suspended 时(重连窗口内)在线设备也禁互动(spec §7)', () => {
    const w = mountItem({ suspended: true })
    expect(w.find('input[type=file]').attributes('disabled')).toBeDefined()
    expect(w.find('.drop-bubble').attributes('disabled')).toBeDefined()
  })
  it('传输中显示进度环与计数文案', () => {
    const w = mountItem({ transfer: { progress: 40, raw: 0.4, sending: true, count: 2 } })
    expect(w.find('.drop-ring').exists()).toBe(true)
    expect(w.text()).toContain(i18n.global.t('filesDropSending', { num: 2 }))
  })
})

// reka-ui's real ContextMenuContent only renders ContextMenuItem into a portal
// while the menu is OPEN, and its real ContextMenuItem injects a MenuRootContext
// that only a real ContextMenuRoot provides — mounting it outside one throws.
// FileContextMenu.test.ts already solved this exact problem for the same
// components/ui/ContextMenu.vue wrapper: stub ContextMenu to render the
// default + #menu slots inline (no portal, no open/close state), and stub
// ContextMenuItem to a plain element that re-emits 'select' on click. This
// proves both "which items render under which props" and "clicking wires to
// the right emit" — the same two facts the real portal would prove, without
// needing to drive reka-ui's open/close state machine in jsdom.
const ContextMenuStub = {
  template: '<div><slot /><div class="menu"><slot name="menu" /></div></div>',
}
const ContextMenuItemStub = {
  emits: ['select'],
  template: '<div class="ctx-item" @click="$emit(\'select\')"><slot /></div>',
}
function mountItemWithMenuStub(props: Record<string, unknown>) {
  return mount(DropItem, {
    props: { device: device(), isSelf: false, isFloat: true, ...props },
    global: {
      plugins: [createPinia()],
      stubs: { ContextMenu: ContextMenuStub, ContextMenuItem: ContextMenuItemStub },
    },
  })
}

describe('DropItem cancel entry', () => {
  it('offers cancelling only while a transfer is running', () => {
    const idle = mountItemWithMenuStub({})
    expect(idle.find('.menu').text()).not.toContain(i18n.global.t('filesDropMenuCancel'))
  })

  it('emits cancel-transfer when the menu entry is chosen', async () => {
    const w = mountItemWithMenuStub({ transfer: { progress: 40, raw: 0.4, sending: true, count: 1 } })
    const items = w.findAll('.menu .ctx-item')
    const cancel = items.find((it) => it.text() === i18n.global.t('filesDropMenuCancel'))
    expect(cancel).toBeTruthy()
    await cancel!.trigger('click')
    expect(w.emitted('cancel-transfer')).toBeTruthy()
  })
})

// The watchdog only ever runs on the RECEIVING side and only ever watches the
// unrounded `raw` fraction -- see the long note in DropItem.vue. Every fixture
// here is therefore `sending: false`, and the ones that represent a live
// transfer move `raw`, not `progress`.
const receiving = (over: Partial<{ progress: number; raw: number; count: number }> = {}) => ({
  progress: 40, raw: 0.4, sending: false, count: 1, ...over,
})

describe('DropItem stall watchdog', () => {
  it('reports a stall when progress stops moving for long enough', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const w = mountItem({ transfer: receiving() })
      vi.advanceTimersByTime(20000)
      await w.vm.$nextTick()
      expect(w.emitted('transfer-stalled')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps quiet while progress is still advancing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const w = mountItem({ transfer: receiving() })
      vi.advanceTimersByTime(10000)
      await w.setProps({ transfer: receiving({ progress: 55, raw: 0.55 }) })
      vi.advanceTimersByTime(10000)
      await w.vm.$nextTick()
      expect(w.emitted('transfer-stalled')).toBeFalsy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('leaves a big slow download alone while it advances in sub-percent steps', async () => {
    // A 5 GB file at ~2 MB/s: one whole percent takes ~25s, so the rounded
    // `progress` sits still far longer than STALL_LIMIT_MS while 64 KB chunks
    // keep arriving. Watching the rounded percent cancels this transfer at
    // t=15s and the partial file is thrown away; watching `raw` does not.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const w = mountItem({ transfer: receiving({ progress: 40, raw: 0.4 }) })
      for (let i = 1; i <= 12; i++) {
        vi.advanceTimersByTime(5000)
        // Same integer percent every time (0.4 -> 0.4048 all round to 40).
        await w.setProps({ transfer: receiving({ progress: 40, raw: 0.4 + i * 0.0004 }) })
      }
      vi.advanceTimersByTime(5000)
      await w.vm.$nextTick()
      expect(w.emitted('transfer-stalled')).toBeFalsy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('never watches the sending side, which ACK_TIMEOUT_MS already bounds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const w = mountItem({ transfer: { progress: 40, raw: 0.4, sending: true, count: 1 } })
      // Assert on the pending-timer count, not just the absent emit: the point
      // is that no interval is scheduled for a send at all.
      expect(vi.getTimerCount()).toBe(0)
      vi.advanceTimersByTime(60000)
      await w.vm.$nextTick()
      expect(w.emitted('transfer-stalled')).toBeFalsy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not run at all when no transfer is in flight', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const w = mountItem({})
      // Assert the watchdog interval was never scheduled in the first place,
      // not just that it never happened to emit — a mutant that starts the
      // interval unconditionally but still no-ops inside on a missing
      // transfer would otherwise pass this test while leaking a timer.
      expect(vi.getTimerCount()).toBe(0)
      vi.advanceTimersByTime(60000)
      await w.vm.$nextTick()
      expect(w.emitted('transfer-stalled')).toBeFalsy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops its timer on unmount so a torn-down card cannot fire', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const w = mountItem({ transfer: receiving() })
      w.unmount()
      // Vue's own emit() already no-ops after unmount (instance.isUnmounted
      // guard), so an emitted-event assertion alone would pass even with a
      // leaked interval — it only proves the symptom, not the cause. Assert
      // directly on the pending-timer count so the mutation that actually
      // matters (a leaked setInterval outliving the component) gets caught.
      expect(vi.getTimerCount()).toBe(0)
      vi.advanceTimersByTime(60000)
      expect(w.emitted('transfer-stalled')).toBeFalsy()
    } finally {
      vi.useRealTimers()
    }
  })
})
