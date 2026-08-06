### Task 4: Store streaming primitives + types + provide/inject seam

**Files:**
- Use (created in Task 3): `src/ai/types.ts` — import the shared contracts, do NOT recreate
- Modify: `src/ai/stores/agentStore.ts` (add streaming-primitive actions + `migrateLegacyMessages` hookup; keep factory)
- Create: `src/ai/composables/useProvidedAgentStore.ts` (the inject seam)
- Modify: `src/ai/stores/agentStore.test.ts` (extend for new primitives; update the `busy` invariant note)

**Interfaces:**
- Produces:
  - `src/ai/types.ts` exports (above).
  - Store gains actions: `pushUserMessage`, `startAssistant`, `appendBlock`, `patchBlock`, `setStreamingDone`, `setBusy`, `patchAssistantStats`, `pushActivityStep`, `markRunningStepDone` — signatures per `StreamActions`. (Consumed by Task 5 via the adapter, Task 6 transport, Task 8 confirm cards.)
  - Store `selectSession` now runs loaded messages through `migrateLegacyMessages` before assigning.
  - `provideAgentStore(store)` + `useProvidedAgentStore(): ReturnType<typeof useAgentStore>` — the seam. Consumed by Task 8 (confirm cards) + Task 11 (UserMessage debt ③).
- Consumes: Task 3 `migrateLegacyMessages`.

- [ ] **Step 1: Confirm `src/ai/types.ts` exists** (created in Task 3) and import its types where needed. Do NOT recreate it.

- [ ] **Step 2: Write failing store tests** in `agentStore.test.ts` for the new primitives (mirror Vue2 `store/agentStore.js` semantics):

```ts
it('startAssistant + appendBlock + patchBlock roundtrip', () => {
  const s = useAgentStore('t-prims')
  s.startAssistant()
  expect(s.messages.at(-1)).toMatchObject({ role: 'assistant', blocks: [], streaming: true })
  s.appendBlock({ type: 'md', text: 'hi', streaming: true })
  const ok = s.patchBlock(b => b.type === 'md' && !!b.streaming, old => ({ text: (old.text as string) + '!' }))
  expect(ok).toBe(true)
  expect((s.messages.at(-1) as any).blocks[0].text).toBe('hi!')
})
it('setStreamingDone flips busy false and clears streaming', () => {
  const s = useAgentStore('t-done'); s.setBusy(true); s.startAssistant(); s.setStreamingDone()
  expect(s.busy).toBe(false)
  expect((s.messages.at(-1) as any).streaming).toBe(false)
})
it('patchAssistantStats merges stats on last assistant', () => {
  const s = useAgentStore('t-stats'); s.startAssistant()
  s.patchAssistantStats({ ttftMs: 12 }); s.patchAssistantStats({ outputTokens: 5 })
  expect((s.messages.at(-1) as any).stats).toMatchObject({ ttftMs: 12, outputTokens: 5 })
})
it('pushActivityStep + markRunningStepDone', () => {
  const s = useAgentStore('t-steps'); s.pushActivityStep({ name: 'ls' })
  expect(s.activitySteps.at(-1)).toMatchObject({ name: 'ls', state: 'running' })
  s.markRunningStepDone()
  expect(s.activitySteps.at(-1)).toMatchObject({ state: 'success' })
})
```

Also update the P1a invariant test (`agentStore.test.ts:178-183`): `busy` may now be toggled; keep the initial-state assertion `busy===false` on a fresh store but remove any "never written" assumption.

- [ ] **Step 3: Run, verify fail** — `pnpm test -- agentStore` → FAIL (actions undefined).

- [ ] **Step 4: Add the streaming state fields + primitives to the factory** (keep `useAgentStore(agentType?)` shape). Add to state: `abortController: null`, `activitySteps: []`, `pendingCancel: null`. Port the 9 primitive actions **verbatim** from `store/agentStore.js:64-150`, converting Vue2-isms:
  - `Vue.observable` is already `ref`/`reactive` in P1a — add new refs alongside existing.
  - Array replacement via `splice(i,1,next)` → keep splice (correct in Vue3) OR direct index assign; keep splice to stay verbatim.
  - `pushUserMessage`, `startAssistant`, `appendBlock`, `patchBlock`, `setStreamingDone`, `setBusy`, `patchAssistantStats`, `pushActivityStep`, `markRunningStepDone` — same id-generation (`u<ts>-<rand>` etc.), same reverse-find semantics.

- [ ] **Step 5: Hook `migrateLegacyMessages` into `selectSession`.** At `agentStore.ts:113-114`, change the RAW assign to:

```ts
import { migrateLegacyMessages } from '../services/streamMappers'
// …inside selectSession, replacing the raw assign:
const raw = Array.isArray(body) ? (body as AgentMessage[]) : []
messages.value = migrateLegacyMessages(raw)
```

- [ ] **Step 6: Create the provide/inject seam** `src/ai/composables/useProvidedAgentStore.ts`:

```ts
import { inject, provide, type InjectionKey } from 'vue'
import { useAgentStore } from '../stores/agentStore'

type Store = ReturnType<typeof useAgentStore>
const AGENT_STORE_KEY: InjectionKey<Store> = Symbol('agentStore')

export function provideAgentStore(store: Store) { provide(AGENT_STORE_KEY, store) }
// Falls back to the default 'general' store if no ancestor provided one (standalone use).
export function useProvidedAgentStore(): Store {
  return inject(AGENT_STORE_KEY, null) ?? useAgentStore()
}
```

- [ ] **Step 7: Provide the store from the shell root** `views/AgentPage.vue`: after `const store = useAgentStore()` (`AgentPage.vue:24`), call `provideAgentStore(store)`. (This makes a future Photos embed able to provide `useAgentStore('photos')` at its own root.)

- [ ] **Step 8: Run, verify pass** — `pnpm test -- agentStore` → PASS.

- [ ] **Step 9: Commit**

```bash
git add src/ai/types.ts src/ai/stores/agentStore.ts src/ai/stores/agentStore.test.ts src/ai/composables/useProvidedAgentStore.ts src/ai/views/AgentPage.vue
git commit -m "SP8-P1b: store streaming primitives + types + provide/inject seam + migrate hookup"
```

---

