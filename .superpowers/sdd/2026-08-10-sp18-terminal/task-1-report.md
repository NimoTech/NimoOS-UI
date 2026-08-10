# Task 1 Report: `_noAuthRetry` opt-out in the shared 401 interceptor

## Status: DONE

## Commit Hash
- `30596198d5d006f836ac392a9d7471a73d5967c8`

## Work Completed

Implemented a per-request opt-out flag (`_noAuthRetry`) for the 401 refresh-replay interceptor in the shared HTTP service. This prevents wrong passwords on terminal session endpoints from being replayed and burning backend lockout attempts.

### Changes Made

1. **packages/service/src/http.test.ts**
   - Added new test: `does not refresh-replay a 401 when the request opts out via _noAuthRetry`
   - Test verifies that when `_noAuthRetry: true` is set on a request config, a 401 response is NOT refreshed or replayed
   - Test asserts: `attempts === 1` (no replay) and `refreshCalls === 0` (no refresh)

2. **packages/service/src/http.ts**
   - Extended response interceptor type annotation to include `_noAuthRetry?: boolean`
   - Added comment explaining the purpose of the flag (SP18 spec §4-6)
   - Modified the condition to check `!original._noAuthRetry` before attempting refresh-replay

### Test Results

```
pnpm vitest run packages/service/src/http.test.ts
```

**Before implementation:**
- 1 failed, 6 passed
- New test failed with: `attempts = 2` (replayed) and `refreshCalls = 0`

**After implementation:**
- **7 passed** (all tests, including the new test and all pre-existing tests)
- Test summary: 7/7 passed

### Verification

The implementation:
- ✅ Follows TDD process (failing test → implementation → all tests pass)
- ✅ Matches the brief exactly (code, comment, test structure identical)
- ✅ Does not break any existing tests
- ✅ Uses English for code comments and test descriptions
- ✅ Follows commit message convention (imperative, English, explains why)
- ✅ Diff is minimal and focused on the feature

## Concerns
None. All tests pass, implementation is complete and matches the requirements.
