// SP8-P1c1 Task 9 — AgentComposer skeleton: chips + textarea + toolbar + send/stop.
// 1:1 ported from Vue2 src/views/AI/Agent/shell/AgentComposer.vue segment (see component
// top comment). Attachment upload pipeline (Task 10) and @mention/slash wiring (Task 11)
// not in this task scope, test cases verbatim from
// .superpowers/sdd/p1c1-task-9-brief.md Step 1.
//
// SP8-P1c1 Task 10 — attachment pipeline describe block added from p1c1-task-10-brief.md Step 1
// (verbatim from brief, assertions unchanged).
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

describe('AgentComposer skeleton', () => {
  beforeEach(() => { setActivePinia(createPinia()); Object.values(svc).forEach((f: any) => f.mockClear?.()) })

  it('send button disabled on empty input; enabled after text added', async () => {
    const w = mountComposer()
    expect(w.find('.send-btn').attributes('disabled')).toBeDefined()
    await w.find('textarea').setValue('hello')
    expect(w.find('.send-btn').attributes('disabled')).toBeUndefined()
  })

  it('Enter sends and clears; Shift+Enter does not send', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('hi there')
    await ta.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(w.emitted('send')).toBeFalsy()
    await ta.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('send')![0][0]).toEqual({ text: 'hi there', attachmentIds: [], attachmentRefs: [] })
    expect((ta.element as HTMLTextAreaElement).value).toBe('')
  })

  it('final-review fix: Enter while busy neither emits send nor clears text (AgentComposer.vue submit() busy guard)', async () => {
    const w = mountComposer({ busy: true })
    const ta = w.find('textarea')
    await ta.setValue('hi there')
    await ta.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('send')).toBeFalsy()
    expect((ta.element as HTMLTextAreaElement).value).toBe('hi there')
  })

  it('Enter during IME composition does not send', async () => {
    const w = mountComposer()
    await w.find('textarea').setValue('中')
    await w.find('textarea').trigger('keydown', { key: 'Enter', isComposing: true })
    expect(w.emitted('send')).toBeFalsy()
  })

  it('when busy, show stop button and emit stop', async () => {
    const w = mountComposer({ busy: true })
    expect(w.find('.send-btn.busy').exists()).toBe(true)
    await w.find('.send-btn.busy').trigger('click')
    expect(w.emitted('stop')).toBeTruthy()
  })

  it('visibleResources render as chips, × calls store.removeVisibleResource', async () => {
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

  // P1c2 debt 1 — chips added via dispatchEvent.ts 'visible_resource_added' branch from
  // agent self-authorizing access in run have no id ({path,kind} only, see
  // dispatchEvent.ts:311 and agentStore.ts removeVisibleResourceByPath declaration notes).
  // Clicking × should call store.removeVisibleResourceByPath(path), not silently no-op.
  it('chip without id clicking × calls store.removeVisibleResourceByPath (not silent no-op)', async () => {
    const store = useAgentStore()
    store.activeSessionId = 'sess-1'
    store.visibleResources.push({ path: '/DATA/agent-added', kind: 'folder' })
    const spy = vi.spyOn(store, 'removeVisibleResourceByPath').mockResolvedValue(undefined)
    const w = mountComposer()
    const chip = w.find('.ctx-chip')
    expect(chip.text()).toContain('agent-added')
    await chip.find('.ctx-chip-x').trigger('click')
    expect(spy).toHaveBeenCalledWith('/DATA/agent-added')
  })

  it('chip without id deletion failure goes through toastError (same as with-id branch)', async () => {
    const store = useAgentStore()
    store.activeSessionId = 'sess-1'
    store.visibleResources.push({ path: '/DATA/agent-added', kind: 'folder' })
    const err = Object.assign(new Error('boom'), { response: { data: { detail: 'nope' } } })
    vi.spyOn(store, 'removeVisibleResourceByPath').mockRejectedValue(err)
    const w = mountComposer()
    await w.find('.ctx-chip').find('.ctx-chip-x').trigger('click')
    await flushPromises()
    const { useToast } = await import('../../../stores/toast')
    expect(useToast().toasts.length).toBe(1)
    // SP8-P1c2 Task 6: auth failure (toastError) → danger tier.
    expect(useToast().toasts[0].tier).toBe('danger')
  })

  it('render context usage circle when ctxUsage exists', () => {
    const w = mountComposer({ ctxUsage: { tokens: 100, window: 1000, pct: 10 } })
    expect(w.find('.ctx-usage').exists()).toBe(true)
  })

  it('Browse button shows toast placeholder (BrowserModal not implemented this phase)', async () => {
    const w = mountComposer()
    const browse = w.findAll('.composer-tool')[0]
    await browse.trigger('click')
    // toast store 里应有一条
    const { useToast } = await import('../../../stores/toast')
    expect(useToast().toasts.length).toBe(1)
  })
})

