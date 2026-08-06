# Task 7 report — MentionPopover.vue (@ mention drill-down panel)

## Files touched
- Created: `src/ai/components/shell/MentionPopover.vue`
- Created: `src/ai/components/shell/MentionPopover.test.ts`
- Modified: `src/ai/styles/tokens.scss` (+`--hairline-ring`, light + dark)
- Modified: `src/i18n/zh_cn.ts`, `src/i18n/en_us.ts` (+15 `aiMention*` keys each)

## Mechanical conversion checklist — how each item was satisfied
1. `$set(loadingPaths, ...)` / `$set(entriesByPath, ...)` (Vue2:215-234) → plain
   assignment on `ref<Record<string, ...>>` (`entriesByPath.value[abs] = ...`,
   `loadingPaths.value[abs] = true/false`). Vue3's Proxy-based reactivity tracks
   new keys without `$set`.
2. `beforeDestroy` (Vue2:195-197) → `onBeforeUnmount` removing the capture-phase
   `keydown` listener. The `open` watcher's add/remove pairing (Vue2:172-181) is
   kept as-is (`watch(() => props.open, ...)` adds on true, removes on false) —
   `onBeforeUnmount` is a redundant safety net exactly like Vue2 had both.
3. `v-for` + `v-else` on the same element (Vue2:44-46) → outer `<template v-else>`
   wrapping the `v-for` block; the empty-state branches use `v-if`/`v-else-if`
   siblings, and the list itself is the `v-else` template.
4. `<template v-for>` key moved onto the `<template>` tag (Vue2:15-18). Vue2 put
   two different keys (`c${i}` on the icon, `s${i}` on the span) on children of
   an implicit per-iteration fragment; Vue3's `<template v-for>` only accepts one
   key on the template itself, so both children now share `:key="i"` on the
   `<template>`.
5. `>>>` (Vue2:370) → `:deep(mark)`.
6. `hi` watcher's `$nextTick` + `querySelector('[data-i="N"]').scrollIntoView(...)`
   (Vue2:187-193) → `nextTick(...)` + `listEl` template ref + optional-chained
   `el?.scrollIntoView?.(...)`. The `?.` guard on `scrollIntoView` is the brief's
   pre-approved defensive deviation (jsdom doesn't implement it).
7. Added `catch` to both `loadMounts`/`loadCurrent` — see "Vue2 defects" below.
8. `popStyle` (Vue2:161-169) ported verbatim (no-anchor fallback `{left:'24px',
   bottom:'120px', width:'460px'}`; anchored case computes `left`, `bottom =
   window.innerHeight - r.top + 8`, `width = min(r.width, 520)`).
9. `onKey` (Vue2:235-268) ported case-by-case: ArrowDown/ArrowUp clamp `hi`;
   Tab emits `drill-in` (non-file) or `pick` (file); Enter/Space emit `pick`;
   `/` emits `drill-in` only for non-file; Escape emits `close`; Backspace emits
   `pop-segment` only when `!query && segments.length > 0`. All still call
   `e.preventDefault()` in the same branches as Vue2.
10. Styles: `.mention-pop` keeps `position:fixed; z-index:1000; pointer-events:
    auto`. The two color conversions are both done (see Theme section below).
    `mention-rise`/`blink` keyframes copied unchanged.

## i18n keys added (15, both `zh_cn.ts` and `en_us.ts`)
Walked Vue2 template lines 1-80 for every visible string:
`aiMentionAllDrives`, `aiMentionDrives`, `aiMentionItems`, `aiMentionLoading`,
`aiMentionNoMatch` (`{query}` param), `aiMentionEmptyHere`,
`aiMentionTryDifferentName` (new — not in the brief's starting list; covers the
"Try a different name, or press" prefix before the `⌫` kbd, brief's own
`aiMentionUpHint` only covers the "to go up" suffix), `aiMentionUpHint`,
`aiMentionFolder`, `aiMentionIgnored`, `aiMentionKbdNav`, `aiMentionKbdDrill`,
`aiMentionKbdSelect`, `aiMentionKbdUp`, `aiMentionKbdClose`.

Deliberately left untranslated (kept as literal glyphs, matching the existing
convention elsewhere in this codebase of never translating kbd symbols, e.g.
`topbarSearchKbd: '搜索 (⌘K)'`): `↑↓`, `Tab`, `Space`, `⌫`, `esc` — only the
semantic action word next to each kbd got a key.

`aiMentionNoMatch`'s single localized string
(`没有匹配 "{query}" 的结果` / `No matches for "{query}"`) replaces Vue2's
two-node `No matches for <b>"{{query}}"</b>` structure (bold wrapping the
quoted query) — the flat i18n string already embeds the quotes, so the `<b>`
wrapper was dropped as unnecessary given the key shape the brief specified.

## Vue2 defects fixed (with in-code comments)
1. **`loadMounts` missing `catch`** (Vue2 `MentionPopover.vue:199-213`,
   `try/finally` with no `catch`) — a rejected `listMounts()` promise was an
   unhandled rejection. Fixed with an empty `catch` (comment in
   `MentionPopover.vue` above `loadMounts`); mounts stays `[]`, retried on next
   open since `loadMounts` only runs while `mounts.length === 0`.
2. **`loadCurrent` missing `catch`** (Vue2 `MentionPopover.vue:215-234`, same
   defect) — fixed identically; `entriesByPath[abs]` stays unset so a retry
   happens next time that path is requested.
3. **New finding — `open` watcher fire-and-forget race** (Vue2
   `MentionPopover.vue:172-181`): `loadMounts()` and `loadCurrent()` are both
   called without awaiting the first. `currentAbsolute` resolves segments
   through `this.mounts`, so if the component is created/opened with
   `segments` already non-empty *and* `mounts` is still empty (first open),
   `loadCurrent()` computes `abs = ''` and no-ops — and nothing ever retries it,
   since there's no watcher on `mounts`. This is exactly the scenario the
   brief's Step-1 test #2 (`有 segments 时拉该目录条目`) exercises (mounts
   fresh with `segments: ['Drive1']`), and it would fail against a literal
   port. Fixed by `await`-ing `loadMounts()` before deciding whether to call
   `loadCurrent()` in the `open` watcher, with an explanatory comment at both
   the file header and inline at the watcher. This is a "logic = follow
   correctness" fix per the port-discipline instructions, not a request to
   re-architect anything else.
