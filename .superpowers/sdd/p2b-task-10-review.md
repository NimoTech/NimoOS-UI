# SP8-P2b Task 10 review — McpTokensSection（对外 MCP 服务）

Commit reviewed: `4b0c7f7` (diff `p2b-review-task10.diff`).

## Verdicts

- **Spec compliance: ✅** — component + test cover endpoint block, persistent onboarding
  (placeholder token), token CRUD, one-time plaintext reveal; 17/17 tests pass; the 6
  carried-over Vue2 spec.js assertions all have real counterparts and are not weakened
  (strengthened to DOM-level checks). One undeclared visual-parity gap found (below).
- **Task quality: Approved, with one Important finding** (visual-only, easy follow-up fix;
  does not block landing given the sub-agent has no browser to catch it and tests can't
  either).

## Findings

- **Important — `.mcp-label` / `.mcp-reveal-warn` used in the template but have zero
  matching CSS anywhere** (`src/ai/components/settings/sections/McpTokensSection.vue:274,281,288`).
  The component ships with no `<style>` block at all. Vue2's blueprint
  (`NimoOS-UI/…/McpTokensSection.vue:238-247`, scoped) defines
  `.mcp-label { display:block; margin:0; color:var(--text-secondary); font-size:13px; }` and
  `.mcp-reveal-warn { color:var(--danger); font-size:13px; line-height:1.5; margin:0; }`.
  Grepped `settings-styles.scss` and `sk-shared.scss` — neither class exists there, and there
  is no generic `label`/`p` rule that would substitute (`settings-styles.scss:285`'s
  `.set-form .field label` is a different, unrelated selector). Net effect: in the one-time
  token-reveal modal, the danger-red warning line loses its color/line-height/margin and the
  two "give this to an agent" / "paste into config" labels lose their secondary-color,
  13px, block styling — real visual drift in exactly the surface this task's brief calls out
  as strict-1:1 territory. The component's header comment declares the `.mcp-x` → SkModal
  `.sk-x` swap (D1) but says nothing about dropping these two rules — an undeclared
  deviation, which per constraints §7 is itself the defect. Fix is small: add a 2-rule
  `<style>` block (or extend `sk-shared.scss`) reusing existing `--text-secondary`/`--danger`
  tokens.
- No other findings. Clipboard, i18n, "Never used" hand-off, response-shape correction, D1/D2
  declarations, class names, markup order, and commit purity all check out (detail below).

## The three declared corrections

1. **Response shape (`res.tokens`/`res.token` vs brief's `res.data.tokens`/`res.data.token`)
   — correct.** Read `NimoOS-AI/agent/main.py:221-242` myself: `POST /mcp-tokens` returns
   `{"id","token","label"}` and `GET /mcp-tokens` returns `{"tokens":[...]}` — flat body, no
   envelope. Since `service.ai.*` already returns body-as-is (equivalent to Vue2's
   `res.data`), the brief's pseudocode would have added a spurious second `.data` layer.
   Defensive fallback semantics (`(res && res.tokens) || []`) are preserved, not dropped.
2. **i18n escaping of `{url}`/`{token}` — correct.** `buildMcpInstruction` (Task 9,
   `mcpConnect.ts:27-31`) does its own `.split('{url}').join(...)` substitution on the
   *already-resolved* i18n string; the component calls `t('aiCfgMcpInstructionTemplate')`
   with **no params** (`instructionTemplate` computed). Bare `{url}`/`{token}` would be
   parsed by vue-i18n v9 as named-interpolation slots and blanked. Escaping to
   `{'{'}url{'}'}`/`{'{'}token{'}'}` is the right fix, and the two i18n values are otherwise
   character-identical to Vue2's production `zh_CN.json`/`en_US.json` (`mcpAgentInstructionTemplate`
   at zh_CN.json:1730 / en_US.json:1666) — confirmed by grep, and confirmed empirically by RED
   probe (see below).
