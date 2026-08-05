# Task 12 report — AgentPage.vue: mount AgentComposer + ctxUsage state & 3 refresh triggers

## Files touched (only these two, per scope)
- `src/ai/views/AgentPage.vue`
- `src/ai/views/AgentPage.test.ts`

## Mount markup added (replaces the `<!-- 1b/1c: composer -->` comment)

```html
<!--
  Agent.vue:38-42 挂载契约 —— 1:1(props/emits 名与语义)。emit 处理器写成
  内联箭头函数、而不是像 Vue2 那样直接 `@send="store.actions.send"` 裸引用
  方法 —— Vue3 里裸方法引用会在渲染时把 `store.send` 这个函数值本身固化进
  vnode 的 onSend prop;此后若外部整体替换了 `store.send`(如测试用
  `vi.spyOn(store, 'send')`,底层走 `Object.defineProperty`,不经过 Vue
  reactive 的 set 陷阱,不会触发 AgentPage 重渲染),裸引用不会跟着变,仍会
  调到替换前的旧函数。内联箭头在**调用时**才去读 `store.send`,读到的是
  当前值,行为才和"调用方法当前实现"一致。
-->
<AgentComposer
  :busy="store.busy"
  :ctx-usage="ctxUsage"
  @send="(payload) => store.send(payload)"
  @stop="() => store.stop()"
  @send-init="(target) => store.sendInit(target)"
/>
```

Sits inside `<main>`, right after `MessageList`/`EmptyState`, matching Vue2 `Agent.vue:38-42`'s position (composer is the last child of `.main`, before the sibling `AgentRightPanel` which is still deferred).

**Deviation from the brief's literal Step-3 snippet** (`@send="store.send"` direct member-expression binding): the brief's own test 1 spies on `store.send`/`store.stop`/`store.sendInit` via `vi.spyOn` **after** `mountPage()` has already run. A direct member-expression binding (`@send="store.send"`) bakes the function *value* into the child vnode's `onSend` prop at render time; Pinia setup-store property replacement via `vi.spyOn` goes through `Object.defineProperty`, which is not intercepted by Vue's reactive `set` trap, so no re-render is triggered and the stale (real) action stays bound — confirmed by running the brief's literal snippet first and watching it fail with "0 calls" on the spy. Switching to inline arrow handlers (`(payload) => store.send(payload)`) makes the property read happen live at call time, which resolves it. This is a binding-style fix only; the prop/emit contract, names, and semantics are unchanged and still match Vue2's mount contract.

## ctxUsage implementation and its 3 triggers (mapped to Vue2 lines)

```ts
const ctxUsage = ref<{ tokens: number; window: number; pct: number } | null>(null)

let ctxUsageSeq = 0
async function refreshContextUsage() {
  if (!store.activeSessionId) return
  const seq = ++ctxUsageSeq
  try {
    const usage = (await service.ai.getContextUsage(
      store.activeSessionId,
      store.selectedModel as string,
    )) as { tokens: number; window: number; pct: number }
    if (seq === ctxUsageSeq) ctxUsage.value = usage
  } catch {
    if (seq === ctxUsageSeq) ctxUsage.value = null
  }
}

watch(() => store.activeSessionId, () => refreshContextUsage())      // Agent.vue:120-126 (ctxUsage part only)
watch(() => store.busy, (v, old) => {
  if (old === true && v === false) refreshContextUsage()
})                                                                     // Agent.vue:127-132, busy true→false edge only
```

- `Agent.vue:99` → `ctxUsage` ref, same shape/initial value (`null`).
- `Agent.vue:198-207` (`refreshContextUsage`) → ported verbatim: early-return with no session; passes the raw composite model key (`store.selectedModel`, e.g. `'local:llama3'`) not a bare model name; failure sets `ctxUsage.value = null`.
- `Agent.vue:154` (mounted, after `loadAvailableModels`) → called once at the end of the `try { loadAvailableModels() } catch {}` block, before the `?skill=`/`?search=`/`?message=` handoff logic — same order as Vue2.
- `Agent.vue:120-126` (session watcher) → ported, **ctxUsage half only**.
- `Agent.vue:127-132` (busy watcher) → ported, true→false edge only, no watcher on `selectedModel` (matches Vue2 — switching model does not auto-refresh usage).

