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
})
