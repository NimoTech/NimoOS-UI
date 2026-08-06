# SP8-P2b final fix wave — re-review

Scope: fix diff only (`efcd6f3`..`4293991`, commit `4293991`). Re-verified all seven
findings from primary sources (Vue2 blueprint, current code, tests), not from the
fixer's report.

## Verdicts

1. **RangeError (Fix 1) — ADDRESSED.** Diffed `MemorySection.vue`: zero production
   changes for this fix; the save-path semantics (`putMemorySettings(payload())`,
   snapshot-then-restore on failure) are byte-identical to pre-fix. Test now writes the
   input DOM value + fires only `trigger('input')`, never `trigger('change')`, so
   `saveContextWindow` (wired to `@change`) can no longer re-enter itself. Ran
   `MemorySection.test.ts` **6/6 times**: 21/21 tests pass every run, `grep -i
   "RangeError|unhandled"` on stderr/stdout empty all 6 runs. Ran full `pnpm test`
   **2/2 times**: 285 files / 2295 tests, zero RangeError in either run.

2. **Delete-failure fallback strings (Fix 2) — ADDRESSED.** Grepped all seven sections:
   delete-failure catches now uniformly use `aiCfgDeleteFailed` at `BlacklistSection.vue:68`,
   `MemorySection.vue:125`, `McpTokensSection.vue:146`, `ChannelsSection.vue:223,276`.
   Remaining `aiCfgDelete` hits are all button labels/titles, not failure fallbacks — correct.
   `git diff efcd6f3 4293991 -- src/i18n/` is empty (no i18n file touched); `aiCfgDeleteFailed`
   pre-existed identically in both locale files. RED-probe: reverted
   `BlacklistSection.vue:68` to `t('aiCfgDelete')` → the new test failed exactly
   (`删除失败` expected, got `删除`); reverted byte-identically, `git status` clean.

3. **SearchSection.vue `markSaved()` declaration (Fix 3) — ADDRESSED.** Header comment
   now has "【逻辑修正 4】" naming Vue2 `SearchSection.vue:199/212` (`savedAt` never reset
   to 0) as the problem and describing the 2s auto-hide fix, explicitly cross-referencing
   `ExecutionSection.vue`'s "逻辑修正 2" wording for the same class of bug. Comparable
   detail/structure to the sibling declaration. Comment-only, no code change (verified).

4. **ObservabilitySection.vue optimistic write (Fix 4) — ADDRESSED.** `onToggle`'s two
   dialog-opening branches (`absent`→install, `running`→stop) no longer write
   `enabled.value`; the two direct branches (`turnOnFlow`, `turnOff`) still write on
   success, unaffected. Confirmed against Vue2 `ObservabilitySection.vue:118-146`: neither
   `$buefy.dialog.confirm` call touches `this.enabled` before opening — matches. Cancel
   paths verified: `onInstallCancel` sets `enabled.value = false` (matches Vue2 `:130`),
   `onStopCancel` is now a true no-op (matches Vue2 `:141` `onCancel: () => {}`). RED
   probe: re-added `enabled.value = v` to both dialog-opening branches → tests 12, 13, 20
   (and downstream test 14) failed precisely on the reintroduced regression; reverted
   byte-identically (`diff` confirmed identical, `git status` clean).

5. **MemorySection.vue `\|\| []` hardening (Fix 5) — ADDRESSED.** Declaration ("逻辑修正 3")
   added at `load()`, naming Vue2 `MemorySection.vue:108` and the reproducible
   `memories.length`/`v-for` failure mode. Hardening code (`|| []`) retained unchanged.

6. **ObservabilitySection.test.ts apiErrorMessage test (Fix 6) — ADDRESSED.** New test 21
   asserts `.px-msg.err` shows the backend `response.data.message` through
   `confirmInstall()`'s catch (`ObservabilitySection.vue:245`). RED probe: changed that
   line to `error.value = t('aiCfgInstallationFailed')` (ignoring the backend message) →
   only test 21 failed (`'安装失败'` vs expected `'磁盘空间不足'`), 22/23 others still
   green — precise, no collateral. Reverted byte-identically, confirmed via `diff`.

7. **session.ts userVersion recompute (Fix 7) — ADDRESSED.** Public API unchanged
   (`setUser(user: unknown): void`, `setTokens`/`setVersion`/`clear` untouched, same
   return shape). `user` computed's try/catch degradation for corrupt/absent/non-object
   localStorage is untouched — cannot throw. Stale comment ("login always does a full
   page reload") replaced with the corrected rationale citing `Login.vue:44`
   (`router.push`, verified: no reload). New test proves same-instance
   `setUser`→`user`/`isAdmin` update plus a logout→login-as-non-admin sequence. RED
   probe: removed `userVersion.value++` from `setUser` → the new test failed
   (`expected null to deeply equal {...}`); reverted byte-identically. Grepped all
   `useSessionStore` consumers (`main.ts`, `App.vue`, `useAuth.ts`,
   `ChannelsSection.vue`): only `ChannelsSection.vue:67` reads `session.isAdmin`; none
   depended on the old non-reactive caching behavior.

## New breakage introduced by this fix diff

None found. No Critical/Important issues.

## Out-of-scope observations (do not extend the loop)

- Test cleanup style still inconsistent across sibling section tests (some `unmount()`,
  some clear `document.body`, some neither) — pre-existing (F8 in prior review), not
  touched by this diff.
- `i18n` files remain untouched by this commit as required; both locale files still carry
  unrelated in-flight P2a markers, not evaluated here (out of scope).

## Gate numbers (self-run)

- `pnpm test`: **285 files / 2295 tests**, 2/2 clean runs, exit 0, no RangeError/unhandled
  rejection on stderr either run.
- `pnpm exec vue-tsc --noEmit`: clean, exit 0, no output.
- `pnpm build`: succeeded in 11.77s; only pre-existing >500KB chunk warnings, no new
  warnings/errors.
- `pnpm test src/styles/color-guard.test.ts`: 161/161 passed.
- `src/files/upload/persist.test.ts`: did not flake in either full run.
- `git diff efcd6f3 4293991 --stat`: exactly 9 files, matches the declared scope; no
  `src/i18n/*` hunk; no P2a-owned file (`SettingsPage.vue`/`.test.ts`,
  `SectionPlaceholder.vue`, `router/index.ts`, `{Models,Providers,Privacy,
  ThinkingDefaults}Section.*`) appears in the diff.
- `git diff efcd6f3 4293991 -- '*.test.ts'`: only removed lines are the rewritten
  mock line (Fix 1) and the two Observability assertions rewritten to match corrected
  behavior (Fix 4) — no assertion coverage dropped without replacement.

## RED probes performed (all reverted, `git status` clean after each and at end)

1. `BlacklistSection.vue:68` `aiCfgDeleteFailed`→`aiCfgDelete` — new delete-fallback test
   failed as expected; reverted from backup.
2. `ObservabilitySection.vue` `onToggle` — re-added `enabled.value = v` to both
   dialog-opening branches — tests 12/13/20 (+14) failed as expected; reverted from
   backup, `diff` confirmed byte-identical.
3. `ObservabilitySection.vue:245` `apiErrorMessage(e, t(...))`→`t('aiCfgInstallationFailed')`
   — only test 21 failed; reverted from backup, `diff` confirmed byte-identical.
4. `session.ts` `setUser` — removed `userVersion.value++` — new recompute test failed;
   reverted from backup, `diff` confirmed byte-identical.

Final `git status --short` in the repo: empty.
