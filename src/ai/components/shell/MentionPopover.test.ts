// 1:1 移植测试见 .superpowers/sdd/p1c1-task-7-brief.md Step 1(逐字照抄,未改动断言)。
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

  it('open 时拉 mounts 并渲染条目', async () => {
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: [] }, global: g })
    await flushPromises()
    expect(svc.listMounts).toHaveBeenCalled()
    expect(w.findAll('.mention-item')).toHaveLength(1)
    expect(w.text()).toContain('Drive1')
  })

  it('有 segments 时拉该目录条目', async () => {
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: ['Drive1'] }, global: g })
    await flushPromises()
    expect(svc.listFsEntries).toHaveBeenCalledWith('/DATA', false)
    expect(w.findAll('.mention-item')).toHaveLength(2)
  })

  it('query 过滤:startsWith 优先于 includes', async () => {
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

  it('点击文件 emit pick;点击目录 emit drill-in', async () => {
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: ['Drive1'] }, global: g })
    await flushPromises()
    const items = w.findAll('.mention-item')
    await items[1].trigger('click')            // a.txt
    expect(w.emitted('pick')).toBeTruthy()
    await items[0].trigger('click')            // docs
    expect(w.emitted('drill-in')).toBeTruthy()
  })

  it('键盘:↓ 移高亮、Escape emit close、无 query 时 Backspace emit pop-segment', async () => {
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

  it('卸载后不再响应 window keydown(监听已摘)', async () => {
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: [] }, global: g, attachTo: document.body })
    await flushPromises()
    w.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toBeFalsy()
  })

  it('抓取失败时不抛未处理 rejection,退空列表', async () => {
    svc.listMounts.mockRejectedValue(new Error('net'))
    const w = mount(MentionPopover, { props: { open: true, query: '', segments: [] }, global: g })
    await flushPromises()
    expect(w.findAll('.mention-item')).toHaveLength(0)
  })

  // Review fix 1 — capture-phase keydown listener must attach synchronously,
  // before the mounts fetch resolves (see MentionPopover.vue header comment).
  it('open 时同步挂载 keydown 监听——mounts 请求未完成时按键也生效', async () => {
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
  it('打开后 mounts 请求未完成即卸载——不遗留监听(add/remove 不成对,监听永久挂着)', async () => {
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
  it('无匹配空态:引号内的 query 用 <b> 加粗渲染', async () => {
    svc.listFsEntries.mockResolvedValue([])
    const w = mount(MentionPopover, { props: { open: true, query: 'zzz', segments: ['Drive1'] }, global: g })
    await flushPromises()
    const b = w.find('.mention-empty b')
    expect(b.exists()).toBe(true)
    expect(b.text()).toContain('zzz')
  })
})
