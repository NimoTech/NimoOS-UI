// SP8-P1c1 Task 9 —— AgentComposer 骨架:chips + textarea + 工具栏 + 发送/停止。
// 1:1 移植自 Vue2 src/views/AI/Agent/shell/AgentComposer.vue 的对应片段(见组件顶部注释)。
// 附件上传管线(Task 10)与 @mention/slash 接线(Task 11)不在本任务范围,测试用例
// 逐字取自 .superpowers/sdd/p1c1-task-9-brief.md Step 1。
//
// SP8-P1c1 Task 10 —— 附件管线 describe 块追加自 p1c1-task-10-brief.md Step 1
// (逐字取自 brief,未改动断言)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  listAgentSessions: vi.fn(), createAgentSession: vi.fn(), listAgentMessages: vi.fn(),
  listMounts: vi.fn().mockResolvedValue([]), listFsEntries: vi.fn().mockResolvedValue([]),
  removeVisibleResource: vi.fn(), uploadAttachment: vi.fn(), deleteAttachment: vi.fn(),
  attachmentRawUrl: vi.fn(() => '/raw'),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: svc } }))

import AgentComposer from './AgentComposer.vue'
import { useAgentStore } from '../../stores/agentStore'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountComposer = (props = {}) =>
  mount(AgentComposer, { props, global: { plugins: [i18n] }, attachTo: document.body })

describe('AgentComposer 骨架', () => {
  beforeEach(() => { setActivePinia(createPinia()); Object.values(svc).forEach((f: any) => f.mockClear?.()) })

  it('空输入时发送键禁用;有文本后启用', async () => {
    const w = mountComposer()
    expect(w.find('.send-btn').attributes('disabled')).toBeDefined()
    await w.find('textarea').setValue('hello')
    expect(w.find('.send-btn').attributes('disabled')).toBeUndefined()
  })

  it('Enter 发送并清空;Shift+Enter 不发送', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('hi there')
    await ta.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(w.emitted('send')).toBeFalsy()
    await ta.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('send')![0][0]).toEqual({ text: 'hi there', attachmentIds: [], attachmentRefs: [] })
    expect((ta.element as HTMLTextAreaElement).value).toBe('')
  })

  it('IME 组合中的 Enter 不发送', async () => {
    const w = mountComposer()
    await w.find('textarea').setValue('中')
    await w.find('textarea').trigger('keydown', { key: 'Enter', isComposing: true })
    expect(w.emitted('send')).toBeFalsy()
  })

  it('busy 时显示停止键并 emit stop', async () => {
    const w = mountComposer({ busy: true })
    expect(w.find('.send-btn.busy').exists()).toBe(true)
    await w.find('.send-btn.busy').trigger('click')
    expect(w.emitted('stop')).toBeTruthy()
  })

  it('visibleResources 渲染成 chip,× 调 store.removeVisibleResource', async () => {
    const store = useAgentStore()
    store.activeSessionId = 'sess-1'
    store.visibleResources.push({ id: 5, path: '/DATA/docs', kind: 'folder' })
    const spy = vi.spyOn(store, 'removeVisibleResource').mockResolvedValue(undefined)
    const w = mountComposer()
    const chip = w.find('.ctx-chip')
    expect(chip.text()).toContain('docs')
    await chip.find('.ctx-chip-x').trigger('click')
    expect(spy).toHaveBeenCalledWith(5)
  })

  it('ctxUsage 存在时渲染占用环', () => {
    const w = mountComposer({ ctxUsage: { tokens: 100, window: 1000, pct: 10 } })
    expect(w.find('.ctx-usage').exists()).toBe(true)
  })

  it('Browse 按钮弹 toast 占位(BrowserModal 本期不做)', async () => {
    const w = mountComposer()
    const browse = w.findAll('.composer-tool')[0]
    await browse.trigger('click')
    // toast store 里应有一条
    const { useToast } = await import('../../../stores/toast')
    expect(useToast().toasts.length).toBe(1)
  })
})

