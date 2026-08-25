import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { defineComponent, nextTick } from 'vue'
import gsap from 'gsap'
import TimeMachineStage from './TimeMachineStage.vue'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import { useFilesStore } from '../stores/files'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

const listVolumesMock = vi.fn()
// The stage never talks to the network itself (Task 6's own store actions do), but mounting it
// still pulls in the snapshotBrowse store module, which imports the service client and the router
// singleton — stub both so an accidental real call in a future edit fails loudly instead of hanging.
vi.mock('@nimotech/nimoos-service', () => ({
  service: { snapshot: { listVolumes: () => listVolumesMock(), list: vi.fn(), restore: vi.fn() }, folder: { getList: vi.fn() } },
}))
vi.mock('../../router', () => ({ router: { push: vi.fn(), replace: vi.fn() } }))
// Task 7's own TimeMachineDepthStack (mounted at z-tier 3 while active) renders one
// SnapshotPreviewWindow per visible slot, each fetching its own listing -- stub it so this suite
// stays about the stage's own wiring, not that already-tested fetch behavior.
vi.mock('../util/snapshotPreviewCache', () => ({ getSnapshotPreview: vi.fn().mockResolvedValue({ entries: [], error: false }) }))

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
  //
  // Review fix (Important, round 1): the original version of this test only compared `.probe`
  // text, which is identical whether the clone was taken before OR after Vue applied
  // tm-fwin--active — it could not tell a correct pre-render capture apart from a regression that
  // captures too late. The real discriminator is the active-only class/style on the cloned
  // `.tm-fwin` root itself: captured BEFORE Vue's render, it must still be the plain
  // pre-activation node (no `tm-fwin--active`, no scale transform), while the LIVE `.tm-fwin`
  // (same tick, same activation) already carries both.
  //
  // Deliberate-regression RED check (see task-6-fix-report.md for the full transcript): flipping
  // TimeMachineStage.vue's own watcher to `{ flush: 'pre' }` did NOT turn this test red — Vue 3's
  // scheduler already runs pre-flush watcher callbacks before any component's own render job in
  // the same batch, so that particular flip isn't actually a regression here. Deferring the
  // capture call itself past the render instead — `nextTick(() => captureClone())` in place of a
  // bare `captureClone()` — DID turn it red (exactly the "clonedFwin classes to not contain
  // tm-fwin--active" assertion below failing, clone showing tm-fwin--active). Both experiments
  // were reverted after confirming.
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

    // Timing pin: the clone's own root (fwinEl.cloneNode(true), appended straight into
    // .tm-stage__clone — see mountClone()) must be the PRE-activation node, not a copy taken
    // after Vue already re-rendered with Time-Machine styling.
    const clonedFwin = clone.find('.tm-fwin')
    expect(clonedFwin.exists()).toBe(true)
    expect(clonedFwin.classes()).not.toContain('tm-fwin--active')
    expect(clonedFwin.attributes('style') ?? '').not.toContain('scale')
    // The LIVE window, captured at the very same activation, already has both — proving the two
    // really did diverge (this isn't just "the assertion never fires either way").
    const liveFwin = w.find('.tm-stage__hold .tm-fwin')
    expect(liveFwin.classes()).toContain('tm-fwin--active')
    expect(liveFwin.attributes('style') ?? '').toContain('scale')
  })

  it('gear button emits open-settings', async () => {
    const w = mountIt()
    useSnapshotBrowseStore().tmActive = true
    await nextTick()
    await w.find('.tm-stage__gear').trigger('click')
    expect(w.emitted('open-settings')).toHaveLength(1)
  })

  // Fix round (review finding 1): `.tm-fwin--traveling` reflects `tmTravelActive` (the
  // reveal-gate flag TimeMachineDepthStack.vue's own armReveal/settle owns), NOT `tmTravel` (a
  // pure "navigation in flight" signal that clears within milliseconds, long before a real dolly
  // sweep finishes) -- see snapshotBrowse.ts's own header comment on tmTravelActive for why the
  // two are deliberately separate. `tmTravel` toggling alone must NOT flip the class any more.
  it('.tm-fwin--traveling reflects the store\'s tmTravelActive state, not tmTravel', async () => {
    const w = mountIt()
    const browse = useSnapshotBrowseStore()
    browse.tmActive = true
    await nextTick()
    expect(w.find('.tm-stage__hold .tm-fwin').classes()).not.toContain('tm-fwin--traveling')

    browse.tmTravel = { from: 'a', to: 'b' }
    await nextTick()
    expect(w.find('.tm-stage__hold .tm-fwin').classes()).not.toContain('tm-fwin--traveling')

    browse.tmTravelActive = true
    await nextTick()
    expect(w.find('.tm-stage__hold .tm-fwin').classes()).toContain('tm-fwin--traveling')

    // tmTravel clearing (navigation settled) alone must NOT reveal the real window.
    browse.tmTravel = null
    await nextTick()
    expect(w.find('.tm-stage__hold .tm-fwin').classes()).toContain('tm-fwin--traveling')

    browse.tmTravelActive = false
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

  describe('TimeMachineDepthStack mounting (Task 7)', () => {
    it('mounts the depth stack only while active/fading (never while fully inactive)', async () => {
      const w = mountIt()
      expect(w.find('.tm-depth-stack').exists()).toBe(false)
      useSnapshotBrowseStore().tmActive = true
      await nextTick()
      expect(w.find('.tm-depth-stack').exists()).toBe(true)
    })

    // Fix round (review finding 2): TimeMachineDepthStack.vue must measure the STAGE root
    // (`.tm-stage`, provided by TimeMachineStage.vue via tmStageRoot.ts), NOT its own
    // `.tm-depth-stack` wrapper -- the wrapper's own CSS already reserves the bottom 80px band,
    // so measuring IT double-subtracts that band inside resolveSlotPose/computeVisibleStripCap.
    // Regression guard: stub `clientHeight` to a DIFFERENT, identifiable value per element and
    // assert the resulting T(-1) strip's own GSAP-applied `y` matches the STAGE element's height
    // (`* 1.4`, resolveSlotPose's own EXIT_OFFSET_MULTIPLIER) -- if the component were still
    // measuring the wrapper, this would instead reflect the wrapper's own (deliberately
    // different) stubbed value.
    it('measures the stage root\'s clientHeight, not the depth-stack wrapper\'s', async () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get(this: HTMLElement) {
          if (this.classList.contains('tm-stage')) return 1000
          if (this.classList.contains('tm-depth-stack')) return 1 // deliberately wrong if ever read
          return 0
        },
      })
      try {
        const w = mountIt()
        const browse = useSnapshotBrowseStore()
        const files = useFilesStore()
        listVolumesMock.mockResolvedValue([{ volume_uuid: 'u1', mount: '/media/RAID_0', supported: true }])
        await browse.ensureVolumes()
        browse.snapshotList = [
          { name: 's0', created_at: '2026-01-02T00:00:00Z' }, // more recent -- lands at depth -1
          { name: 's1', created_at: '2026-01-01T00:00:00Z' }, // selection -- depth 0
        ]
        files.currentPath = '/media/RAID_0/.snapshots/s1'
        browse.tmActive = true
        await nextTick()
        await nextTick() // TimeMachineDepthStack's own onMounted -> nextTick(measureHeight)
        await flushPromises()

        const strip = w.get('[data-snapshot="s0"]') // depth -1
        expect(strip.attributes('data-depth')).toBe('-1')
        const y = gsap.getProperty(strip.element, 'y')
        expect(y).toBeCloseTo(1000 * 1.4, 5) // stage's own 1000 * resolveSlotPose's EXIT_OFFSET_MULTIPLIER
      } finally {
        // clientHeight is normally inherited from Element.prototype (no own descriptor on
        // HTMLElement.prototype) -- restore the own descriptor if one existed, else remove the
        // stub entirely so it cannot leak into any other test in this file.
        if (originalDescriptor) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalDescriptor)
        else Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight')
      }
    })
  })

  describe('ArrowUp/ArrowDown stepping (Task 7, preempts Task 9\'s own keyboard line item)', () => {
    async function setupBrowsing() {
      const browse = useSnapshotBrowseStore()
      const files = useFilesStore()
      listVolumesMock.mockResolvedValue([{ volume_uuid: 'u1', mount: '/media/RAID_0', supported: true }])
      await browse.ensureVolumes()
      browse.snapshotList = [
        { name: 's0', created_at: '2026-01-03T00:00:00Z' },
        { name: 's1', created_at: '2026-01-02T00:00:00Z' },
        { name: 's2', created_at: '2026-01-01T00:00:00Z' },
      ]
      files.currentPath = '/media/RAID_0/.snapshots/s1'
      return { browse, files }
    }

    it('ArrowUp steps to the next MORE RECENT snapshot (stepLater — lower index)', async () => {
      const w = mountIt()
      const { browse } = await setupBrowsing()
      browse.tmActive = true
      await nextTick()
      const spy = vi.spyOn(browse, 'switchTo').mockResolvedValue()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }))
      expect(spy).toHaveBeenCalledWith('s0')
      w.unmount()
    })

    it('ArrowDown steps to the next OLDER snapshot (stepEarlier — higher index)', async () => {
      const w = mountIt()
      const { browse } = await setupBrowsing()
      browse.tmActive = true
      await nextTick()
      const spy = vi.spyOn(browse, 'switchTo').mockResolvedValue()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }))
      expect(spy).toHaveBeenCalledWith('s2')
      w.unmount()
    })

    it('does nothing at the newest-snapshot boundary (ArrowUp) or oldest-snapshot boundary (ArrowDown)', async () => {
      const w = mountIt()
      const { browse, files } = await setupBrowsing()
      browse.tmActive = true
      await nextTick()
      const spy = vi.spyOn(browse, 'switchTo').mockResolvedValue()

      files.currentPath = '/media/RAID_0/.snapshots/s0' // newest
      await nextTick()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }))
      expect(spy).not.toHaveBeenCalled()

      files.currentPath = '/media/RAID_0/.snapshots/s2' // oldest
      await nextTick()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }))
      expect(spy).not.toHaveBeenCalled()
      w.unmount()
    })

    it('does not step while a dialog is open (same guard as Escape)', async () => {
      const w = mountIt({ dialogOpen: true })
      const { browse } = await setupBrowsing()
      browse.tmActive = true
      await nextTick()
      const spy = vi.spyOn(browse, 'switchTo').mockResolvedValue()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }))
      expect(spy).not.toHaveBeenCalled()
      w.unmount()
    })

    it('does not listen at all while inactive', async () => {
      const w = mountIt()
      const { browse } = await setupBrowsing()
      const spy = vi.spyOn(browse, 'switchTo').mockResolvedValue()
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }))
      expect(spy).not.toHaveBeenCalled()
      w.unmount()
    })
  })
})
