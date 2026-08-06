### Task 4: store —— `sendInit(target)`(`/init` 斜杠命令的执行体)

**Files:**
- Modify: `src/ai/stores/agentStore.ts`
- Test: `src/ai/stores/agentStore.p1c.test.ts`(追加 describe)

**Interfaces:**
- Consumes: 既有 `createSession`、`appendBlock`、`setStreamingDone`、`createStreamActions`、`runAgentRun`(from `../services/agentTransport`)、`parseModelKey`(模块私有,`agentStore.ts:70`)。
- Produces: `sendInit(target: string): Promise<void>`(进 return 表)。

- [ ] **Step 1: 写失败测试**

```ts
describe('agentStore P1c Task4:sendInit', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(svc).forEach((fn) => fn.mockReset())
    localStorage.clear()
    svc.createAgentSession.mockResolvedValue({ session_id: 'sess-init' })
    svc.listAgentSessions.mockResolvedValue([])
  })

  it('sendInit:先 push [/init] user + assistant 占位,再按 kind=init 发 run', async () => {
    const { runAgentRun } = await import('../services/agentTransport')
    const s = useAgentStore('t4a')
    s.availableModels = [{ key: 'local:llama3', source: 'local', displayName: 'llama3', provider_type: 'ollama' } as any]
    s.selectedModel = 'local:llama3'
    await s.sendInit('/DATA/docs')
    expect(s.messages[0]).toMatchObject({ role: 'user', content: '[/init] /DATA/docs' })
    expect(s.messages[1]).toMatchObject({ role: 'assistant' })
    expect(runAgentRun).toHaveBeenCalledWith(
      'sess-init',
      { message: 'Please generate agent.md for /DATA/docs.', model: 'llama3', kind: 'init', init_target: '/DATA/docs' },
      'ollama',
      expect.anything(), expect.anything(), expect.any(Function), {},
    )
    expect(s.busy).toBe(false)
  })

  it('sendInit:无选中模型时落一个 error tool block 并收尾', async () => {
    const s = useAgentStore('t4b')
    s.selectedModel = null
    await s.sendInit('/DATA/docs')
    const last: any = s.messages[s.messages.length - 1]
    expect(last.blocks[0]).toMatchObject({ type: 'tool', state: 'error', name: 'request' })
    expect(s.busy).toBe(false)
  })

  it('sendInit:云模型带 X-Agent-Provider-Id 头', async () => {
    const { runAgentRun } = await import('../services/agentTransport')
    const s = useAgentStore('t4c')
    s.activeSessionId = 'sess-1'
    s.availableModels = [{ key: 'cloud:6:deepseek-chat', source: 'cloud', displayName: 'deepseek-chat', providerId: 6, provider_type: 'deepseek' } as any]
    s.selectedModel = 'cloud:6:deepseek-chat'
    await s.sendInit('/DATA/x')
    expect(runAgentRun).toHaveBeenCalledWith(
      'sess-1', expect.objectContaining({ model: 'deepseek-chat', kind: 'init' }), 'deepseek',
      expect.anything(), expect.anything(), expect.any(Function), { 'X-Agent-Provider-Id': '6' },
    )
  })
})
```

> 注:`runAgentRun` 的实参顺序以 `src/ai/services/agentTransport.ts` 的现有签名为准 —— 实现前先读该文件确认(1b 的 `send()` 调用形态是唯一真值),测试断言按实际签名对齐,不要照抄 Vue2 的参数顺序。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test -- src/ai/stores/agentStore.p1c.test.ts -t "Task4"`
Expected: FAIL —— `s.sendInit is not a function`。

- [ ] **Step 3: 实现**

逐字港 `agentStore.js:423-490`,放在 `send()` 之后。要点(与 Vue2 完全一致):
1. `const message = \`Please generate agent.md for ${target}.\`` —— **英文固定串,不 i18n**(后端提示词)。
2. 直接 `messages.value.push` 两条:user `{ id: 'u<ts>-<rand>', role: 'user', content: \`[/init] ${target}\` }`、assistant `{ id: 'a<ts>-<rand>', role: 'assistant', blocks: [], streaming: true }`(**id 生成方式照抄 Vue2**)。
3. `busy.value = true`;`abortController.value = new AbortController()`。
4. `try`:无会话先 `await createSession()`;`if (!selectedModel.value) throw new Error('No model selected')`;用 `parseModelKey` 解析出 `modelName`/`source`;`providerType = sel?.provider_type || (source === 'local' ? 'ollama' : 'other')`;`extraHeaders` 仅当 `sel?.source === 'cloud' && sel?.providerId` 时带 `X-Agent-Provider-Id`;调 `runAgentRun`,payload `{ message, model: modelName, kind: 'init', init_target: target }`,`onError` 回调落 error tool block + `setStreamingDone()`(与 `send()` 里同款,双形 error 都要吃)。
   **注意:Vue2 的 `sendInit` 不带 `thinking` 字段** —— 保持不带。
5. `catch`:`appendBlock({type:'tool',state:'error',name:'request',sections:[{label:'ERROR',code: typeof e === 'string' ? e : ((e as Error)?.message || JSON.stringify(e))}]})` + `setStreamingDone()`。
6. `finally`:`if (busy.value) setStreamingDone()`;`abortController.value = null`。**Vue2 的 sendInit 不做首轮自动标题** —— 保持不做。

return 表补 `sendInit`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test -- src/ai/stores/agentStore.p1c.test.ts`
Expected: 全绿。`pnpm exec vue-tsc --noEmit` → 0 error。

- [ ] **Step 5: Commit**

```bash
git add src/ai/stores/agentStore.ts src/ai/stores/agentStore.p1c.test.ts
git commit -m "SP8-P1c1: store sendInit (slash /init)"
```

---

