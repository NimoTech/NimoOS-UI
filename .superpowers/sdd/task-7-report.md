# Task 7 Report: AppConsolePage + 路由 + 卡片入口

## Implemented

- `src/apps/views/AppConsolePage.vue` — new page at `/apps/:name/console`. Loads
  `service.compose.containers(id)` on mount; single-service apps hide the service `<select>`
  (`data-test="console-svc-select"`); multi-service apps default to `main` (fallback to the
  first key if `main` is missing/stale); switching the selector re-keys `<TerminalPane
  :key="containerId">` so the terminal reconnects against the new container. Two tabs
  (Terminal/Logs, `role="tablist"`); `LogsPane` lazy-mounts on first visit to the Logs tab
  (`v-if="logsVisited"`) and is then kept alive across tab switches via `v-show` so its 5s
  polling isn't interrupted. `containers()` returning `undefined`/empty, or throwing, both
  toast (`appsConsoleNotFound` / `appsConsoleLoadFailed`) and `router.push({name:'apps'})`.
  Page skeleton (AreaShell/AppsSidebar/back button/apps-layout classes) copied from
  `AppSettingsPage.vue` for visual consistency; title uses `InstalledApp.title` (verified
  field name in `stores/installedApps.ts`), falling back to the raw id.
- `src/apps/views/AppConsolePage.test.ts` — 4 tests per brief (single-service no picker;
  multi-service picker + switch; logs lazy-mount + v-show keep-alive; 404 → toast + push).
- `src/router/index.ts` — added `{ path: '/apps/:name/console', name: 'apps-console', component: AppConsolePage }` after the settings route.
- `src/apps/components/InstalledAppCard.vue` — added `console` emit + a "终端与日志"
  (`appsConsole`) menu item between Settings and Check-for-updates.
- `src/apps/components/InstalledAppCard.test.ts` — added the menu-item test case.
- `src/apps/views/InstalledAppsPage.vue` — wired `@console="router.push({ name: 'apps-console', params: { name: a.id } })"` next to the existing `@settings` handler.
- `src/i18n/zh_cn.ts` + `src/i18n/en_us.ts` — added `appsConsole`, `appsConsoleTerminal`,
  `appsConsoleLogs`, `appsConsoleNotFound`, `appsConsoleLoadFailed` (kept in parity).

## T6 integration constraint (mandatory, not in brief)

Applied via option 2 from the brief note: refactored the container-load logic into a
`load()` function that (a) **resets** `tab`, `logsVisited`, `info`, `selectedService` up
front, then (b) fetches `containers()`; called from `onMounted` **and** from
`watch(id, () => void load())`. Because vue-router reuses the `AppConsolePage` instance when
only the `:name` param changes (same route name), this ensures: the terminal's `:key`
changes to the new containerId (forcing reconnect), and `logsVisited` resets to `false`
(unmounting the stale `LogsPane` so it re-lazy-mounts fresh for the new app id if revisited).
I did **not** additionally key the whole content block by `id` — the explicit resets in
`load()` make that redundant. As the brief allows, `tab`/`logsVisited` (and here also the
selected service) reset on app switch, which is correct semantics (different app = fresh
console). No dedicated automated test was added for this specific in-place-param-change path
(the brief's 4 required cases don't cover it, and reactively mocking a live `route.params`
object for just that one scenario added test complexity disproportionate to what's a
straightforward, reviewable code change); verified by reading the code path instead.

## TDD evidence

