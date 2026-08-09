# Task 11 report — convert McpInstallCard and ConfirmCard to useConfirmResolve

## Scope done

1. `src/ai/components/blocks/McpInstallCard.vue` — converted to
   `useConfirmResolve<'allow' | 'deny'>()`. Removed the `<button class="undo"
   @click="decision = null">{{ t('aiChange') }}</button>` that was left over from
   before `McpPermissionCard` had it deleted on this branch, plus its `.undo` /
   `.undo:hover` CSS. Added an `expired` branch (mirroring McpPermissionCard's markup)
   with the `[data-decision="expired"]` CSS rules.

2. `src/ai/components/blocks/ConfirmCard.vue` — converted to
   `useConfirmResolve<'yes' | 'no'>()`. Template now branches `expired` → `decision` →
   button row, instead of `resolved`/`resolvedValue`/`error`. The success-path markup
   (`{{ resolvedValue ? t('aiAccepted') : t('aiDenied') }} · {{ new
   Date().toLocaleTimeString() }}`) is byte-identical in output, just re-expressed as
   `decision === 'yes' ? t('aiAccepted') : t('aiDenied')`.

3. `src/ai/composables/useConfirmResolve.ts` — fixed the non-409 branch to prefer a
   **string** `e.response.data.detail` over `e.message` over `t('aiUnknownError')`
   (previously it only used `e.message`), so converting ConfirmCard doesn't downgrade
   its existing error text. This strictly improves the three MCP cards that already
   use the composable, since they previously only ever saw `e.message`.

4. `src/ai/components/blocks/PermissionRequestCard.vue` — left the 409 behavior alone
   (silently marks the request resolved instead of erroring), added an English comment
   at the 409 branch stating this divergence from `useConfirmResolve` is intentional
   and why, so it doesn't get "fixed" into consistency later.

## aiChange grep result

```
src/ai/knowledge/views/SettingsView.test.ts:1926:      ['aiKbSetChange', 'aiChange'],
src/i18n/zh_cn.ai.ts:244:  aiChange: '更改',
src/i18n/en_us.ai.ts:226:  aiChange: 'Change',
```

`McpInstallCard.vue`'s own usage is gone (that's the point), but
`SettingsView.test.ts` still references the `aiChange` key literal in its
key-consistency pairing table (`expect(zh['aiKbSetChange']).toBe(zh['aiChange'])` and
the `en` equivalent) — that's a real consumer, just not a UI one. **Kept the key in
both `zh_cn.ai.ts` and `en_us.ai.ts`** rather than deleting it, since deleting it would
break that test.

## Tests added

- `src/ai/composables/useConfirmResolve.test.ts`: two new cases pinning the error-detail
  preference order — string `response.data.detail` wins over `e.message`; a non-string
  `detail` (e.g. an object) falls back to `e.message`.
