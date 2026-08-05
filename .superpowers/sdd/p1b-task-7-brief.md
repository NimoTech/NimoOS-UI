### Task 7: Store `send`/`stop`/`continueRun`/`confirmAgentAction` + minimal model bootstrap + attach

**Files:**
- Modify: `src/ai/stores/agentStore.ts`
- Modify: `src/ai/stores/agentStore.test.ts`

**Interfaces:**
- Consumes: Task 6 transport, `service.ai` (`cancelAgentRun`, `confirmAgentAction`, `listModels`, `listProviders`).
- Produces store actions/state:
  - `createStreamActions(): StreamActions` — the adapter bound to this store (used by send/attach).
  - `send(payload: string | { text: string; attachmentIds?: string[]; attachmentRefs?: AttachmentRef[]; contextPhoto?: unknown; contextAlbum?: unknown }): Promise<void>`
  - `stop(): Promise<void>`, `continueRun(): Promise<void>`, `confirmAgentAction(confirmId, confirmed, remember?): Promise<void>`
  - `loadAvailableModels(): Promise<void>`, `selectModel(key): void`, state `availableModels`, `selectedModel`, `thinking` (defaults), `pendingSkillId`.
  - `selectSession` now attaches via `attachAgentStream` after loading history.

- [ ] **Step 1: Write failing tests** (mock `service.ai` + `agentTransport`):

```ts
it('send guards on busy (no double-run)', async () => {
  const s = useAgentStore('t-send'); s.setBusy(true)
  await s.send('hi'); expect(runSpy).not.toHaveBeenCalled()
})
it('send with no model appends an error tool block', async () => {
  const s = useAgentStore('t-nomodel'); s.availableModels = []; s.selectedModel = null
  await s.send('hi')
  const last: any = s.messages.at(-1)
  expect(last.blocks.some((b: any) => b.type === 'tool' && b.state === 'error')).toBe(true)
})
it('send happy path: pushes user + assistant, calls runAgentRun with model+providerType', async () => {
  const s = useAgentStore('t-happy'); s.availableModels = [LOCAL_MODEL]; s.selectModel('local:llama')
  s.activeSessionId = 'sess1'
  await s.send('hello')
  expect(runSpy).toHaveBeenCalledWith('sess1', expect.objectContaining({ message: 'hello', model: 'llama' }),
    'ollama', expect.anything(), expect.anything(), expect.any(Function), expect.anything())
})
it('confirmAgentAction delegates to service', async () => {
  const s = useAgentStore('t-confirm'); s.activeSessionId = 'x'
  await s.confirmAgentAction('c1', true); expect(confirmSpy).toHaveBeenCalledWith('x', 'c1', true, false)
})
it('loadAvailableModels selects local-first default', async () => {
  const s = useAgentStore('t-models'); await s.loadAvailableModels()
  expect(s.selectedModel).toMatch(/^local:/)
})
```

- [ ] **Step 2: Run, verify fail** — `pnpm test -- agentStore` → FAIL.

- [ ] **Step 3: Add `createStreamActions()`** returning a `StreamActions` object bound to this store's primitives (Task 4), with a mutable `_lastNimoosSearchQuery` carrier. In 1b, DO NOT include `appendStagedChange`/`appendVisibleResource`/`removeVisibleResourceFromList` (absent → reducer no-ops):

```ts
function createStreamActions(): StreamActions {
  return {
    pushUserMessage, startAssistant, appendBlock, patchBlock, setStreamingDone,
    setBusy, patchAssistantStats, pushActivityStep, markRunningStepDone,
    _lastNimoosSearchQuery: '',
  }
}
```

- [ ] **Step 4: Port `buildCloudModelList` + `loadAvailableModels` + `selectModel` + minimal thinking state** from `agentStore.js:8-26, 599-698` — **minus any picker UI** (no ThinkingBar). Keep: local-first fallback, localStorage key `nimoos.ai.agent.selectedModel`, `lastFallbackNotice`, `updateThinkingForModel` (sets `thinking.supportsThinking`/`providerType`). `thinking` state defaults `{enabled:true, level:'medium', supportsThinking:false, providerType:'', defaults:{enabled:true,level:'medium'}}`.

- [ ] **Step 5: Port `send`** verbatim from `agentStore.js:295-421` with conversions: use `createStreamActions()` instead of the Vue2 `actions` object; call Task 6 `runAgentRun`; keep model-key parse (`local:` vs `cloud:<id>:<name>`), `providerType` derivation, `extraHeaders` (`X-Skill-Id` from `pendingSkillId` consumed once, `X-Agent-Provider-Id`), busy guard, `await pendingCancel`, session auto-create, `pushUserMessage`+`startAssistant`, `onError` appends error `tool` block + `setStreamingDone`, `finally` auto-title on first turn. **The `onError` block now receives `{status, body}` where `body` = `errorBody`** — keep the Vue2 rendering (JSON.stringify into ERROR section) for parity; cleaner formatting is a 1c nicety.

- [ ] **Step 6: Port `stop`** (`491-511`: abort controller + `ai.cancelAgentRun` stored in `pendingCancel` + `setStreamingDone`), `continueRun` (`519-597`), `confirmAgentAction` (`513-517`). Convert Vue2-isms.

- [ ] **Step 7: Wire attach into `selectSession`.** After `migrateLegacyMessages` assign (Task 4), port the attach tail from `agentStore.js:246-293`: abort prior stream, create `AbortController`, optimistic `busy=true`, `const { attached } = await attachAgentStream(id, ctl.signal, createStreamActions())`, clear busy only if `!attached`. Keep the race-guard (ignore if `activeSessionId` changed mid-await).

- [ ] **Step 8: Run, verify pass** — `pnpm test -- agentStore` → PASS.

- [ ] **Step 9: Load models on shell mount.** In `AgentPage.vue onMounted` (`AgentPage.vue:54-87`), add `store.loadAvailableModels()` (fire-and-forget try/catch) BEFORE the auto-send handoff so a default model exists when auto-send fires (Task 11).

- [ ] **Step 10: Commit**

```bash
git add src/ai/stores/agentStore.ts src/ai/stores/agentStore.test.ts src/ai/views/AgentPage.vue
git commit -m "SP8-P1b: store send/stop/continueRun/confirm + minimal model bootstrap + attach"
```

---

