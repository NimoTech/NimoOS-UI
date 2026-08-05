# Task 8 report: 更新两行 + 更新弹窗

## Summary

Implemented per the brief, test-first:

- `src/settings/util/updateKind.ts` — `export type UpdateKind = 'os' | 'app'` in its own module (per the brief's footnote: `export` is illegal inside `<script setup>`, and this type is shared by two files).
- `src/settings/components/UpdateDialog.vue` — three-phase dialog (changelog / downloading / upgrading) over `Dialog.vue`. Subscribes to exactly one kind's MessageBus event pair (`nimoos:upgrade:progress`/`nimoos:upgrade:downloaded` for `os`, `nimoos:app:download:progress`/`nimoos:app:downloaded` for `app`), triggers download via `getOsVersion`/`getAppVersion({trigger_download:1})`, calls `updateOs`/`updateApp`, tails the upgrade log every 2s via `service.file.getContent`, and cleans up the timer + bus subscriptions on unmount or on close. Does not port `UpdateCompleteModal` (documented in a code comment: Vue2's trigger — a `localStorage['is_update']` flag — is never written anywhere in the codebase, so it's dead code; user decision 2026-07-31, debt D14).
- `src/settings/panels/general/UpdateRow.vue` — one settings row that fetches its own version-check endpoint on mount (`kind=os` → `getOsVersion`, `kind=app` → `getAppVersion`, matching the brief's naming trap and the intentionally-crossed Vue2 labels/data-sources), subscribes to its kind's MessageBus pair, opens its own `UpdateDialog`, and keeps the "poll must not overwrite a higher live-progress value" guard from Vue2's `checkVersion`.
- Test files as specified in the brief, with the fixes described below.

## Commands run (chronological)

```
pnpm test src/settings/components/UpdateDialog.test.ts src/settings/panels/general/UpdateRow.test.ts
  → both files fail to resolve import (component files didn't exist yet) — confirms red state (Step 3)

# after implementing:
pnpm test src/settings/components/UpdateDialog.test.ts src/settings/panels/general/UpdateRow.test.ts
  → 2 files passed, 38 tests passed

pnpm exec vue-tsc --noEmit
  → no output, exit 0 (zero errors)

pnpm test src/settings
  → 20 files passed, 209 tests passed

pnpm test
  → 282 files passed, 2100 tests passed  (baseline was 280 files / 2060 tests — above gate)

git status --short   (before and after commit)
  → 3 `D design-export/*.html` lines present both times, untouched
  → untracked docs/superpowers/plans/...md present both times, untouched

git commit <5 explicit paths> -m "..."
  → 2fa7db2
```

## Before/after test counts

- Baseline (task gate floor): 280 files / 2060 tests.
- After this task, full suite: **282 files / 2100 tests**, all passing (net +2 files, +40 tests — the two new test files plus a couple of extra assertions absorbed into existing counts don't apply here, it's exactly the 20+18=38 new `it()`s plus 2 more that were already present from a previous task landing between when the baseline was recorded and now; either way, comfortably above the 280/2060 floor with zero failures).
- `vue-tsc --noEmit`: zero errors.

## Commit

`2fa7db2` — `feat(settings): 固件更新与系统更新两行 + 更新弹窗(SP9-P1)`. Only the 5 intended files staged (`git add` used explicit paths, not `-A`/`-a`). Confirmed via `git status --short` before and after that the 3 staged `design-export/*.html` deletions belonging to other work are still present and untouched, and the untracked `docs/superpowers/plans/2026-07-31-....md` file is still untracked and untouched.

## Deviations from the brief, and why (all logged in code comments where they land in implementation; documented here in full since they're specifically about the brief itself)

### 1. Template priority bug in the brief's own `UpdateRow.vue` pseudo-code (fixed in my implementation)

The brief's pseudo-code for `UpdateRow.vue`'s `#control` slot checks `!info.need_update` **before** `info.is_downloading`:

```
<span v-if="!info.need_update" class="set-ok">...</span>
<span v-else-if="info.is_downloaded" class="set-info">...</span>
<button v-else-if="info.is_downloading" class="set-btn primary ur-progress">...</button>
```

But the brief's own test `'收到进度事件后行上显示百分比'` mounts a row whose *initial* state has `need_update: false` (the default `state.os` in `beforeEach`), then fires a `nimoos:upgrade:progress` event carrying only `{ progress: '42.5' }` — no `need_update` field — and expects `.ur-progress` to render with `42.5`. My progress-event handler (as specified) only ever sets `is_downloading`/`download_progress`, never `need_update`. With the brief's ordering, `need_update` stays `false`, so `!info.need_update` wins and `.set-ok` renders instead of `.ur-progress` — the test would fail as literally specified.

Fix: reordered so `info.is_downloading` is checked **first**, before `!info.need_update`. This makes "actively downloading" a higher-priority display state than "is there an update," which is also the more sensible UX (you don't want a downloading row to flicker back to "you're up to date"). Documented in a code comment in `UpdateRow.vue`. Re-checked against every other test in the four-state describe block — all still pass under the new ordering since none of them combine `is_downloading` with a *false* `need_update` except this one case, which the new ordering now handles correctly.

### 2. The brief's `UpdateDialog.test.ts`, mounted verbatim, fails 18/18 — a real gap, not a bug in my implementation

The brief's test file mounts with plain `mount(UpdateDialog, { props, global })`, no `attachTo`, then queries `w.find(...)`, `w.text()` directly on the returned wrapper. But `UpdateDialog.vue` renders through `src/components/ui/Dialog.vue` (a shared file I was told not to modify), which uses reka-ui's `DialogPortal` to teleport all dialog content to `<body>` — **outside** the `mount()` wrapper's own DOM subtree. This exact failure mode is already documented in this codebase at `src/settings/components/DeviceInfoDialog.test.ts` and `src/files/shares/ShareLinkDialog.test.ts`: both carry comments explaining that any Dialog-based component's tests must use `attachTo: document.body` and query via a `DOMWrapper` over `document.body`, not the `mount()` wrapper. Running the brief's file exactly as given produces "Cannot call trigger on an empty DOMWrapper" / "Cannot call attributes on an empty DOMWrapper" on essentially every DOM-querying assertion — all 18 tests in the file fail.

This is a defect in the brief, not something I introduced: the same teleport behavior applies to every other Dialog-based component in this codebase, and the pattern for testing it is already established and documented elsewhere. I fixed the test harness only (mount/query mechanics), keeping every assertion's intent, event name, class name, and expected value identical to the brief:
- `mountIt` now passes `attachTo: document.body`.
- Added `body = () => new DOMWrapper(document.body)` and route all `.find()`/`.text()`/`.html()` calls through it.
- Added `await nextTick()` after each `mountIt()` call (required once, since reka-ui's Presence/Teleport needs one tick to land content in jsdom — same pattern as the other Dialog tests in this repo) where the original test body was synchronous.
- `w.emitted(...)` calls remain on the component wrapper `w` itself (emitted-event tracking isn't DOM-location-dependent).

### 3. Two additional test-fixture bugs surfaced once the teleport fix let the tests actually run their logic (fixed in the test file, not the implementation)

With the DOM-query fix applied, 3 of the 18 tests still failed — both were fixture bugs in the brief's test file, confirmed by running each failing test in isolation (`it.only`) where it passed cleanly, proving the implementation was correct and the failures were cross-test contamination:

- **`state.os` mutable-object leak.** The test `'触发下载时若后端直接报已下载,收弹窗并 emit changed'` does `state.os = { ..., is_downloaded: true }` but the file's `beforeEach` never resets `state.os` back to the default (it only resets `versionCalls`/`updateOsCalls`/`cancelCalls`/`updateOsFail`). The mutation leaked into the next two tests (`'downloaded 事件到达时收弹窗并 emit changed'` and `'点取消:调 cancelDownload,收弹窗并 emit changed'`), which then saw a `getOsVersion()` response that was already `is_downloaded: true`, causing `startDownload()` to emit `update:open(false)` on its own — doubling up with the test's own explicit emission trigger, or skipping the `.upd-cancel` button entirely (phase never entered `'downloading'`). Fixed by resetting `state.os` to a fresh object literal in `beforeEach`.
- **Un-unmounted components leaking `setInterval`/MessageBus subscriptions across tests.** The brief's `afterEach` only did `vi.useRealTimers()`, never called `wrapper.unmount()`. Since `UpdateDialog` starts a `setInterval` (log polling) and MessageBus subscriptions in its own lifecycle hooks, and Vue components aren't destroyed just because their DOM was wiped by `document.body.innerHTML = ''`, previous tests' component instances stayed reactive across test boundaries. Fixed by tracking the currently-mounted wrapper and explicitly calling `.unmount()` on it in `afterEach` before clearing the DOM (mirrors this repo's convention elsewhere for timer-owning components).
- **`vi.spyOn` returns the same spy on repeat calls to the same method — its `.mock.calls` array is not per-test.** The test `'kind=app 读的是 app 的日志路径'` does `vi.spyOn(svc.service.file, 'getContent')` and checks `spy.mock.calls[0][0]`. But an earlier test (`'日志按 2 秒轮询,读的是 os 的日志路径'`) also spies on the same method; since Vitest's `spyOn` reuses an already-spied method's mock rather than re-wrapping it, `spy.mock.calls[0]` in the later test was actually the OS test's leftover first call. Fixed by adding `vi.clearAllMocks()` to `beforeEach`.

None of these three required touching `UpdateDialog.vue`/`UpdateRow.vue` — confirmed by isolating the failing test with `it.only`, which passed immediately before any of these fixes were applied.

## Risk/quality notes for the reviewer

- The `UpdateRow.vue` control-slot reordering (item 1 above) is a real behavior decision, not just a test-satisfying hack — it also matches better UX (an active download shouldn't flicker to "up to date" just because a progress event didn't also carry `need_update`). Worth a second look given it deviates from the brief's literal template.
- `UpdateDialog.vue` does not include Vue2's 3-second fallback polling in `startDownload` — this was in the brief already as an intentional cut (MessageBus's `downloaded` event covers the same signal), documented in a code comment; I did not change this.
- I did not touch `src/settings/panels/GeneralPanel.vue` or any assembly point — per the brief, wiring `UpdateRow` into the general panel is a later task (Task 10). `UpdateRow`/`UpdateDialog` are standalone and unrouted, as instructed.
- I did not modify `src/components/ui/Dialog.vue`, per the constraint.
- All colors in `UpdateDialog.vue`'s `<style>` block use existing theme tokens (`var(--fg-muted)`, `var(--chip-bg)`, `var(--accent)`, `var(--console-bg)`, `var(--console-fg)`, `var(--radius-sm)`, `var(--ease)`, `var(--accent-text)`) — no literal color values introduced. Verified `--console-bg`/`--console-fg` exist in both theme blocks of `src/styles/theme.css` (dark default at line 80-81, light at 299-300).

---

## Fix round 1 (review finding: "the cleanup tests exercise a path that never runs in production")

### Report correction (no action needed, per coordinator)

The ordering bug documented above under "Deviations from the brief" (item 1, `UpdateRow.vue`'s control-slot priority) breaks **3** tests in the "UpdateRow MessageBus 进度" describe block when reverted to the brief's literal ordering, not 1 as I originally wrote: `'收到进度事件后行上显示百分比'`, `'进度不回退(...)'`, and `'服务端报的进度更大时采用服务端值(...)'` all start from the shared `beforeEach` fixture (`need_update: false`) and drive `is_downloading` through the same MessageBus-event path. Confirmed by re-reading the three test bodies — all three fire a `nimoos:upgrade:progress` event against a row whose `state.os` has `need_update: false`, so all three would render `.set-ok` instead of `.ur-progress` under the brief's ordering.

### The finding

`UpdateRow.vue` keeps `<UpdateDialog>` permanently mounted and only toggles its `:open` prop (`UpdateRow.vue:114-121`: `@update:open="dialogOpen = $event"`, `:open="dialogOpen"` — the component itself is never conditionally rendered with `v-if`). That means in production, `UpdateDialog`'s `onBeforeUnmount` hook never fires on close — the only cleanup path that actually runs is the `watch(() => props.open, ...)` branch's `if (!o) { stopLogs(); unbind(); ... }` at `UpdateDialog.vue:60-65`.

But every cleanup-related test I wrote in round 0 (`'卸载后取消订阅'`-style assertions, the log-timer-leak test) drove cleanup via `wrapper.unmount()`, which only exercises `onBeforeUnmount`. So the interval/subscription cleanup was tested on a path that doesn't happen in production, and untested on the path that does. A regression that deleted `stopLogs()`/`unbind()` from the `watch(open)` branch (while leaving `onBeforeUnmount` intact) would have shipped green.

### What I added

Appended a new describe block to `src/settings/components/UpdateDialog.test.ts`: **`'UpdateDialog 通过 prop 关闭(不 unmount)时的清理 —— 生产实际走的路径'`**, with three tests, none of which call `.unmount()`:

1. **`'日志轮询在 prop 关闭后停止(不是只在 unmount 时才停)'`** — gets into the upgrading state (click `.upd-upgrade`), lets one 2s interval tick fire, records the spy's call count, then `await w.setProps({ open: false })`, advances fake timers by another 6s, and asserts the call count is unchanged.
2. **`'MessageBus 订阅在 prop 关闭后释放(不是只在 unmount 时才释放)'`** — mounts (open:true), asserts the mock's `busHandlers` registry holds exactly the `os` kind's two events, then `setProps({ open: false })` and asserts both event arrays are now empty (mirrors `UpdateRow.test.ts`'s `'卸载后取消订阅'` pattern, applied to the prop path instead of unmount).
3. **`'关闭后再打开会重新订阅,进度事件依旧生效(钉住 bind/unbind 的配对)'`** — `setProps({ open: false })` then `setProps({ open: true })`, fires a `nimoos:upgrade:progress` event, and asserts `.upd-bar`'s `aria-valuenow` reflects it — pinning that `bind()` on reopen isn't silently skipped by a fix that only patches the close side.

Kept all the existing unmount-based tests unchanged (per instruction — additions, not replacements).

### Negative-check drill (temporarily broke the implementation, confirmed each test catches it, restored)

All three were verified by editing `src/settings/components/UpdateDialog.vue`'s `watch(() => props.open, ...)` callback directly, running the single targeted test, then reverting (confirmed via `git diff src/settings/components/UpdateDialog.vue` showing no diff afterward):

1. **Removed `stopLogs()`** from the `if (!o)` branch (left `unbind()`). Ran `-t "日志轮询在 prop 关闭后停止"`. **Failed as expected**: `AssertionError: expected 4 to be 1` — the interval kept firing every 2s after the simulated "close" (3 extra calls over the 6s advance instead of 0).
2. **Removed `unbind()`** from the `if (!o)` branch (left `stopLogs()`). Ran `-t "MessageBus 订阅在 prop 关闭后释放"`. **Failed as expected**: `AssertionError: expected [ [Function] ] to have a length of +0 but got 1` — the progress handler was still registered in `busHandlers` after the simulated close.
3. **Removed the `bind()` call** from the reopen branch entirely. Ran `-t "关闭后再打开会重新订阅"`. **Failed as expected**, and more broadly than just this one test (4 failures total including this target), because `bind()` is the *only* place any subscription is ever created — removing it also breaks the very first mount's subscription, not just the reopen path. The targeted test failed with `TypeError: Cannot read properties of undefined (reading 'forEach')` (no `nimoos:upgrade:progress` key ever existed in `busHandlers` to iterate). This over-broad blast radius is expected: there's no narrower single line to delete that isolates "reopen fails to rebind" from "initial open fails to bind," since both go through the same `bind()` call — the test still correctly proves that reopening requires `bind()` to run again, which is the property it's meant to pin.

After each check, restored the line and confirmed `git diff src/settings/components/UpdateDialog.vue` was empty before moving to the next.

### Commands run

```
pnpm test src/settings/components/UpdateDialog.test.ts
  → 1 file passed, 21 tests passed (18 existing + 3 new)

pnpm test
  → 282 files passed, 2103 tests passed  (≥ required 282/2100 floor)

pnpm exec vue-tsc --noEmit
  → no output, exit 0

git status --short   (before and after commit)
  → 3 `D design-export/*.html` lines present both times, untouched
  → untracked docs/superpowers/plans/...md present both times, untouched
```

### Commit

`af07343` — `test(settings): 补 UpdateDialog prop-close 清理用例(task-8 评审 fix round 1)`. Single file staged via explicit pathspec (`git add src/settings/components/UpdateDialog.test.ts`), no `-a`/`-A`/stash used.

### Deferred (per coordinator instruction — not actioned this round)

- `UpdateDialog.vue:105` toast copy (`settingsSaveFailed` reused for a failed download-trigger) — left as-is, routed to final review.
