import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConsoleStage from './ConsoleStage.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (state: string) => ({ id: 'v', name: 'x', state } as KvmVM)
const mk = (p: Record<string, unknown> = {}) =>
  mount(ConsoleStage, { props: { vm: VM('running'), connected: false, errorKey: '', processing: false, ...p },
    global: { plugins: [i18n] } })

describe('ConsoleStage placeholder layer', () => {
  it('Show placeholder layer when not connected, hide after connecting', () => {
    expect(mk().find('.console-placeholder').exists()).toBe(true)
    expect(mk({ connected: true }).find('.console-placeholder').exists()).toBe(false)
  })
  it('Show power-on large button when stopped, emit start when clicked', async () => {
    const w = mk({ vm: VM('stopped') })
    const b = w.get('.start-vm-btn')
    await b.trigger('click')
    expect(w.emitted('start')).toHaveLength(1)
  })
  it('Show resume large button when paused, emit resume when clicked', async () => {
    const w = mk({ vm: VM('paused') })
    await w.get('.start-vm-btn').trigger('click')
    expect(w.emitted('resume')).toHaveLength(1)
  })
  it('When running but not connected, do not show large button (per Vue2 :168-190 v-if condition)', () => {
    expect(mk().find('.start-vm-btn').exists()).toBe(false)
  })
  it('Large button is disabled when processing', () => {
    expect(mk({ vm: VM('stopped'), processing: true }).get('.start-vm-btn').attributes('disabled')).toBeDefined()
  })
  it('When there is an error, show red error text and do not show large button (Vue2 v-if/else)', () => {
    const w = mk({ vm: VM('stopped'), errorKey: 'kvmVncFetchFailed' })
    expect(w.get('.console-hint').classes()).toContain('is-error')
    expect(w.text()).toContain('获取 VNC 信息失败')
    expect(w.find('.start-vm-btn').exists()).toBe(false)
  })
  it('Expose hostEl for composable to mount RFB', () => {
    const w = mk()
    expect((w.vm as unknown as { hostEl: HTMLElement }).hostEl).toBeTruthy()
  })
  it('Large button has aria-label', () => {
    expect(mk({ vm: VM('stopped') }).get('.start-vm-btn').attributes('aria-label')).toBeTruthy()
  })
  // Review Minor: hard constraint 4 (prohibit placeholder symbols, must use real images) currently relies entirely on manual checking
  // whether there is an import of a real .svg in <script setup>. Add a test case that can automatically differentiate —
  // Vite parses .svg static resources as `data:image/svg+xml,...` inlined URLs (verified with probe script, not a guess),
  // real image's src will be this prefix and the two buttons differ; switching to placeholder symbols (emoji/unicode characters)
  // or both buttons sharing the same image would cause this test to fail.
  it('Power-on/resume large buttons use real svg icons, not placeholder symbols (hard constraint 4)', () => {
    const powerSrc = mk({ vm: VM('stopped') }).get('.power-svg').attributes('src')
    const playSrc = mk({ vm: VM('paused') }).get('.power-svg').attributes('src')
    expect(powerSrc).toMatch(/^data:image\/svg\+xml/)
    expect(playSrc).toMatch(/^data:image\/svg\+xml/)
    expect(powerSrc).not.toBe(playSrc) // Power icon and resume icon are not the same image
  })

  // Task 7 review correction: SendKeyToolbar no longer relies on Teleport + parent's manually written addEventListener
  // mounted into `.console-display`, changed to this component forwarding console-enter/console-leave/console-move three
  // mouse events + one <slot />, the parent component (KvmPage) passes the toolbar as slot content. Add two test cases
  // here to verify the forwarding itself is not misconfigured — KvmPage.test.ts's full mount test can only indirectly prove
  // "overall wiring is connected", insufficient to locate "whether ConsoleStage forwarded incorrectly or KvmPage received incorrectly".
  it('Forward console-enter/console-leave/console-move three mouse events (Task 7)', async () => {
    const w = mk()
    const display = w.get('.console-display')
    await display.trigger('mouseenter')
    expect(w.emitted('console-enter')).toHaveLength(1)
    await display.trigger('mouseleave')
    expect(w.emitted('console-leave')).toHaveLength(1)
    await display.trigger('mousemove', { clientX: 42 })
    expect(w.emitted('console-move')).toHaveLength(1)
    expect((w.emitted('console-move')![0][0] as MouseEvent).clientX).toBe(42) // Native event object passed through, not an empty shell
  })

  it('Slot content renders inside .console-display (for SendKeyToolbar to mount, Task 7)', () => {
    const w = mount(ConsoleStage, {
      props: { vm: VM('running'), connected: false, errorKey: '', processing: false },
      slots: { default: '<div class="probe-slot-content">x</div>' },
      global: { plugins: [i18n] },
    })
    expect(w.find('.console-display .probe-slot-content').exists()).toBe(true)
  })
})
