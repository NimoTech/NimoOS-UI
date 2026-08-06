### Task 12: `AgentPage.vue` 集成 —— 挂 composer + `ctxUsage` 状态与三个刷新触发

**Files:**
- Modify: `src/ai/views/AgentPage.vue`(1-11 头注释、13-24 导入、57-101 `onMounted`、131 composer 缝)
- Modify: `src/ai/views/AgentPage.test.ts`(追加用例)

**Interfaces:**
- Consumes: Task 9-11 的 `AgentComposer.vue`(props `busy`/`ctxUsage`;emits `send`/`stop`/`send-init`);store 的 `send`/`stop`/`sendInit`;`service.ai.getContextUsage(sessionId, model)`。
- Produces: 无对外接口(视图层收口)。

- [ ] **Step 1: 写失败测试**

追加到 `src/ai/views/AgentPage.test.ts`(沿用该文件既有的 `svc` hoisted mock + `vue-router` mock + `mountPage()` 助手;需给 `svc` 补 `getContextUsage`):

```ts
  it('挂载 composer,并把 send/stop/send-init 接到 store', async () => {
    const w = mountPage()
    await flushPromises()
    const composer = w.findComponent({ name: 'AgentComposer' })
    expect(composer.exists()).toBe(true)
    const store = useAgentStore()
    const sendSpy = vi.spyOn(store, 'send').mockResolvedValue(undefined)
    const stopSpy = vi.spyOn(store, 'stop').mockResolvedValue(undefined)
    const initSpy = vi.spyOn(store, 'sendInit').mockResolvedValue(undefined)
    composer.vm.$emit('send', { text: 'hi', attachmentIds: [], attachmentRefs: [] })
    composer.vm.$emit('stop')
    composer.vm.$emit('send-init', '/DATA/docs')
    expect(sendSpy).toHaveBeenCalledWith({ text: 'hi', attachmentIds: [], attachmentRefs: [] })
    expect(stopSpy).toHaveBeenCalled()
    expect(initSpy).toHaveBeenCalledWith('/DATA/docs')
  })

  it('ctxUsage:挂载后拉一次;切会话拉一次;busy 由 true→false 再拉一次', async () => {
    svc.getContextUsage.mockResolvedValue({ tokens: 10, window: 100, pct: 10 })
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    const base = svc.getContextUsage.mock.calls.length
    store.activeSessionId = 'sess-x'
    await flushPromises()
    expect(svc.getContextUsage.mock.calls.length).toBe(base + 1)
    store.busy = true
    await flushPromises()
    expect(svc.getContextUsage.mock.calls.length).toBe(base + 1)   // 上升沿不拉
    store.busy = false
    await flushPromises()
    expect(svc.getContextUsage.mock.calls.length).toBe(base + 2)   // 下降沿拉
    expect(w.findComponent({ name: 'AgentComposer' }).props('ctxUsage')).toEqual({ tokens: 10, window: 100, pct: 10 })
  })

  it('ctxUsage:无会话不拉;请求失败置 null', async () => {
    svc.getContextUsage.mockRejectedValue(new Error('x'))
    const w = mountPage()
    await flushPromises()
    const store = useAgentStore()
    store.activeSessionId = 'sess-y'
    await flushPromises()
    expect(w.findComponent({ name: 'AgentComposer' }).props('ctxUsage')).toBe(null)
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/ai/views/AgentPage.test.ts`
Expected: FAIL(composer 未挂载)。

- [ ] **Step 3: 实现**

1. 导入 `AgentComposer`,把 `:131` 的注释换成:
```html
      <AgentComposer :busy="store.busy" :ctx-usage="ctxUsage"
                     @send="store.send" @stop="store.stop" @send-init="store.sendInit" />
```
(与 Vue2 `Agent.vue:38-42` 的挂载契约一致。)
2. 港 `Agent.vue:99/198-207` 的 `ctxUsage` —— 视图层 ref + `refreshContextUsage()`:
```ts
const ctxUsage = ref<{ tokens: number; window: number; pct: number } | null>(null)
/** Agent.vue:198-207 —— 传**原始 model key**(如 'local:llama3'),不是裸模型名。 */
async function refreshContextUsage() {
  if (!store.activeSessionId) return
  try {
    ctxUsage.value = (await service.ai.getContextUsage(store.activeSessionId, store.selectedModel)) as any
  } catch { ctxUsage.value = null }
}
```
3. 三个触发点(与 Vue2 完全同源):`onMounted` 末尾(在 `loadAvailableModels` 之后)调一次;`watch(() => store.activeSessionId, () => { refreshContextUsage() })`;`watch(() => store.busy, (v, old) => { if (old && !v) refreshContextUsage() })`(**只在 true→false 下降沿**)。
   > Vue2 的 `Agent.vue:120-126` 会话 watcher 里还有 `loadSessionThinking`/`updateThinkingForModel` —— 那两条属于 ThinkingBar,**1c-2 再补**,本任务只接 ctxUsage,不要提前塞。
4. 更新文件头 1-11 的注释:composer 已在 1c-1 挂上;右栏/ModelPicker/ThinkingBar 仍留 1c-2。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/ai/views/AgentPage.test.ts`
Expected: 全绿(含 1a/1b 既有用例)。
Run: `pnpm exec vue-tsc --noEmit` → 0 error。

- [ ] **Step 5: Commit**

```bash
git add src/ai/views/AgentPage.vue src/ai/views/AgentPage.test.ts
git commit -m "SP8-P1c1: mount AgentComposer in AgentPage + ctxUsage state & 3 refresh triggers"
```

---

