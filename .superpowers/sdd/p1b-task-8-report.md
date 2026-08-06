# P1b Task 8 report — block renderers batch A

Commit: `1c66bfa` — "SP8-P1b: block renderers batch A (full BLOCK_MAP + trivial/light + confirm cards)"

## A) Full BLOCK_MAP

`src/ai/components/blocks/BlockRenderer.vue` rewritten from the P1a "md only, else gray chip"
stub to the Vue2-equivalent generic dispatch: `BLOCK_MAP: Record<string, Component>` with all
20 entries, resolved via `computed`, rendered as `<component :is="resolved" v-if="resolved"
v-bind="block" />` (verbatim Vue2 shape: `v-bind="block"` prop-spreads the whole block object
onto whichever component the type resolves to). Unmapped types still fall through to the
`.block-chip` gray degradation span (P1a behavior preserved).

Updated the pre-existing `BlockRenderer.test.ts` (P1a): its "unmapped type falls back to chip"
assertions used `tool` and `thinking` as example unmapped types — now that they're mapped for
real, those two tests were repointed to `nonexistent_type`/`totally_unknown`, and a comment
notes why. New test coverage for the full map lives in `BlockRenderer.batchA.test.ts` instead.

## B) 17 renderers ported (1:1, mechanical Vue2→Vue3 conversion)

All under `src/ai/components/blocks/`. Every file carries a `<!-- 1:1 移植自 Vue2 ... -->`
header comment pointing at its source path.

