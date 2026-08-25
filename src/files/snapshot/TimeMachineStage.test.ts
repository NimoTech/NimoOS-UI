import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { defineComponent, nextTick } from 'vue'
import TimeMachineStage from './TimeMachineStage.vue'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// The stage never talks to the network itself (Task 6's own store actions do), but mounting it
// still pulls in the snapshotBrowse store module, which imports the service client and the router
// singleton — stub both so an accidental real call in a future edit fails loudly instead of hanging.
vi.mock('@nimotech/nimoos-service', () => ({
  service: { snapshot: { listVolumes: vi.fn(), list: vi.fn(), restore: vi.fn() }, folder: { getList: vi.fn() } },
}))
vi.mock('../../router', () => ({ router: { push: vi.fn(), replace: vi.fn() } }))

// A host wrapping TimeMachineStage with real, recognizable slot content — cloneNode(true) capture
// (the stage's own core mechanism) needs actual DOM to clone, not an abstract render check.
const Host = defineComponent({
  components: { TimeMachineStage },
  props: { dialogOpen: { type: Boolean, default: false } },
  emits: ['open-settings'],
  template: `
    <TimeMachineStage :dialog-open="dialogOpen" @open-settings="$emit('open-settings')">
      <div class="probe">hello real window</div>
    </TimeMachineStage>
  `,
})

const mountIt = (props: Record<string, unknown> = {}) =>
  mount(Host, { props, global: { plugins: [i18n] }, attachTo: document.body })

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('TimeMachineStage shell', () => {
  it('always renders the default slot content, active or not', () => {
    const w = mountIt()
    expect(w.find('.probe').text()).toBe('hello real window')
    useSnapshotBrowseStore().tmActive = true
    expect(w.find('.probe').exists()).toBe(true)
  })

  it('inactive: no decorative shell, .tm-fwin carries no active/traveling class', () => {
    const w = mountIt()
    expect(w.find('.tm-stage--active').exists()).toBe(false)
    expect(w.find('.tm-stage__clone').exists()).toBe(false)
    expect(w.find('.tm-stage__glass').exists()).toBe(false)
    expect(w.find('.tm-stage__hold .tm-fwin').classes()).not.toContain('tm-fwin--active')
  })

  it('active: renders the glass/clone shell and marks .tm-fwin active', async () => {
    const w = mountIt()
    useSnapshotBrowseStore().tmActive = true
    await nextTick()
    expect(w.find('.tm-stage').classes()).toContain('tm-stage--active')
    expect(w.find('.tm-stage__glass').exists()).toBe(true)
    expect(w.find('.tm-stage__clone').exists()).toBe(true)
    expect(w.find('.tm-stage__hold .tm-fwin').classes()).toContain('tm-fwin--active')
  })

  // M2-F8 (Vue2 parity): a live cloneNode(true) of the pre-Time-Machine DOM, captured before Vue
  // re-renders with Time-Machine styling — the clone still shows the SAME content, independent of
  // (and unaffected by) whatever the live .tm-fwin goes on to render afterwards.
  it('captures a clone of the real window before going active, mounted into .tm-stage__clone', async () => {
    const w = mountIt()
    useSnapshotBrowseStore().tmActive = true
    await nextTick() // clone is captured synchronously (flush:'sync'); mounting itself waits one tick
    await nextTick()
    const clone = w.find('.tm-stage__clone')
    expect(clone.exists()).toBe(true)
    expect(clone.find('.probe').exists()).toBe(true)
    expect(clone.find('.probe').text()).toBe('hello real window')
    // The live window keeps rendering its own copy independently — two nodes, not a move.
    expect(w.findAll('.probe')).toHaveLength(2)
  })

  it('gear button emits open-settings', async () => {
    const w = mountIt()
    useSnapshotBrowseStore().tmActive = true
    await nextTick()
    await w.find('.tm-stage__gear').trigger('click')
    expect(w.emitted('open-settings')).toHaveLength(1)
  })

  it('.tm-fwin--traveling reflects the store\'s tmTravel state', async () => {
    const w = mountIt()
    const browse = useSnapshotBrowseStore()
    browse.tmActive = true
    await nextTick()
    expect(w.find('.tm-stage__hold .tm-fwin').classes()).not.toContain('tm-fwin--traveling')

    browse.tmTravel = { from: 'a', to: 'b' }
    await nextTick()
    expect(w.find('.tm-stage__hold .tm-fwin').classes()).toContain('tm-fwin--traveling')

    browse.tmTravel = null
    await nextTick()
    expect(w.find('.tm-stage__hold .tm-fwin').classes()).not.toContain('tm-fwin--traveling')
  })

  describe('Escape to exit', () => {
    it('exits when active and no dialog is open', async () => {
      mountIt()
      const browse = useSnapshotBrowseStore()
      const spy = vi.spyOn(browse, 'exitTimeMachine').mockImplementation(() => {})
      browse.tmActive = true
      await nextTick()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('does not exit while a dialog (e.g. snapshot settings) is open', async () => {
      mountIt({ dialogOpen: true })
      const browse = useSnapshotBrowseStore()
      const spy = vi.spyOn(browse, 'exitTimeMachine').mockImplementation(() => {})
      browse.tmActive = true
      await nextTick()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
      expect(spy).not.toHaveBeenCalled()
    })

    it('does not listen at all while inactive', () => {
      mountIt()
      const browse = useSnapshotBrowseStore()
      const spy = vi.spyOn(browse, 'exitTimeMachine').mockImplementation(() => {})
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
      expect(spy).not.toHaveBeenCalled()
    })

    it('does not exit when Escape targets a stacked dialog outside the stage (Teleported content)', async () => {
      const w = mountIt()
      const browse = useSnapshotBrowseStore()
      const spy = vi.spyOn(browse, 'exitTimeMachine').mockImplementation(() => {})
      browse.tmActive = true
      await nextTick()
      // Simulate a reka-ui DialogContent Teleported to document.body — a sibling of the stage
      // root, not one of its descendants.
      const outside = document.createElement('div')
      document.body.appendChild(outside)
      const evt = new KeyboardEvent('keydown', { code: 'Escape' })
      Object.defineProperty(evt, 'target', { value: outside })
      window.dispatchEvent(evt)
      expect(spy).not.toHaveBeenCalled()
      outside.remove()
      w.unmount()
    })
  })
})
