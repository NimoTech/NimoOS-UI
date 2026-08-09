# Task 2 Report: Add `extra` Parameter to `confirmAgentAction`

## Summary
Successfully implemented the optional `extra` parameter for the `confirmAgentAction` method in the shared HTTP service package, allowing MCP elicitation cards to pass three-state answers (accept/decline/cancel) and their content through the HTTP layer.

## Findings

### Real URL Shape
- **File**: `packages/service/src/ai.test.ts`
- **Location**: Line 57 in the URL table assertion
- **URL prefix**: `/ai/` (not `/v1/ai/` as shown in the brief)
- **Full URL pattern**: `/ai/agent/sessions/{sessionId}/confirm`
- **Example from test line 93**: `POST /ai/agent/sessions/s1/confirm`

### Test Execution

#### Pre-implementation (Regression Guard)
Ran failing tests to confirm new feature isn't yet in place:
```bash
pnpm exec vitest run packages/service/src/ai.test.ts -t 'extra'
```

**Result**: 1 test passed (regression guard), 1 test failed (expected)
- ✓ `confirmAgentAction 不传 extra 时,body 与今天逐字相同`
- ✗ `confirmAgentAction 把 extra 展开进 body(elicitation 的 action/content 走这里)`

**Failure message**: 
```
AssertionError: expected { confirm_id: 'c1', confirmed: true, remember: false }
to deeply equal { confirm_id: 'c1', confirmed: true, remember: false, action: 'accept', content: { name: 'Ada' } }
```

The body was missing the `action` and `content` fields, confirming the feature wasn't implemented.

#### Post-implementation
Ran full test suite:
```bash
pnpm exec vitest run packages/service/src/ai.test.ts
```

**Result**: All 67 tests passed ✓
- Test Files: 1 passed
- Tests: 67 passed
- No failures

## Implementation Details

### Changes Made
1. **File**: `packages/service/src/ai.ts` (lines 39-51)
   - Added optional parameter `extra?: Record<string, unknown>` as the fifth argument
   - Added comment explaining the MCP elicitation use case (three-state with answer payload)
   - Spread the `extra` object into the request body using `...(extra || {})`
   - Preserves byte-identical behavior when `extra` is omitted

2. **File**: `packages/service/src/ai.test.ts`
   - Added regression test: ensures body is identical when `extra` is not passed
   - Added functional test: ensures `extra` fields spread correctly into the request body

### Backward Compatibility
The implementation maintains full backward compatibility:
- Parameter is optional (default undefined)
- When omitted, the request body is byte-identical to the previous implementation
- The regression test explicitly pins this guarantee

## Commit
- **SHA**: `8e9e347`
- **Message**: `feat(service): let confirmAgentAction carry an elicitation payload`
- **Files changed**: 2
- **Insertions**: 20

## Test Summary
- **Total tests**: 67/67 passed
- **New tests**: 2 added (both passing)
- **Regression tests**: 1 included (passing - backward compatibility verified)