4. Also used `{ immediate: true }` on the `open` watcher (Vue2's watcher is not
   immediate) — necessary because in this codebase's test/usage contract the
   component can be mounted already `open: true` (all 7 given tests do this),
   and Vue2's non-immediate watcher would never fire in that case, so neither
   the initial `listMounts` fetch nor the `keydown` listener would ever
   attach. Documented inline as a deliberate correctness adjustment, not left
   silent.

## Mount/entry field mapping — one non-obvious decision
The Vue2 source reads `m.total`/`m.used` off each mount object for
capacity/used. I kept `m.total` → `item.capacity` and `m.used` → `item.used`
(matching the real backend struct `NimoOS-AI/route/v2/fs.go` `Mount{Total,
Used uint64}`) rather than the brief's Step-1 mock field name `capacity`
(`{ label: 'Drive1', path: '/DATA', capacity: 100, used: 20 }`) — none of the
7 given tests assert on the capacity/used values themselves, so both mappings
pass; `m.total` is correct against the actual API contract. Per the interface
in the "Produces" section, `capacity`/`used` are raw numbers (not
pre-formatted strings like Vue2's mapper produced) — formatting now happens at
render time via `formatSize()` (== `formatBytes`), matching how `size` is
already handled.

## Theme / token conversion
- `--hairline-ring` added to `src/ai/styles/tokens.scss`: light block value
  `rgba(0, 0, 0, 0.04)`, dark block value `rgba(255, 255, 255, 0.06)`, each with
  a short comment, placed next to the `--line*` group in both blocks.
- `.mention-pop`'s `box-shadow` hairline term now reads
  `0 0 0 0.5px var(--hairline-ring)` in place of the literal
  `rgba(0,0,0,0.04)`.
- Deleted the Vue2 `[data-theme="dark"] .mention-pop { background: rgba(36,
  38, 44, 0.85) }` override entirely — `.agent-app` dark block already defines
  `--glass-strong: rgba(28, 28, 30, 0.82)`, so no replacement rule is needed.

Color-literal grep (must be empty per the brief):
```
$ grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/MentionPopover.vue
(no output)
```

## Test commands and results
```
$ pnpm test -- src/ai/components/shell/MentionPopover.test.ts src/i18n/parity.test.ts
 Test Files  2 passed (2)
      Tests  10 passed (10)

$ pnpm exec vue-tsc --noEmit
(no output — clean)

$ pnpm test        # full suite, sanity check
 Test Files  241 passed (241)
      Tests  1579 passed (1579)
```
(Ran the brief's Step-2 "confirm failing" step first: before the component
existed, `pnpm test -- src/ai/components/shell/MentionPopover.test.ts` failed
with "Failed to resolve import ./MentionPopover.vue" — recorded, not
re-pasted here.)

## Noticed but deliberately left alone
- `onKey`'s `ArrowDown` clamp (`Math.min(hi.value + 1, list.length - 1)`) can
  produce `hi = -1` when `list.length === 0` (e.g. list momentarily empty while
  loading/filtering to zero) — this exactly matches Vue2's own arithmetic and
  has no visible effect (nothing is rendered to mark `data-active` at `hi=-1`
  since the list is empty), so left as-is rather than "fixing" behavior the
  brief didn't ask about.
- The component doesn't validate `anchorRect`'s shape beyond reading
  `left`/`top`/`width` — same as Vue2, and out of scope (anchoring is wired by
  the composer in a later task).
- Not wired into any composer/host component — per the task description, this
  is intentionally a standalone leaf component; wiring is later P1c work.

## Status
DONE. Commit: (see below)

## Fix pass (review fixes, 2026-07-27)

Two review findings applied against the already-landed component.

### Fix 1 — capture-phase keydown listener attached too late / could leak

Final `watch(() => props.open, ...)` in `MentionPopover.vue`:

```js
watch(
  () => props.open,
  (v) => {
    if (v) {
      hi.value = 0
      // Attach the capture-phase listener synchronously, in the same tick
      // `open` becomes true — before any await. This matters for two reasons:
      // (1) keys pressed while the mounts fetch is still in flight must work
      // (Vue2 attached synchronously too, since its fetches were fire-and-forget);
      // (2) it guarantees nothing ever attaches a listener *after* this watcher
      // callback has already returned — so if the component unmounts while the
      // mounts fetch is still pending, onBeforeUnmount's removeEventListener is
      // always the last word and no listener is left dangling with no cleanup
      // path (review fix — real trigger: open the popover, then close/navigate
      // away before the network round-trip finishes).
      window.addEventListener('keydown', onKey, true)
      // See file-header note: await the mounts fetch first when it's needed,
      // so currentAbsolute (which depends on `mounts`) is resolvable before
      // loadCurrent runs — fixes a Vue2 ordering bug (see header comment).
      // Run this in an inner async IIFE (rather than making the watcher
      // callback itself async) so the listener attach above always happens
      // synchronously and this awaited work never gates it.
      ;(async () => {
        if (mounts.value.length === 0) await loadMounts()
        if (props.segments.length > 0) loadCurrent()
      })()
    } else {
      window.removeEventListener('keydown', onKey, true)
    }
  },
  { immediate: true },
)
```

The file-header comment block got one paragraph appended (dated) explaining why the
`addEventListener` line must stay synchronous and before any `await`.

### Fix 2 — lost bold in the "no matches" empty state

`src/i18n/zh_cn.ts` / `src/i18n/en_us.ts`: replaced `aiMentionNoMatch: '...{query}...'`
with `aiMentionNoMatchTpl` (quotes moved out of the translated string, into the
`<i18n-t>` named slot markup):

```ts
// zh_cn.ts
aiMentionNoMatchTpl: '没有匹配 {query} 的结果',
// en_us.ts
aiMentionNoMatchTpl: 'No matches for {query}',
```

Template in `MentionPopover.vue`:

```html
<i18n-t v-if="query" keypath="aiMentionNoMatchTpl" tag="span">
  <template #query><b>"{{ query }}"</b></template>
</i18n-t>
```

Renders `No matches for <b>"zzz"</b>` in English (byte-for-byte Vue2 wording) and
`没有匹配 <b>"zzz"</b> 的结果` in Chinese — quoted query is a real `<b>` element.

### RED (before fix) — tail

```
 FAIL  MentionPopover > open 时同步挂载 keydown 监听——mounts 请求未完成时按键也生效
AssertionError: expected undefined to be truthy
 ❯ src/ai/components/shell/MentionPopover.test.ts:97:32
    97|     expect(w.emitted('close')).toBeTruthy()

 FAIL  MentionPopover > 打开后 mounts 请求未完成即卸载——不遗留监听(add/remove 不成对,监听永久挂着)
AssertionError: expected true to be false // Object.is equality
 ❯ src/ai/components/shell/MentionPopover.test.ts:132:29
    132|       expect(stillAttached).toBe(false)

 FAIL  MentionPopover > 无匹配空态:引号内的 query 用 <b> 加粗渲染
AssertionError: expected false to be true
 ❯ src/ai/components/shell/MentionPopover.test.ts:128:24
    128|     expect(b.exists()).toBe(true)

 Test Files  1 failed (1)
      Tests  3 failed | 7 passed (10)
```

(An intermediate version of the leak test used a live `window.dispatchEvent` +
`defaultPrevented` check instead of add/remove-call tracking; it also went RED
pre-fix, but was replaced because earlier tests in this same suite mount with
`open: true` and never call `w.unmount()`, leaving stale `keydown` listeners on
jsdom's shared `window` — a live-dispatch assertion in a later test can't tell
"this test's listener leaked" from "an earlier test's listener is still there."
The final test instead spies on `addEventListener`/`removeEventListener`, keyed
by `type==='keydown' && capture===true`, and tracks per-function-reference
attached/detached state recorded only during this test's own spy lifetime —
verified to fail against the pre-fix code with the same assertion above.)

### GREEN (after fix) — tail

```
 RUN  v4.1.9 /home/nimo/NimoTech/.sp8/NimoOS-New-UI

 Test Files  2 passed (2)
      Tests  13 passed (13)
```
(`src/ai/components/shell/MentionPopover.test.ts` + `src/i18n/parity.test.ts`; full
repo suite also re-run clean: 241 files / 1582 tests passed.)

### Verification grep (no color literals)

```
$ grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/MentionPopover.vue
(no output)
```

`pnpm exec vue-tsc --noEmit` → 0 errors.
