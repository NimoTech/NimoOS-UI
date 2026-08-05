# P1c2 Task 5 report — settle 1c-1's three deferred debts

Commit: `4f3e5c8` — `SP8-P1c2: settle 1c-1 debts (chip w/o id, staged reactivity, popSegment assertion)`

## Debt 1 — chip without id cannot be removed

**Files:** `src/ai/stores/agentStore.ts` (new action), `src/ai/components/shell/AgentComposer.vue` (`removeChip`), tests in `agentStore.p1c.test.ts` and `AgentComposer.test.ts`.

New store action:

```ts
async function removeVisibleResourceByPath(path: string): Promise<void> {
  await loadVisibleResources()
  const found = visibleResources.value.find((r) => r.path === path)
  if (found && found.id !== undefined) {
    await removeVisibleResource(found.id)
  } else {
    removeVisibleResourceFromList(path)
  }
}
```

Comment written above it (full text in the diff) explains: Vue2 `agentStream.js:539-542` never carries an id on this stream event, so Vue2's `removeChip` calls `removeVisibleResource(undefined)` unconditionally — broken but *visible* (hits `/visible-resources/undefined`, fails, surfaces via Vue2's own `catch { toastError(e) }`). 1c-1's port instead guarded `id === undefined` and no-op'd silently — worse than Vue2, not better. The fix refreshes the server-side list first (it always has real ids), finds by path, deletes by id if still present, or drops the stale local entry if the server has already forgotten it (no error — the end state the user wanted is already true).

Composer change:

```ts
async function removeChip(c: { id?: string | number; path: string }) {
  try {
    if (c.id !== undefined) {
      await store.removeVisibleResource(c.id)
    } else {
      await store.removeVisibleResourceByPath(c.path)
    }
  } catch (e) {
    toastError(e)
  }
}
```

**Why this shape is right:** it keeps the existing id-path behavior byte-for-byte (still tested by the pre-existing "visibleResources 渲染成 chip,× 调 store.removeVisibleResource" case), adds exactly one new branch for the id-less case, and both branches share the same error surface (`toastError`/`aiAuthFailed`) so the two paths behave consistently from the user's perspective — clicking × either removes the chip or shows the same kind of error toast, never a silent no-op.

**RED (before implementing `removeVisibleResourceByPath` / composer wiring):**
```
FAIL src/ai/stores/agentStore.p1c.test.ts > removeVisibleResourceByPath:先刷新拿到服务端 id,再按 id 删除
TypeError: s.removeVisibleResourceByPath is not a function
FAIL src/ai/stores/agentStore.p1c.test.ts > removeVisibleResourceByPath:刷新后服务端已无该项,只清本地(不调删除 API)
TypeError: s.removeVisibleResourceByPath is not a function
FAIL AgentComposer.test.ts > 无 id 的 chip 点 × 调 store.removeVisibleResourceByPath(而非静默无反应)
AssertionError: expected "wrappedAction" to be called with arguments: [ '/DATA/agent-added' ] — Number of calls: 0
FAIL AgentComposer.test.ts > 无 id 的 chip 删除失败时走 toastError(与有 id 分支一致)
AssertionError: expected +0 to be 1
```

**GREEN:** all 4 new tests pass (see combined tail below).

## Debt 2 — staged-changes reducer reactivity hazard

**File:** `src/ai/stores/agentStore.ts`, `appendStagedChange`.

```ts
if (!group) {
  group = { run_id: runId, created_at: Date.now() / 1000, items: [] }
  stagedChanges.value.push(group)
  // ... comment (full text in diff) ...
  group = stagedChanges.value[stagedChanges.value.length - 1]
}
```

Comment explains the mechanism precisely: `stagedChanges.value.push(group)` pushes the *raw* object; that push itself does trigger Vue reactivity (dependents on the array/its length are notified), but the pushed element only becomes a tracked reactive proxy lazily, on first read-back through the array. Continuing to mutate the local `group` variable (the raw reference) bypasses the proxy's set trap entirely — no `trigger()` fires for that specific mutation. A `flush: 'sync'` watcher that already depends on `items.length` (which the staged-changes UI landing later this phase will need) would never see the item land.

**Why this shape is right:** it's the minimal fix — reassign `group` to the proxied element pulled back out of the array right after the push, so every subsequent `.items` mutation in this function call goes through the reactive proxy. No behavior change for any existing caller; only the notification path is corrected.

