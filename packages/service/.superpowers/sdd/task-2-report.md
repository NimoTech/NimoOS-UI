# Task 2 Report: `batch` Domain Implementation

## Status
**DONE**

## Summary
Successfully implemented the `batch` domain for the shared TypeScript package `@nimotech/nimoos-service` following TDD methodology. All 5 batch domain tests pass, full test suite (39 tests) passes, and TypeScript compilation succeeds with no errors.

## TDD Execution

### Step 1: Write Failing Tests
Created `src/batch.test.ts` with 5 test cases:
- `download passes format + files`
- `task posts data body`
- `deleteTask deletes /batch/{id}/task`
- `delete sends files in request body (data)`
- `batchUrl builds /v1/batch with encoded token + files`

### Step 2: Confirm Tests Fail (RED)
```bash
$ npm test -- batch
...
FAIL  src/batch.test.ts [ src/batch.test.ts ]
Error: Cannot find module './batch' imported from /home/nimo/NimoTech/NimoOS-Service/src/batch.test.ts
```
✓ Tests fail as expected because implementation doesn't exist yet.

### Step 3: Implement Solution (GREEN)
Created `src/batch.ts` with `createBatch()` factory function exposing:
- `download(format, files): Promise<unknown>` — GET `/batch` with `{ format, files }` params
- `task(data): Promise<unknown>` — POST `/batch/task` with body
- `deleteTask(id): Promise<unknown>` — DELETE `/batch/{id}/task` (no body)
- `delete(files): Promise<unknown>` — DELETE `/batch` with files in config `data` field
- `batchUrl(files): string` — builds `/v1/batch?token=<enc>&files=<enc>` (omits token= when null)

Key patterns followed:
- Injected-factory: `createBatch(http: AxiosInstance, getToken: () => string | null)`
- axios DELETE-with-body: `http.delete(url, { data: files })`  (not `http.delete(url, files)`)
- Response unwrapping: all methods call `unwrap<T>(res.data)`
- Token encoding: uses `encodeURIComponent()` for both token and files

### Step 4: Wire into Service (index.ts)
Added import: `import { createBatch } from './batch.js'`

Added lazy getter to `service` object:
```typescript
get batch(): ReturnType<typeof createBatch> {
  return createBatch(getHttp() as AxiosInstance, () => getConfig().getToken())
}
```

Mirrors existing `file` and `photos` patterns.

### Step 5: Confirm Tests Pass (GREEN)
```bash
$ npm test -- batch
Test Files  1 passed (1)
Tests  5 passed (5)

$ npm test
Test Files  10 passed (10)
Tests  39 passed (39)

$ npm run build
[tsc -p tsconfig.json completes with no errors]
```
✓ All tests pass, including 5 new batch tests, full suite green, build clean.

### Step 6: Commit
```bash
$ git commit -m "feat(service): add batch domain (+ batchUrl builder) to shared package"
[sp3-shared-http d2d2f11] ...
 3 files changed, 86 insertions(+)
 create mode 100644 src/batch.test.ts
 create mode 100644 src/batch.ts
```

Commit SHA: **d2d2f11**

## Files Changed
- **Created** `src/batch.ts` (28 lines) — batch domain implementation
- **Created** `src/batch.test.ts` (54 lines) — 5 comprehensive unit tests
- **Modified** `src/index.ts` (+4 lines) — import + lazy getter wiring

## Test Summary
- Batch domain: 5/5 tests pass ✓
- Full suite: 39/39 tests pass ✓
- Build: tsc clean, no errors ✓

## Self-Review Checklist

✓ **TDD discipline**: RED → GREEN → REFACTOR flow followed exactly
✓ **Code pattern consistency**: mirrors `file.ts` injected-factory and `index.ts` lazy-getter patterns
✓ **axios semantics**: DELETE-with-body correctly uses `{ data: files }` config field
✓ **Token encoding**: `batchUrl()` correctly encodes both token and files, omits `token=` segment when null
✓ **Response handling**: all methods consistently unwrap via `unwrap<T>(res.data)`
✓ **No extra methods**: strictly adheres to brief interface (no YAGNI violations)
✓ **Type safety**: all methods typed with `Promise<unknown>` matching brief
✓ **Test assertions**: all test expectations match brief exactly (URLs, params, data placement)
✓ **Build verification**: npm run build completes cleanly
✓ **Full regression**: all 39 tests pass; no breaking changes to existing suite

## Concerns
None. Implementation is straightforward, follows established patterns in the codebase, and all tests pass.

## Deployment Notes
The batch domain is now available via `service.batch` after `initService()`. Usage:
```typescript
import { initService, service } from '@nimotech/nimoos-service'

await initService(config)
const result = await service.batch.download('zip', '/DATA/a,/DATA/b')
const url = service.batch.batchUrl('/DATA/a')  // gets direct download link with token
```