Wrote `AppConsolePage.test.ts` and the `InstalledAppCard.vue` menu test alongside the
implementation, then iterated to green. Hit and fixed two real test-infra issues along the
way (documented as comments in the test files so they don't get re-discovered blind):
1. Stubbing `TerminalPane`/`LogsPane` via VTU `stubs:` only swaps the render output — it does
   **not** stop the real `.vue` module (and its `@xterm/xterm` import, which touches
   `HTMLCanvasElement.getContext` at *import* time, not construction time) from being
   evaluated, since `AppConsolePage.vue` imports them statically. Fixed by
   `vi.mock('../console/TerminalPane.vue', ...)` / `vi.mock('../console/LogsPane.vue', ...)`
   instead, mocking the whole module.
2. `isVisible()` (used to assert `v-show` keep-alive) reads `getComputedStyle()`, which only
   reflects real inline styles for elements connected to the live document — an unattached
   `mount()` wrapper reports "visible" regardless of `display:none`. Fixed by mounting that
   one test with `attachTo: document.body` + explicit `w.unmount()` (same pattern already used
   in `AppSettingsPage.test.ts`'s conflict-dialog test).

Final: `pnpm test -- --run` → **210 files / 1150 tests passed, zero stderr output**.
`pnpm exec vue-tsc --noEmit` → clean.

## Files changed

- `src/apps/views/AppConsolePage.vue` (new)
- `src/apps/views/AppConsolePage.test.ts` (new)
- `src/router/index.ts`
- `src/apps/components/InstalledAppCard.vue`
- `src/apps/components/InstalledAppCard.test.ts`
- `src/apps/views/InstalledAppsPage.vue`
- `src/i18n/zh_cn.ts`, `src/i18n/en_us.ts`
- `vitest.setup.ts` (see "Scope note" below — outside the brief's file list, added deliberately)

## Self-review (against brief checklist)

- [x] 4 page test cases from brief — all present and passing.
- [x] Card menu case ("⋮ 菜单含「终端与日志」,点击 emit console") — added, passing.
- [x] T6 constraint — applied (see above), no watcher-gap left on route param reuse.
- [x] Single-service hides picker — `v-if="serviceNames.length > 1"`, test 1 asserts absence.
- [x] Main fallback to first key — `r.main && r.containers[r.main] ? r.main : Object.keys(r.containers)[0]`.
- [x] Terminal keyed by containerId — `:key="containerId"` on `<TerminalPane>`.
- [x] Logs lazy-mount then v-show keep-alive — `v-if="logsVisited" v-show="tab==='logs'"`; test 3 confirms `exists()` stays `true` and only visibility toggles across tab switches.
- [x] 404 → toast + back — confirmed both the `toast.show(...)` call (via `useToast()` store
      state) and `router.push({name:'apps'})` in test 4.
- [x] Pristine output — full suite runs with **zero** console/stderr noise (see Scope note).

## Scope note / concern

Wiring `AppConsolePage` into the router had a side effect outside the brief's file list:
`router/index.ts` now statically pulls in `TerminalPane.vue` → `@xterm/xterm`, and xterm does
canvas feature-detection at **module import time** (not just construction), so *any* test
that transitively imports `router` (the large majority of the suite) started printing a jsdom
"HTMLCanvasElement.getContext not implemented" error — non-fatal, but it polluted output
suite-wide. The repo already solved the exact same class of problem once before
(`lottie-web` via `Welcome.vue`, mocked globally in `vitest.setup.ts` with an explanatory
comment). I applied the identical remedy: a global `vi.mock('@xterm/xterm', ...)` in
`vitest.setup.ts`, confirmed it does not override the more detailed per-file mocks in
`TerminalPane.test.ts`/`AppConsolePage.test.ts` (those still pass with their own mocks), and
confirmed the full suite is clean after. This is a deliberate, necessary, minimal deviation
from "nothing else" in Code Organization — flagging it explicitly in case the reviewer wants
it reverted or moved elsewhere.

## Fix: race in `load()` on rapid successive route-param changes (reviewed finding)

**Root cause**: `load()` (called from `onMounted` and `watch(id, load)`) had no guard tying
its async result to the id current when the fetch was issued. Two overlapping `load()` calls
(fast A→B navigation, same route name `apps-console` so the component instance is reused) let
whichever `service.compose.containers` response landed LAST win unconditionally — a stale
`info.value`/`selectedService.value` could overwrite the newer app's state, and worse, a stale
invalid-app branch could fire `toast + router.push({name:'apps'})` and yank the user off a
valid app's console they'd since navigated to.

**Fix** (`src/apps/views/AppConsolePage.vue`): mirrored the repo's existing monotonic-sequence
pattern (`appstore.ts`'s `loadCatalog` `mySeq`/`seq`). A module-scoped `let seq = 0` is
incremented at the top of every `load()` call into a local `mySeq`. After the
`await service.compose.containers(id.value)` resolves (both the success path and the `catch`
branch), if `mySeq !== seq` the function returns immediately — no write to `info`/
`selectedService`, no toast, no `router.push`. The unconditional up-front reset (`tab`,
`logsVisited`, `info`, `selectedService`) that runs before the `await` was left untouched, per
the fix brief.

**Regression test** (`src/apps/views/AppConsolePage.test.ts`): new case
"快速切换应用(A→B)后 A 的陈旧响应落地:不覆盖 B 的状态,不误弹 toast/跳转". Two controllable
deferred promises are queued via `mockImplementationOnce` for two successive
`service.compose.containers` calls: call #1 fires from `onMounted` (id="demo"), call #2 fires
after mutating a newly-`reactive()` `routeMock.params.name` to `"other"` (drives
`watch(id, load)` without remounting, matching how vue-router reuses the instance for this
route). Call #2 (the current/newer app) resolves **first** with valid single-container data;
call #1 (the stale app) resolves **last** with the invalid-app shape (`{main:'', containers:{}}`
— the toast+redirect branch). Assertions: `TerminalPane`'s `containerId` prop still reflects
call #2's container after call #1 resolves (not overwritten), `router.push` was never called,
and no toast was shown.

Two supporting test-file changes were needed to make `routeMock` mutation viable across the
existing suite: `useRoute` mock now returns a shared `reactive({ params: { name: 'demo' } })`
object (previously a plain literal, which vue's reactivity couldn't track mutations on), and
`enableAutoUnmount(afterEach)` was added — without it, wrappers left mounted by earlier tests
in the file (only one of the four pre-existing tests explicitly unmounts) keep their
`watch(id, load)` alive and also react to the new test's `routeMock.params.name` mutation,
double-firing `containers()` calls across unrelated tests and desyncing the two-deferred-promise
sequencing. `beforeEach` resets `routeMock.params.name = 'demo'` for isolation.

**Test evidence**:
- `pnpm test -- --run AppConsolePage` → 1 test file, 5 tests passed (4 pre-existing + 1 new).
- `pnpm test -- --run` (full suite) → 210 test files, 1151 tests passed.
- `pnpm exec vue-tsc --noEmit` → clean, no output/errors.
