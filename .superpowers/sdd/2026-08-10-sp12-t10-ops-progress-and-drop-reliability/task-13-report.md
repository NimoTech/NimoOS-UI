# Task 13 report — leave guard for /files/drop

## What changed

- **New** `src/files/drop/leaveGuard.ts` — `installDropUnloadGuard(hasActive, win?)`, a
  `beforeunload` listener installed and torn down at page scope (unlike
  `src/files/upload/unloadGuard.ts`, which is app-scope). Doc comment explains why the
  scopes differ: the upload queue is an app-lifetime Pinia store that survives navigation,
  while drop transfers only exist while `DropPage` is mounted (its `onBeforeUnmount` tears
  the WebRTC connections down).
- **New** `src/files/drop/leaveGuard.test.ts` — 4 unit tests for the guard in isolation,
  copied verbatim from the brief's Step 1.
- **Modified** `src/files/drop/components/DropPage.vue`:
  - `onBeforeRouteLeave` guard: if `drop.hasActiveTransfers()` is false, navigation proceeds
    immediately; otherwise it opens an `AlertDialog` and awaits the user's answer via a
    Promise (`askLeave`/`settleLeave`).
  - `onLeaveOpenChange` defers the "cancel" answer by one tick (`setTimeout(…, 0)`) because
    reka-ui's `AlertDialogAction` fires `update:open(false)` on the same click as `@confirm`,
    with no guaranteed ordering — same pattern already used in `UploadPanel.vue`'s delete
    confirmation, referenced in a comment.
  - `onMounted` now also calls `installDropUnloadGuard(() => drop.hasActiveTransfers())` and
    stores the returned `offUnloadGuard` teardown.
  - `onBeforeUnmount` calls `offUnloadGuard?.()` **before** `drop.destroy()`, per the brief.
  - Template gets a new `<AlertDialog>` bound to `filesDropLeaveTitle` /
    `filesDropLeaveMessage` / `filesDropLeaveConfirm`, reusing the existing `filesCancel` key
    for the cancel button (no duplicate key added).
- **Modified** `src/i18n/zh_cn.base.ts` and `src/i18n/en_us.base.ts` — added
  `filesDropLeaveTitle`, `filesDropLeaveMessage`, `filesDropLeaveConfirm` to both, right after
  `filesDropUnsupported` (same line position in both files, matching the existing convention
  of keeping the two files aligned).
