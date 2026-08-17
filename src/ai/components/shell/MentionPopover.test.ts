// 1:1 port of test; see .superpowers/sdd/p1c1-task-7-brief.md Step 1 (verbatim copy, assertions unchanged).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'

const svc = vi.hoisted(() => ({ listMounts: vi.fn(), listFsEntries: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: svc } }))
import MentionPopover from './MentionPopover.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const g = { plugins: [i18n] }

describe('MentionPopover', () => {
  beforeEach(() => {
    svc.listMounts.mockReset(); svc.listFsEntries.mockReset()
    svc.listMounts.mockResolvedValue([{ label: 'Drive1', path: '/DATA', capacity: 100, used: 20 }])
    svc.listFsEntries.mockResolvedValue([
      { path: '/DATA/docs', kind: 'dir', name: 'docs' },
      { path: '/DATA/a.txt', kind: 'file', name: 'a.txt', size: 12 },
    ])
  })

  it('fetches mounts and renders items when open', async () => {
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: [] }, global: g })
    await flushPromises()
    expect(svc.listMounts).toHaveBeenCalled()
    expect(w.findAll('.mention-item')).toHaveLength(1)
    expect(w.text()).toContain('Drive1')
  })

  it('fetches directory entries when segments present', async () => {
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: ['Drive1'] }, global: g })
    await flushPromises()
    expect(svc.listFsEntries).toHaveBeenCalledWith('/DATA', false)
    expect(w.findAll('.mention-item')).toHaveLength(2)
  })

  it('query filter: startsWith takes precedence over includes', async () => {
    svc.listFsEntries.mockResolvedValue([
      { path: '/DATA/mydoc', kind: 'dir', name: 'mydoc' },
      { path: '/DATA/doc', kind: 'dir', name: 'doc' },
    ])
    const w = mount(MentionPopover, { props: { open: true, query: 'doc', segments: ['Drive1'] }, global: g })
    await flushPromises()
    const names = w.findAll('.mention-name').map((n) => n.text())
    expect(names[0]).toContain('doc')
    expect(names).toHaveLength(2)
  })

  it('clicking file emits pick; clicking directory emits drill-in', async () => {
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: ['Drive1'] }, global: g })
    await flushPromises()
    const items = w.findAll('.mention-item')
    await items[1].trigger('click')            // a.txt
    expect(w.emitted('pick')).toBeTruthy()
    await items[0].trigger('click')            // docs
    expect(w.emitted('drill-in')).toBeTruthy()
  })

  it('keyboard: ↓ moves highlight, Escape emits close, Backspace without query emits pop-segment', async () => {
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: ['Drive1'] }, global: g, attachTo: document.body })
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await w.vm.$nextTick()
    expect(w.findAll('.mention-item')[1].attributes('data-active')).toBe('true')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toBeTruthy()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))
    expect(w.emitted('pop-segment')).toBeTruthy()
    w.unmount()
  })

  it('after unmount, no longer responds to window keydown (listener removed)', async () => {
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: [] }, global: g, attachTo: document.body })
    await flushPromises()
    w.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toBeFalsy()
  })

  it('on fetch failure, does not throw unhandled rejection, returns empty list', async () => {
    svc.listMounts.mockRejectedValue(new Error('net'))
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: [] }, global: g })
    await flushPromises()
    expect(w.findAll('.mention-item')).toHaveLength(0)
  })

  // Review fix 1 — capture-phase keydown listener must attach synchronously,
  // before the mounts fetch resolves (see MentionPopover.vue header comment).
  it('synchronously attaches keydown listener when open — key press works even before mounts request completes', async () => {
    let resolveMounts: (v: unknown[]) => void = () => {}
    svc.listMounts.mockReturnValue(new Promise((resolve) => { resolveMounts = resolve }))
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: [] }, global: g, attachTo: document.body })
    // Deliberately do NOT flush/await before dispatching — listMounts is still pending.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toBeTruthy()
    resolveMounts([])
    await flushPromises()
    w.unmount()
  })

  // Review fix 1 — unmounting while the first mounts fetch is still in flight
  // must not leave a dangling capture-phase window listener. Note: this suite
  // never calls w.unmount() in most earlier tests, so jsdom's shared `window`
  // can carry stale keydown listeners from sibling tests by the time this one
  // runs — a live dispatchEvent()/emitted() check would be polluted by that
  // and can't tell "our listener leaked" from "some earlier test's listener
  // fired". Instead, track add/remove calls made *during this test* by fn
  // reference and simulate the resulting attached/detached state directly —
  // immune to what other tests left on `window`.
  it('unmount after open while mounts request not yet complete — no listener leak (add/remove mismatched, listener permanently attached)', async () => {
    const originalAdd = window.addEventListener.bind(window)
    const originalRemove = window.removeEventListener.bind(window)
    const attached = new Map<EventListenerOrEventListenerObject, boolean>()
    const addSpy = vi.spyOn(window, 'addEventListener').mockImplementation((type: any, fn: any, opts?: any) => {
      if (type === 'keydown' && opts === true) attached.set(fn, true)
      return originalAdd(type, fn, opts)
    })
    const removeSpy = vi.spyOn(window, 'removeEventListener').mockImplementation((type: any, fn: any, opts?: any) => {
      if (type === 'keydown' && opts === true) attached.set(fn, false)
      return originalRemove(type, fn, opts)
    })
    try {
      let resolveMounts: (v: unknown[]) => void = () => {}
      svc.listMounts.mockReturnValue(new Promise((resolve) => { resolveMounts = resolve }))
      const w = mount(MentionPopover, { props: { open: true, query: '', segments: [] }, global: g, attachTo: document.body })
      w.unmount()
      resolveMounts([])
      await flushPromises()
      const stillAttached = [...attached.values()].some((v) => v)
      expect(stillAttached).toBe(false)
    } finally {
      addSpy.mockRestore()
      removeSpy.mockRestore()
    }
  })

  // Review fix 2 — empty-state "no matches" text must bold the quoted query
  // (Vue2 MentionPopover.vue:38 wraps it in <b>), even though it's now i18n'd.
  it('no-match empty state: query inside quotes rendered bold with <b>', async () => {
    svc.listFsEntries.mockResolvedValue([])
    const w = mount(MentionPopover, { props: { open: true, query: 'zzz', segments: ['Drive1'] }, global: g })
    await flushPromises()
    const b = w.find('.mention-empty b')
    expect(b.exists()).toBe(true)
    expect(b.text()).toContain('zzz')
  })
})
