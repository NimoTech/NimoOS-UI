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

  it('final-review fix: busy 时按 Enter 既不 emit send 也不清空文本(AgentComposer.vue submit() 的 busy 守卫)', async () => {
    const w = mountComposer({ busy: true })
    const ta = w.find('textarea')
    await ta.setValue('hi there')
    await ta.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('send')).toBeFalsy()
    expect((ta.element as HTMLTextAreaElement).value).toBe('hi there')
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

  it('文档抽取报错时 chip 出警告角标(且角标文案对应 docErrorShortKey 的 zh_cn 译文)', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    svc.uploadAttachment.mockResolvedValue({ id: 'a1', kind: 'document', meta: { extract_error: 'timeout' } })
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'a.pdf')])
    await flushPromises()
    const chip = w.find('.ctx-chip-att.is-doc-warn')
    expect(chip.exists()).toBe(true)
    // Fix 3: pin the actual rendered label text, not just the CSS class — this
    // must be able to fail if docErrorShortKey('timeout') → 'aiDocErrShortTimedOut'
    // regresses (e.g. mapped to the wrong key or the zh_cn string changes).
    expect(chip.find('.ctx-chip-doc-warn').text()).toContain(zh.aiDocErrShortTimedOut)
  })

  it('kind=binary 且 extract_error=not_installed、文档扩展名:给 7000ms 警告 toast', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    svc.uploadAttachment.mockResolvedValue({ id: 'a1', kind: 'binary', meta: { extract_error: 'not_installed' } })
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'a.pdf')])
    await flushPromises()
    const { useToast } = await import('../../../stores/toast')
    const toasts = useToast().toasts
    expect(toasts.length).toBe(1)
    expect(toasts[0].text).toContain(zh.aiDocErrNotInstalled)
  })

  it('kind=binary 且 extract_error=not_installed、非文档扩展名:不弹该 toast', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    svc.uploadAttachment.mockResolvedValue({ id: 'a1', kind: 'binary', meta: { extract_error: 'not_installed' } })
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'a.bin')])
    await flushPromises()
    const { useToast } = await import('../../../stores/toast')
    expect(useToast().toasts.length).toBe(0)
  })

  it('批次中途切换会话:后续文件停止上传,不产生跨会话孤儿附件', async () => {
    // Fix 1 (review): Vue2 (AgentComposer.vue:547) re-reads a *computed*
    // `this.sessionId` every loop iteration, so a mid-batch session switch just
    // redirects the remaining uploads into whatever session is now active. This
    // port instead stops the batch — see the comment at the break site in
    // AgentComposer.vue for why continuing would only create invisible orphans.
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    let resolveFirst!: (v: unknown) => void
    svc.uploadAttachment.mockImplementationOnce(
      () => new Promise((res) => { resolveFirst = res }),
    )
    const w = mountComposer()
    await pickFiles(w, [
      new File(['x'], 'a.txt'),
      new File(['x'], 'b.txt'),
    ])
    // First upload (a.txt) is in flight — the loop is suspended on its await,
    // so it has not started processing b.txt yet. Switch sessions now.
    store.activeSessionId = 'sess-2'
    resolveFirst({ id: 'a1', kind: 'text' })
    await flushPromises()
    expect(svc.uploadAttachment).toHaveBeenCalledTimes(1)
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

// SP8-P1c1 Task 11 — @提及/斜杠接线 + gitignore 409 确认框 describe 块,
// 逐字取自 p1c1-task-11-brief.md Step 1(未改断言)。
describe('AgentComposer @提及 / 斜杠', () => {
  beforeEach(() => { setActivePinia(createPinia()); Object.values(svc).forEach((f: any) => f.mockClear?.()) })

  it('输入 @ 触发提及面板;输入空格后关闭', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('@doc')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(true)
    await ta.setValue('@doc ')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(false)
  })

  it('drill-in 把 "<name>/" 写回输入框并更新 segments', async () => {
    const w = mountComposer()
    await w.find('textarea').setValue('@Dr')
    await w.findComponent({ name: 'MentionPopover' }).vm.$emit('drill-in', { name: 'Drive1', kind: 'drive', resolvedPath: '/DATA' })
    await w.vm.$nextTick()
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('@Drive1/')
    expect(w.findComponent({ name: 'MentionPopover' }).props('segments')).toEqual(['Drive1'])
  })

  it('pick 文件:删掉 @token、调 addVisibleResource', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    const spy = vi.spyOn(store, 'addVisibleResource').mockResolvedValue(undefined)
    const w = mountComposer()
    await w.find('textarea').setValue('@Drive1/a')
    await w.findComponent({ name: 'MentionPopover' }).vm.$emit('pick', { name: 'a.txt', kind: 'file', resolvedPath: '/DATA/a.txt' })
    await flushPromises()
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect(spy).toHaveBeenCalledWith('/DATA/a.txt', 'file', false)
  })

  it('pick 命中 409 gitignore:弹确认框,确认后 force 重试', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    const err = Object.assign(new Error('x'), { response: { status: 409, data: { detail: 'path blocked by .gitignore' } } })
    const spy = vi.spyOn(store, 'addVisibleResource').mockRejectedValueOnce(err).mockResolvedValueOnce(undefined)
    const w = mountComposer()
    await w.find('textarea').setValue('@Drive1/x')
    w.findComponent({ name: 'MentionPopover' }).vm.$emit('pick', { name: 'x', kind: 'folder', resolvedPath: '/DATA/x' })
    await flushPromises()
    const dlg = w.findComponent({ name: 'AlertDialog' })
    expect(dlg.props('open')).toBe(true)
    dlg.vm.$emit('confirm')
    await flushPromises()
    expect(spy).toHaveBeenNthCalledWith(2, '/DATA/x', 'folder', true)
  })

  it('pop-segment 弹掉最后一段', async () => {
    const w = mountComposer()
    await w.find('textarea').setValue('@Drive1/docs/')
    await w.findComponent({ name: 'MentionPopover' }).vm.$emit('pop-segment')
    await w.vm.$nextTick()
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('@Drive1/')
  })

  it('提及面板打开时 Enter 不发送(交给面板处理)', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('@doc')
    await ta.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('send')).toBeFalsy()
  })
})

