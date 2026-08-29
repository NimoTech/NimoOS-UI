import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VmSidebar from './VmSidebar.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (id: string, state = 'running') => ({ id, name: id, state, vcpu: 1, memory: 512, os: 'linux' } as KvmVM)
const mk = (props: Partial<InstanceType<typeof VmSidebar>['$props']> = {}) =>
  mount(VmSidebar, {
    props: { vms: [VM('a'), VM('b', 'stopped')], selectedId: 'a', runningCount: 1, isLoading: false, collapsed: false, ...props },
    global: { plugins: [i18n] },
  })

describe('VmSidebar', () => {
  it('header displays "1 / 2 running"', () => {
    expect(mk().get('.kvm-status').text().replace(/\s+/g, ' ')).toContain('1 / 2 运行中')
  })

  it('status dot lights up in header when there are running VMs', () => {
    expect(mk().get('.kvm-status .status-dot').classes()).toContain('running')
    expect(mk({ runningCount: 0 }).get('.kvm-status .status-dot').classes()).not.toContain('running')
  })

  it('renders each VM', () => {
    expect(mk().findAll('.vm-list-item')).toHaveLength(2)
  })

  it('clicking a VM emits select with that VM object', async () => {
    const w = mk()
    await w.findAll('.vm-list-item')[1].trigger('click')
    expect((w.emitted('select')![0][0] as KvmVM).id).toBe('b')
  })

  it('empty list and loading complete → show empty state message', () => {
    expect(mk({ vms: [], runningCount: 0 }).text()).toContain('暂无虚拟机')
  })

  it('loading and empty list → do not show empty state (per Vue2 v-if="vms.length===0 && !isLoading")', () => {
    expect(mk({ vms: [], runningCount: 0, isLoading: true }).text()).not.toContain('暂无虚拟机')
  })

  // P6 Task 8 unlocked: Add VM button is no longer a "shape-first" placeholder button; clicking
  // really emits to open the create dialog (per Vue2 `@click="showCreateVM"` :61-64).
  it('Add VM button no longer disabled, clicking emits add-vm', async () => {
    const w = mk()
    const btn = w.get('.add-vm-btn')
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    expect(w.emitted('add-vm')).toHaveLength(1)
  })

  // Task 2 unlocked: settings gear button is no longer a "shape-first" placeholder button;
  // clicking really emits to open the global settings dialog.
  it('gear button no longer disabled, clicking emits open-global-settings', async () => {
    const w = mount(VmSidebar, { props: { vms: [], selectedId: null, runningCount: 0, isLoading: false, collapsed: false }, global: { plugins: [i18n] } })
    const btn = w.get('.kvm-settings-btn')
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    expect(w.emitted('open-global-settings')).toHaveLength(1)
  })

  it('collapsed passes through to root element', () => {
    expect(mk({ collapsed: true }).classes()).toContain('collapsed')
  })

  // Task 8 cleanup fix: Vue2 narrow-screen drawer's active/open class was never really toggled
  // (dead code, see comment above `.kvm-sidebar.active` rule in kvm.css); here we reuse collapsed
  // state to drive the same drawer visibility on narrow screens — active when not-collapsed (default),
  // not active when collapsed.
  it('root element active class is opposite of collapsed (drives narrow-screen drawer visibility)', () => {
    expect(mk({ collapsed: false }).classes()).toContain('active')
    expect(mk({ collapsed: true }).classes()).not.toContain('active')
  })

  // Review important supplementary test: selectedId is the sole basis for "which is highlighted";
  // no test case previously asserted this (VmListItem.test.ts only tested prop→class, here only
  // counted rows/emits); review mutation `:active="false"` passed all-green. Here we lock in that
  // whichever selectedId points to gets the active class, and when id changes, the highlight moves.
  it('whichever selectedId points to gets the active class (and only it)', () => {
    const items = mk({ selectedId: 'a' }).findAll('.vm-list-item')
    expect(items[0].classes()).toContain('active')
    expect(items[1].classes()).not.toContain('active')
  })

  it('when selectedId changes to a different VM, highlight follows', () => {
    const items = mk({ selectedId: 'b' }).findAll('.vm-list-item')
    expect(items[0].classes()).not.toContain('active')
    expect(items[1].classes()).toContain('active')
  })
})
