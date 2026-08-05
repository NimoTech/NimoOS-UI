# SP8-P2b Task 2 review — session store user/isAdmin read side

## Spec compliance: PASS (✅)

- `src/stores/session.ts`: read-only addition confirmed. `token`, `isAuthed`, `setTokens`,
  `setUser`, `setVersion`, `clear` are byte-identical to before; no reshaping, no new store,
  no state duplication. `USER` constant (`'user'`) is reused, not re-typed as a literal.
- `user` computed re-parses `localStorage.getItem(USER)` on every access; degrades to `null`
  on missing key, `JSON.parse` throw, or parsed value not a plain object. The `try` wraps the
  `localStorage.getItem` call itself, not just `JSON.parse` — covers private-mode browsers
  where `getItem` can throw.
- `isAdmin` is strictly `user.value?.role === 'admin'` — no truthy shortcut, no role list.
- Non-reactivity of `computed` over `localStorage` is documented in a code comment (lines
  17-23 of the diff) naming the deliberate tradeoff (full-page reload on login) — matches the
  three-way declaration requirement (code comment + report + this review as the ledger check).
- `export interface SessionUser { username?: string; role?: string }` matches the brief
  exactly. No `any`, no `as unknown as` laundering — the single `as SessionUser` cast is
  gated behind a `typeof parsed === 'object'` runtime check, not a laundering cast.
- Citation correction (`:118` → `:184`) verified independently: `grep -n "role === 'admin'"`
  against `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Settings/sections/ChannelsSection.vue`
  shows line 184 is `isAdmin() { return this.$store.state.user.role === 'admin' }` — line 118
  is unrelated markup. Semantics match exactly (strict `role === 'admin'`, not truthy/list).
  This is citation-accuracy only, no logic/behavior change, correctly declared in the report.
- Commit hygiene: `git show --stat 1685f50` touches exactly `src/stores/session.ts` and
  `src/stores/session.test.ts` (24 / 39 insertions). Nothing from the parallel SP8-P2a session
  (`SettingsPage.vue`, `SectionPlaceholder.vue`, `router/index.ts`, `i18n/*`) leaked in.

## Task quality: Approved

No Critical / Important / Minor findings survive verification.

- Minor (cosmetic, not a defect): the new test block duplicates its own
  `setActivePinia`/`localStorage.clear()` `beforeEach` identical to the outer `describe` —
  brief explicitly asked for this (independence from outer ordering), so not flagged as a
  defect.

## RED probe (performed personally, then reverted)

Broke `src/stores/session.ts` line with the object-type guard:
`return parsed && typeof parsed === 'object' ? (parsed as SessionUser) : null`
→ `return (parsed as SessionUser)` (dropped the guard).

Result: `pnpm test src/stores/session.test.ts` → 1 failed / 10 passed. The failure was
exactly the targeted case, "user 不是对象(比如存了字符串)时也退化成 null":
`AssertionError: expected 'nimo' to be null`. All other 10 cases (including the other 4 new
ones) still passed, confirming the test is precise, not accidentally coupled to other guards.
Restored the original line; `git status --porcelain` / `git diff --stat` on
`src/stores/session.ts` empty afterward — tree byte-identical to before the probe.

## Tests observed personally

- `pnpm test src/stores/session.test.ts`: 1 file / 11 tests passed (before probe) — matches
  report's GREEN claim.
- `pnpm test` (full suite): **268 files / 2005 tests passed**, matching the report's claimed
  gate and the 2000-baseline + 5-new arithmetic.
- `pnpm exec vue-tsc --noEmit`: clean, no output.
- `pnpm build`: succeeded; only pre-existing 3rd-party / ">500 kB chunk" warnings
  (`ExcelViewer`, `index-Dw64pT8I.js`, etc.) — no new warnings.

## Vacuousness check

Each of the 5 new cases would fail if the feature were entirely absent (`user`/`isAdmin`
`undefined`) — confirmed by the report's own RED run (5 failed / 6 passed before Step 3) and
independently reproduced via the guard-removal RED probe above for the non-object case. The
"computed caches, doesn't re-run after `setUser`" comment is consistent with what the tests
prove: each of the 5 cases constructs a *fresh* Pinia instance via `createPinia()` in
`beforeEach`, so none of them exercises or contradicts the caching claim — the tests neither
prove nor disprove same-instance staleness, which is correct since the brief flags that gap
as untested-by-design and documented instead.