| File | Conversions applied |
|---|---|
| `ActionsRow.vue` | Options→`<script setup>`; no store/i18n; `color:'white'`→`var(--text-on-accent)`. |
| `McpWarningCard.vue` | `$t(...)`→`useI18n()`; literal rgba/hex badge→`--warning-soft`/`--warning-soft-border`/`--warning`. |
| `StorageCard.vue` | `computed` for `pct`; no color literals (breakdown colors are data-driven, not code literals). |
| `SearchResultsCard.vue` | no script state; icon-bg rgba→`--warning-soft`. |
| `ProgressCard.vue` | `computed` doneCount; icon-bg rgba→`--teal-soft`. |
| `VideoCard.vue` | `computed` placeholderStyle; **kept literal hex palette** (seed-based decorative gradient, commented as generative/theme-independent, same exemption class as `.ic-*`). Fixed a TS2345 (`position: 'absolute' as const`). |
| `FileListCard.vue` | no script state; no color literals (fileicon-tag colors live in shared `agent-styles.scss`, out of this file's scope). |
| `ThinkingBlock.vue` | `data()`→`ref`; `watch` for `defaultOpen` prop change (was a Vue2 `watch` option). |
| `MaxTurnsCard.vue` | `inject:['agentStore']`→`useProvidedAgentStore()`; `agentStore.state.busy`→`computed(() => store.busy)`; `agentStore.actions.continueRun()`→`store.continueRun()`; `$t`→`useI18n()`; `#fff`→`var(--text-on-accent)`. |
| `ImageGridCard.vue` | `computed` columns; icon-bg rgba→`--purple-soft`; **kept literal hex PALETTES** (same generative-placeholder exemption as VideoCard, commented). Fixed the same TS2345. |
| `ToolCard.vue` | `data()`→`ref`; `computed` stateLabel; `diffLines` plain function; no color literals (all via shared `.tool-*`/`.diff-*` classes already in `agent-styles.scss`). |
| `ConfirmCard.vue` | `inject:['agentStore']`→`useProvidedAgentStore()`; `agentStore.actions.confirmAgentAction(id, confirmed)`→`store.confirmAgentAction(...)`; `$t`→`useI18n()`; ring/badge rgba→`--warning-ring`/`--warning-soft`; `color:white`→`var(--text-on-accent)`. |
| `PermissionRequestCard.vue` | same store wiring as ConfirmCard; 409 case silently resolves (unchanged Vue2 behavior — no error shown); `$t`→`useI18n()`; `white`→`var(--text-on-accent)`. |
| `McpCallCard.vue` | `data()`→`ref` (`open`); `computed` stateLabel; tile gradient `#C18CFF/#AF52DE`→`var(--purple-light)`/`var(--purple)`; state badges rgba→`--success-soft`/`--purple-soft`/`--danger-soft`; inset gloss shadow→`--gloss-inset`; `color:#fff`→`var(--text-on-accent)`. |
| `McpPermissionCard.vue` | `inject`→`useProvidedAgentStore()`; `store.confirmAgentAction(id, confirmed, remember)`; ribbon/badge/button rgba→`--purple-soft(-border)`/`--success-soft`/`--danger-soft`; `#fff`→`var(--text-on-accent)`. |
| `McpInstallCard.vue` | same pattern as McpPermissionCard, no "always remember" branch (matches Vue2 — always passes `remember=false`). |
| `PhotoGridCard.vue` | `data()`→`ref`(`lightboxIndex`); `computed` lightboxPhotos; imports the Task-9 stub `SearchImageLightbox.vue`; hover scrim `rgba(0,0,0,0.35)`→`--scrim-dark`; icon `color="#fff"`→`color="var(--text-on-accent)"` (an already-established pattern — `KindIcon.vue` passes `color="var(--accent)"` to `AgentIcon` the same way). Preserved the Vue2 curly quotes `“{{ query }}”` verbatim. |

## Stubs created (Task 9 fills these)

- `TerminalCard.vue` — `defineProps` mirrors the real Vue2 prop surface (command/cwd/shell/
  sandbox/state/exitCode/durationMs/lines/streamingLine/approval/defaultOpen) so Task 9 only
  has to fill the body; placeholder `.block-stub` chip, tokens only.
- `SemanticSearchCard.vue` — loosely typed (`[key: string]: unknown`) since the real Vue2
  component is 926 lines / very different shape; placeholder chip, tokens only.
- `SearchImageLightbox.vue` — props `photos`/`index`, emits `close`/`nav` (matching how
  `PhotoGridCard.vue` actually calls it); placeholder chip, tokens only.

All three carry a `1b-stub: filled in Task 9` comment.

## Theme-token additions (`src/ai/styles/tokens.scss`)

Added once per light (`.agent-app`) and dark (`.agent-app[data-theme="dark"]`) block:

- `--warning-soft`, `--warning-soft-border`, `--warning-ring`
- `--success-soft`, `--success-soft-border`
- `--danger-soft`, `--danger-soft-border`
- `--purple-soft`, `--purple-soft-border`
- `--purple-light` (gradient stop, same value both themes — same convention as `--purple`
  itself not being redefined in dark)
- `--teal-soft`
- `--scrim-dark` (photo-hover darkening overlay — same value both themes, intentional)
- `--gloss-inset` (tiny inset highlight shadow on the McpCallCard tile — same value both themes)

Rationale: Vue2 used many one-off `rgba(<hue>, <varying opacity>)` literals for the same
handful of semantic "soft badge" colors across these files. Rather than replicate every exact
opacity as a bespoke token, I consolidated to one soft-bg/soft-border pair per semantic hue
(warning/success/danger/purple/teal) plus the three one-off decorative values above, and used
those consistently. Visually equivalent intent (soft colored badge behind a saturated icon/
text), values chosen close to the most common opacity used per hue.

## i18n

Vue2's raw-sentence-as-`$t()`-key convention doesn't match this repo's established
camelCase-key convention (`zh_cn.ts`/`en_us.ts` have zero literal-sentence keys anywhere —
verified before minting new keys). Added ~45 new `aiXxx` keys to **both** `zh_cn.ts` and
`en_us.ts`, content taken verbatim from Vue2's `src/assets/lang/zh_CN.json` (zh) and the
literal Vue2 source string (en) — e.g. `aiConfirmRequiredTitle: 'Confirmation required:
{action}'` / `'需要确认：{action}'`. Interpolation uses the same `{param}` named-slot syntax
already used elsewhere in this codebase (`t('key', { param: value })`).

Components that had plain English literals in Vue2 (not `$t()`-wrapped) were left as literal
English per the brief ("prefer keeping Vue2's literal text as-is") — e.g. ToolCard's state
labels (Running/Completed/Failed/Pending), ProgressCard's "of N complete", StorageCard's
"NIMO HOME", ImageGridCard's "Showing X of Y matches", ThinkingBlock's "Thinking"/"Reasoned".

`parity.test.ts` passes (zh/en key sets identical).

## Test results

- `pnpm test -- BlockRenderer`: 2 files, 30 tests, all pass (existing `BlockRenderer.test.ts`
  3 tests + new `BlockRenderer.batchA.test.ts` 27 tests covering all 17 renderers + full-map
  dispatch, including click→store-call assertions for all 4 confirm-style cards + MaxTurnsCard).
- `pnpm test` (full suite): **231 files / 1444 tests, all pass.**
- `pnpm exec vue-tsc --noEmit`: clean after fixing two `position: 'absolute'` string-vs-literal
  TS2345 errors (VideoCard/ImageGridCard placeholder style computeds — added `as const`).

## Color self-audit

`git diff`/grep over all 21 new+modified component files for `#hex` / `rgb(` / `rgba(` /
named colors (`white`/`black`) found:
- **Zero** unjustified literals.
- Two justified exceptions, both commented in-file: `VideoCard.vue`'s `PAL` and
  `ImageGridCard.vue`'s `PALETTES` — seed-indexed decorative placeholder gradients for
  "no real thumbnail yet" tiles, generative and theme-independent (same exemption class as
  the `.ic-*` desktop app icon gradients called out in `docs/THEMING.md`).
- All other prior Vue2 literals (badge rgba, `#fff`/`white` text-on-accent, MCP tile gradient,
  photo-hover scrim) converted to tokens as described above.

## Self-review

- Confirm-card store wiring verified against brief: `ConfirmCard`/`PermissionRequestCard`/
  `McpPermissionCard`/`McpInstallCard` → `store.confirmAgentAction(confirmId, confirmed[,
  remember])`; `MaxTurnsCard` → `store.continueRun()`, `busy` reads `store.busy` (a plain
  boolean off the Pinia setup-store instance, confirmed against existing usage in
  `AgentPage.vue`/`AssistantMessage.vue` — no `.value` needed).
- `v-bind="block"` prop-spread dispatch shape preserved 1:1 from Vue2's `BlockRenderer.vue`.
- Every declared prop matches what `dispatchEvent.ts`/Vue2 blocks actually carry, so no
  attribute-leak surprises from `v-bind="block"` spreading undeclared fields onto component
  roots.
- `PhotoGridCard.vue`'s curly quotes (`“…”`) preserved verbatim rather than "corrected" to
  straight quotes, matching Vue2 exactly.

## Concerns

None blocking. Two things worth flagging for whoever picks up Task 9:

1. `SemanticSearchCard.vue`'s real Vue2 source is **926 lines** (vs. 30-125 lines for
   everything else in this batch) — confirms the brief's own framing of it as one of the two
   "heavy" renderers deliberately deferred to Task 9, not a scope-cut on my part.