describe('AgentComposer attachment pipeline', () => {
  beforeEach(() => { setActivePinia(createPinia()); Object.values(svc).forEach((f: any) => f.mockClear?.()) })

  const pickFiles = async (w: any, files: File[]) => {
    const input = w.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: files, configurable: true })
    await input.trigger('change')
  }

  it('no session: create session first, then upload; chip shows uploaded after success', async () => {
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

  // SP8-P1c2 Task 6: create session failure → danger tier (p1c2-task-6-brief.md
  // "AgentComposer 7 places"). onFilesPicked() 507-514 lazy-create branch, fail returns,
  // no upload sent.
  it('no session: lazy create fails: danger toast, no upload sent', async () => {
    const store = useAgentStore()
    vi.spyOn(store, 'createSession').mockRejectedValue(new Error('network down'))
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'p.png', { type: 'image/png' })])
    await flushPromises()
    expect(svc.uploadAttachment).not.toHaveBeenCalled()
    const { useToast } = await import('../../../stores/toast')
    const toasts = useToast().toasts
    expect(toasts.length).toBe(1)
    expect(toasts[0].tier).toBe('danger')
  })

  it('over 500MB: directly reject, no request, show toast', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    const big = new File(['x'], 'big.bin')
    Object.defineProperty(big, 'size', { value: 500 * 1024 * 1024 + 1 })
    const w = mountComposer()
    await pickFiles(w, [big])
    await flushPromises()
    expect(svc.uploadAttachment).not.toHaveBeenCalled()
    const { useToast } = await import('../../../stores/toast')
    expect(useToast().toasts.length).toBe(1)
    // SP8-P1c2 Task 6: over limit → danger tier.
    expect(useToast().toasts[0].tier).toBe('danger')
  })

  it('uploading: chip shows percentage, canSend false', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    let emit!: (p: number) => void
    svc.uploadAttachment.mockImplementation((_s: any, _f: any, o: any) => new Promise((res) => { emit = o.onProgress; setTimeout(() => res({ id: 'a1', kind: 'text' }), 0) }))
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'a.txt')])
    emit(42); await w.vm.$nextTick()
    expect(w.find('.ctx-chip-prog').text()).toContain('42')
    await w.find('textarea').setValue('hi')
    expect(w.find('.send-btn').attributes('disabled')).toBeDefined()   // uploading blocks send
  })

  it('upload failure: chip marked failed', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    svc.uploadAttachment.mockRejectedValue({ response: { data: { detail: 'nope' } } })
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'a.txt')])
    await flushPromises()
    expect(w.find('.ctx-chip-att.is-failed').exists()).toBe(true)
    // SP8-P1c2 Task 6: upload failure → danger tier.
    const { useToast } = await import('../../../stores/toast')
    expect(useToast().toasts[0].tier).toBe('danger')
  })

  it('document extraction error: chip shows warning badge (text matches docErrorShortKey zh_cn translation)', async () => {
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
    // SP8-P1c2 Task 6: document extraction warning (7000ms) → warning tier, not danger.
    const { useToast } = await import('../../../stores/toast')
    expect(useToast().toasts[0].tier).toBe('warning')
  })

  it('kind=binary and extract_error=not_installed, doc extension: show 7000ms warning toast', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    svc.uploadAttachment.mockResolvedValue({ id: 'a1', kind: 'binary', meta: { extract_error: 'not_installed' } })
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'a.pdf')])
    await flushPromises()
    const { useToast } = await import('../../../stores/toast')
    const toasts = useToast().toasts
    expect(toasts.length).toBe(1)
    expect(toasts[0].text).toContain(zh.aiDocErrNotInstalled)
    // SP8-P1c2 Task 6: same, not_installed warning also warning tier.
    expect(toasts[0].tier).toBe('warning')
  })

  it('kind=binary and extract_error=not_installed, non-doc extension: no such toast', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    svc.uploadAttachment.mockResolvedValue({ id: 'a1', kind: 'binary', meta: { extract_error: 'not_installed' } })
    const w = mountComposer()
    await pickFiles(w, [new File(['x'], 'a.bin')])
    await flushPromises()
    const { useToast } = await import('../../../stores/toast')
    expect(useToast().toasts.length).toBe(0)
  })

  it('mid-batch session switch: stop remaining uploads, no orphan attachments across sessions', async () => {
    // Fix 1 (review): Vue2 (AgentComposer.vue:547) re-reads a *computed*
    // `this.sessionId` every loop iteration, so mid-batch session switch just
    // redirects remaining uploads to whatever session is now active. This port
    // instead stops batch — see comment at break site in AgentComposer.vue for
    // why continuing only creates invisible orphans.
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
    // First upload (a.txt) in flight — loop suspended on await, not started b.txt yet.
    // Switch sessions now.
    store.activeSessionId = 'sess-2'
    resolveFirst({ id: 'a1', kind: 'text' })
    await flushPromises()
    expect(svc.uploadAttachment).toHaveBeenCalledTimes(1)
  })

  it('delete uploaded attachment: call deleteAttachment and remove chip', async () => {
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

  it('submit includes attachmentIds/attachmentRefs and clears local list', async () => {
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

  it('session switch clears local pending attachments', async () => {
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

// SP8-P1c1 Task 11 — @mention/slash wiring + gitignore 409 confirmation describe block,
// verbatim from p1c1-task-11-brief.md Step 1 (assertions unchanged).
describe('AgentComposer @mention / slash', () => {
  beforeEach(() => { setActivePinia(createPinia()); Object.values(svc).forEach((f: any) => f.mockClear?.()) })

  it('@ opens mention panel; space closes it', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('@doc')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(true)
    await ta.setValue('@doc ')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(false)
  })

  it('drill-in writes "<name>/" back to input and updates segments', async () => {
    const w = mountComposer()
    await w.find('textarea').setValue('@Dr')
    await w.findComponent({ name: 'MentionPopover' }).vm.$emit('drill-in', { name: 'Drive1', kind: 'drive', resolvedPath: '/DATA' })
    await w.vm.$nextTick()
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('@Drive1/')
    expect(w.findComponent({ name: 'MentionPopover' }).props('segments')).toEqual(['Drive1'])
  })

  it('pick file: delete @token, call addVisibleResource', async () => {
    const store = useAgentStore(); store.activeSessionId = 'sess-1'
    const spy = vi.spyOn(store, 'addVisibleResource').mockResolvedValue(undefined)
    const w = mountComposer()
    await w.find('textarea').setValue('@Drive1/a')
    await w.findComponent({ name: 'MentionPopover' }).vm.$emit('pick', { name: 'a.txt', kind: 'file', resolvedPath: '/DATA/a.txt' })
    await flushPromises()
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect(spy).toHaveBeenCalledWith('/DATA/a.txt', 'file', false)
  })

  it('pick hits 409 gitignore: show confirmation dialog, force retry after confirming', async () => {
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

  it('pop-segment pops last segment', async () => {
    const w = mountComposer()
    await w.find('textarea').setValue('@Drive1/docs/')
    await w.findComponent({ name: 'MentionPopover' }).vm.$emit('pop-segment')
    await w.vm.$nextTick()
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('@Drive1/')
  })

  // P1c2 debt 3 — popSegment() verbatim alignment with Vue2 shell/AgentComposer.vue:412-428:
  // it *doesn't* refocus textarea, but drillIn(355-371)/pickItem(374-410) do. This
  // asymmetry had no assertion before, a "while I'm here" focus() addition wouldn't be
  // caught. Write all three together as contrast groups: after pop-segment activeElement
  // stays non-textarea, after drill-in/pick activeElement returns to textarea. Real
  // `element.focus()`/`.blur()` (not `.trigger('focus')` which only dispatches synthetic
  // event without changing `document.activeElement`) needed to observe, needs
  // `attachTo: document.body` (already default mount in `mountComposer`).
  it('pop-segment does not refocus textarea (asymmetry vs drill-in/pick, Vue2 412-428 by design)', async () => {
    const w = mountComposer()
    const taEl = w.find('textarea').element as HTMLTextAreaElement
    await w.find('textarea').setValue('@Drive1/docs/')
    taEl.focus()
    expect(document.activeElement).toBe(taEl)
    taEl.blur()
    expect(document.activeElement).not.toBe(taEl)
    await w.findComponent({ name: 'MentionPopover' }).vm.$emit('pop-segment')
    await w.vm.$nextTick()
    expect(document.activeElement).not.toBe(taEl)
  })

  it('contrast: drill-in refocuses textarea', async () => {
    const w = mountComposer()
    const taEl = w.find('textarea').element as HTMLTextAreaElement
    await w.find('textarea').setValue('@Dr')
    taEl.blur()
    expect(document.activeElement).not.toBe(taEl)
    await w.findComponent({ name: 'MentionPopover' }).vm.$emit('drill-in', { name: 'Drive1', kind: 'drive', resolvedPath: '/DATA' })
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(taEl)
  })

  it('contrast: pick refocuses textarea', async () => {
    const store = useAgentStore()
    store.activeSessionId = 'sess-1'
    vi.spyOn(store, 'addVisibleResource').mockResolvedValue(undefined)
    const w = mountComposer()
    const taEl = w.find('textarea').element as HTMLTextAreaElement
    await w.find('textarea').setValue('@Drive1/a')
    taEl.blur()
    expect(document.activeElement).not.toBe(taEl)
    await w.findComponent({ name: 'MentionPopover' }).vm.$emit('pick', { name: 'a.txt', kind: 'file', resolvedPath: '/DATA/a.txt' })
    await flushPromises()
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(taEl)
  })

  it('mention panel open: Enter does not send (handled by panel)', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('@doc')
    await ta.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('send')).toBeFalsy()
  })
})

// P1c1 acceptance patch Task 1 — blur-close then refocus/click should reopen panel (Vue2
// also lacks @focus handler, defect fixed per project "logic follows correctness" rule,
// see p1c1-patch-task-1-brief.md). Cases verbatim from brief "test requirements" 1-4,
// fake timers usage aligns with AgentTopbar.test.ts.
describe('AgentComposer @mention panel focus/click resync (P1c1 patch)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((f: any) => f.mockClear?.())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('blur → refocus reopens panel', async () => {
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

  it('refocus does not open unrelated panel', async () => {
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

  it('click moving caret out of @ word closes panel', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    const el = ta.element as HTMLTextAreaElement
    await ta.setValue('@Drive1/docs/ tail')

    // Caret inside @ segment, click there first — panel opens.
    el.setSelectionRange(5, 5)
    await ta.trigger('click')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(true)

    // Move caret to ' tail' (outside mention) and click again.
    el.setSelectionRange(el.value.length, el.value.length)
    await ta.trigger('click')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(false)
  })

  it('focus cancels pending blur close', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('@doc')
    await ta.trigger('blur')
    vi.advanceTimersByTime(100) // less than the 180ms blur-close delay
    await ta.trigger('focus')
    vi.advanceTimersByTime(200)
    await flushPromises()
    // Pending blur timer must be cancelled by focus — panel stays open, doesn't
    // close later by stale timer.
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(true)
  })
})

// P1c1 acceptance patch task 4 — @ mention word changed to "state tracking" instead of
// re-deriving from text every time (scanMention breaks on whitespace). NimoOS mount point
// name `System (/DATA)` has spaces and slashes; after drilling old impl loses panel on next
// blur/focus or keystroke — cases verbatim from .superpowers/sdd/p1c1-patch-task-4-brief.md
// "component tests" 1-6, fake timers usage aligns with focus/click resync describe above.
describe('AgentComposer @mention word state tracking (P1c1 patch task 4, mount point with spaces/slashes)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((f: any) => f.mockClear?.())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** Drill two levels, repro user-reported path prefix: `@System (/DATA)/.system_data/`.
   *  drillIn is pure state write (buildDrillText uses mentionStart/mentionSegs, no text
   *  scan), so this step not affected by bug being fixed, can use directly as fixture. */
  async function drillIntoSpacedMount(w: ReturnType<typeof mountComposer>) {
    await w.find('textarea').setValue('@Sys')
    const pop = w.findComponent({ name: 'MentionPopover' })
    await pop.vm.$emit('drill-in', { name: 'System (/DATA)', kind: 'drive', resolvedPath: '/DATA' })
    await w.vm.$nextTick()
    await pop.vm.$emit('drill-in', { name: '.system_data', kind: 'folder', resolvedPath: '/DATA/.system_data' })
    await w.vm.$nextTick()
  }

  it('1. user original repro: blur hides, refocus restores by recorded segments/query (space doesn\'t lose panel)', async () => {
    const w = mountComposer()
    await drillIntoSpacedMount(w)
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('@System (/DATA)/.system_data/')

    await w.find('textarea').trigger('blur')
    vi.advanceTimersByTime(200)
    await flushPromises()
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(false)

    await w.find('textarea').trigger('focus')
    const pop = w.findComponent({ name: 'MentionPopover' })
    expect(pop.props('open')).toBe(true)
    expect(pop.props('segments')).toEqual(['System (/DATA)', '.system_data'])
    expect(pop.props('query')).toBe('')
  })

  it('2. drill then type: panel doesn\'t drop (old impl breaks on space — must fail before fix)', async () => {
    const w = mountComposer()
    await drillIntoSpacedMount(w)
    const ta = w.find('textarea')
    await ta.setValue((ta.element as HTMLTextAreaElement).value + 're')
    const pop = w.findComponent({ name: 'MentionPopover' })
    expect(pop.props('open')).toBe(true)
    expect(pop.props('query')).toBe('re')
  })

  it('3. after Esc, focus doesn\'t resurrect', async () => {
    const w = mountComposer()
    await drillIntoSpacedMount(w)
    const pop = w.findComponent({ name: 'MentionPopover' })
    expect(pop.props('open')).toBe(true)

    await pop.vm.$emit('close')
    await w.vm.$nextTick()
    expect(pop.props('open')).toBe(false)

    await w.find('textarea').trigger('focus')
    expect(pop.props('open')).toBe(false)
  })

  it('4. discovery rule not widened: email and isolated @ don\'t trigger', async () => {
    const w = mountComposer()
    await w.find('textarea').setValue('me@host')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(false)
    await w.find('textarea').setValue('hi @ x')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(false)
  })

  it('5. session switch resets (not just hides): panel closes, subsequent focus doesn\'t reopen', async () => {
    const store = useAgentStore()
    store.activeSessionId = 'sess-1'
    const w = mountComposer()
    await drillIntoSpacedMount(w)
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(true)

    store.activeSessionId = 'sess-2'
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(false)

    await w.find('textarea').trigger('focus')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(false)
  })

  it('6. after send resets: text clears, subsequent focus doesn\'t reopen panel', async () => {
    const store = useAgentStore()
    store.activeSessionId = 'sess-1'
    const w = mountComposer()
    await drillIntoSpacedMount(w)
    const ta = w.find('textarea')
    await ta.setValue((ta.element as HTMLTextAreaElement).value + 'hello')
    await w.find('.send-btn').trigger('click')
    await flushPromises()
    expect((ta.element as HTMLTextAreaElement).value).toBe('')

    await ta.trigger('focus')
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(false)
  })
})

// SP8-P1c1 patch task 3 — retire rejected fullscreen SlashMenu, wire up SlashPopover
// instead. Ten cases verbatim from .superpowers/sdd/p1c1-patch-task-3-brief.md
// "test requirements" 1-10. Old single test exercising SlashMenu + "whole string is
// exactly '/'" trigger rule deleted (not superseded) because rule and component are
// exactly what patch replaces — keeping it would duplicate coverage or assert retired.
describe('AgentComposer slash command panel (P1c1 patch task 3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((f: any) => f.mockClear?.())
  })

  it('1. "/" at start opens; "/" in sentence doesn\'t', async () => {
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

  it('2. type-as-filter: query updates with input', async () => {
    const w = mountComposer()
    await w.find('textarea').setValue('/in')
    const pop = w.findComponent({ name: 'SlashPopover' })
    expect(pop.props('open')).toBe(true)
    expect(pop.props('query')).toBe('in')
  })

  it('3. command stage space closes', async () => {
    const w = mountComposer()
    await w.find('textarea').setValue('/init ')
    expect(w.findComponent({ name: 'SlashPopover' }).props('open')).toBe(false)
  })

  it('4. two-stage flow: pick-command changes text to "/init ", enters target, folders gets authorized dirs', async () => {
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

  it('5. choose dir and send: pick-target emits send-init and clears input', async () => {
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

  it('6. Esc back then exit: back() to command stage (text "/init"), then close() closes panel', async () => {
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

  it('7. closed doesn\'t auto-reopen; only reopens if text changes', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('/')
    const pop = w.findComponent({ name: 'SlashPopover' })
    expect(pop.props('open')).toBe(true)

    await pop.vm.$emit('close')
    await w.vm.$nextTick()
    expect(pop.props('open')).toBe(false)

    // Resync without changing text (e.g. refocus) — must stay closed.
    await ta.trigger('focus')
    expect(pop.props('open')).toBe(false)

    await ta.setValue('/i')
    expect(pop.props('open')).toBe(true)
  })

  it('8. panel open: Enter doesn\'t send', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('/')
    await ta.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('send')).toBeFalsy()
  })

  it('9. @ and / don\'t open together', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('/')
    expect(w.findComponent({ name: 'SlashPopover' }).props('open')).toBe(true)
    await ta.setValue('@doc')
    expect(w.findComponent({ name: 'SlashPopover' }).props('open')).toBe(false)
    expect(w.findComponent({ name: 'MentionPopover' }).props('open')).toBe(true)
  })

  it('10. session switch closes slash panel', async () => {
    const store = useAgentStore()
    const w = mountComposer()
    await w.find('textarea').setValue('/')
    expect(w.findComponent({ name: 'SlashPopover' }).props('open')).toBe(true)
    store.activeSessionId = 'sess-2'
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'SlashPopover' }).props('open')).toBe(false)
  })
})

// P1c1 acceptance patch Task 5 (2026-07-27, round 2 Item A) — @ panel Esc close lacks
// "closed doesn't auto-reopen" memory like slashDismissedText: type '@doc' → Esc → click
// input → onFocus → syncMentionFromCaret → scanMention rediscovers same @doc token,
// panel reopens uninvited. Cases match brief Item A 1-4 verbatim.
describe('AgentComposer @mention panel Esc close memory (P1c1 acceptance patch round 2 Item A)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((f: any) => f.mockClear?.())
  })

  it('1. after Esc close, refocus doesn\'t resurrect', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('@doc')
    const pop = w.findComponent({ name: 'MentionPopover' })
    expect(pop.props('open')).toBe(true)

    await pop.vm.$emit('close')
    await w.vm.$nextTick()
    expect(pop.props('open')).toBe(false)

    await ta.trigger('focus')
    expect(pop.props('open')).toBe(false)
  })

  it('2. after close, reopens only if text changes', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('@doc')
    const pop = w.findComponent({ name: 'MentionPopover' })
    await pop.vm.$emit('close')
    await w.vm.$nextTick()
    expect(pop.props('open')).toBe(false)

    await ta.setValue('@docx')
    expect(pop.props('open')).toBe(true)
  })

  it('3. clear text then retype new @ word, old memory doesn\'t block', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('@doc')
    const pop = w.findComponent({ name: 'MentionPopover' })
    await pop.vm.$emit('close')
    await w.vm.$nextTick()
    expect(pop.props('open')).toBe(false)

    await ta.setValue('')
    await ta.setValue('@x')
    expect(pop.props('open')).toBe(true)
  })

  it('4. drilled word after Esc doesn\'t resurrect; session switch resets, new word opens', async () => {
    const store = useAgentStore()
    store.activeSessionId = 'sess-1'
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('@Dr')
    const pop = w.findComponent({ name: 'MentionPopover' })
    await pop.vm.$emit('drill-in', { name: 'Drive1', kind: 'drive', resolvedPath: '/DATA' })
    await w.vm.$nextTick()
    expect((ta.element as HTMLTextAreaElement).value).toBe('@Drive1/')

    await pop.vm.$emit('close')
    await w.vm.$nextTick()
    expect(pop.props('open')).toBe(false)

    await ta.trigger('focus')
    expect(pop.props('open')).toBe(false)

    store.activeSessionId = 'sess-2'
    await w.vm.$nextTick()
    await ta.setValue('@y')
    expect(pop.props('open')).toBe(true)
  })
})

