# Task 6 report: `McpElicitUrlCard.vue`

## Files touched
- Created `src/ai/components/blocks/McpElicitUrlCard.vue`
- Created `src/ai/components/blocks/McpElicitUrlCard.test.ts`
- Modified `src/i18n/zh_cn.ai.ts`, `src/i18n/en_us.ai.ts` (8 new `aiMcpElicitUrl*` keys, zh+en)
- Modified `src/ai/styles/knowledgeStyles.test.ts` (`COMPONENTS_VUE_FILES` drift-guard list — added `'blocks/McpElicitUrlCard.vue'` alphabetically between `McpElicitFormCard.vue` and `McpInstallCard.vue`)

Commit: `b6b7022` — "feat(ai): gate MCP authorization links behind an http(s) allowlist"

## Step 2 — pre-implementation red

Command:
```
pnpm exec vitest run src/ai/components/blocks/McpElicitUrlCard.test.ts
```
Failure observed (component did not exist yet):
```
Error: Failed to resolve import "./McpElicitUrlCard.vue" from "src/ai/components/blocks/McpElicitUrlCard.test.ts". Does the file exist?
...
Test Files  1 failed (1)
     Tests  no tests
```

## Step 5 — green after implementation

Command:
```
pnpm exec vitest run src/ai/components/blocks/McpElicitUrlCard.test.ts src/i18n/parity.test.ts
```
Result:
```
Test Files  2 passed (2)
     Tests  21 passed (21)
```

Also re-ran the components drift/color-literal guard to confirm the new file and the list entry don't trip it:
```
pnpm exec vitest run src/ai/styles/knowledgeStyles.test.ts
Test Files  1 passed (1)
     Tests  428 passed (428)
```

Combined run of all three (post-mutation-revert, final state):
```
pnpm exec vitest run src/ai/components/blocks/McpElicitUrlCard.test.ts src/i18n/parity.test.ts src/ai/styles/knowledgeStyles.test.ts
Test Files  3 passed (3)
     Tests  449 passed (449)
```

`pnpm exec vue-tsc --noEmit` — no output, clean (strict mode, no stale `resolveElicitation`/`confirmAgentAction` signature issue hit, so no `pnpm install` was needed).

## Step 6 — mutation check (mandatory)

Edited the component's `OPENABLE_URL_RE` from `/^https?:\/\//i` to `/^\w+:/` (i.e. "allow any scheme"), then re-ran:
```
pnpm exec vitest run src/ai/components/blocks/McpElicitUrlCard.test.ts
```

Observed: exactly the 4 allowlist cases went red, all other tests (8) stayed green:
```
FAIL  ... scheme 白名单拦下 javascript:alert(1):不打开、不发请求
  AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
  1st vi.fn() call: [ "javascript:alert(1)", "_blank", "noopener,noreferrer" ]

FAIL  ... scheme 白名单拦下 data:text/html,<h1>hi:不打开、不发请求
  (same shape — open() called with the data: URL)

FAIL  ... scheme 白名单拦下 blob:https://evil.example/x:不打开、不发请求
  (same shape — open() called with the blob: URL)

FAIL  ... scheme 白名单拦下 myapp://launch:不打开、不发请求
  (same shape — open() called with the myapp: URL)

Test Files  1 failed (1)
     Tests  4 failed | 8 passed (12)
```
This confirms the four allowlist test cases actually exercise the gate (they would not have caught a broken/widened regex if they were vacuous). Reverted `OPENABLE_URL_RE` back to `/^https?:\/\//i` immediately after, and re-ran the full 21-test file to confirm it returned to green (see Step 5 combined run above, run after the revert).

## Notes on the port
- Followed the brief's 4 rewrites: `t('aiMcpElicitUrl…')` keys, `rgba(...)` → existing tokens (`--purple-soft`, `--purple-soft-border`, `--danger-soft`, `--success-soft`/`--success`, `--text-on-accent`), `data-decision` restricted to `accept`/`cancel`/`expired` (no `decline` on this card), and the `expired` screen placed before the `decision` screen in the template (matches the Vue2 original's actual order — verified by reading `origin/main:src/views/AI/Agent/blocks/McpElicitUrlCard.vue` directly, not just the brief's paraphrase).
- Comments in both the component and the ported Vue2 rationale were translated to English in full (allowlist-vs-blocklist reasoning, each blocked scheme's specific capability, the `indexOf`-not-`split` reason, `accept` ≠ "authorized", and why the backend's existing check is not a reason to skip the frontend check) — no comment was shortened into a summary.
- Reused `useConfirmResolve<'accept' | 'cancel'>()` (T1) and `store.resolveElicitation` via `useProvidedAgentStore()` (T3) rather than re-implementing the submit/expiry state machine, consistent with `McpElicitFormCard.vue`.
- `.mcc-btn.ghost` and `.mcc-perm-ribbon .badge`'s hover rule that don't apply to this card (no `ghost`-role button here) were dropped along with unused button variants; kept exactly the style rules the brief named as reusable (`mcc-perm`, ribbon, `mcc-perm-foot`, `mcc-btn` base/primary/deny, `mcc-err`, `mcc-perm-resolved` + decision-color variants) plus the four URL-card-specific blocks (`mcc-url`/`.dim`/`.host`, `mcc-alarm`/`.ascii`, `mcc-note`).

## Verification status
All three targeted test files pass (449 tests), `vue-tsc --noEmit` is clean, the color-literal/file-list drift guard passes with the new entry, and the mutation check confirmed the allowlist tests are load-bearing (not vacuously green). A full-repo `vitest run` was also kicked off in the background as a broader regression check; if it surfaces anything outside the files this task touched, that is a pre-existing condition unrelated to this change (this task's own test files and the drift guard all pass in isolation and combined).