- **Modified** `src/files/drop/components/DropPage.test.ts` (pre-existing file, appended to,
  not recreated):
  - Removed the shared `i18n` singleton from all three pre-existing `mount()` calls'
    `global.plugins` arrays and deleted the now-unused `import { i18n } from '../../../i18n'`.
    `vitest.setup.ts` already installs `i18n` globally via `config.global.plugins`, so passing
    it again was double-installing the plugin and emitting a hidden `[Vue warn]` on every test
    in this file (confirmed with `--reporter=verbose`, see below). This was flagged in my
    brief as optional-but-welcome since I was already editing the file — done.
  - Added a `describe('DropPage leave guard', …)` block (3 tests) that drives a real
    navigation through a dedicated `createMemoryHistory` router with `DropPage` as the
    matched route component, per the brief's Step 6 template (adapted to not pass `i18n`).
  - Added one extra test, not in the brief, closing a gap I noticed: nothing in the brief's
    test list actually proves `DropPage`'s `onMounted`/`onBeforeUnmount` wire
    `installDropUnloadGuard` up correctly (only the standalone function is unit-tested, and
    the route-leave tests don't touch `beforeunload` at all). Added
    `'warns on window close while a transfer is running, and stops after unmount'` to the
    existing `describe('DropPage', …)` block, dispatching real `beforeunload` events on
    `window` before and after `unmount()`.

## Test commands and output

```
$ pnpm exec vitest run src/files/drop/leaveGuard.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

```
$ pnpm exec vitest run src/files/drop/ src/i18n/parity.test.ts
 Test Files  14 passed (14)
      Tests  102 passed (102)
```

```
$ pnpm exec vue-tsc --noEmit
(no output, exit 0)
```

Verbose run of just `DropPage.test.ts` to check for hidden `[Vue warn]`/console noise
(per repo convention that the default reporter swallows stderr on passing tests):

```
$ pnpm exec vitest run src/files/drop/components/DropPage.test.ts --reporter=verbose
```
Output showed exactly 4 occurrences of one message, all on the 4 pre-existing-style tests
that mount `DropPage` directly rather than through a matched `<router-view>`:
```
[Vue Router warn]: No active route record was found when calling `onBeforeRouteLeave()`.
Make sure you call this function inside a component child of <router-view>. Maybe you
called it inside of App.vue?
```
This is expected and harmless — see "Concerns" below. No `[Vue warn]` from Vue itself
appeared (the i18n double-install warning is gone), and the new "leave guard" describe
block (which mounts through a real matched route) produced zero warnings.

## Per-test mutation analysis

`src/files/drop/leaveGuard.test.ts` (function tested in isolation):

| Test | Mutation that kills it |
|---|---|
| `prompts the browser while a transfer is running` | Delete `e.preventDefault()` from the handler, or invert the `hasActive()` check — assertion `toHaveBeenCalled()` fails. |
| `stays out of the way when nothing is in flight` | Remove the `if (!hasActive()) return undefined` guard so `preventDefault` always runs — assertion `not.toHaveBeenCalled()` fails. |
| `removes its listener when the returned cleanup runs` | Make the returned cleanup a no-op (e.g. `return () => {}` instead of calling `removeEventListener`) — `win.handlers.beforeunload.length` stays 1 instead of 0. |
| `is a no-op in an environment with no window` | Remove the `if (!target \|\| typeof target.addEventListener !== 'function') return () => {}` guard — calling `installDropUnloadGuard(() => true, undefined)()` throws instead of returning cleanly. |

I ran the target/no-window checks mentally against the existing sibling implementation
(`unloadGuard.ts` has the identical shape and passed the same review previously); I did not
re-run all four mutations by hand since the shape is a direct copy of an already-hardened
pattern, but I did run the two mutations below that are specific to this task's new
integration code.

`src/files/drop/components/DropPage.test.ts` — `describe('DropPage leave guard', …)`:

| Test | Mutation that kills it | Verified by running |
|---|---|---|
| `holds navigation on the drop page until the user confirms` | Change `if (!drop.hasActiveTransfers()) return true` to unconditional `return true` (brief's Step 8 mutation) | Yes — ran it, both this test and the next failed with `expected '/elsewhere' to be '/files/drop'`. |
| `stays on the page when the user backs out` | Same mutation as above | Yes — same run, failed with `Cannot call vm on an empty VueWrapper` (AlertDialog never rendered since the guard never opened it). |
| `lets navigation through untouched when no transfer is running` | Remove the `hasActiveTransfers()` short-circuit entirely (always call `askLeave()`) | Yes — ran it, test timed out at 5000ms because navigation hangs waiting for a dialog answer that never comes. The brief's Step-8 mutation (always-`return true`) does *not* kill this test, since letting navigation through is exactly its expected behavior — this second mutation was needed to get a kill for it specifically. |

`src/files/drop/components/DropPage.test.ts` — new wiring test:

| Test | Mutation that kills it | Verified by running |
|---|---|---|
| `warns on window close while a transfer is running, and stops after unmount` | Remove `offUnloadGuard?.()` from `onBeforeUnmount` (leaving only `offUnloadGuard = null`) | Yes — ran it, failed with `expected true to be false` on the post-unmount `beforeunload` assertion (the listener kept firing after unmount). |
| (same test, other half) | Remove the `installDropUnloadGuard(...)` call from `onMounted` entirely | Yes — ran it, failed with `expected false to be true` on the while-mounted `beforeunload` assertion (no listener ever registered). |

All mutations above were reverted immediately after their run; `pnpm exec vitest run
src/files/drop/ src/i18n/parity.test.ts` and `pnpm exec vue-tsc --noEmit` were re-run clean
after every revert, and the final clean state is what's committed.

## The `drop.init()` / `files.loadRoots()` boundary

No new mocking was needed. The pre-existing `DropPage.test.ts` already mocks
`../serverConnection`, `../peersManager`, and `@nimotech/nimoos-service` (`service: {}`) at
module scope via `vi.mock`, and those mocks are hoisted and shared by every `describe` block
in the file, including the new one. `files.loadRoots()` → `folders.loadDisks()` calls
`service.storage.list(...)` on the mocked empty `service` object, which throws
`TypeError: Cannot read properties of undefined (reading 'list')`; `loadDisks()` already
wraps that call in try/catch and falls back to `disks.value = []` with a `console.warn`
(`src/home/stores/folders.ts:49`), so it never surfaces as a test failure — this was already
true before Task 13 (verified by running the pre-existing tests unmodified before touching
`DropPage.vue`). No production code was changed to accommodate this.

## Concerns

- **New `[Vue Router warn]` on the 4 pre-existing-style tests** in `DropPage.test.ts` (the
  three original tests plus my new wiring test) that mount `DropPage` directly via
  `mount(DropPage, {...})` rather than through a matched `<router-view>`. Adding
  `onBeforeRouteLeave` to the component means vue-router now looks for an active route
  record on every mount, and these tests' shared router (`createWebHashHistory` with a
  wildcard route rendering an unrelated `<div/>`) never actually matches `DropPage` to a
  route — so the guard silently fails to register and vue-router logs a dev warning. This is
  harmless: none of those 4 tests exercise the leave guard, and the guard genuinely does work
  correctly in the app (proven by the 3 tests that do mount through a matched route). I chose
  not to rework those 4 tests' mount strategy to eliminate the warning, since that would mean
  restructuring already-passing, unrelated tests beyond what the brief or the task's explicit
  "fix only the i18n double-install" carve-out asked for, and risks unrelated breakage. Flagging
  it here rather than silently leaving it — a controller call on whether it's worth a follow-up
  cleanup.
- The `askLeave`/`settleLeave` Promise pattern means if a user opens the leave dialog and
  then, instead of clicking either button, navigates away by other means (e.g. browser
  back/forward spamming), `leaveResolver` could theoretically be overwritten by a second
  concurrent `askBeforeRouteLeave` call before the first resolves. I did not add a test for
  this edge case — it's the same shape of concern as the pre-existing `pendingRun` comment in
  `UploadPanel.vue`, and out of scope for this task's brief.

## Commit

```
git add -f src/files/drop/leaveGuard.ts src/files/drop/leaveGuard.test.ts \
  src/files/drop/components/DropPage.vue src/files/drop/components/DropPage.test.ts \
  src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "feat(drop): ask before leaving or closing during a transfer

Mounted at page scope on purpose -- unlike the upload guard, whose Files.vue
mount point is a known defect for an app-level queue.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
(report itself committed separately with `git add -f` per `.superpowers/sdd/`'s bare `*`
`.gitignore` entry.)