## Vue2 defect fixed

`Agent.vue:198-207`'s `refreshContextUsage()` has no in-flight/staleness guard: two overlapping calls (e.g. a fast session switch, or a session switch racing a busy-edge refresh) can resolve out of order and leave `ctxUsage` showing a stale/wrong session's numbers. Fixed with a minimal monotonically-increasing `ctxUsageSeq` counter — each call captures its own sequence number at dispatch time, and only writes `ctxUsage.value` (success or failure) if it is still the most-recently-dispatched call by the time it resolves; a superseded (stale) result is silently discarded rather than overwriting. Comment placed directly above the counter and inside `refreshContextUsage` in `AgentPage.vue` citing `Agent.vue:198-207` and the 2026-07-27 port-discipline rule. Does not change call counts or trigger timing — verified against the brief's test 2, which asserts exact call counts across mount/session-switch/busy-edge and still passes.

## Deliberately left for 1c-2 (not ported)

- `loadSessionThinking` / `updateThinkingForModel` calls that live in Vue2's same `activeSessionId` watcher (`Agent.vue:122-123`) — ThinkingBar scope.
- `lastFallbackNotice` toast watcher (`Agent.vue:133-142`) — ModelPicker/ThinkingBar scope.
- `AgentRightPanel`, ModelPicker, ThinkingBar mounting — right panel stays permanently collapsed (`data-rightcollapsed="true"`) as it already was pre-task.
- Header comment block (lines 1-24) updated to document the Task 12 addition and explicitly flag what's still deferred to 1c-2.

## Tests

Brief's three test cases added verbatim to `AgentPage.test.ts`, plus `getContextUsage: vi.fn()` added to the hoisted `svc` mock.

RED (before implementation, composer not mounted):
```
pnpm test -- src/ai/views/AgentPage.test.ts
 ❯ src/ai/views/AgentPage.test.ts (14 tests | 3 failed) 219ms
     × 挂载 composer,并把 send/stop/send-init 接到 store
     × ctxUsage:挂载后拉一次;切会话拉一次;busy 由 true→false 再拉一次
     × ctxUsage:无会话不拉;请求失败置 null
 Tests  3 failed | 11 passed (14)
```
(First failure confirmed the exact brief-literal `@send="store.send"` binding also fails the same way for a different reason — see "Deviation" above — before being corrected to inline arrows.)

GREEN (after implementation):
```
pnpm test -- src/ai/views/AgentPage.test.ts
 Test Files  1 passed (1)
      Tests  14 passed (14)
```

Type check:
```
pnpm exec vue-tsc --noEmit
(no output — 0 errors)
```

## Noticed but left alone

- Mounting `AgentComposer` for the first time in this test file surfaces stderr `Message compilation error: Invalid linked format` / `Unexpected lexical analysis` warnings from vue-i18n, coming from `aiComposerPlaceholder: '问 Nimo，或输入 @ 引用文件…'` in `src/i18n/zh_cn.ts:695` — vue-i18n's compiler treats the bare `@` as the start of a linked-message token. This is a pre-existing string in a file outside this task's scope (owned by the composer's i18n keys, not touched here); it does not fail any test (compilation falls back and the placeholder still renders), so left untouched. Worth a follow-up ticket to escape the `@` (e.g. `{'@'}`) if the concurrent composer-review agent hasn't already flagged it.
- The gitignore-409 `AlertDialog` / `DialogPortal` theming caveat and other AgentComposer-internal notes documented in that file's own header comment are unrelated to this task and were not touched.
