# Task 6 Report: Surface `size_match` and `is_dir` from Upload Precheck

## Summary

Added TypeScript type declarations for `size_match` and `is_dir` fields to `UploadPrecheckResult`, which are already returned by the NimoOS core handler but were missing from the type definition. Task 7 needs `is_dir` to decide whether Overwrite can be offered for a colliding path inside a merged folder.

## Files Changed

- `packages/service/src/types.ts` — Updated `UploadPrecheckResult` interface
- `packages/service/src/file.upload.test.ts` — Added one test case

## TDD Evidence

### RED Phase (Test Fails Before Implementation)

Ran the new test with the original type:

```bash
npx tsc --noEmit packages/service/src/file.upload.test.ts 2>&1 | grep -E "size_match|is_dir"
```

Output (lines 44-45 of test file):
```
packages/service/src/file.upload.test.ts(44,27): error TS2339: Property 'size_match' does not exist on type '{ relativePath: string; exists: boolean; }'.
packages/service/src/file.upload.test.ts(45,27): error TS2339: Property 'is_dir' does not exist on type '{ relativePath: string; exists: boolean; }'
```

**Why this failure was expected:** The test accesses `.size_match` and `.is_dir` on the result object, but the type only declared `relativePath` and `exists`. This is the correct RED state.

### Implementation

Modified `packages/service/src/types.ts` (lines 81–87):

```typescript
export interface UploadPrecheckResult {
  // size_match / is_dir are optional in the type but always present from the
  // NimoOS core handler (route/v2/precheck_file.go) — optional only so an old
  // or degraded body can't break the type contract.
  results: { relativePath: string; exists: boolean; size_match?: boolean; is_dir?: boolean }[]
}
```

The fields are declared as optional (`?`) because they represent fields that may arrive from different backend versions or degraded responses, but the core handler always sends them.

### GREEN Phase (Tests Pass After Implementation)

```bash
pnpm exec vitest run packages/service/src/file.upload.test.ts packages/service/src/file.test.ts
```

Output:
```
Test Files  2 passed (2)
     Tests  19 passed (19)
  Start at  01:50:26
  Duration  980ms (transform 442ms, setup 738ms, import 57ms, tests 23ms, environment 776ms)
```

Type check:
```bash
pnpm exec vue-tsc --noEmit
```

Output: No errors (clean).

## Test Implementation Details

Added test case in `file.upload.test.ts` following the existing mocking idiom:

```typescript
it('uploadPrecheck passes through size_match and is_dir', async () => {
  const http = fakeHttp({ data: { success: 200, data: { results: [{ relativePath: 'a.txt', exists: true, size_match: true, is_dir: false }] } } })
  const file = createFile(http, () => 'tok')
  const out = await file.uploadPrecheck('/DATA/x', [{ relativePath: 'a.txt', size: 5 }])
  expect(out.results[0].size_match).toBe(true)
  expect(out.results[0].is_dir).toBe(false)
})
```

**Mocking idiom used:** Copied from existing test at line 14–23:
- `fakeHttp()` function that returns a mock Axios instance with `post` and `get` mocks
- `createFile(http, () => 'tok')` to instantiate the file service
- `.mockResolvedValue()` to return the response structure `{ data: { success: 200, data: { results: [...] } } }`

The pattern is identical to the existing `uploadPrecheck` test (line 14–23), just extending the mock response object to include the new fields.

## Self-Review Findings

✅ **RED step:** Confirmed type error at correct lines (44–45) for missing properties — not a mock/setup error.

✅ **Test idiom:** Matches the file's existing pattern exactly; no new helpers, mocking libraries, or setup introduced.

✅ **Type declaration:** Fields marked optional because they represent runtime data that may degrade, not because they're conditionally present — comment explains the distinction clearly.

✅ **Output:** All tests pass (19 tests), no type errors, clean status.

✅ **Commit message:** Follows brief exactly, imperative subject, body explains the *why*.

## Concerns

None. Task is complete and validated per spec.

## Commit

- **SHA:** `1e472c1`
- **Subject:** `feat(service): surface size_match and is_dir from upload precheck`
