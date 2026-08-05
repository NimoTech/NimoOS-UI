# Task 11 report — auto-send (`?search`/`?message`) + EmptyState send + UserMessage inject seam (debt ③)

Branch: `sp8-ai` (base `421f811`). Commit: `b268f6a` — "SP8-P1b: auto-send ?search/?message + EmptyState send + UserMessage inject seam (debt ③)".

## What was wired

1. **`src/ai/stores/agentStore.ts`** — removed the dead `pendingPrompt` ref (both the `ref()` declaration and its entry in the returned object). No replacement seam: the search-vs-message distinction lives inline in `AgentPage.vue`'s `onMounted`, per the brief.

2. **`src/ai/views/AgentPage.vue`** — replaced the P1a `pendingPrompt`-stash block with the brief's exact auto-send logic, placed after `loadSessions()` + `loadAvailableModels()`:
   - `?skill=` → `store.pendingSkillId = String(skill)` (stash only, unchanged from before — consumed later by `send()`'s `X-Skill-Id` header assembly).
   - `?search=<q>` → **always** `await store.createSession()` (fresh), then `store.send(t('ai.searchMyNas', { query: seedSearch }))` (locale-wrapped).
   - `?message=<m>` (only reached when `search` is absent/empty) → `if (!store.activeSessionId) await store.createSession()` (reuse if present), then `store.send(seedMessage)` (raw verbatim).
   - One-shot: `await router.replace({ path: '/ai/agent', query: clean })` — `clean` has **both** `search` and `message` deleted, run *before* the send branch, so a refresh never re-triggers.
   - `try {...} catch { /* onError already surfaced a block */ }` wraps the create+send pair only (matches brief — the `router.replace` await sits outside that inner try, exactly as specified).
   - Kept `store.initTheme()` / `loadSessions()` / `loadAvailableModels()` untouched from Task 7; no `selectSession()` call anywhere in this path (only `createSession`), so the Task-7 footgun (awaiting `selectSession` on an active-run session) is not at risk.

3. **`src/ai/components/stream/EmptyState.vue`** — `pick(prompt)` now calls `store.send(prompt)`; `store` is obtained via `useProvidedAgentStore()` (was `useAgentStore()`); removed the `aiComingSoon` toast and the `pendingPrompt` stash, and the now-unused `useToast` import.

4. **`src/ai/components/stream/UserMessage.vue`** (debt ③) — `const store = useAgentStore()` → `const store = useProvidedAgentStore()`. Removed the `// 1b:` marker comment, replaced with a resolved-state comment. Audited the other two seam sites per the brief: `AgentPage.vue` already calls `provideAgentStore(store)` (Task 4, root of the tree — correctly the *provider*, not a consumer, so it stays on `useAgentStore()`), and `EmptyState.vue` now uses `useProvidedAgentStore()` (Step 3 above). All three are consistent now.

5. **i18n** — added `'ai.searchMyNas'` to both `src/i18n/zh_cn.ts` (`在我的 NAS 中搜索"{query}"。`) and `src/i18n/en_us.ts` (`Search my NAS for "{query}".`). Verified empirically (throwaway probe test, deleted) that vue-i18n's Composition-API `t()` resolves a flat object key containing a literal dot as an exact-match lookup before falling back to dot-path traversal, so the flat-file convention (`aiEmptyTitle`, `aiComingSoon`, etc., no nesting) stays intact — no nested `{ ai: { searchMyNas } }` object was introduced (which would have broken `parity.test.ts`'s "all values are non-empty strings" assertion).

## TDD evidence

- Baseline (`pnpm test -- AgentPage EmptyState UserMessage agentStore parity`) captured green before any edit: 6 files / 70 tests.
- Updated tests first, then implementation, per file:
  - `agentStore.test.ts`: dropped the `pendingPrompt===null` assertion from the initial-state test.
  - `AgentPage.test.ts`: replaced the 3 P1a `pendingPrompt` tests with 7 new tests covering: search→fresh session+wrapped send+call-order (`createSession` before `send`); search always-fresh even with a pre-existing `activeSessionId`; message→create-then-send-raw when no active session; message reuses session when one exists; both-present→only search fires (single `createSession`/`send` call, single `replace` call); one-shot `replace` preserves unrelated query params (`tab=x`) while stripping `search`/`message`; `?skill=` stashes `pendingSkillId` without sending.
  - `EmptyState.test.ts`: replaced the `pendingPrompt`+toast assertion with a `vi.spyOn(store, 'send')` assertion (non-empty string argument).
  - `UserMessage.test.ts`: added a new test mounting a wrapper component that `provideAgentStore()`s a `useAgentStore('photos')` instance (with a *different* `activeSessionId` than the default `'general'` store) and asserts `UserMessage` resolves attachment URLs against the *provided* session id, not a hardcoded `'general'` one.
