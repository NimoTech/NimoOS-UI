# Task 5 report — pure modules for composer text/cursor math, attachment meta, mention format, ctx-usage geometry

## composerText.ts (from AgentComposer.vue:180-196 / 300-335 / 355-428)

Ported `getExt`, `basename`, `dirname` verbatim (same `i < 1` guard on `getExt`
so dotfiles and no-extension names return `''`; same trailing-slash strip in
`basename`/`dirname`; `dirname` collapses to `/` when the last `/` is at index
0).

`scanMention` is a pure reformulation of the `onInput` inline back-scan
(AgentComposer.vue:312-334): walks back from `caret`, an `@` triggers only at
index 0 or when preceded by whitespace (so `me@host` doesn't trigger),
hitting whitespace before an `@` aborts. No behavior change — just took an
explicit `caret` param instead of reading `ta.selectionStart` inline.

`buildDrillText`/`buildPopText`/`stripMentionToken` port the text+cursor
splice math from `drillIn`/`popSegment`/`pickItem` (:355-428) exactly,
including the `caretPos = (before + newPath).length` computation and
`buildPopText`'s collapse to a bare `@` when segments run out.

No bugs found in this file's logic.

## attachmentMeta.ts (from AgentComposer.vue:160-171 / 460-504 / 531)

`TEXT_EXTS`, `DOCUMENT_EXTS`, `ACCEPT_TYPES` are copied verbatim (test
inlines the exact Vue2 array literals and re-derives `ACCEPT_TYPES` to
compare string-for-string). `MAX_ATTACHMENT_BYTES = 500 * 1024 * 1024 =
524288000`, matching the `file.size > 500 * 1024 * 1024` check at
AgentComposer.vue:531.

**Correction to the brief's candidate code names**: the brief listed
`scanned_pdf/encrypted_pdf/too_large/timeout/corrupted/cache_failed/
not_installed/lost` as candidates but flagged the Vue2 source as
authoritative. Reading `docErrorLabel`/`docErrorShort`
(AgentComposer.vue:461-470, 475-484) shows the actual 8 `extract_error` codes
are: `empty_scanned`, `encrypted`, `zip_bomb`, `timeout`, `parse_error`,
`sidecar_write_failed`, `not_installed`, `vanished`. Used these real codes,
mapped to i18n key names: `aiDocErrEmptyScanned`, `aiDocErrEncrypted`,
`aiDocErrZipBomb`, `aiDocErrTimeout`, `aiDocErrParseError`,
`aiDocErrSidecarWriteFailed`, `aiDocErrNotInstalled`, `aiDocErrVanished` (full
labels) and `aiDocErrShortScannedDoc`/`ShortEncrypted`/`ShortTooLarge`/
`ShortTimedOut`/`ShortParseFailed`/`ShortCacheFailed`/`ShortParserMissing`/
`ShortLost` (short labels). Unknown code → `{ key: 'aiDocErrGeneric', params:
{ code } }` (mirrors Vue2's `this.$t('Document extraction failed: {code}',
{ code })` fallback) and `'aiDocErrShortParse'` (mirrors Vue2's `'Parse
failed'` fallback). These are key *names* only — no zh_cn/en_us strings added,
per task scope.

No Vue2 bugs found here.

## mentionFormat.ts (from MentionPopover.vue:87-107 / 273-299)

`DRIVE_PALETTE` kept as literal hex array with a comment marking it a
registered brand-color exception (per project convention, same category as
`SearchFullResults.vue`'s `PALETTES`). `driveColor` hash is verbatim.

`formatBytes` thresholds/output ported exactly (`1024`/`1024**2`/`1024**3`
cutoffs, `.toFixed(1)` for KB/MB, `.toFixed(2)` for GB) — **not** reusing
`src/files/util/format.ts`'s `renderSize()`, which has different thresholds
and output format, per instructions.

`formatTime`, `escapeHtml`, `highlightMatch` ported verbatim (unix-seconds
`> 1e12` heuristic, same-year → month/day vs. other-year → year/month
locale formatting, 5-char HTML escape map, case-insensitive first-match
highlight wrapped in `<mark>` with all three surrounding segments escaped).

**`getExt` duplication resolved per instructions**: compared
`AgentComposer.vue:180-183` and `MentionPopover.vue:103-107` — byte-identical
(`i < 1` guard, same lowercase slice). Exported once from `composerText.ts`
and re-exported from `mentionFormat.ts` with a comment explaining why.

No Vue2 bugs found here.

## contextUsage.ts (from ContextUsageBar.vue:2-28)

`RING_R = 15.5`, `RING_C = 2π·R`, `formatTokens`, `levelFor` (`level`
computed), `dashArrayFor` (`dashArray` computed) all ported verbatim,
including the `>= 90` / `>= 70` thresholds and the `Math.min(100,
Math.max(0, pct))` clamp before computing the filled arc length. Test file
ports all 8 pure-function cases from `ContextUsageBar.spec.js:8-52` (the
`rendering` describe block in that spec mounts the SFC and is out of scope
for a pure-module test) plus the two boundary cases (70→warn, 90→danger) the
brief asked to add.

No Vue2 bugs found here.

## Bugs found and fixed: none

All four modules' Vue2 source logic was already correct for the behavior
observed; nothing needed a documented deviation.

## Commands run

```
pnpm test -- src/ai/util/composerText.test.ts src/ai/util/attachmentMeta.test.ts src/ai/util/mentionFormat.test.ts src/ai/util/contextUsage.test.ts
```
Before implementation: `4 failed (4)` — "Failed to resolve import" (modules didn't exist).
After implementation:
```
 Test Files  4 passed (4)
      Tests  46 passed (46)
```

```
pnpm exec vue-tsc --noEmit
```
→ no output, 0 errors.

```
pnpm test
```
(full suite) →
```
 Test Files  239 passed (239)
      Tests  1565 passed (1565)
```

## Commit

`33d3aef` — "SP8-P1c1: pure modules for composer text/cursor math, attachment meta, mention format, ctx-usage geometry"

---

## Fix pass (review fixes, SP8-P1c1 follow-up)

A reviewer found the four modules' implementations correct but flagged three
test-coverage gaps (tests that can't fail on a real regression) plus one
documentation gap (an exception comment claiming a central registration that
didn't exist). Fixed exactly these four; no `.ts` implementation logic
changed.

### Fix 1 (Important) — `formatTime` tautological tests

File: `src/ai/util/mentionFormat.test.ts`

Old: two cases only asserted `out.length > 0` for unix-seconds and
unix-ms inputs — passes even if the `t > 1e12 ? t : t * 1000` branch is
flipped.

New:
```ts
it('unix 秒(≤1e12)要 ×1000:与对应毫秒值渲染同一天(同年:含月日、不含年份)', () => {
  const currentYear = new Date().getFullYear()
  const anchorMs = new Date(currentYear, 0, 15, 12, 0, 0).getTime()
  const anchorSeconds = Math.floor(anchorMs / 1000)
  expect(formatTime(anchorSeconds)).toBe(formatTime(anchorMs))
  expect(formatTime(anchorSeconds)).not.toMatch(new RegExp(String(currentYear)))
  expect(formatTime(anchorSeconds)).toContain('15')
})
it('unix 毫秒直接使用:与手动 ×1000 的秒值渲染一致(跨年:含年份)', () => {
  const pastYear = new Date().getFullYear() - 3
  const anchorMs = new Date(pastYear, 5, 20, 12, 0, 0).getTime()
  const anchorSeconds = Math.floor(anchorMs / 1000)
  expect(formatTime(anchorMs)).toBe(formatTime(anchorSeconds))
  expect(formatTime(anchorMs)).toMatch(new RegExp(String(pastYear)))
})
```
Deterministic: anchors are derived from `new Date().getFullYear()` (not
"today"), so they don't drift across days/years the way `Date.now()` would.

**Regression-sensitivity — verified empirically, not just reasoned.**
Temporarily changed `mentionFormat.ts` line 41 from
`new Date(t > 1e12 ? t : t * 1000)` to `new Date(t > 1e12 ? t * 1000 : t)`
(the exact branch-flip the reviewer described) and reran the suite:
```
FAIL  formatTime > unix 秒...: expected 'Jan 1970' to be 'Dec 58009'
FAIL  formatTime > unix 毫秒...: expected 'Apr 55436' to be 'Jan 1970'
```
Both new tests failed as predicted (seconds misread as ms → epoch 1970;
ms erroneously re-multiplied → a date ~58000 years out). Reverted the file
back to the original (verified via diff against a pre-edit backup) and
reran — all green. The old `out.length > 0` assertions would have passed
unchanged through this exact breakage.

### Fix 2 (Important) — `scanMention` never tests mid-string caret

File: `src/ai/util/composerText.test.ts`

```ts
it('caret 在字符串中间:只应扫描到 caret 为止,忽略其后的文本', () => {
  const t = '@Drive1/do tail'
  const caret = t.indexOf('do') + 'do'.length
  expect(scanMention(t, caret)).toEqual({ open: true, start: 0, segments: ['Drive1'], query: 'do' })
})
```

**Regression-sensitivity — verified empirically.** Changed `scanMention`'s
`let i = caret - 1` to `let i = text.length - 1` (i.e. the implementation
ignoring its `caret` argument, scanning from end-of-string instead). Reran:
the new test failed (`scanMention` walked back from `'l'` in `'tail'`, hit
the space before `'do'`, and aborted → `{ open: false, ... }` instead of the
expected `{ open: true, segments: ['Drive1'], query: 'do' }`). All 13
pre-existing cases still passed (they all use `caret = text.length`, so the
bug is invisible to them) — confirming this gap was real and now closed.
Reverted the file (diff-verified against backup); reran — all green.

### Fix 3 (Important) — `buildPopText` never tests tail preservation

File: `src/ai/util/composerText.test.ts`

```ts
it('buildPopText:保留光标之后的原文(caret 在字符串中间)', () => {
  const r = buildPopText('@Drive1/docs/ tail', 0, 13, ['Drive1', 'docs'])
  expect(r.text).toBe('@Drive1/ tail')
  expect(r.segments).toEqual(['Drive1'])
})
```
Mirrors the existing `buildDrillText` tail-preservation case in form.

**Regression-sensitivity — verified empirically.** Changed `buildPopText`'s
`const after = text.slice(caret)` to `const after = text.slice(text.length)`
(dropping the tail unconditionally). Reran: the new test failed
(`expected '@Drive1/' to be '@Drive1/ tail'`) while the other 13 cases
(including the pre-existing `buildPopText` case, which uses
`caret = text.length` so `after` is always `''` there) kept passing —
confirming only the new test catches this class of bug. Reverted the file
(diff-verified against backup); reran — all green.

### Fix 4 (Minor) — register `DRIVE_PALETTE` in the central exception registry

`mentionFormat.ts`'s header comment (lines 12-15) already claimed
`DRIVE_PALETTE` was "one of this repo's registered color-literal
exceptions", pointing at `src/ai/styles/tokens.scss` header lines 7-18 and
`docs/THEMING.md` §6 — but neither actually listed it. Added it to both
(no token values touched):

- `src/ai/styles/tokens.scss` (after the existing seed-indexed-mosaic
  exception paragraph, before the closing `=====` line): a new paragraph
  registering `src/ai/util/mentionFormat.ts`'s `DRIVE_PALETTE` as a
  drive-identity color (hashed by drive label, skin-independent, preserved
  verbatim in both themes) — a distinct category from the seed-indexed
  placeholder mosaics, grouped instead with `.ic-*` brand gradients.
- `docs/THEMING.md` §6 exception table: new row —
  `DRIVE_PALETTE（按 drive/挂载点标签哈希取色的身份识别色）` /
  `src/ai/util/mentionFormat.ts` / rationale paragraph matching the existing
  row style.

No test applies to this fix (it's a doc/comment-only change); verified by
inspection that the wording now matches what the in-file comment claims.

### Verification commands + output tail

```
pnpm test -- src/ai/util/composerText.test.ts src/ai/util/mentionFormat.test.ts src/ai/util/attachmentMeta.test.ts src/ai/util/contextUsage.test.ts
```
```
 Test Files  4 passed (4)
      Tests  48 passed (48)
```
```
pnpm exec vue-tsc --noEmit
```
→ no output, 0 errors.

`git status --short` before commit showed exactly the four intended files
changed: `docs/THEMING.md`, `src/ai/styles/tokens.scss`,
`src/ai/util/composerText.test.ts`, `src/ai/util/mentionFormat.test.ts`.
No `.ts` implementation file has a net diff (each was temporarily broken
for regression-sensitivity verification, then restored and diffed byte-for-
byte against a pre-edit backup before the final test/tsc run above).