// P1c-1 验收补丁 Task 1 —— 失焦关闭后重新聚焦/点击要能重开面板(Vue2 同样缺
// @focus 处理器,按项目"逻辑跟正确性"规则修的缺陷,见 p1c1-patch-task-1-brief.md)。
// 用例逐字取自 brief「测试要求」1-4,fake timers 用法对齐 AgentTopbar.test.ts。
describe('AgentComposer @提及面板 focus/click 重新同步(P1c1 补丁)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((f: any) => f.mockClear?.())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('失焦→重新聚焦会重开面板', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('@doc')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(true)

    await ta.trigger('blur')
    vi.advanceTimersByTime(200)
    await flushPromises()
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(false)

    await ta.trigger('focus')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(true)
    expect(w.findComponent({ name: 'MentionPopover' }).props('query')).toBe('doc')
  })

  it('重新聚焦时不重开无关面板', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('hello')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(false)

    await ta.trigger('blur')
    vi.advanceTimersByTime(200)
    await flushPromises()
    await ta.trigger('focus')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(false)
  })

  it('点击把光标移出 @ 词会关闭面板', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    const el = ta.element as HTMLTextAreaElement
    await ta.setValue('@Drive1/docs/ tail')

    // Caret inside the @ segment, click there first — panel opens.
    el.setSelectionRange(5, 5)
    await ta.trigger('click')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(true)

    // Move the caret into ' tail' (outside the mention) and click again.
    el.setSelectionRange(el.value.length, el.value.length)
    await ta.trigger('click')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(false)
  })

  it('聚焦会取消挂起的 blur 关闭', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('@doc')
    await ta.trigger('blur')
    vi.advanceTimersByTime(100) // less than the 180ms blur-close delay
    await ta.trigger('focus')
    vi.advanceTimersByTime(200)
    await flushPromises()
    // The pending blur timer must have been cancelled by focus — the panel
    // stays open, it does not get closed a moment later by the stale timer.
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(true)
  })
})