2. The soft-badge token set I added consolidates several distinct Vue2 opacities per hue into
   one pair each (see rationale above) — a minor, deliberate visual simplification versus
   pixel-exact Vue2 parity, in exchange for a coherent reusable token vocabulary. Flagging in
   case a reviewer wants pixel-exact opacities restored as per-usage one-off tokens instead.

---

## Review follow-up fixes (commit `<see below>`)

Review verdict: **Approved with 2 Important follow-ups** (spec/tests both passed; both items
were theme-parity nits). Both fixed.

### Fix 1 — central exception documentation for the decorative placeholder palettes

The `VideoCard.vue` `PAL` / `ImageGridCard.vue` `PALETTES` hex-literal exception previously
lived only as an in-component comment (self-authorized, not registered anywhere central).
Fixed by registering it in **both** places a future grep-audit would check:

- `docs/THEMING.md` §6 ("例外清单") — added a new table row alongside the existing `.ic-*`
  row: *生成式、按 seed 取色的占位马赛克色板 (`VideoCard.vue` 的 `PAL`、`ImageGridCard.vue`
  的 `PALETTES`)* — AI Agent 区，理由：皮肤无关、占位马赛克，纯生成式，不代表语义状态，
  同 `.ic-*` 一类。
- `src/ai/styles/tokens.scss` — added an "例外清单" comment block right under the file's
  existing header note, cross-referencing docs/THEMING.md §6, since the AI Agent subtree runs
  its own parallel token file (not `src/styles/theme.css`) and needed its own pointer into the
  same registry rather than a second silent exemption.
