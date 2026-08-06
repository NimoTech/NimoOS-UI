# P1c1 补丁验收第 2 轮 Task 5 —— Report

Files touched (only these two, per constraint):
- `src/ai/components/shell/AgentComposer.vue`
- `src/ai/components/shell/AgentComposer.test.ts`

## Item A — mention panel Esc-dismissal memory

Root cause confirmed by reading the code before touching it: the slash panel already had
`slashDismissedText` + `openSlashIfNotDismissed()` (Esc records the text at close time; a
later focus/click re-sync only reopens if the text differs). The `@` panel had no equivalent.
Repro: type `@doc` → Esc (`MentionPopover`'s `close` emit, bound to bare `resetMention`) →
click back into the textarea → `onFocus` → `syncMentionFromCaret` → `scanMention`
rediscovers `@doc` from the text and reopens uninvited. Existing tests didn't catch this
because they happened to drill into a name containing a space (`System (/DATA)`), which
`scanMention` can never rediscover — that was a coincidence, not a fix.

### Implementation — mirrors the slash side 1:1 in shape/naming

- **New ref**: `mentionDismissedText = ref<string | null>(null)` (declared next to
  `slashDismissedText`, same comment style).
- **New helper**: `openMentionIfNotDismissed(v, start, segs, query)` — mirrors
  `openSlashIfNotDismissed(v)`. If `mentionDismissedText.value === v`, forces
  `mentionOpen.value = false` and returns; otherwise sets `mentionStart`/`mentionSegs`/
  `mentionQuery`/`mentionOpen` and calls `updateAnchor()`.
- **Read sites** (both branches of `syncMentionFromCaret`, per the task instruction):
  - The state-trusted `parseActiveMention` branch (`mentionSegs.value.length > 0`) now
    calls `openMentionIfNotDismissed(v, mentionStart.value, mentionSegs.value, parsed.query)`
    instead of writing `mentionQuery`/`mentionOpen` directly.
  - The `scanMention` discovery branch calls
    `openMentionIfNotDismissed(v, scan.start, scan.segments, scan.query)` instead of writing
    directly.
  - Both routes funnel through the same gate so the "stays closed until text changes" rule
    can't drift between the two discovery mechanisms — even though in practice, after an
    Esc-triggered `resetMention()`, `mentionSegs` is always `[]` by the time the next sync
    runs, so only the `scanMention` branch is actually reachable in the current call graph.
    The `parseActiveMention` branch is still gated defensively, matching the letter of the
    brief and guarding against any future refactor that stops clearing `mentionSegs` on Esc.
- **Write site**: `onMentionPopClose()` — new handler bound to `MentionPopover`'s `@close`
  (previously bound directly to `resetMention`). It calls `resetMention()` first (preserves
  the existing "Esc is a full reset" invariant), then writes
  `mentionDismissedText.value = text.value` *after* the reset — order matters, since
  `resetMention()` itself nulls the dismissal memory (see below); writing after reset avoids
  the handler immediately erasing what it just recorded.
- **Clear sites**: added a single line inside `resetMention()`:
  `mentionDismissedText.value = null`. This fires on every full-reset path already in the
  codebase: `pickItem` (select), `submit()` (send), the `activeSessionId` watcher
  (session-switch), `onSlashPickTarget` (text cleared via `/init` completion), and the
  `syncMentionFromCaret` fallback when no mention token is discovered at all (covers "clear
  the text entirely"). No new clear call sites were needed — piggybacking on the existing
  `resetMention()` single point of truth was sufficient and kept the change minimal.
- **Distinction preserved**: `onBlur` still calls `hideMentionPanel()` (hide-only, no
  `mentionDismissedText` write, segments/query preserved) — untouched. Only the Esc/`close`
  path writes the dismissal memory.
- Both the new `mentionDismissedText` ref and the file-header comment block explicitly note
  that Vue2 has no equivalent mechanism — this is a defect fix (project rule 2026-07-27),
  not a 1:1 port gap.

### RED tails (before the fix, on the actual test file used)

Test 1 ("Esc 关闭后重新聚焦不复活"):
```
AssertionError: expected true to be false // Object.is equality
 ❯ AgentComposer.test.ts:654:31
    await ta.trigger('focus')
    expect(pop.props('open')).toBe(false)
                              ^
```
Test 4 ("钻取过的词被 Esc 关闭后同样不复活..."): same shape, failed at the equivalent
post-Esc-focus assertion (`AgentComposer.test.ts:700`). Tests 2 and 3 passed even before the
fix — they only assert "differs → reopens" / "cleared text → fresh token opens", which were
already true with no memory at all; they exist to pin the complementary behavior once the
feature lands, not to catch the regression by themselves.

### GREEN tail (after the fix)

```
 Test Files  1 passed (1)
      Tests  50 passed (50)
```
(full `AgentComposer.test.ts` file, including all 4 new Item A cases and the 1 new Item B
case.)

## Item B — drillIn caret math with trailing text: verdict = FAILED, fixed

The reviewer's concern was real, but my first attempt at a test produced a **false pass**
against the unmodified code — worth recording since it's a genuine test-writing pitfall, not
just a curiosity. `el.focus()` inside `drillIn`'s `nextTick` callback does synchronously
re-enter `onFocus` → `syncMentionFromCaret` (confirmed by instrumenting `el.focus`/
`el.addEventListener('focus', ...)` directly in a scratch version of the test), which mutates
`mentionQuery` via a *new* reactive write. That write is only reflected in the child
component's props after Vue's scheduler flushes — which does **not** happen within a single
`await w.vm.$nextTick()` chained directly onto the same emit, because the newly-queued job
from the re-entrant handler is scheduled *after* that tick resolves. A test that reads
`pop.props('query')` after only one `nextTick()` therefore observes a stale, pre-bug snapshot
and reports `''` even on the buggy implementation. Using `flushPromises()` (drains enough
microtask rounds to reach the converged state) exposed the real value.

### RED tail (genuine, on the corrected test, before the fix)
```
AssertionError: expected ' tail' to be '' // Object.is equality
 ❯ AgentComposer.test.ts:743:32
    expect(pop.props('query')).toBe('')
                                ^
```
`segments` was already correctly `['Drive1']` in both the buggy and fixed versions (segments
are written directly by `drillIn`, not re-derived by the re-entrant sync) — only `query` was
corrupted.

### Fix applied

In `drillIn`'s `nextTick` callback, swapped the order:
```js
// before (buggy):
el?.focus()
el?.setSelectionRange(result.caretPos, result.caretPos)
grow()

// after (fixed):
el?.setSelectionRange(result.caretPos, result.caretPos)
el?.focus()
grow()
```
`setSelectionRange` doesn't require the element to already be focused, and `focus()` does not
reset an existing selection — so setting the caret first means the focus-triggered re-entrant
sync reads the correct post-drill position instead of the DOM's post-`.value`-assignment
default (end of string). Comment added at the `drillIn` declaration naming the mechanism
(re-entrant `onFocus` call, why order matters, why the swap is safe).

### GREEN tail (after the fix)
```
 Test Files  1 passed (1)
      Tests  50 passed (50)
```

## Full verification

- `pnpm test` (full suite): **244 files / 1661 tests, all passed** (baseline was 244/1656 —
  net +5 tests: 4 Item A + 1 Item B).
- `pnpm exec vue-tsc --noEmit`: 0 errors (no output).
- `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/AgentComposer.vue`:
  no output (no new color literals introduced).

## Noticed but left alone

- `pickItem`'s own `nextTick` callback has the same `el.focus(); el.setSelectionRange(...)`
  order as `drillIn` did before the fix. In practice it's safe today: `pickItem` calls
  `resetMention()` *before* scheduling the `nextTick`, so by the time the focus-triggered
  re-entrant sync runs, `mentionSegs` is already `[]` and the mention token is gone from the
  text (stripped by `stripMentionToken`), so `scanMention` either finds nothing or a
  genuinely new `@` further back — there's no stale-segments contamination path like
  `drillIn` had. Left untouched: out of scope (task restricted the fix to `drillIn`), and no
  test demonstrated a real defect there.
- `popSegment` intentionally never calls `el.focus()` at all (Vue2 parity, already commented
  in the source) — not a candidate for the same class of bug.
- Did not add a `mentionDismissedText`-equivalent clear inside `onSlashPickTarget`'s already
  existing `resetMention()` call, or the session-switch watcher's `resetMention()` call —
  both already get the clear for free since it's centralized inside `resetMention()` itself;
  no separate edit was needed there.
