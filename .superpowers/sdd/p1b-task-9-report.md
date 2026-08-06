# Task 9 report — block renderers batch B (Terminal + SemanticSearch + search aux)

Commit: `1daccf7` — SP8-P1b: block renderers batch B (Terminal + SemanticSearch + search aux)

## Components ported

| File | Status | Vue2 lines | Notes |
|---|---|---|---|
| `SearchImageLightbox.vue` | replaced Task 8 stub | 216 | `<script setup>`, `beforeDestroy`→`onBeforeUnmount`, `triedThumb` fallback preserved |
| `SearchFileDrawer.vue` | new | 295 | file-detail modal, `kindColor`/`scoreColor`/`highlightText` ported |
| `SearchFullResults.vue` | new | 686 | "view all results" modal, section filter bar, own `PALETTES` |
| `TerminalCard.vue` | replaced stub | 185 | **no `<style>` block** — see design note below |
| `SemanticSearchCard.vue` | replaced stub (heaviest) | 926 | tabbed all/image/file/semantic, composes the 3 aux components |

Also touched:
- `src/ai/services/openInApp.ts` (new) — TS port of Vue2's `openInApp.js`.
- `src/ai/components/blocks/PhotoGridCard.vue` — 3-line type-guard fix (see Concerns).
- `src/i18n/zh_cn.ts` / `en_us.ts` — 29 new `ai*` keys (parity maintained).
- `src/ai/styles/tokens.scss` — new token groups (below).

## Design note: TerminalCard has no `<style>` block, intentionally

Vue2's `TerminalCard.vue` itself has **no `<style>` section** — all `.term-*` chrome
(`term-head`, `term-badge`, `term-cmd`, `term-body`, `term-approval`, etc.) lives in the
global `agent-styles.scss`, which was already carried over **verbatim, whole-file, in an
earlier task** into `src/ai/styles/agent-styles.scss` (imported once by `AgentPage.vue`).
That file's top line already carries a standing exemption comment: *"1:1 移植自 Vue2
Agent；字面色值为作用域内既有体系，豁免全局 token 规则"*. Confirmed via `grep` that the
new repo's copy already contains all `.term-*` rules (line-for-line match with Vue2's
`agent-styles.scss`) and no conflicting `.sil-*`/`.sfd-*`/`.sfr-*`/`.semcard-*` rules exist
there. So `TerminalCard.vue` needed **zero new CSS** — it inherits the already-exempted
global chrome, matching Vue2 1:1.

The **one exception**: Vue2's `TerminalCard.vue` passes two `AgentIcon` `color` props
directly as `"rgba(255,255,255,0.5)"` literals (not via a CSS class, so not covered by the
global-file exemption). Since that's a hardcoded color newly appearing in *my* file, I
routed it through a new `--term-icon-dim` token instead of copying the literal — documented
inline in the component's header comment.

## Theme tokens added (`src/ai/styles/tokens.scss`)

All new tokens have a value in **both** `.agent-app` (light) and `.agent-app[data-theme="dark"]`
(dark) blocks, except two groups that are *composed from other tokens via nested `var()`*
(declared once, following the file's own pre-existing `--tl-active: var(--accent)` precedent
— a single declaration already resolves correctly under either theme since the inner `var()`
re-resolves live).

**Literal, duplicated in both blocks** (all theme-invariant chrome — same rationale as the
already-existing `--scrim-dark`/`--gloss-inset`):
- `--overlay-scrim`, `--overlay-fg-strong`, `--overlay-fg-soft`, `--overlay-chip-bg(-hover)`,
  `--overlay-chip-border`, `--overlay-btn-bg(-hover)`, `--overlay-nav-bg(-hover)`,
  `--overlay-nav-border`, `--overlay-img-shadow` — SearchImageLightbox's fullscreen dark stage.
- `--modal-scrim` — dim-behind-blur backdrop shared by SearchFileDrawer/SearchFullResults.
- `--paper-surface` — white "paper" file-icon face (3 components).
- `--kind-pdf`, `--kind-doc`, `--kind-xls`, `--kind-md`, `--kind-txt`, `--kind-archive` — the
  `kindColor()` ext→color badge map (reused by all 3 search components).
