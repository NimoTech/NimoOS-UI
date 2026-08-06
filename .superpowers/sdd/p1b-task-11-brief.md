### Task 11: Auto-send (`?search`/`?message`) + EmptyState send + UserMessage seam (debt ③)

**Files:**
- Modify: `src/ai/views/AgentPage.vue` (replace the `pendingPrompt` stash with direct auto-send in `onMounted`)
- Modify: `src/ai/stores/agentStore.ts` (remove the now-dead `pendingPrompt` ref)
- Modify: `src/ai/components/stream/EmptyState.vue` (pick→send)
- Modify: `src/ai/components/stream/UserMessage.vue` (restore inject seam, debt ③)
- Modify/add i18n keys `zh_cn.ts`/`en_us.ts`: `ai.searchMyNas` = `Search my NAS for "{query}".` (en) / `在我的 NAS 中搜索"{query}"。` (zh)

**Interfaces:**
- Consumes: Task 7 `send`, Task 4 seam.
- Produces: opening `/app/#/ai/agent?search=<q>` auto-sends a fresh-session locale-wrapped search; `?message=<m>` auto-sends raw into the current/new session; EmptyState cards send.

- [ ] **Step 1: Remove the dead `pendingPrompt` seam.** In `agentStore.ts`, delete the `pendingPrompt` ref (P1a stashed the seed here only because `send()` didn't exist yet; 1b sends directly in Step 2/3). Update the P1a initial-state test (`agentStore.test.ts`) that asserted `pendingPrompt===null` — drop that assertion. No `pendingSeed` replacement is needed: the search-vs-message distinction (wrap+fresh vs raw+reuse) is handled inline in the Step 2 `onMounted` branch.

- [ ] **Step 2: Rewrite the `AgentPage.vue onMounted` handoff** (`AgentPage.vue:73-86`) to preserve the Vue2 two-flow distinction (`Agent.vue:144-196`), consuming the seed after models load:

```ts
// after store.loadSessions() + store.loadAvailableModels()
const skill = route.query.skill
if (skill) store.pendingSkillId = String(skill)

const seedSearch = (route.query.search ?? '').toString().trim()
const seedMessage = (route.query.message ?? '').toString().trim()
if (seedSearch || seedMessage) {
  const clean = { ...route.query }; delete clean.search; delete clean.message
  await router.replace({ path: '/ai/agent', query: clean })   // one-shot: refresh won't re-send
  try {
    if (seedSearch) {
      await store.createSession()                              // always fresh
      await store.send(t('ai.searchMyNas', { query: seedSearch }))
    } else {
      if (!store.activeSessionId) await store.createSession()  // reuse if present
      await store.send(seedMessage)                            // raw verbatim
    }
  } catch { /* onError already surfaced a block */ }
}
```

- [ ] **Step 3: Rewire `EmptyState.vue`** (`:43-46`): `pick(prompt)` → `store.send(prompt)` (via `useProvidedAgentStore()` — change `EmptyState.vue:13`), remove the `aiComingSoon` toast + `pendingPrompt` stash.

- [ ] **Step 4: Restore the UserMessage injection seam (debt ③).** In `UserMessage.vue:29-30`, replace hardcoded `const store = useAgentStore()` with `const store = useProvidedAgentStore()` so a Photos-profile embed resolves the right session id for `attachmentRawUrl`. Remove the `// 1b:` marker comment (mark it resolved). Audit `AgentPage.vue:24` (now `provideAgentStore` — Task 4) and `EmptyState.vue:13` (now `useProvidedAgentStore` — Step 3).

- [ ] **Step 5: Add i18n keys** `ai.searchMyNas` to both `zh_cn.ts` and `en_us.ts`. Run `pnpm test -- parity` → PASS.

- [ ] **Step 6: Write tests** — `AgentPage` mount with `route.query.search='cats'` calls `createSession` then `send` with the wrapped string; with `route.query.message='hi'` reuses session + sends `'hi'`; with both, only `search` fires (guard). Mock `store.send`/`createSession`. EmptyState `pick` calls `store.send`.

- [ ] **Step 7: Run** — `pnpm test -- AgentPage EmptyState UserMessage parity` → PASS.

- [ ] **Step 8: Commit**

```bash
git add src/ai/views/AgentPage.vue src/ai/stores/agentStore.ts src/ai/components/stream/EmptyState.vue src/ai/components/stream/UserMessage.vue src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "SP8-P1b: auto-send ?search/?message + EmptyState send + UserMessage inject seam (debt ③)"
```

---