describe('AgentComposer 附件管线', () => {
  beforeEach(() => { setActivePinia(createPinia()); Object.values(svc).forEach((f: any) => f.mockClear?.()) })

  const pickFiles = async (w: any, files: File[]) => {
    const input = w.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: files, configurable: true })
    await input.trigger('change')
  }

  it('无会话时先建会话再上传,成功后 chip 显示已上传', async () => {
    const store = useAgentStore()
    vi.spyOn(store, 'createSession').mockImplementation(async () => { store.activeSessionId = 'sess-new' })
    svc.uploadAttachment.mockResolvedValue({ id: 'a1', kind: 'image', mime: 'image/png' })
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'p.png', { type: 'image/png' })])
    await flushPromises()
    expect(store.createSession).toHaveBeenCalled()
    expect(svc.uploadAttachment).toHaveBeenCalledWith('sess-new', expect.any(File), expect.objectContaining({ onProgress: expect.any(Function) }))
    expect(w.find('.ctx-chip-att').text()).toContain('p.png')
  })

  it('超过 500MB 直接拒绝、不发请求、给 toast', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    const big = new File(['x'], 'big.bin')
    Object.defineProperty(big, 'size', { value: 500 * 1024 * 1024 + 1 })
    const w = mountComposer()
    await pickFiles(w, [big])
    await flushPromises()
    expect(svc.uploadAttachment).not.toHaveBeenCalled()
    const { useToast } = await import('../../../stores/toast')
    expect(useToast().toasts.length).toBe(1)
  })

  it('上传中 chip 显示百分比,且 canSend 为假', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    let emit!: (p: number) => void
    svc.uploadAttachment.mockImplementation((_s: any, _f: any, o: any) => new Promise((res) => { emit = o.onProgress; setTimeout(() => res({ id: 'a1', kind: 'text' }), 0) }))
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'a.txt')])
    emit(42); await w.vm.$nextTick()
    expect(w.find('.ctx-chip-prog').text()).toContain('42')
    await w.find('textarea').setValue('hi')
    expect(w.find('.send-btn').attributes('disabled')).toBeDefined()   // 上传中禁发
  })

  it('上传失败 chip 标失败态', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    svc.uploadAttachment.mockRejectedValue({ response: { data: { detail: 'nope' } } })
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'a.txt')])
    await flushPromises()
    expect(w.find('.ctx-chip-att.is-failed').exists()).toBe(true)
  })

  it('文档抽取报错时 chip 出警告角标', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    svc.uploadAttachment.mockResolvedValue({ id: 'a1', kind: 'document', meta: { extract_error: 'timeout' } })
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'a.pdf')])
    await flushPromises()
    expect(w.find('.ctx-chip-att.is-doc-warn').exists()).toBe(true)
  })

  it('删除已上传附件:调 deleteAttachment 并移除 chip', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    svc.uploadAttachment.mockResolvedValue({ id: 'a1', kind: 'text' })
    svc.deleteAttachment.mockResolvedValue({})
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'a.txt')])
    await flushPromises()
    await w.find('.ctx-chip-att .ctx-chip-x').trigger('click')
    await flushPromises()
    expect(svc.deleteAttachment).toHaveBeenCalledWith('sess-1', 'a1')
    expect(w.find('.ctx-chip-att').exists()).toBe(false)
  })

  it('submit 带上 attachmentIds/attachmentRefs 并清空本地列表', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    svc.uploadAttachment.mockResolvedValue({ id: 'a1', kind: 'image', mime: 'image/png' })
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'p.png', { type: 'image/png' })])
    await flushPromises()
    await w.find('.send-btn').trigger('click')
    expect(w.emitted('send')![0][0]).toEqual({
      text: '', attachmentIds: ['a1'],
      attachmentRefs: [{ id: 'a1', filename: 'p.png', kind: 'image', mime: 'image/png', url: '/raw' }],
    })
    expect(w.find('.ctx-chip-att').exists()).toBe(false)
  })

  it('切会话清空本地待发附件', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    svc.uploadAttachment.mockResolvedValue({ id: 'a1', kind: 'text' })
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'a.txt')])
    await flushPromises()
    store.activeSessionId = 'sess-2'
    await w.vm.$nextTick()
    expect(w.find('.ctx-chip-att').exists()).toBe(false)
  })
})