// SP8-P1c1 patch task 3 — retire the rejected full-screen SlashMenu, wire up
// SlashPopover instead. Ten cases verbatim from
// .superpowers/sdd/p1c1-patch-task-3-brief.md「测试要求」1-10. The old single
// test above exercising SlashMenu + the "whole string is exactly '/'" trigger
// rule was deleted (not just superseded) because that rule and that component
// are exactly what this patch replaces — keeping it would either duplicate
// coverage or force it to assert retired behavior.
describe('AgentComposer 斜杠命令面板(P1c1 补丁 task 3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((f: any) => f.mockClear?.())
  })

  it('1. 开头的 "/" 才弹;句中的 "/" 不弹', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('/')
    let pop = w.findComponent({ name: 'SlashPopover' })
    expect(pop.props('open')).toBe(true)
    expect(pop.props('stage')).toBe('command')

    await ta.setValue('hi /')
    pop = w.findComponent({ name: 'SlashPopover' })
    expect(pop.props('open')).toBe(false)
  })

  it('2. 边敲边筛:query 跟随输入更新', async () => {
    const w = mountComposer()
    await w.find('textarea').setValue('/in')
    const pop = w.findComponent({ name: 'SlashPopover' })
    expect(pop.props('open')).toBe(true)
    expect(pop.props('query')).toBe('in')
  })

  it('3. command 阶段敲空格关闭', async () => {
    const w = mountComposer()
    await w.find('textarea').setValue('/init ')
    expect(w.findComponent({ name: 'SlashPopover' }).props('open')).toBe(false)
  })

  it('4. 两阶段流程:pick-command 后文本变 "/init "、进入 target 阶段、folders 收到已授权目录', async () => {
    const store = useAgentStore()
    store.visibleResources.push({ id: 1, path: '/DATA/docs', kind: 'folder' })
    store.visibleResources.push({ id: 2, path: '/DATA/notes.txt', kind: 'file' })
    const w = mountComposer()
    await w.find('textarea').setValue('/')
    const pop = w.findComponent({ name: 'SlashPopover' })
    await pop.vm.$emit('pick-command', 'init')
    await w.vm.$nextTick()
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('/init ')
    expect(pop.props('stage')).toBe('target')
    expect(pop.props('folders').map((f: any) => f.path)).toEqual(['/DATA/docs'])
  })

  it('5. 选目录即发送:pick-target 后 emit send-init 且输入框清空', async () => {
    const store = useAgentStore()
    store.visibleResources.push({ id: 1, path: '/DATA/docs', kind: 'folder' })
    const w = mountComposer()
    await w.find('textarea').setValue('/')
    const pop = w.findComponent({ name: 'SlashPopover' })
    await pop.vm.$emit('pick-command', 'init')
    await pop.vm.$emit('pick-target', '/DATA/docs')
    await w.vm.$nextTick()
    expect(w.emitted('send-init')).toEqual([['/DATA/docs']])
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('6. Esc 退层再退出:back() 回 command 阶段(文本 "/init"),再 close() 关闭面板', async () => {
    const store = useAgentStore()
    store.visibleResources.push({ id: 1, path: '/DATA/docs', kind: 'folder' })
    const w = mountComposer()
    await w.find('textarea').setValue('/')
    const pop = w.findComponent({ name: 'SlashPopover' })
    await pop.vm.$emit('pick-command', 'init')
    await pop.vm.$emit('back')
    await w.vm.$nextTick()
    expect(pop.props('stage')).toBe('command')
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('/init')

    await pop.vm.$emit('close')
    await w.vm.$nextTick()
    expect(pop.props('open')).toBe(false)
  })

  it('7. 关掉后不自动重开;文本变了才重开', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('/')
    const pop = w.findComponent({ name: 'SlashPopover' })
    expect(pop.props('open')).toBe(true)

    await pop.vm.$emit('close')
    await w.vm.$nextTick()
    expect(pop.props('open')).toBe(false)

    // Re-sync without changing the text (e.g. a refocus) — must stay closed.
    await ta.trigger('focus')
    expect(pop.props('open')).toBe(false)

    await ta.setValue('/i')
    expect(pop.props('open')).toBe(true)
  })

  it('8. 面板打开时 Enter 不发送', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('/')
    await ta.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('send')).toBeFalsy()
  })

  it('9. "@" 与 "/" 不同时打开', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('/')
    expect(w.findComponent({ name: 'SlashPopover' }).props('open')).toBe(true)
    await ta.setValue('@doc')
    expect(w.findComponent({ name: 'SlashPopover' }).props('open')).toBe(false)
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(true)
  })

  it('10. 切会话关闭斜杠面板', async () => {
    const store = useAgentStore()
    const w = mountComposer()
    await w.find('textarea').setValue('/')
    expect(w.findComponent({ name: 'SlashPopover' }).props('open')).toBe(true)
    store.activeSessionId = 'sess-2'
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'SlashPopover' }).props('open')).toBe(false)
  })
})