- After edits: `pnpm test -- AgentPage EmptyState UserMessage agentStore parity` → 6 files / 75 tests, all green.
- Full suite: `pnpm test` → 233 files / 1470 tests, all green (no regressions elsewhere).
- `pnpm exec vue-tsc --noEmit` → clean, no errors.

## Files changed
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/stores/agentStore.ts`
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/stores/agentStore.test.ts`
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/views/AgentPage.vue`
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/views/AgentPage.test.ts`
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/components/stream/EmptyState.vue`
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/components/stream/EmptyState.test.ts`
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/components/stream/UserMessage.vue`
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/ai/components/stream/UserMessage.test.ts`
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/i18n/zh_cn.ts`
- `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/src/i18n/en_us.ts`

## Self-review

- **Both flows correct**: `search` uses `createSession()` unconditionally (verified by a dedicated test where `activeSessionId` is pre-set and `createSession` still fires exactly once); `message` uses the `if (!store.activeSessionId)` guard (verified both branches: reuse when set, create when absent).
- **Wrap vs raw**: `search` goes through `t('ai.searchMyNas', { query })`; `message` is passed to `store.send()` untouched — asserted literally in tests (`'在我的 NAS 中搜索"cats"。'` vs `'hi'`).
- **Fresh vs reuse**: covered above.
- **One-shot strip**: `router.replace` is called with a `query` object that has both `search` and `message` deleted (verified it preserves unrelated keys like `tab`), and it happens before the create/send branch runs — a refresh re-mounting `AgentPage` with the already-stripped URL will not see `seedSearch`/`seedMessage` again.
- **No `await store.selectSession(...)` anywhere in the auto-send path** — only `createSession()` is called, which does not attach/await a stream the way `selectSession` does. Confirmed by reading `agentStore.ts`'s `createSession()` (no `attachAgentStream` call) vs `selectSession()` (which does `await attachAgentStream(...)`).
- **Debt ③ seam restored**: `UserMessage.vue` now resolves via `useProvidedAgentStore()`; test proves a provided `'photos'` store's session id is used, not the default `'general'` one. Audited `AgentPage.vue` (correctly the provider root, stays on `useAgentStore()`) and `EmptyState.vue` (now consumer via `useProvidedAgentStore()`) for consistency — no remaining hardcoded `useAgentStore()` call in a component that could be embedded under a different profile.
- **`pendingPrompt` fully removed**: grepped the whole `src/` tree afterward — zero live references, only two historical prose comments mention the old name for context (in `EmptyState.vue`'s header comment and `agentStore.test.ts`'s dropped-assertion note).

## Concerns

- The unused `aiComingSoon` i18n key (zh_cn/en_us) is now orphaned — no component references it anymore after this task. The brief didn't ask to delete i18n keys and `parity.test.ts` doesn't flag unused keys, so I left it in place rather than risk an out-of-scope removal; flagging for whoever does i18n cleanup later.
- `t('ai.searchMyNas', ...)` relies on vue-i18n's exact-key-first resolution behavior for a flat key containing a literal dot, which I confirmed empirically via a throwaway probe test (not committed) rather than reading through the full intlify resolver source to prove it as a documented guarantee. It works today (all tests pass, including the real zh_cn locale file), but it's a slightly unusual key-naming choice for this codebase's otherwise all-camelCase, non-nested locale files — worth a note if a future refactor of the resolver internals ever changes that lookup order.
- Per the brief, the `router.replace` call in the auto-send branch is NOT wrapped in try/catch (matches the brief's pseudocode verbatim, unlike the pre-existing P1a code which had `.catch(() => {})`). If `router.replace` ever rejects in production, `onMounted`'s async function would throw past the point where sends are guarded — this is what the brief specified, so I kept it, but it's a minor asymmetry with the rest of the swallow-per-call style in this file.
