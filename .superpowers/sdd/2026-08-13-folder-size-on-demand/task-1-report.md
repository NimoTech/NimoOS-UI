# Task 1 Report: Tighten `getFolderSize` in the service package

## Summary
Successfully completed Task 1. Modified `getFolderSize` method to add typed return value (`Promise<number>`) and 5-minute timeout (300000ms). Updated test fixtures to match real backend envelope shape.

## Changes Made

### File: `packages/service/src/folder.ts`
- Changed `getFolderSize` return type from `Promise<unknown>` to `Promise<number>`
- Added 5-minute timeout (300000ms) to the HTTP GET request config
- Added explanatory comment documenting why the long timeout is necessary (backend walks entire subtree)
- Changed `unwrap<unknown>` to `unwrap<number>` to match return type

### File: `packages/service/src/folder.test.ts`
- Replaced combined test (lines 35-42) with two separate tests:
  1. **getFolderSize test**: Verifies correct endpoint (`/folder/size`), path parameter, 5-minute timeout (300000), and byte count return value. Updated mock to return real backend envelope: `{ data: { success: 200, message: 'ok', data: 123456789 } }` (data is raw int64, not an object)
  2. **getFolderCount test**: Verifies correct endpoint (`/folder/count`), path parameter, and returned count (no timeout)
- Left all other tests unchanged

## Test Results

### Initial Run (Step 2 - Expected Failure)
```
FAIL: getFolderSize hits /folder/size with path, a 5-minute timeout, and returns the byte count
AssertionError: expected undefined to be 300000
```
✓ Confirmed test correctly failed because timeout was not yet implemented

### Final Run (Step 4 - Verification)
```
Test Files  1 passed (1)
Tests  6 passed (6)
```

Full verbose output:
- ✓ getList passes path param and unwraps content
- ✓ create posts path to /folder
- ✓ rename puts old/new to /folder/name
- ✓ getFolderSize hits /folder/size with path, a 5-minute timeout, and returns the byte count
- ✓ getFolderCount hits /folder/count with path
- ✓ 条目的 size 字段被保留(OSSelector 自定义区要显示文件大小)

## Commit Details
- **Hash**: `4023027c060fe6bad3a150d70cb445095c848870`
- **Message**: `feat(service): type getFolderSize and give it a 5-minute timeout`
- **DCO Signed-off-by**: Tiansanchuan <1312528051@qq.com>
- **Files Modified**: 2 (folder.ts, folder.test.ts)
- **Insertions**: 36, **Deletions**: 10

## Quality Assurance

✓ All comments and commit message in English
✓ Only specified files modified
✓ TDD workflow followed: test update → failure → implementation → success → commit
✓ Test envelope fixture corrected to real backend shape (raw byte count in data field)
✓ Return type properly typed (`Promise<number>`)
✓ Timeout correctly set to 300000ms (5 minutes)
✓ No unrelated changes
✓ No stray modifications outside task scope
✓ All 6 tests passing

## Concerns
None. Task completed successfully according to specification.
