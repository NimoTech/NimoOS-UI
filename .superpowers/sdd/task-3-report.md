# Task 3 Report — `sources` Pinia store (load / register / unregister / 事件 + 轮询收敛)

## What was implemented

- `src/apps/stores/sources.ts` — new Pinia setup store `useSourcesStore()`, exactly per brief design:
  - State: `sources`, `loading`, `error`, `loaded`, `registeringUrl`.
  - `load()` — sequence-guarded (`seq` counter) fetch of `service.appstore.listSources()`, mirrors the `appstore.ts` stale-response-discard pattern.
  - `register(url)` — trims URL, sets `registeringUrl`, awaits `service.appstore.registerSource`. Synchronous HTTP errors (e.g. 409 duplicate) reset `registeringUrl` and re-throw `Error(backend message)` for the caller to display inline. On acceptance, arms a 15s (`REGISTER_POLL_MS`) polling fallback that calls `listSources()` and case-insensitively checks whether the target URL now appears, converging via `convergeRegistered()` if so.
  - `unregister(id)` — awaits `service.appstore.unregisterSource`, on success toasts + reloads + invalidates appstore catalog cache; on failure toasts the backend message and does not throw.
  - MessageBus subscriptions (`app-store:register-end` / `app-store:register-error`) wired at store-setup time (same lifecycle idiom as `installProgress.ts`), converging pending registration on whichever of event/poll arrives first (polling is stopped inside `settleRegister()`).
  - `register-end` received while nothing is pending (another client's registration) silently refreshes + invalidates without a toast.
- `src/apps/stores/sources.test.ts` — the 7 test cases from the brief, copied verbatim (fake timers, hoisted mocks for `@nimotech/nimoos-service` and `useMessageBus`, event-handler capture map).
- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts` — added 4 keys the store references: `appsSourcesRegisterOk`, `appsSourcesRegisterFail`, `appsSourcesRemoveOk`, `appsSourcesRemoveFail` (both files, keeping parity). Pulled forward from Task 4 per the brief's explicit Step 4 authorization, because the `register-error` test asserts real interpolated text (`stringContaining('not an appstore')`) which fails if vue-i18n echoes the bare key name instead.

## TDD evidence

**RED** (before `sources.ts` existed):
```
$ pnpm exec vitest run src/apps/stores/sources.test.ts
FAIL  src/apps/stores/sources.test.ts [ src/apps/stores/sources.test.ts ]
Error: Failed to resolve import "./sources" from "src/apps/stores/sources.test.ts". Does the file exist?
Test Files  1 failed (1)
     Tests  no tests
```

**Intermediate** (implementation added, i18n keys not yet added — confirms the brief's predicted failure mode):
```
[intlify] Not found 'appsSourcesRemoveOk' key in 'zh_cn' locale messages.
FAIL  ... register-error 事件 ...        expected "appsSourcesRegisterFail" to contain "not an appstore"
FAIL  ... unregister 成功/失败 ...        expected "appsSourcesRemoveOk"/"appsSourcesRemoveFail" ...
Tests  2 failed | 5 passed (7)
```

**GREEN** (after adding the 4 i18n key pairs):
```
$ pnpm exec vitest run src/apps/stores/sources.test.ts src/i18n/parity.test.ts
Test Files  2 passed (2)
     Tests  10 passed (10)
```

**Full suite + typecheck** (once before commit):
```
$ pnpm test
Test Files  213 passed (213)
     Tests  1182 passed (1182)

$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/src/apps/stores/sources.ts` (new)
- `/home/nimo/NimoTech/NimoOS-New-UI/src/apps/stores/sources.test.ts` (new)
- `/home/nimo/NimoTech/NimoOS-New-UI/src/i18n/zh_cn.ts` (+5 lines: 1 comment + 4 keys)
- `/home/nimo/NimoTech/NimoOS-New-UI/src/i18n/en_us.ts` (+5 lines: 1 comment + 4 keys, kept parity)

## Commit

`04d3698` — "P7: 商店源 store(注册事件+轮询双通道收敛,同步错误透出)" — body notes the i18n keys were pulled forward from Task 4 with rationale, per brief authorization.

## Self-review

- Mechanical adaptation only — no redesign; the brief's code was used as-is (matches existing store idioms in `appstore.ts`/`installProgress.ts`/`mounts.ts` closely, e.g. sequence-guarded `load()`, store-setup-level `bus.on(...)` subscriptions, `errMsg()` helper for `{response:{data:{message}}}` extraction).
- Checked for Pinia store-ID collisions (`'appSources'`) across `src/` — none found.
- Checked for hard-coded color literals per repo theming convention — N/A, this task touches no CSS/styling.
- `register()` does not itself guard against being called again while a registration is already pending (it will silently overwrite `registeringUrl` and re-arm the poll via `stopPoll()` + new `setInterval`) — this is the brief's given design, not something I introduced; Task 4's page-level UI is expected to disable the register button/input while `registeringUrl !== null` (not verified here since Task 4 hasn't landed yet).
- i18n copy for the 4 keys I added is my own wording (no access to a Task-4 spec with exact copy) — followed the sibling `filesMountEject*` / `appsInstall*` key style. Task 4 may add different/additional page-level keys (title, buttons, etc.) — no conflict expected since parity only requires identical keysets between the two locale files, not a specific final wording.
- No dangling promises / unhandled rejections introduced beyond the brief's own intentional `console.warn` in `load()`'s catch and the silently-swallowed poll-failure catch.

## Concerns

None blocking. Only note: the exact i18n copy chosen for the 4 forwarded keys is my own judgment call, not verbatim from a Task-4 plan I had access to — flagging in case the actual Task 4 plan specifies different wording for these same keys (parity test and store behavior are unaffected either way; this is cosmetic only).

---

## Fix round (post-review)

Review verdict: Approved with one Important finding + two cheap test tightenings, addressed in commit `a618aed`.

### Important — concurrent `register()` silently swallowed the 2nd call's outcome

`registeringUrl` is a single ref, and the poll's `needle` closes over the URL at call time. If `register(B)` was called while `register(A)` was still in flight, `A`'s eventual convergence (`settleRegister()`) would null out `registeringUrl` — and both `B`'s own polling guard (`if (registeringUrl.value === null) return` inside the `setInterval` callback) and the MessageBus event handlers' null guards would then treat `B` as already-settled forever, even though `B`'s actual registration outcome (event/poll match) never arrived. Net effect: `B`'s registration result was dropped with no error, no toast, no `sources` refresh — a real bug, not just a test gap, since the store's own docstring/plan says "一次只允许一个注册在途" but nothing enforced it.

**Fix**: added a store-level guard as the very first line of `register()`:
```ts
if (registeringUrl.value !== null) throw new Error(t('appsSourcesBusy'))
```
This rejects the second caller synchronously, before ever touching `registeringUrl` or calling `service.appstore.registerSource` — so the first (in-flight) registration's state is left completely untouched.

Added i18n key `appsSourcesBusy` to both `src/i18n/zh_cn.ts` (`'已有一个源正在注册,请等它完成'`) and `src/i18n/en_us.ts` (`'A source registration is already in progress'`), preserving parity.

### Minor test tightenings

- **register-error test**: added `expect(svc.appstore.listSources).not.toHaveBeenCalled()` — the existing `不重拉` (no-refetch) claim in the test name/comment previously had zero assertion backing it.
- **Poll-fallback test**: after the second `advanceTimersByTimeAsync(15_000)` that converges the registration, added a further `advanceTimersByTimeAsync(15_000)` and asserted `svc.appstore.listSources.mock.calls.length` did not grow — proving the poll `setInterval` was actually cleared (`stopPoll()` inside `settleRegister()`), not just no-op-guarded.

### New test

- **并发守卫**: registers URL A (in flight), then calls `register(B)` concurrently — asserts it rejects, `registerSource` was called exactly once (never for B), and `registeringUrl` still reads A's URL (untouched by the rejected second call).

### Verification

```
$ pnpm exec vitest run src/apps/stores/sources.test.ts src/i18n/parity.test.ts
Test Files  2 passed (2)
     Tests  11 passed (11)

$ pnpm test
Test Files  213 passed (213)
     Tests  1183 passed (1183)

$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

### Files changed (this round)

- `/home/nimo/NimoTech/NimoOS-New-UI/src/apps/stores/sources.ts` — guard clause + comment
- `/home/nimo/NimoTech/NimoOS-New-UI/src/apps/stores/sources.test.ts` — 1 new test, 2 tightened assertions
- `/home/nimo/NimoTech/NimoOS-New-UI/src/i18n/zh_cn.ts` / `en_us.ts` — `appsSourcesBusy` key pair

### Commit

`a618aed` — "P7: 商店源 store 并发注册守卫 + 收敛测试补强"