**RED (test written first, real reactivity probe, not a mock):**
```ts
it('appendStagedChange:新组首个 item 的入列必须经过响应式代理通知(flush:sync 侦听器需同步看到 length=1,而非卡在 0)', () => {
  const s = useAgentStore('t1f')
  const seen: number[] = []
  watch(
    () => (s.stagedChanges[0] ? s.stagedChanges[0].items.length : -1),
    (len) => { seen.push(len) },
    { flush: 'sync' },
  )
  s.appendStagedChange({ run_id: 'rX', seq: 1, op: 'mkdir', path: '/a' })
  expect(seen).toContain(1)
})
```
```
FAIL appendStagedChange:新组首个 item 的入列必须经过响应式代理通知(...)
AssertionError: expected [ +0 ] to include 1
```
This confirms the hazard is real and observable, not theoretical: the synchronous watcher (registered on `stagedChanges[0].items.length` before the mutation) sees the group-creation notification (`0`) but never the item-push notification, exactly as described. Used Vue's own `watch(..., { flush: 'sync' })` rather than importing `@vue/reactivity` directly — the latter isn't a direct dependency in this pnpm-strict workspace (not linked at top-level `node_modules/@vue/`), while `watch` from `vue` gives an equivalent synchronous reactive-effect probe with zero new dependencies.

**GREEN:** test passes after the fix (see combined tail below).

## Debt 3 — missing assertion for popSegment's focus asymmetry

**File:** `src/ai/components/shell/AgentComposer.test.ts`.

Added three tests, using real `element.focus()`/`.blur()` (not `.trigger('focus')`, which only dispatches a synthetic event and does not move `document.activeElement`) against a component mounted with `attachTo: document.body` (already the default in this file's `mountComposer`):

```ts
it('pop-segment 之后不重新聚焦 textarea(与 drill-in/pick 的不对称,Vue2 412-428 特意如此)', async () => {
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
// + two control tests: 'drill-in 之后重新聚焦 textarea' and 'pick 之后重新聚焦 textarea',
// same shape, asserting document.activeElement === taEl afterward.
```

**Why this shape is right:** three tests instead of one — the pop-segment case alone doesn't prove the assertion means anything (it could be passing because focus was never being restored by *anything*, e.g. a broken test harness). The two control cases (drill-in, pick) prove the harness *can* detect a restored focus, so the pop-segment test's negative assertion is meaningful by contrast, and any future "helpful" edit that adds a stray `el.focus()` inside `popSegment()` will break exactly this test.

**Not RED in the classic sense:** no production code changed for this debt — `popSegment()` already correctly omits the focus call (per Vue2 `shell/AgentComposer.vue:412-428`). This is a characterization/pinning test, not a bugfix; it was written first, run, and observed passing immediately (confirming the intended existing behavior), which is what the brief asked for ("prove nothing pins this asymmetry" → now something does). The two control tests were similarly run and passed immediately, confirming they correctly detect the opposite behavior in `drillIn`/`pickItem`.

**GREEN (first run, no code change made for this debt):**
```
✓ pop-segment 之后不重新聚焦 textarea(与 drill-in/pick 的不对称,Vue2 412-428 特意如此)
✓ 对照组:drill-in 之后重新聚焦 textarea
✓ 对照组:pick 之后重新聚焦 textarea
```

## Combined final run

```
$ pnpm test -- src/ai/stores/ src/ai/components/shell/AgentComposer.test.ts
 Test Files  4 passed (4)
      Tests  151 passed (151)

$ pnpm exec vue-tsc --noEmit
(no output — 0 errors)
```

## Noticed but left alone

- `removeVisibleResourceByPath`'s "not found → local cleanup" branch does not distinguish "path was already removed by someone else" from "path never existed" — both collapse to the same no-op-locally outcome, which matches the brief's stated behavior and doesn't need finer granularity for this task.
- The i18n guard (`{'@'}` literal rule, zh_cn/en_us parity) was not implicated — no new user-facing strings were added; `toastError`/`aiAuthFailed` is reused as instructed.
- Did not touch `dispatchEvent.ts` — its `visible_resource_added` handler correctly still has no id in the payload; that asymmetry is inherent to the stream protocol and is exactly what `removeVisibleResourceByPath` was built to route around, not something to "fix" at the reducer level.