// P1c1 acceptance patch Task 5 (2026-07-27, round 2 Item B) — drillIn's nextTick
// `el.focus()` sync re-enters onFocus → syncMentionFromCaret (see header note, precedent),
// if re-entry happens before `el.setSelectionRange(caretPos, caretPos)`, caret read is
// browser default string end after DOM .value assignment, not where drill should land — when
// text follows token, tail text wrongly becomes mentionQuery. Cases match brief Item B verbatim.
describe('AgentComposer drillIn caret math (P1c1 acceptance patch round 2 Item B)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((f: any) => f.mockClear?.())
  })

  it('drill when token has text after: query not polluted by tail text', async () => {
    // Regression note: earlier draft checked props after single `await w.vm.$nextTick()`
    // and passed *even against buggy impl* — single tick sees stale (pre-focus-handler) prop
    // snapshot, before Vue scheduler flushes render from focus-triggered re-entrant sync.
    // `flushPromises()` drains microtask rounds to observe true converged state; without it
    // test is false negative that can't catch the bug it's named for.
    const w = mountComposer()
    const ta = w.find('textarea')
    const el = ta.element as HTMLTextAreaElement
    await ta.setValue('@Dr tail')
    el.setSelectionRange(3, 3) // caret right after "@Dr", before " tail"
    await ta.trigger('click')
    const pop = w.findComponent({ name: 'MentionPopover' })
    expect(pop.props('open')).toBe(true)

    await pop.vm.$emit('drill-in', { name: 'Drive1', kind: 'drive', resolvedPath: '/DATA' })
    await flushPromises()

    expect(el.value).toBe('@Drive1/ tail')
    expect(pop.props('segments')).toEqual(['Drive1'])
    expect(pop.props('query')).toBe('')
  })
})

