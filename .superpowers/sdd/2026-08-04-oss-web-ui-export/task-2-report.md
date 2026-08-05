# Task 2 Report: Fix `pnpm test` Exit Code

## Summary
Fixed the exit code 1 issue by adding missing `avatarPath` mock to the `users` service mock in `SettingsPage.test.ts`.

**Root Cause:** AccountPanel.vue line 43 computes `avatarSrc` by calling `service.users.avatarPath()` during mount. The SettingsPage.test.ts mock was missing this method, causing an unhandled TypeError to be thrown after all 3078 tests completed. Tests passed, but the uncaught error caused process exit code 1.

**Solution:** Added `avatarPath: (v: number, t: string | null) => '/v1/users/avatar?...'` to match the existing mock shape in AccountPanel.test.ts:25.

## Before: `pnpm test 2>&1 | tail -8; echo "EXIT=${PIPESTATUS[0]}"`

```
 Test Files  352 passed (352)
      Tests  3078 passed (3078)
     Errors  1 error
   Start at  01:34:31
   Duration  70.64s (transform 13.74s, setup 51.69s, import 75.58s, tests 38.79s, environment 129.21s)

 ELIFECYCLE  Test failed. See above for more details.
EXIT=1
```

## After: `pnpm test 2>&1 | tail -8; echo "EXIT=${PIPESTATUS[0]}"`

```
 Test Files  352 passed (352)
      Tests  3078 passed (3078)
   Start at  01:36:03
   Duration  71.65s (transform 14.24s, setup 53.22s, import 76.07s, tests 39.77s, environment 131.21s)

EXIT=0
```

## Changes Made

**File:** `src/settings/views/SettingsPage.test.ts`

Added 3 lines to the `users` mock (after `setCustomStorage`):
```typescript
// AccountPanel 的 avatarSrc computed 在挂载时求值;缺这行会在用例结束后
// 抛 unhandled TypeError,表现为「3078 例全绿但进程退出码 1」。
avatarPath: (v: number, t: string | null) => `/v1/users/avatar?${t ? `token=${t}&` : ''}v=${v}`,
```

## Verification

- ✅ Test Files: 352 passed (unchanged)
- ✅ Tests: 3078 passed (unchanged)
- ✅ **No "Errors" line** (was present before)
- ✅ EXIT=0 (was EXIT=1 before)
- ✅ Git status shows only 3 expected design-export deletions
- ✅ Commit: `721117f` with explicit pathspec (`git add src/settings/views/SettingsPage.test.ts`)

## Gate Status

✅ **Exit code 0 confirmed** — The `pnpm test` exit code gate for subsequent 13 tasks is now operational.
