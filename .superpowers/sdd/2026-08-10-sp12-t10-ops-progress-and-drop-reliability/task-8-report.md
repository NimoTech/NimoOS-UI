# Task 8 report: sender-side ACK timeout for /files/drop

## What changed

- `src/files/drop/protocol.ts`: added `ACK_TIMEOUT_MS = 30000` (verbatim per brief, with the same comment).
- `src/files/drop/rtcPeer.ts` (`Peer` class):
  - New private field `ackTimer: ReturnType<typeof setTimeout> | null = null`.
  - New private methods `armAck()` (clears any existing timer, then arms a fresh `setTimeout(() => this.handleDisconnect('timeout'), ACK_TIMEOUT_MS)`) and `clearAck()` (clears + nulls the field, no-op if already null).
  - `sendFile()`'s `FileChunker` partition-end callback now does `sendJSON({ type: 'partition', offset }); this.armAck()` instead of just sending.
  - `handleChannelMessage()`:
    - `case 'partition-received'`: now `clearAck()` first, then `if (chunker && !isFileEnd()) chunker.nextPartition()` else `armAck()` (arms the wait for the peer's `transfer-complete` after the last partition was acked).
    - `case 'transfer-complete'`: now `clearAck(); this.onTransferCompleted()`.
  - `resetTransferState()`: added `this.clearAck()` as the first line, alongside the existing `chunker?.abort()` / digester-null / queue-clear logic (nothing removed or replaced).
- `src/files/drop/rtcPeer.test.ts`: added a fourth `describe('Peer send-side timeouts', ...)` block with 4 tests, importing `ACK_TIMEOUT_MS` from `./protocol`. Two of the four tests deviate from the brief's literal text — see "Deviations from the brief" below, with the reasoning.

## Test commands and output

Scoped to `src/files/drop/` per instructions (no full-suite run, to avoid the dirty-tree OSS export gate and the unrelated spurious export-test failures):

```
pnpm exec vitest run src/files/drop/rtcPeer.test.ts
 Test Files  1 passed (1)
      Tests  17 passed (17)
```

```
pnpm exec vitest run src/files/drop/
 Test Files  12 passed (12)
      Tests  62 passed (62)
```

```
pnpm exec vue-tsc --noEmit
(no output — clean)
```

## Step 2: initial red confirmation (pre-implementation)

With only the test block added (protocol.ts/rtcPeer.ts untouched), `ACK_TIMEOUT_MS` resolved to `undefined` (imported but not yet exported), so `vi.advanceTimersByTime(undefined + 1)` = `vi.advanceTimersByTime(NaN)`. Result: 2 of the 4 new tests failed —

- "gives up on a partition acknowledgement that never comes..." — failed: `onTransferBroken` never called (no timeout mechanism existed yet).
- "arms the same timeout while waiting for the final transfer-complete" — failed: same reason.
- The other two ("does not fire..." / "clears the timer on transfer-complete...") assert `not.toHaveBeenCalled()`, which trivially held since nothing could ever fire — expected and consistent with the brief (these two are not meaningful red/green signals on their own, they only matter as guards against over-firing once the feature exists).

This is red for the expected reason: the timeout/arming mechanism did not exist yet, not a typo or unrelated failure.

## Step 4: green confirmation (post-implementation)

All 17 tests in the file passed after implementing Steps 3 exactly as specified in the brief for `protocol.ts` and `rtcPeer.ts` (see diff below), combined with two test fixture corrections described next.

## Deviations from the brief's literal test text (found and fixed)

The brief's Step 1 code block was applied verbatim first, then run — this surfaced two problems, both fixture bugs in the given test text, not implementation bugs. Both were root-caused before touching anything, per the "confirm red/green for the right reason" instruction.

### 1. "does not fire once the acknowledgement arrives in time" — fixture used the wrong partition count

The brief's original body used a 70000-byte file and acked it with `{ type: 'partition-received', offset: 64000 }`. With `CHUNK_SIZE = 64000` and `MAX_PARTITION_SIZE = 1e6`, a 70000-byte file produces exactly **one** partition (chunk 1 = 64000B, chunk 2 = 6000B, `onPartitionEnd` fires once at offset 70000 because `isFileEnd()` trips before `isPartitionEnd()` ever could). That single partition is therefore also the *final* one. Per the correctness rule the brief itself specifies ("after the last partition is acknowledged, the sender arms the wait for `transfer-complete`"), acking it necessarily takes the `else this.armAck()` branch — the exact same branch exercised by the very next test ("arms the same timeout while waiting for the final transfer-complete"), which uses the same shape and correctly expects `onTransferBroken` to fire. Running the brief's literal test 2 against the brief's literal implementation reproducibly failed: `onTransferBroken` **was** called with `reason: 'timeout'`, contradicting the test's `not.toHaveBeenCalled()` assertion — because no `transfer-complete` ever followed, so the freshly-armed "waiting for completion" timer correctly fired.

Fix: rewrote the fixture to a 1,100,000-byte file, which (verified numerically: chunks accumulate to 1,024,000 at partition 1, then 1,100,000 at partition 2 — a genuine two-partition transfer). The test now acks partition 1 (non-final → `if` branch, no rearm-for-completion), waits for partition 2 to be sent, acks it, sends `transfer-complete`, then advances time and confirms no broken-transfer report — i.e. it now actually exercises "ack arrives in time and the whole transfer finishes cleanly," rather than accidentally re-testing the last-partition-arms-completion-wait behavior with the wrong expected polarity.

### 2. "clears the timer on transfer-complete..." — assertion couldn't detect the mutation it's named for

Running the brief's literal Step 5 second mutation (deleting `clearAck()` from the `transfer-complete` case) did **not** turn this test red. Root cause: `onTransferCompleted()` sets `busy = false` unconditionally. By the time the (now-uncancelled) stale timer fires 30s later, `hasActiveTransfer()` is `false`, so `handleDisconnect`'s `wasActive` guard swallows the report before `onTransferBroken` is ever called — with or without the bug, the assertion `expect(ev.onTransferBroken).not.toHaveBeenCalled()` passes. The test's only observable signal was blind to exactly the defect it was meant to catch.

The underlying risk described in the parent brief's correctness point 3 ("a dead timer fires against a peer that has already moved on") is still real: the leaked native `setTimeout` handle isn't cancelled by simply overwriting the `ackTimer` field later — it keeps counting down independently and would misfire against whatever transfer is in flight to the same peer if the 30s deadline is reached before some *other* call happens to invoke `armAck()`/`clearAck()` first.

Fix: added a direct assertion on the internal `ackTimer` field (`expect((p as unknown as { ackTimer: unknown }).ackTimer).toBeNull()`) immediately after the `transfer-complete` message, before advancing time. This checks the actual invariant ("the handle is gone") rather than an indirect, occasionally-unobservable side effect. Verified this new assertion:
  - Passes when `clearAck()` is present in the `transfer-complete` case.
  - Fails with the mutation applied (error: expected the timer object to be `null`, received the live `Timeout` object) — confirmed by direct re-run.

## Step 5: mutation-check results (both, with the corrected test 4)

**Mutation A** — deleted `else this.armAck()` from the `partition-received` case:
```
Tests  1 failed | 16 passed (17)
FAIL  ... > arms the same timeout while waiting for the final transfer-complete
  AssertionError: expected "vi.fn()" to be called with arguments: [...]  Number of calls: 0
```
Exactly the target test went red, all others (including the corrected "does not fire..." test) stayed green. Restored the line; re-ran: 17/17 green.

**Mutation B** — deleted `this.clearAck()` from the `transfer-complete` case:
- Against the brief's literal test 4 body: 17/17 green (did **not** turn red — see deviation #2 above for why).
- Against the strengthened test 4 (with the `ackTimer` internal-state assertion added): exactly "clears the timer on transfer-complete so a finished send never reports a timeout" went red:
```
Tests  1 failed | 16 passed (17)
FAIL  ... > clears the timer on transfer-complete so a finished send never reports a timeout
  AssertionError: expected { refed: true, ... } to be null
  - Expected: null
  + Received: { hasRef: [Function], ref: [Function], refed: true, refresh: [Function], unref: [Function], ... }
```
Restored the line; re-ran: 17/17 green.

Final state after both mutation checks and restores: `pnpm exec vitest run src/files/drop/rtcPeer.test.ts` → 17/17 green; `pnpm exec vitest run src/files/drop/` → 62/62 green; `pnpm exec vue-tsc --noEmit` → clean.

## Whether each new test fails against pre-Task-8 code, and why

All four tests were checked against the pre-implementation state (test block added, `protocol.ts`/`rtcPeer.ts` untouched):

1. "gives up on a partition acknowledgement that never comes..." — **fails**. No `armAck`/`clearAck` exist yet; nothing ever calls `handleDisconnect('timeout')`, so `onTransferBroken` is never called with the expected argument.
2. "does not fire once the acknowledgement arrives in time" (corrected fixture) — **passes trivially** even pre-implementation, since nothing can ever fire yet. This is expected for a `not.toHaveBeenCalled()`-style assertion; it only becomes meaningful once the feature exists and is exercised alongside test 1/3, which is why the brief pairs it with a "fires" test.
3. "arms the same timeout while waiting for the final transfer-complete" — **fails**. Same root cause as test 1: no timer mechanism, `onTransferBroken` never called.
4. "clears the timer on transfer-complete..." (strengthened) — **fails** pre-implementation on the added internal-state assertion: `ackTimer` doesn't exist as a field at all yet, so `(p as unknown as { ackTimer: unknown }).ackTimer` is `undefined`, and `expect(undefined).toBeNull()` fails. (Its second assertion, `not.toHaveBeenCalled()`, would trivially pass on its own for the same reason as test 2, which is exactly why the internal-state check was necessary.)

So 3 of the 4 tests fail against pre-Task-8 code for the intended reason; the 4th is an inherent limitation of a pure "did not fire" assertion and is expected/acceptable given it's paired with tests that do fail meaningfully.

## Concerns

- Two of the four test bodies had to be corrected from the brief's literal text (see "Deviations" above) because they didn't hold given the actual `CHUNK_SIZE`/`MAX_PARTITION_SIZE` constants and the `wasActive` guard's interaction with `onTransferCompleted()`. Both corrections are behavior-preserving relative to the brief's *design intent* (bounding both waits; last-partition ack arms completion wait; transfer-complete clears the timer) — only the test fixtures/assertions were wrong, not the prescribed `protocol.ts`/`rtcPeer.ts` implementation, which was applied exactly as written.
- No test currently exercises the true "dangling timer fires mid-flight against a *new*, unrelated transfer" scenario end-to-end (only the direct internal-state check for the `transfer-complete` case). Constructing that deterministically would require controlling `FileChunker`'s async timing precisely against the 30s deadline, which felt like overkill for this task; flagging it here in case a future task wants a stronger regression test for correctness point 3.
- Did not run the full `pnpm test` suite per instructions (dirty tree breaks `oss/export.mjs` gate); scoped to `src/files/drop/` + `vue-tsc --noEmit`, both clean.

---

# Fix round 1 of 5 (reviewer feedback)

Reviewer (more capable model) found two Important bugs, each with its own probe, plus one comment-accuracy issue on code from this task's original pass. All three fixed.

## Important 1 — `RTCPeer.close()` never reset transfer state

`close()` nulled `conn`/`channel` but never called `resetTransferState()`/`clearAck()`. `RTCPeerConnection.close()` does not fire `connectionstatechange`, so nothing else routes into the disconnect trunk on that path. `PeersManager` calls `close()` on `peer-left` and from `destroy()` (which `stores/drop.ts` calls when the user leaves `/files/drop`), so an in-flight send's `ackTimer` would outlive the page and fire 30s later against a `Peer` nobody is looking at — reporting a broken transfer through the app-global toast store on whatever page the user has since navigated to. This was inert before Task 8 (there was no timer to leak); Task 8's `ackTimer` addition made it reachable.

**Fix** (`src/files/drop/rtcPeer.ts`, `RTCPeer.close()`): added `this.resetTransferState()` as the last line, with a comment explaining why `close()` itself has to do it (no `connectionstatechange` event to hook).

**Test added**: `RTCPeer close() resets transfer state > clears an in-flight ack timer, so leaving the page never reports a broken transfer 30s later`. Uses a new `TestRTCPeer` (extends `RTCPeer`, overrides `sendRaw` to capture output like `TestPeer` does for the base class) plus the same minimal `FakeConn` stub pattern already used by the `RTCPeer disconnect branches` describe block. Starts a send, waits for the first `partition` message (which arms the timer), calls `close()`, advances past `ACK_TIMEOUT_MS`, asserts `onTransferBroken` was never called.

**Mutation check**: reverted `close()` to the original two-line body (no reset). Reran `pnpm exec vitest run src/files/drop/rtcPeer.test.ts`:
```
Tests  1 failed | 19 passed (20)
FAIL  ... > RTCPeer close() resets transfer state > clears an in-flight ack timer, so leaving the page never reports a broken transfer 30s later
  AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
  Received: [{ peerId: 'peer2', reason: 'timeout' }]
```
Exactly the target test went red, nothing else. Restored the fix; reran: 20/20 green.

## Important 2 — bare `else this.armAck()` armed even with no chunker

In the `partition-received` case, the `else` branch ran unconditionally, so a stray/duplicate `partition-received` arriving while `this.chunker` is `null` (idle peer, or a chunker whose `abort()` raced an in-flight `onPartitionEnd`) would still arm a 30s timer. The receive path never touches `ackTimer`, so nothing would cancel it — if a healthy incoming transfer happened to be active 30s later, the stray timer would fire, `hasActiveTransfer()` would read true (`digester !== null`), and `handleDisconnect('timeout')` would drop the half-assembled file and report a phantom broken transfer.

**Fix** (`src/files/drop/rtcPeer.ts`): `else this.armAck()` → `else if (this.chunker) this.armAck()`, with a comment naming both reachable routes (post-reset re-dial stray ack; chunker abort racing `onPartitionEnd`).

**Test added**: `Peer send-side timeouts > ignores a stray partition-received while idle, so it cannot arm a timer that later kills an unrelated incoming transfer`. Sends a stray `partition-received` on an idle `TestPeer` (no chunker), then starts a healthy incoming transfer that is deliberately left in-flight (header + one short chunk, below `PROGRESS_NOTIFY_STEP` so it doesn't itself emit anything), advances past `ACK_TIMEOUT_MS`, and asserts both `onTransferBroken` was never called and `hasActiveTransfer()` is still `true` (the incoming transfer must be untouched, not just "no report").

**Mutation check**: reverted to bare `else this.armAck()`. Reran `pnpm exec vitest run src/files/drop/rtcPeer.test.ts`:
```
Tests  1 failed | 19 passed (20)
FAIL  ... > Peer send-side timeouts > ignores a stray partition-received while idle, so it cannot arm a timer that later kills an unrelated incoming transfer
  AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
  Received: [{ peerId: 'peer2', reason: 'timeout' }]
```
Exactly the target test went red, nothing else. Restored the fix; reran: 20/20 green.

## Minor — inaccurate comment on the private-field assertion

The comment on the `ackTimer`-reaching-into-private-field assertion (in "clears the timer on transfer-complete...") claimed the stale handle "survives reassigning `ackTimer`" — false, since `armAck()` calls `clearAck()` before assigning, so two live timers can never coexist under the field. Rewrote it to say what's actually true: the handle is untouched (and still counting down) until *something* calls arm or clear again, and fires on its own if nothing does within the timeout.

Per the reviewer's note, also added the observable-behaviour companion test they verified independently: `Peer send-side timeouts > a timer surviving transfer-complete cannot kill a later unrelated incoming transfer to the same peer` — completes a small file's send fully (through `transfer-complete`), then starts a healthy incoming transfer left in-flight, advances past `ACK_TIMEOUT_MS`, and asserts neither `onTransferBroken` fires nor the incoming transfer gets touched.

**Kept both** the private-field test and the new observable-behaviour test, rather than replacing one with the other: the private-field version pinpoints the exact defect (a live timer object where there should be `null`) immediately after the triggering event, with no dependency on a second transfer; the observable-behaviour version proves the real-world consequence the reviewer's probe described (a healthy unrelated transfer actually gets killed). Together they cover both "is the bug present" and "does the bug matter," and the second one is a direct regression test for the reviewer's exact probe.

**Mutation check** (removing `clearAck()` from the `transfer-complete` case, same mutation as Important-2's sibling from the original pass) now turns **both** of these tests red together:
```
Tests  2 failed | 18 passed (20)
FAIL  ... > clears the timer on transfer-complete so a finished send never reports a timeout
  AssertionError: expected { refed: true, ... } to be null
FAIL  ... > a timer surviving transfer-complete cannot kill a later unrelated incoming transfer to the same peer
  AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
  Received: [{ peerId: 'peer2', reason: 'timeout' }]
```
Restored; reran: 20/20 green.

## Regression check: original three Task-8 tests still correct under the updated code

With both Important fixes now in place (the `if (this.chunker)` guard and the `close()` reset), re-ran the two original Step-5 mutations from the first pass to confirm they still behave correctly:

- Deleting `else if (this.chunker) this.armAck()` entirely → exactly `arms the same timeout while waiting for the final transfer-complete` went red (`Tests 1 failed | 19 passed`), all else green. Restored → 20/20 green.
- Deleting `this.clearAck()` from the `transfer-complete` case → covered above (now turns two tests red instead of one, both for the same underlying reason). Restored → 20/20 green.

## Final verification

```
pnpm exec vitest run src/files/drop/
 Test Files  12 passed (12)
      Tests  65 passed (65)

pnpm exec vue-tsc --noEmit
(no output — clean)
```

No full-suite run performed (dirty-tree OSS export gate), per instructions.

---

# Fix round 2 of 5 (reviewer feedback)

Reviewer verdicted round-1 fixes ADDRESSED, but found one new Important consequence created by round 1's `close()` change itself.

## Important — `peer-left` mid-send went silent, leaving a stale transfer card

Before round 1, "the other device vanished mid-transfer" got reported by accident: `close()` nulled the channel but left the chunker running, so its next `onChunk` → `sendRaw` found `this.channel === null` and called `handleDisconnect('disconnected')` itself — which is also what fired the (unwanted) `refresh()` re-dial of a peer that had just left.

Round 1's `close()` → `resetTransferState()` fix correctly killed that accidental path for `PeersManager.destroy()` (navigating away from `/files/drop`, where silence is intended), but it also killed it for `peer-left` (the other device actually vanishing while the user is still watching), where `resetTransferState()` now aborts the chunker before it can ever detect the null channel — so the send dies with no report, and since `stores/drop.ts` only clears `transfers.value[peerId]` from the `onTransferBroken` handler, the progress card for that peer would stay on screen forever.

**Fix** (`src/files/drop/peersManager.ts`, `peer-left` branch): added `peer?.handleDisconnect('disconnected')` immediately before `peer?.close()`, exactly as prescribed — order matters because `handleDisconnect` must run while transfer state is still live (`hasActiveTransfer()` true), and `close()`'s own `resetTransferState()` afterwards is a harmless no-op second reset. `destroy()` was deliberately left untouched (navigating away stays silent). Comment on the change names the pre-existing accidental-`refresh()` bug this deliberately avoids reintroducing, per the reviewer's note.

**Tests added** (`src/files/drop/peersManager.test.ts`):
- Extended `makeFakePeer()`'s shape with a `handleDisconnect: vi.fn()` slot (harmless addition; existing tests unaffected).
- `peer-left with an in-flight transfer reports onTransferBroken exactly once with reason disconnected`: injects a fake peer via the existing `makePeer` hook whose `handleDisconnect` mock mirrors the real `Peer.handleDisconnect`'s `wasActive`-guard behavior for the "active" case (calls `ev.onTransferBroken`), then asserts the event fired exactly once with `{ peerId: 'a', reason: 'disconnected' }` and that call order is `handleDisconnect` → `onTransferBroken` → `close` (verifying `handleDisconnect` genuinely runs before `close()`, not just that both get called).
- `peer-left for an idle peer reports nothing`: fake peer's `handleDisconnect` never calls `onTransferBroken` (mirroring the real guard when idle); asserts `onTransferBroken` is never called.

**Mutation check**: removed `peer?.handleDisconnect('disconnected')` from the `peer-left` branch. Reran `pnpm exec vitest run src/files/drop/peersManager.test.ts`:
```
Tests  1 failed | 5 passed (6)
FAIL  ... > PeersManager > peer-left with an in-flight transfer reports onTransferBroken exactly once with reason disconnected
  AssertionError: expected "vi.fn()" to be called once, but got 0 times
```
Exactly the target test went red (the idle test is unaffected either way, as expected for a "reports nothing" assertion). Restored the line; reran `pnpm exec vitest run src/files/drop/`: 67/67 green.

## Regression check: round-1 tests still correct

Re-ran both round-1 mutations against the current code:
- Reverted `RTCPeer.close()` to the pre-round-1 two-line body (no `resetTransferState()`) → exactly `RTCPeer close() resets transfer state > clears an in-flight ack timer, so leaving the page never reports a broken transfer 30s later` went red (`onTransferBroken` called with `reason: 'timeout'`), 19/20 else green. Restored → 20/20 green.
- Reverted `partition-received`'s `else if (this.chunker) this.armAck()` to bare `else this.armAck()` → exactly `ignores a stray partition-received while idle, so it cannot arm a timer that later kills an unrelated incoming transfer` went red (same symptom), 19/20 else green. Restored → 20/20 green.

## Final verification

```
pnpm exec vitest run src/files/drop/
 Test Files  12 passed (12)
      Tests  67 passed (67)

pnpm exec vue-tsc --noEmit
(no output — clean)
```

No full-suite run performed (dirty-tree OSS export gate), per instructions.