- `--photo-caption-scrim`, `--photo-chip-bg(-hover)`, `--photo-chip-border`,
  `--photo-overlay-fg` — photo-thumbnail hover/caption chrome.
- `--term-icon-dim` — TerminalCard's two literal-color icon props (see design note above).

**Composed once (auto-adapts per theme, not redefined in dark block)**:
- `--icon-tile-glow: 0 3px 10px color-mix(in srgb, var(--accent) 22%, transparent)` —
  replaces Vue2's `rgba(0, 122, 255, 0.22)` icon-tile shadow; `color-mix()` is an already-
  established pattern in this repo (used in `theme.css`, `AlertDialog.vue`, several `files/`
  components).
- `--grad-photo: linear-gradient(135deg, var(--purple), var(--pink))` — replaces Vue2's
  `linear-gradient(135deg, #AF52DE, #FF2D55)`.
- `--grad-file: linear-gradient(135deg, var(--accent), var(--teal))` — replaces Vue2's
  `linear-gradient(135deg, #007AFF, #5AC8FA)` (nearest existing tokens; decorative icon-tile
  hue, not a semantic-state color).

**Tokens reused, not duplicated** (per the task's "reuse before adding" instruction):
`--scrim-dark` (photo hover-overlay dim, exact 0.35 match), `--gloss-inset` (icon-tile gloss
highlight, paired with the new `--icon-tile-glow`), `--text-on-accent` (every literal `#fff`
icon/text-on-colored-surface), `--accent`/`--teal`/`--warning`/`--text-tertiary` (score-color
function, already tokens in the Vue2 source itself).

**Exception-list extension**: `tokens.scss`'s header comment already registered
`VideoCard.PAL` / `ImageGridCard.PALETTES` as a sanctioned "generative seed-indexed
placeholder mosaic" exception. `SearchFullResults.vue` and `SemanticSearchCard.vue` each
carry the **exact same `PALETTES` array**, copy-pasted in Vue2 itself — I extended the
existing comment to name these two files rather than treating it as a new exception (it
isn't one; same category, same array).

## i18n

29 new keys added to both `zh_cn.ts` and `en_us.ts` (parity test covers this): `aiOpenInPhotos`,
`aiLightboxClose`, `aiPrevious`, `aiNext`, `aiOpenInFileManager`, `aiMatchedPassage`,
`aiSimilarity`, `aiTypeLabel`, `aiPathLabel`, `aiAllSearchResults`, `aiMatchesShowing`, `aiAll`,
`aiPhotosLabel`, `aiFilesLabel`, `aiSemanticPassagesLabel`, `aiSemanticLabel`, `aiPhotosCount`,
`aiFilesCount`, `aiSemanticCount`, `aiSemanticPassagesCount`, `aiSemanticSearchTitle`,
`aiMatchesLabel`, `aiQueryLabel`, `aiVectorIndex`, `aiItemsLabel`, `aiFileindexBuilding`,
`aiPhotoSearchUnavailable`, `aiFilenameSearchUnavailable`, `aiSemanticSearchUnavailable`,
`aiNoMatchingFiles`, `aiNoMatchingSemanticPassages`, `aiClickToView`, `aiViewAllFiles`,
`aiViewAllSemanticPassages`, `aiViewAllResults`. `TerminalCard.vue` kept all literal English
strings verbatim (Vue2 source uses no `$t` there).

## `openInApp.ts` routing judgment call

Vue2's `openInApp.js` deep-links search results into sibling pages within the *same*
(single) Vue2 app. This repo has **two coexisting apps** (Vue2 at `/`, New-UI at `/app/`).
I routed:
- **Files** → New-UI's own Files page: `/app/#/files?path=&highlight=` — confirmed New-UI's
  `src/views/Files.vue` already reads exactly these two query params (SP4 work, already live).
- **Photos** → the **legacy Vue2** Photos page: `/#/photos?...` — New-UI has no Photos route
  on this branch yet (SP7 photos migration lives in a separate, unmerged worktree per
  `sp7-photos-migration-progress` memory). This is a deliberate bridge, documented with a
  code comment in `openInApp.ts` pointing at what to swap once SP7 merges.

## Tests

`BlockRenderer.batchB.test.ts` — 13 cases, all passing:
- TerminalCard: running (dots + cursor), success (Exited 0 + ok), error (Exit 2 + failed).
- SearchImageLightbox: title/counter render, `→`/`←`/`Escape` keydown → correct `nav`/`close`
  emits (including the boundary case where `←` at index 0 must NOT emit), next-button click.
- SemanticSearchCard: mounted from a **real `buildSemanticSearchBlock()` fixture** (not a
  hand-rolled shape) — asserts query/total render, tab-click switches to the image grid,
  thumbnail click opens `SearchImageLightbox` (asserted via `findComponent` + `.sil-overlay`),
  file-row click opens `SearchFileDrawer`, footer link opens `SearchFullResults`.

`pnpm test -- BlockRenderer.batchB`: **13/13 passed**.
`pnpm test` (full suite): **1459/1459 passed** (232 files) on the run after my changes;
one file (`files/upload/persist.test.ts`) flaked once under full-suite load — confirmed via
isolated rerun (`pnpm test -- persist.test`, passes) and a second full-suite rerun (also
100% green) that this is a **pre-existing IndexedDB-timing flake unrelated to Task 9**, not
a regression from these changes.
`pnpm exec vue-tsc --noEmit`: **clean** (one real type error surfaced and fixed — see
Concerns).

## Color self-audit

`git diff` + targeted `grep -nE "#[0-9a-fA-F]{3,8}|rgba?\("` across all 5 ported files plus
`openInApp.ts`: the only hex literals remaining are the sanctioned `PALETTES` arrays in
`SearchFullResults.vue`/`SemanticSearchCard.vue` (documented exception, extended in
tokens.scss's header) and one incidental match inside a code *comment* in `TerminalCard.vue`
(the string `rgba(255,255,255,0.5)` appears only as prose describing the fix, not as code).
Every new raw color added to the repo lives exclusively inside token *definitions* in
`tokens.scss`. No new raw-hex exception categories were introduced.

## Self-review

- All 5 components render from real prop shapes (Task 3's `buildSemanticSearchBlock` output
  for SemanticSearchCard; hand-built but schema-accurate fixtures elsewhere) — tests assert
  actual DOM content/classes, not mocked internals.
- `SemanticSearchCard`'s composition wiring (Lightbox/Drawer/FullResults props+events) was
  ported 1:1, including the `lightboxPhotos` filter-by-`assetId` indirection and the
  `onFullImageClick`/`onFullFileClick` handoff-then-close-modal sequencing.
- `PhotoGridCard.vue` (Task 8) required a 3-line type-guard fix once `SearchImageLightbox`'s
  real (non-`unknown[]`) prop types were filled in — `vue-tsc --noEmit` caught it, fixed with
  a type-predicate `.filter()` rather than widening the interface.

## Concerns (worth a second look, not blocking)

1. **Photos deep-link judgment call**: `openPhotoInNewTab`/`openPhotoSetInNewTab` point at the
   legacy Vue2 app's `/#/photos` route rather than New-UI's own (nonexistent, on this branch)
   Photos page. This is the only reasonable choice given the current migration state, but
   whoever merges SP7's Photos work into this branch should grep `openInApp.ts` and re-point
   both functions at New-UI's own route.
2. **`--icon-tile-glow`/`--grad-file` are decorative approximations**, not exact-hex matches
   to Vue2's `#007AFF`/`rgba(0,122,255,...)` (iOS system blue) — composed from this file's
   existing `--accent`/`--teal` tokens instead, per "reuse before adding". Visually close but
   not byte-identical; flag if exact-brand-blue fidelity matters here.
3. `TerminalCard.vue` carries no `<style>` block by design (see design note) — this is
   correct only as long as the pre-existing whole-file exemption on `agent-styles.scss`
   remains in force. If a future task removes that global-file exemption piecemeal
   (component-by-component), TerminalCard would need its own scoped styles added at that
   point.

Status: **DONE** (not DONE_WITH_CONCERNS in the blocking sense — all tests/typecheck green,
concerns above are judgment calls to flag, not defects).