// SP8-P3a post-acceptance addition — "mounted skill" banner. Verbatim from
// .superpowers/sdd/p3a-post-skillbanner-brief.md §3. Uses real Pinia store (consistent
// with rest of file, no agentStore mock), directly reads/writes store.pendingSkillId.
describe('AgentComposer mounted skill banner (SP8-P3a post-acceptance)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((f: any) => f.mockClear?.())
  })

  it('pendingSkillId has value: render banner, copy includes slug (in <code>)', () => {
    const store = useAgentStore()
    store.pendingSkillId = 'duplicate-sweeper'
    const w = mountComposer()
    const banner = w.find('.pending-skill')
    expect(banner.exists()).toBe(true)
    expect(banner.find('code').text()).toBe('duplicate-sweeper')
  })

  it('pendingSkillId null: banner not rendered', () => {
    const store = useAgentStore()
    store.pendingSkillId = null
    const w = mountComposer()
    expect(w.find('.pending-skill').exists()).toBe(false)
  })

  it('click close button nulls store.pendingSkillId, banner disappears', async () => {
    const store = useAgentStore()
    store.pendingSkillId = 'duplicate-sweeper'
    const w = mountComposer()
    expect(w.find('.pending-skill').exists()).toBe(true)
    await w.find('.pending-skill-x').trigger('click')
    expect(store.pendingSkillId).toBeNull()
    expect(w.find('.pending-skill').exists()).toBe(false)
  })

  // Auto-disappears after send: agentStore.ts:925-927 send() is what truly consumes/clears
  // pendingSkillId (X-Skill-Id header), AgentComposer submit() only emits('send') to parent
  // (AgentPage.vue) to call store.send() — per brief ban this file doesn't touch
  // AgentPage.vue/agentStore.ts internals, impractical to re-mock runAgentRun/SSE to drive
  // real send() here. So pin only half allowed by brief §3.4: after pendingSkillId cleared
  // (by anyone), banner v-if purely reactively vanishes, component needs no cleanup code.
  it('after pendingSkillId cleared (simulating send() consuming once), banner naturally disappears', async () => {
    const store = useAgentStore()
    store.pendingSkillId = 'duplicate-sweeper'
    const w = mountComposer()
    expect(w.find('.pending-skill').exists()).toBe(true)

    // Simulate agentStore.ts:927 `pendingSkillId.value = null // consume once`.
    store.pendingSkillId = null
    await flushPromises()
    expect(w.find('.pending-skill').exists()).toBe(false)
  })
})
