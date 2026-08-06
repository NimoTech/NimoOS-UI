### Task 11: `AgentComposer.vue` —— @ 提及 + 斜杠命令接线 + gitignore 409 确认

**Files:**
- Modify: `src/ai/components/shell/AgentComposer.vue`
- Modify: `src/ai/components/shell/AgentComposer.test.ts`(追加 describe)
- Modify: `src/i18n/{zh_cn,en_us}.ts`

**Interfaces:**
- Consumes: Task 5 `composerText.ts` 的 `scanMention`/`buildDrillText`/`buildPopText`/`stripMentionToken`;Task 7 `MentionPopover.vue`;Task 8 `SlashMenu.vue`;store `addVisibleResource(path, kind, force)`(错误原样抛)、`sendInit` 经 `@send-init` 上抛给 AgentPage;`src/components/ui/AlertDialog.vue`(props `open/title/message/confirmText/cancelText/destructive`,emits `update:open`/`confirm`)。
- Produces: 无新增对外接口(仍是 Task 9 的三个 emit)。

- [ ] **Step 1: 写失败测试**

```ts
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

  it('单独输入 "/" 打开斜杠菜单;确认 init 后清空输入并 emit send-init', async () => {
    const store = useAgentStore()
    store.visibleResources.push({ id: 1, path: '/DATA/docs', kind: 'folder' })
    const w = mountComposer()
    await w.find('textarea').setValue('/')
    const menu = w.findComponent({ name: 'SlashMenu' })
    expect(menu.exists()).toBe(true)
    expect(menu.props('folders').map((f: any) => f.path)).toEqual(['/DATA/docs'])
    await menu.vm.$emit('init', '/DATA/docs')
    expect(w.emitted('send-init')).toEqual([['/DATA/docs']])
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('提及面板打开时 Enter 不发送(交给面板处理)', async () => {
    const w = mountComposer()
    const ta = w.find('textarea')
    await ta.setValue('@doc')
    await ta.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('send')).toBeFalsy()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/ai/components/shell/AgentComposer.test.ts -t "@提及"`
Expected: FAIL。

- [ ] **Step 3: 实现**

逐字港:`onInput`(300-335)—— 先 `grow()`,再斜杠触发(307-310:**仅当整串等于 `'/'` 且未打开时**),再用 Task 5 的 `scanMention(text, caret)` 写回 `mentionOpen/mentionStart/mentionSegs/mentionQuery` + `updateAnchor()`;`onBlur`(343-346)180ms 延迟关闭 —— **补 Vue2 缺的清理**:把 timer 存 ref,`onBeforeUnmount` 里 `clearTimeout`(允许的偏离,写注释);`closeMention`(347-352);`drillIn`/`pickItem`/`popSegment`(355-428)用 Task 5 的三个 build 函数 + `nextTick` 里 `ta.focus()`(仅 drillIn/pickItem,`popSegment` 照 Vue2 **不 focus**)+ `setSelectionRange(caretPos, caretPos)` + `grow()`;`onInit`(613-617);Task 10 留下的 watcher 体补上 `closeMention()`。

**gitignore 409 确认(本期唯一有意的交互偏离,必须写注释说明):** Vue2 用 `window.confirm`(398/630),这里改成 reka `AlertDialog`。实现方式:组件内 `const gitignoreAsk = ref<{ path: string; kind: string } | null>(null)`,`pickItem` 的 catch 里判 `status===409 && /gitignore/i.test(detail)` → 赋值打开对话框(不再阻塞);`AlertDialog` 的 `@confirm` → `addVisibleResource(path, kind, true)`,失败走 `toastError`;`update:open=false` → 清空。文案键 `aiGitignoreBlockedTitle`('该路径被 .gitignore 排除')+ `aiGitignoreBlockedMsg`('{path} 被 .gitignore 排除,仍要授权吗?'/Vue2 英文原串)+ 确认键复用 `aiAllow`、取消复用 `aiCancel`。
**注意** AlertDialog 走 `DialogPortal`、渲染在 `.agent-app` 子树之外 → `.agent-app` 的 token 不生效(AgentSidebar 的删除确认已是同样处境,视为既有约定)。

`toastError(e)`(654-657)→ `useToast().show(t('aiAuthFailed', { msg }), 5000)`,`msg` 取 `e?.response?.data?.detail || e?.message || 'unknown'`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/ai/components/shell/AgentComposer.test.ts src/i18n/parity.test.ts`
Expected: 全绿。

- [ ] **Step 5: Commit**

```bash
git add src/ai/components/shell/AgentComposer.vue src/ai/components/shell/AgentComposer.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P1c1: AgentComposer @mention + slash wiring + gitignore-409 AlertDialog"
```

---