3. **`aiCfgDeleteFailed` reuse — correct.** Pre-existing value (`zh_cn.ts:673`/`en_us.ts:667`
   = `删除失败`/`Delete failed`) matches exactly what this section needs; grepped both locale
   files for duplicate `aiCfg*:` keys — none found.

## "Never used" hand-off (Task 9 → Task 10)

Verified correct. `fmtLastUsed` (`McpTokensSection.vue:155-161`) returns the bare
`t('aiCfgNeverUsed')` with no prefix when `last_used_at` is falsy, matching Vue2
`:213-216` exactly. Test 12 covers both branches (never + used) with exact string equality,
not just `.toContain`. RED probe below proves the test actually catches a prefix regression.

## Clipboard on plain HTTP

No duplication. The component imports the shared `copyText` helper from
`src/files/util/clipboard.ts` (Task 7's fix) directly — does not re-implement the
`navigator.clipboard` → `execCommand('copy')` fallback chain. `copy()` behavior (success
toast vs. warning toast on failure) matches Vue2 semantics and both paths are tested
(tests 8, 11).

## RED probes (3 run, all reverted — `git status` clean afterward)

1. Changed `fmtLastUsed`'s falsy branch to `` `${t('aiCfgLastUsed')}: -` `` → test 12 failed
   exactly as expected (`expected '最近使用: -' to be '从未使用'`). Reverted.
2. Reverted `load()` to the brief's original `res.data.tokens` pseudocode → 7/17 tests failed
   immediately (list stayed empty against the flat mock). Confirms the declared correction is
   necessary, not just stylistically preferred. Reverted.
3. Un-escaped `aiCfgMcpInstructionTemplate`'s `{url}`/`{token}` in `zh_cn.ts` → test 9 failed;
   rendered instruction showed `{url}`/`{token}` blanked to empty strings exactly as the
   header comment predicts. `messageSyntax.test.ts` still passed (ran it alongside). Reverted.

`git status`/`git diff` clean after all three restorations.

## Other checks

- Modal is `SkModal` (reka Dialog), not a hand-rolled `.sk-modal-bg` div; D1 swap declared in
  the header comment (lines 10-19); `AlertDialog`/`PromptDialog` swaps also declared.
- Test file `await nextTick()`-flushes (`flush()`, 3x) after every mount/interaction, per the
  reka `useMounted()` gate precedent.
- Every CSS class other than `.mcp-label`/`.mcp-reveal-warn` grepped and found in
  `settings-styles.scss` or `sk-shared.scss`; `.set-page-head` correctly has no rule (Vue2 has
  none either — not flagged).
- All 17 i18n values (zh + en) checked character-by-character against
  `NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json` — exact matches including punctuation,
  full-width colons/commas, and the escaped `{'{'}...{'}'}`. No duplicate key definitions in
  either locale file. `aiCfgMcpTokens` (h1, reused from P2a) also verified to match
  `"Expose as MCP server"`.
- Spot-checked all 17 test cases for vacuousness (not just 6) — each asserts a real,
  falsifiable outcome (confirmed empirically for 3 of them via RED probes above); none is a
  tautology that would pass with the behavior deleted.
- Icons: `AgentIcon` supports `plus`/`trash`/`copy`/`key` (grepped
  `src/ai/components/icons/AgentIcon.vue`) — the `x`-close icon is correctly *not*
  reimplemented since SkModal supplies its own close button (per D1).
- Commit purity: `git show --stat 4b0c7f7` touches exactly 4 files (component, test, and
  Task-10-marked-block-only hunks in both i18n files); `SettingsPage.vue` correctly untouched
  per constraints §2.

## Tests personally run

- `pnpm exec vitest run src/ai/components/settings/sections/McpTokensSection.test.ts`:
  **17/17 passed**.
- `pnpm test` (full): **283 files / 2256 tests passed**, 0 red (no flake surfaced this run).
- `pnpm exec vue-tsc --noEmit`: **0 errors**.
- `pnpm build`: **succeeded**, only pre-existing third-party/chunk-size warnings.
