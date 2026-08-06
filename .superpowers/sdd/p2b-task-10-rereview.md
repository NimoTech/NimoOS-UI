# SP8-P2b Task 10 — Scoped re-review of fix diff (22c98e2, base 4b0c7f7)

## Open finding: `.mcp-label` / `.mcp-reveal-warn` unstyled — ADDRESSED

Vue2 `McpTokensSection.vue:238-247` scoped `<style>` defines exactly three
classes: `.mcp-x`/`.mcp-x:hover` (241-244), `.mcp-label` (245),
`.mcp-reveal-warn` (246). `.mcp-x` was already covered by `SkModal.vue`'s
`.sk-x`/`.sk-x:hover` (byte-identical values incl. `28px`/`8px`/transition
timing). The fix adds `.mcp-label` and `.mcp-reveal-warn` to
`src/ai/styles/settings-styles.scss:204-205`, verbatim:

- `.mcp-label { display: block; margin: 0; color: var(--text-secondary); font-size: 13px; }` — identical to Vue2 `:245`.
- `.mcp-reveal-warn { color: var(--danger); font-size: 13px; line-height: 1.5; margin: 0; }` — identical to Vue2 `:246`.

Both classes are used in the new component's template (2× `.mcp-label` for
the onboarding labels, 1× `.mcp-reveal-warn` for the warning paragraph,
inside the `<SkModal>` reveal). No unstyled class remains — every Vue2
scoped rule is now accounted for. No raw colour literal/fallback introduced;
both are pure tokens, matching the Vue2 source (which had none to strip).
Deviation is declared in both the component header comment (12-line addition
citing Vue2 `:245/246`, the Task 8 `.px-msg` precedent, and "scope
expansion, declared") and the fix diff commit message.

## Value-level parity: confirmed byte-identical to Vue2 source (manual diff, not covered by the test — see below).

## RED probe

Deleted only the two rule lines (204-205) from `settings-styles.scss`,
re-ran `settingsStyles.test.ts` → **all 9 tests still passed**, including
the new one. Root cause: the guarding comment added in the *same* fix
(`settings-styles.scss:195`) itself contains the literal backtick-quoted
substrings `` `.mcp-label` ``/`` `.mcp-reveal-warn` ``, so
`css.toContain('.mcp-label')` is satisfied by the comment text alone once
the actual CSS declarations are gone. Confirmed by stripping the whole added
block (comment + rules) — only then does the test fail as expected (1
failed / 8 passed, failure at `settingsStyles.test.ts:63`). Restored via
`git checkout -- src/ai/styles/settings-styles.scss`; `md5sum` matches
pre-probe value `42a8804b3292285efb30e4cca0c5df2d`; `git status --short`
clean.

**New Important finding (introduced by the fix diff itself):** the added
regression test does not actually guard against the regression it targets —
it passes even with both CSS rules deleted, because it does a raw substring
match against file content that includes the fix's own comment. It would
fail to catch a future accidental deletion of just the CSS rules (the exact
scenario it was written for) as long as the comment text is left in place.

## Test results
- `McpTokensSection.test.ts` + `settingsStyles.test.ts` + `color-guard.test.ts`: 186/186 passed.
- Full `pnpm test`: 283 files / 2257 tests passed. Noise: `MemorySection.test.ts` threw its known intermittent unhandled `RangeError` (stack overflow) via `PromiseRejectCallback` while the suite still reported all passing — matches documented flake. `persist.test.ts` IndexedDB flake did not trigger this run.
- `pnpm exec vue-tsc --noEmit`: clean, no output.
- `pnpm build`: succeeded (31.47s), only pre-existing chunk-size warnings.

## Commit hygiene
`git show --stat 22c98e2`: exactly 3 files (`McpTokensSection.vue`,
`settings-styles.scss`, `settingsStyles.test.ts`), 34 insertions/0
deletions — matches the review-package diff exactly. No i18n hunk, no
concurrent-session files (`SettingsPage.*`, `ModelsSection.*`,
`ProvidersSection.*`, `PrivacySection.*`, `ThinkingDefaultsSection.*`,
`src/i18n/*.ts`, `src/router/index.ts`) swept in.

## Constraints §6 (colour)
Both added rules use only existing tokens (`var(--text-secondary)`,
`var(--danger)`), no new raw colours. `color-guard.test.ts` passes (part of
the 186/186 above).

## Out of scope (does not extend the loop)
- `SkModal.vue`'s `.sk-x` coverage of Vue2 `.mcp-x`/`ChannelsSection.vue`'s `.chan-x` dedup was verified only incidentally here — it's Task 3 territory, not this fix diff.
- The `MemorySection.test.ts` intermittent `RangeError` and `persist.test.ts` IndexedDB flake are pre-existing/known, unrelated to this fix.
