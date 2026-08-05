### Task 10: `AgentComposer.vue` —— 附件管线(选择/上传/进度/文档错误/删除/清空)

**Files:**
- Modify: `src/ai/components/shell/AgentComposer.vue`
- Modify: `src/ai/components/shell/AgentComposer.test.ts`(追加 describe)
- Modify: `src/i18n/{zh_cn,en_us}.ts`

**Interfaces:**
- Consumes: Task 5 `attachmentMeta.ts`(`ACCEPT_TYPES`/`MAX_ATTACHMENT_BYTES`/`docErrorKey`/`docErrorShortKey`/`TEXT_EXTS`/`DOCUMENT_EXTS`);`service.ai.uploadAttachment(sessionId, file, { onProgress })` / `deleteAttachment` / `attachmentRawUrl`;store `createSession()`。
- Produces: 本地 `pending` 列表项形状(仅组件内部,不外泄):`{ tmpId: string; file: File; status: 'uploading'|'uploaded'|'failed'; progress: number; aid?: string; kind?: string; mime?: string; error?: string; docError?: string; docMeta?: { extractor?: string; pages?: number; truncated?: boolean } }`;`submit()` 的 `attachmentIds`/`attachmentRefs` 从此列表推导(refs 形状 `{ id, filename, kind, mime, url }`)。

- [ ] **Step 1: 写失败测试**

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/ai/components/shell/AgentComposer.test.ts -t "附件管线"`
Expected: FAIL。

- [ ] **Step 3: 实现**

逐字港 Vue2 `AgentComposer.vue` 的:`attachments` data(220-225)→ `ref<PendingAttachment[]>`;模板 chips 段 18-42(动态 class `is-uploading`/`is-failed`/`is-doc-warn`、`chipTitle`、进度/错误/警告角标);`onFilesPicked`(506-602)全流程 —— `e.target.value=''` 复位、懒建会话(517-527)、500MB 门(531-537)、`tmpId` 生成、**先 push 再上传**(545)、`onProgress` 直接改 entry(547-549)、成功写 `aid/kind/mime/status`(550-554)、document + `meta.extract_error` → `docError` + 7000ms 警告 toast(558-578)、`binary` + `not_installed` + 扩展名匹配 → 同款 toast(582-591)、失败写 `status/error` + 5000ms danger toast(592-600);`removeAttachment(entry)`(604-611,已上传则 best-effort 删服务端后本地移除);`chipTitle`/`docOkLabel`(488-504);`attachmentHint`(234-244)→ **原生 `title` 属性多行串**(Buefy `<b-tooltip>` 无替代品,`\n` 拼接;这是本期的允许偏离,写注释说明);`submit()` 补齐 attachment 部分(438-452);`activeSessionId` watcher(275-281)在此加上 —— 体内 `closeMention()`(Task 11 补)与 `pending.value = []`,本任务先只清附件,Task 11 再补 closeMention 调用。

i18n:文档错误 8 长句 + 8 短标签 + `aiDocErrGeneric`/`aiDocErrShortParse` + `aiDocOkExtracted`/`aiDocPages`/`aiDocTruncated` + `aiAttachHint1..7`(Vue2 236-242 七行)+ `aiAttachTooLarge`('{name} 超过 500 MB 上限')+ `aiAttachSessionFailed`('建会话失败:{err}')。**zh_cn 中文、en_us 用 Vue2 英文原串。**

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/ai/components/shell/AgentComposer.test.ts src/i18n/parity.test.ts`
Expected: 全绿。`grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(' src/ai/components/shell/AgentComposer.vue` → 无输出。

- [ ] **Step 5: Commit**

```bash
git add src/ai/components/shell/AgentComposer.vue src/ai/components/shell/AgentComposer.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P1c1: AgentComposer attachment pipeline (upload/progress/doc-errors/delete)"
```

---