- `src/ai/components/blocks/BlockRenderer.batchA.test.ts`: extended the existing
  `ConfirmCard` and `McpInstallCard` describe blocks (no new file, per the "extend
  rather than duplicate" instruction) with, for each card: a 409 case asserting the
  card text contains the expired message and `findAll('button')` is length 0, and a
  500 case asserting the buttons are still present/clickable. Also added a "Change"
  button removal regression test for `McpInstallCard`, mirroring the existing one on
  `McpPermissionCard.test.ts`.

## Test commands and output

```
$ pnpm exec vitest run src/ai/ src/i18n/ oss/
 Test Files  142 passed (142)
      Tests  3612 passed (3612)
   Duration  46.68s

$ pnpm exec vue-tsc --noEmit
(no output, exit 0)
```

Before committing, the same `oss/` run failed 3 test files (`tree.test.mjs`,
`media-wave.test.mjs`, `export-rsync.test.mjs`) purely because `oss/export.mjs` refuses
to run against a dirty worktree even with `--allow-dirty-oss` (that flag apparently
covers the `oss/` dir's own staged content, not arbitrary uncommitted changes
elsewhere in the tree). After the commit, the same suite passed clean — no anchor
regressions in `oss/manifest.mjs` from deleting the `.undo` button/styles or the local
refs in either card.

## Mutation check

Temporarily changed `useConfirmResolve.ts`'s 409 branch from:

```ts
if (status === 409) {
```

to:

```ts
if (false && status === 409) {
```

so 409 falls through to the retryable branch instead of setting `expired`. Ran:

```
pnpm exec vitest run src/ai/composables/useConfirmResolve.test.ts \
  src/ai/components/blocks/BlockRenderer.batchA.test.ts \
  src/ai/components/blocks/McpPermissionCard.test.ts \
  src/ai/components/blocks/McpElicitFormCard.test.ts \
  src/ai/components/blocks/McpElicitUrlCard.test.ts
```

Result: **7 tests failed** across all 5 files — every "409 collapses the card / zero
buttons remain" assertion in `useConfirmResolve.test.ts`, `BlockRenderer.batchA.test.ts`
(both `ConfirmCard` and `McpInstallCard`), `McpPermissionCard.test.ts`,
`McpElicitFormCard.test.ts`, and `McpElicitUrlCard.test.ts` went red, each with the
diagnostic message showing the card's button row (Accept/Deny, Register/Deny, etc.)
still rendered with `submitError` text appended instead of the collapsed "confirm
expired" line. This confirms all five cards' 409-terminal guarantee is actually
exercised by their tests, not just the two newly-converted ones.

Reverted the mutation; `diff` against a pre-mutation backup of the file confirmed the
restored file is byte-identical to the committed version.

## Full verification after revert + commit

```
$ pnpm exec vitest run src/ai/ src/i18n/ oss/
 Test Files  142 passed (142)
      Tests  3612 passed (3612)

$ pnpm exec vue-tsc --noEmit
(clean, exit 0)
```

## Commit

`7e3f780` on branch `sp14-ai-catchup` — "fix(ai): convert McpInstallCard and ConfirmCard
to useConfirmResolve", 6 files changed (125 insertions, 65 deletions):

- `src/ai/components/blocks/BlockRenderer.batchA.test.ts`
- `src/ai/components/blocks/ConfirmCard.vue`
- `src/ai/components/blocks/McpInstallCard.vue`
- `src/ai/components/blocks/PermissionRequestCard.vue`
- `src/ai/composables/useConfirmResolve.test.ts`
- `src/ai/composables/useConfirmResolve.ts`

No i18n file changes were needed/made (`aiChange` kept, no new keys introduced).

## Fix round 1 (review finding)

Review flagged that keeping `aiChange` because `SettingsView.test.ts:1926` still
referenced it was the wrong reasoning: that reference was an entry in a
collision-detection pairs table, `['aiKbSetChange', 'aiChange']`, asserting the two
keys happen to carry the same string — not an actual consumer. Nothing renders
`aiChange` any more once `McpInstallCard`'s "Change" button was removed in the prior
commit, so keeping the key alive on a coincidental-text-match test was backwards.

Changes made:

1. `src/ai/knowledge/views/SettingsView.test.ts` — removed the `['aiKbSetChange',
   'aiChange']` entry from the pairs table, and adjusted the test's title from "实测的
   9 对撞车" to "实测的 8 对撞车" (the count assertion is implicit in the array length,
   but the title itself said "9"). Left the rest of the table and the `T9_KEYS`
   existence check for `aiKbSetChange` untouched — that key is still live at
   `SettingsView.vue:554`.
2. Deleted the `aiChange` entry from both `src/i18n/zh_cn.ai.ts` (`'更改'`) and
   `src/i18n/en_us.ai.ts` (`'Change'`).
3. `src/ai/components/blocks/PermissionRequestCard.vue` — merged the duplicate
   409-divergence comment (new English rationale + pre-existing Chinese comment saying
   the same thing) into a single English comment. Logic untouched.

### Final aiChange grep (zero hits)

```
$ grep -rn "aiChange" src/
(no output, exit code 1)
```

### Locale parity check

```
$ pnpm exec vitest run src/i18n/parity.test.ts
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

### Full re-run after the fix, post-commit

```
$ pnpm exec vitest run src/ai/ src/i18n/ oss/
 Test Files  142 passed (142)
      Tests  3612 passed (3612)
   Duration  47.49s

$ pnpm exec vue-tsc --noEmit
(no output, exit 0)
```

### Commit

`0868c0f` on `sp14-ai-catchup` — "fix(ai): delete the now-dead aiChange i18n key", 4
files changed (3 insertions, 7 deletions):

- `src/ai/components/blocks/PermissionRequestCard.vue`
- `src/ai/knowledge/views/SettingsView.test.ts`
- `src/i18n/en_us.ai.ts`
- `src/i18n/zh_cn.ai.ts`