- `VideoCard.vue` / `ImageGridCard.vue` in-component comments rewritten to point at both of the
  above (tokens.scss's "例外清单" section + docs/THEMING.md §6) instead of only cross-referencing
  each other.

No color values changed by this fix — purely documentation/registration.

### Fix 2 — McpCallCard 3-tier opacity restored (pill vs. seg-head wash)

Re-checked Vue2 `McpCallCard.vue` exact opacities:

| | pill (`.mcc-call-state`) | seg-head wash (`.mcc-seg-head`) | seg-head border |
|---|---|---|---|
| purple/running | `rgba(175,82,222,0.1)` | `rgba(175,82,222,0.06)` | `rgba(175,82,222,0.14)` |
| success/return | `rgba(52,199,89,0.12)` | `rgba(52,199,89,0.07)` | `rgba(52,199,89,0.14)` |
| danger/error | `rgba(255,59,48,0.1)` | `rgba(255,59,48,0.06)` | `rgba(255,59,48,0.14)` |

My original consolidation mapped both the pill and the wash onto the same `--<hue>-soft` token,
so the wash came out as saturated as the pill (losing the intended bolder/fainter hierarchy —
wash is consistently ~60% of the pill's opacity in Vue2). Fixed by adding a third, fainter tier
per hue, `--<hue>-soft-faint`, at that ~60%-of-`-soft` ratio, added to **both** theme blocks in
`src/ai/styles/tokens.scss`:

| Token | Light (`.agent-app`) | Dark (`.agent-app[data-theme="dark"]`) |
|---|---|---|
| `--purple-soft-faint` | `rgba(175, 82, 222, 0.06)` | `rgba(175, 82, 222, 0.11)` |
| `--success-soft-faint` | `rgba(46, 158, 84, 0.07)` | `rgba(79, 184, 112, 0.11)` |
| `--danger-soft-faint` | `rgba(215, 73, 59, 0.06)` | `rgba(240, 119, 107, 0.1)` |

(Hue/base RGB per token matches the existing `-soft` token's hue exactly — light-theme purple
opacity 0.06 and danger 0.06 land on the exact Vue2 values since our `-soft` pill tokens for
those two already matched Vue2's pill opacity 1:1; success's Vue2 wash 0.07 also carried over
exactly since our `--success-soft` pill (0.12) already matches Vue2's pill (0.12) exactly.
Dark-theme faint values are the same ~60% ratio applied to the dark `-soft` values, since Vue2
has no separate dark theme to source exact dark opacities from.)

`McpCallCard.vue` updated: `.mcc-seg[data-kind="call"] .mcc-seg-head`,
`.mcc-seg[data-kind="return"] .mcc-seg-head`, and
`.mcc-seg[data-kind="return"][data-error="true"] .mcc-seg-head` now use
`var(--purple-soft-faint)` / `var(--success-soft-faint)` / `var(--danger-soft-faint)` for
`background`, respectively. The state-badge pills (`.mcc-call-state[data-state="..."]`) were
left untouched on `--purple-soft` / `--success-soft` / `--danger-soft`. Seg-head `border-bottom`
also left untouched on the existing `-soft-border` tokens (out of scope per the follow-up —
only the background wash had lost its hierarchy). McpPermissionCard/McpInstallCard were left
alone as instructed — their ribbon/badge backgrounds map cleanly onto the existing 2-tier system
(Vue2 uses a single wash opacity there, no separate pill+wash split).

### Re-verification

```
$ pnpm test -- BlockRenderer
 Test Files  2 passed (2)
      Tests  30 passed (30)

$ pnpm test
 Test Files  231 passed (231)
      Tests  1444 passed (1444)

$ pnpm exec vue-tsc --noEmit
(clean, no output)

$ git diff -U0 src/ai/styles/tokens.scss src/ai/components/blocks/McpCallCard.vue \
    src/ai/components/blocks/VideoCard.vue src/ai/components/blocks/ImageGridCard.vue \
    docs/THEMING.md | grep '^+' | grep -Ev '^\+\+\+' | grep -E '#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\('
  --purple-soft-faint: rgba(175, 82, 222, 0.06);
  --success-soft-faint: rgba(46, 158, 84, 0.07);
  --danger-soft-faint: rgba(215, 73, 59, 0.06);
  --purple-soft-faint: rgba(175, 82, 222, 0.11);
  --success-soft-faint: rgba(79, 184, 112, 0.11);
  --danger-soft-faint: rgba(240, 119, 107, 0.1);
```

All 6 new raw-color hits are the faint-tier **token definitions** inside `tokens.scss` itself
(expected — that's where literal values belong); no new raw hex/rgb leaked into any component
file, and the two documented placeholder palettes (`PAL`/`PALETTES`) are unchanged (no diff
lines touch their literal arrays in this follow-up).
