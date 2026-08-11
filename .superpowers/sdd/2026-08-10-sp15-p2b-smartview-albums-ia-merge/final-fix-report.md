# SP15-P2b — whole-branch final review, fix wave report

Base for the diff: `caae33f`. One fix dispatch, one scoped re-review. Every finding below was
re-verified against the Vue 2 target `939a7d3a` before being implemented; nothing was taken on
the review's word alone.

---

## CRITICAL — For You page renders nothing on the acceptance device

**Confirmed exactly as described.** `src/views/PhotosSmartViews.vue` gated the whole
`.mo-section` (the page's only `<h1>` + its description included) on `showMoments`. Vue 2's
target (`939a7d3a:src/views/Photos/PhotosSmartViewsView.vue`) puts no `v-if` on `.mo-section`
(:18) or `.mo-hero` (:19), gates only `.sv-grid.mo-grid` (:24), and keeps the slim hint as the
grid's `v-else-if` **inside** the section (:31).

Changed:
- `.mo-section` + `.mo-hero` now render unconditionally; `data-test="mo-section"` stays on the
  section (it now means "the section", not "the band is showing").
- `v-if="showMoments"` moved onto `.sv-grid.mo-grid`, which also gained `data-test="mo-grid"` so
  tests can distinguish "section present" from "grid present".
- The `v-else-if="aiSmartViewOff"` slim hint moved **inside** `.mo-section` (it was a sibling of
  the section, under `<main>`).
- Header comment scope items 2/3 rewritten; new deviation-registry entry 5 records that this was
  a corrected port, not a deviation, and why the old shape was harmless at `899af59b`.
- `showMoments`'s own comment corrected: citation `899af59b` → `939a7d3a:24 + :455`, and the
  "expected on a real device" sentence now says "heading with no cards under it" instead of
  "not seeing this band".

`src/views/PhotosSmartViews.moments.test.ts`:
- File header rewritten. It cited `899af59b:31-44` — the pre-merge commit, which is the root
  cause of the whole defect. Now cites `939a7d3a:18-32` and spells out why the old citation
  turned a harmless gate into a blank page.
- `describe('band gating')` → `describe('grid gating')`; all four cases now assert on `mo-grid`
  and, where relevant, that `.mo-hero h1` survives.
- The pinning case `'shows neither the band nor the hint when there are simply no moments (the
  everyday real-device state)'` retitled to `'shows the hero on its own — no grid, no hint —
  when there are simply no moments (the everyday real-device state)'` and rewritten: section
  present, `h1` text `=== zh.photosMoHeroTitle`, `p` text `=== zh.photosMoHeroDesc`, grid
  absent, hint absent.
- The AI-off case retitled and strengthened: hero present, grid absent, hint present **and**
  `mo-section.element.contains(hint.element)` — pinning Vue 2's nesting, not just presence.

### Mutation check (Critical)

The literal named mutation (v-if back on `.mo-section` **and** removed from the grid) does not
compile — `v-else-if has no adjacent v-if`. So the mutation applied was the defect-reproducing
half: add `v-if="showMoments"` back to `.mo-section`, leave the grid's gate in place.

```
$ pnpm exec vitest run src/views/PhotosSmartViews.moments.test.ts
     × keeps the section and its hero, dropping only the grid, when there are no moments
     × hides the grid when aiFeatures.smartview is false, even with moments present
     × shows the hero plus the slim settings hint instead of the grid when smart views are off
     × shows the hero on its own — no grid, no hint — when there are simply no moments (…)
      Tests  4 failed | 11 passed (15)
```

Reverted; back to 15/15 passing.

---

## IMPORTANT

**1. Convert confirmation's primary button was a ghost — FIXED.**
Verified: `sv-confirm-ok` with no modifier, base rule transparent + `--card-border` + `--fg`,
and the only hovers present were `.sv-confirm-cancel:hover` / `.sv-confirm-ok.danger:hover`.
Vue 2 uses `trash-btn-cta` (`939a7d3a:src/views/Photos/photos.scss:2203-2213` — filled gradient,
`color: white`, `font-weight: 600`). Added `.sv-confirm-ok.primary` (`var(--accent)` /
`var(--on-accent)` / `border: 0` / weight 600) plus
`.sv-confirm-ok.primary:hover:not(:disabled) { filter: brightness(1.08) }`, mirroring
`.sv-action-btn-primary:hover` on the same page. Applied `.primary` to the convert button only;
the delete dialog's `.danger` path is untouched.
Two small additions beyond the letter of the finding, both to avoid shipping a new
half-state: `:hover` applies to disabled buttons in CSS, so the hover carries `:not(:disabled)`,
and a shared `.sv-confirm-cancel:disabled, .sv-confirm-ok:disabled { opacity: .6; cursor:
not-allowed }` was added (both buttons are disabled mid-flight and neither showed it; the delete
dialog never disables either, so this only surfaces on the convert dialog). The
`.sv-confirm-cancel:hover` rule likewise gained `:not(:disabled)` — same defect class as the
`.sv-export-item:disabled` minor below.

**2. Non-destructive action wore the delete colour — FIXED.**
Verified: `.sv-confirm-icon` is unconditionally `--remove-fg`-tinted, and Vue 2 differentiates —
`939a7d3a:PhotosSmartViewDetail.vue:298` passes `color="var(--accent-hi)"` for the album glyph
while `:279` passes red for the trash glyph. Added `.sv-confirm-icon.accent
{ background: var(--accent-soft); color: var(--accent-text) }` (the pair the `.sv-export-icon`
discs on this same page already use) and applied `accent` to the convert dialog's icon only.

Two guard tests added to `src/views/__tests__/PhotosSmartViewDetail.test.ts`: one asserts the
button carries `primary` and not `danger` plus that the two CSS rules exist; the other asserts
the convert icon has `.accent` **and that the delete dialog's does not**.

**3. Neither conversion removed the source object — FIXED.**
Verified the whole chain, including the part the registered deviation glossed over:
`PhotosSmartViewDetail.vue:96` is `if (!store.listLoaded) await store.fetchSmartViews()` and
`PhotosAlbumDetail.vue:442` is `if (!albums.albumsLoaded) void albums.fetchAlbums()`. Both flags
stay `true` after a conversion, so the detail route for the server-deleted object rendered fully
interactive in both directions.

- `albums.ts`: new `dropAlbumLocal(id)` (immutable filter, matching this file's convention; also
  drops the album's cached asset list) — exported.
- `smartViews.ts`: new `dropSmartViewLocal(id)` (in-place splice, matching *its* file's
  convention) — exported.
- `convertFromAlbum` now calls `usePhotosAlbums().dropAlbumLocal(albumId)`;
  `convertFromSmartView` now calls `usePhotosSmartViews().dropSmartViewLocal(smartViewId)`.
- Both registered deviation comments rewritten: they no longer claim the remount covers this,
  and each names the exact line (`:96` / `:442`) that makes the stale detail page reachable.
- The two files now import each other. That mutual import is documented in a comment on both
  sides: it is safe because neither module touches the other's binding at module-evaluation
  time — both calls sit inside an async action body. `vue-tsc` and the full suite are green with
  it. **Flagging for the re-reviewer**: putting the eviction in the stores is what the finding
  asked for and gives one source of truth, but it is the first cross-store call in
  `src/photos/stores/`. The alternative (doing it at the two call sites) avoids the cycle at the
  cost of "one place can forget". If the re-reviewer prefers the other trade-off, it is a
  two-line move.

Four store tests added (two per direction): the source object is gone and the new object is
present on success; the source object is untouched on failure.

Mutation check: both `drop*Local` calls deleted →
```
$ pnpm exec vitest run src/photos/stores/__tests__/albums.test.ts src/photos/stores/__tests__/smartViews.test.ts
     × evicts the source album from the albums store
     × evicts the source smart view from the smart views store
      Tests  2 failed | 93 passed (95)
```
Restored; 95/95.

**4. Self-translated copy — FIXED.**
`zh_CN.json:1801` is `"Created": "创建于"` and `939a7d3a:PhotosAlbumDetail.vue:212` labels that
cell `$t('Created')` → `photosAlbumStatCreated: '创建时间'` → `'创建于'`.
`zh_CN.json:2024` is `"By month": "按月分布"` → `photosMoByMonth: '按月份'` → `'按月分布'`.
Grepped for both old strings elsewhere in `src/` (outside `src/i18n/`): zero hits.

**5. `#112`'s copy change not ported — FIXED.**
`zh_CN.json:1974` is `"Click to create or ask Nimo": "点击创建或询问 Nimo"` and
`939a7d3a:PhotosAlbumsView.vue:99` renders exactly that string on the create tile. Updated `photosAlbumNewHint` in place in both locales (`'Click to create or ask Nimo'` /
`'点击创建或询问 Nimo'`). No new key; the only consumer is `PhotosAlbums.vue:405`.

**6. AI-off banner indented 32px too far — FIXED.**
`939a7d3a:PhotosAlbumsView.vue:79` is `margin:0 0 20px`. Changed `.albums-ai-banner` from
`24px 32px 20px` to `0 0 20px`. The style comment was wrong in two ways and is rewritten: the
right reference for this surface is Vue 2's *Albums-page* banner (not the other New-UI page's),
and the old claim that "the 20px bottom margin deviates from Vue2's literal 0" is backwards —
Vue 2's bottom margin *is* 20px; it is the top and side margins that were invented.

**7. Reshaped more menu was 280px — FIXED.**
`939a7d3a:PhotosAlbumDetail.vue:61` is `<div class="sv-export-menu" style="min-width:220px">`,
and the sibling page carries the same width as `.sv-more-menu` (`PhotosSmartViewDetail.vue:740`
markup, `:1034` rule). Added `sv-more-menu` to the menu element and restated
`.sv-more-menu { min-width: 220px }` in this SFC. The block comment claiming the copied bodies
are "identical to" the sibling's is corrected — it is a restatement with two documented
differences (the `:disabled` rules, and this modifier that had been dropped).

**8. Escape-to-dismiss had no test that could fail — FIXED.**
Three cases added to `src/photos/components/__tests__/AlbumConvertToSmartDialog.test.ts`:
Escape while open dismisses; Escape mid-flight does not (it must route through `close()`'s busy
guard); Escape after close does nothing (the listener is detached).

Named mutation — delete `document.addEventListener('keydown', onDocumentKeydown)` from inside
the `watch`:
```
$ pnpm exec vitest run src/photos/components/__tests__/AlbumConvertToSmartDialog.test.ts
     × dismisses on Escape while open
      Tests  1 failed | 10 passed (11)
```
Restored (`git diff` on that file is empty); 11/11.

---

## MINOR

- **`AlbumView.dateEnd` — REMOVED.** Its only consumer was the deleted `sortAlbums('date')`;
  `dateRange` reads `a.dateEnd` off the *raw* record, not the view field. Removed the field, the
  local `const dateEnd`, and the return entry; repointed the `albumToView` comment (it now names
  `videoCount`/`dateStart` and records why `dateEnd` went). Two fixtures updated:
  `albumView.test.ts:21`'s `toMatchObject` now pins `dateStart` instead, and
  `mixedAlbums.test.ts:11` drops the field. `vue-tsc --noEmit` clean.
- **Three false comments — FIXED (prose only, no code touched).**
  - `PhotosAlbumDetail.vue` "By month" gate: Vue 2 **does** have this histogram behind this exact
    `v-if="monthBuckets.length"` (`939a7d3a:PhotosAlbumDetail.vue:218-224`). Comment now says so
    and keeps the PhotosMomentDetail pointer for where the rule bodies come from.
  - `PhotosAlbums.vue` grid width: `939a7d3a` unified both kinds into one `.album-grid-user` at
    `minmax(220px, 1fr)` (`photos.scss:3190-3193`) and renders `smart-view-card` inside it
    (`PhotosAlbumsView.vue:99-105`). Dropped the "accepted cost of mixing" framing; 220px **is**
    the target's mixed-grid column width.
  - `PhotosSmartViews.vue`'s `899af59b` citation: covered by the Critical.
- **`.sv-export-item:disabled` hover — FIXED.** `.sv-export-item:hover` →
  `.sv-export-item:hover:not(:disabled)`, so the disabled Convert row no longer highlights.
- **`.mo-off-hint` geometry — FIXED.** Now `padding: 12px 14px`, no margin, `gap: 8px`,
  `align-items: center`, `line-height: 1.4` — Vue 2's slim-hint inline style at
  `939a7d3a:PhotosSmartViewsView.vue:31`. Token family unchanged (`--dem-*`). Font size left at
  12.5px (Vue 2's 12px was not part of the finding and the surrounding page is on 12.5px).
- **`SmartViewCreateDialog` embedded focus — FIXED.** Added `descInputRef` on the description
  textarea; the focus call is now
  `(props.embedded ? descInputRef.value : nameInputRef.value)?.focus()`. New test asserts
  `document.activeElement` is the textarea in embedded mode and the name input in standalone
  mode (mounted with `attachTo: document.body`, both modes in one case). Mutation-checked:
  reverting the ternary turns that case red (1 failed | 52 passed).
- **`PhotosAlbums.test.ts:609` — FIXED.** `toContain('2')` →
  `toContain(zh.photosAlbumsCount.replace('{count}', '2'))`. Mutation-checked: hard-coding
  `count: 99` in the view turns it red (1 failed | 36 passed); with the old bare-`'2'` assertion
  that same mutation would not have been caught.
- **`PhotosSmartViewDetail.test.ts:801` — RETITLED** to `'closes the convert confirmation on
  Escape'`, with a note that the multi-overlay invariant is covered by the existing
  export-menu + more-menu case (`askConvertToAlbum` closes the menu on its way in, so no second
  overlay is ever open here).

## Explicitly not touched

The half-width→full-width `，` normalisation in the three convert keys; the
`display: contents` / `@click.self` observation; everything the ledger settles (the
`.sv-action-btn` rename, the `photosAlbumBack` back-button deviation, the restated scoped CSS
bodies). Also left alone: the ledger's deferred Task-7 minor about `AlbumConvertToSmartDialog.
test.ts` hard-coding `'转换失败'` / `'已存在'` instead of referencing the zh module — the final
review triaged it out, so it stays as accepted.

## Nothing in the findings list was wrong

All eight Importants and every Minor reproduced on inspection, and the Critical's stated root
cause (the test file's own `899af59b` citation) is exactly what the file said. Two mechanical
corrections to the *instructions*, not to the findings:

1. The Critical's named mutation cannot be applied literally — moving the `v-if` back to
   `.mo-section` while also removing it from the grid is a Vue compile error, not a red test. The
   defect-reproducing half was used instead (documented above).
2. Finding 8 cites `AlbumConvertToSmartDialog.vue:723-733`; the `watch` with the
   `addEventListener` is at `:56-67`. The described code is the code that was fixed.

## Newly-added-Chinese grep

```
$ git diff caae33f HEAD | grep '^+' | grep -P '[\x{4e00}-\x{9fff}]'
+  photosAlbumNewHint: '点击创建或询问 Nimo',
+  photosAlbumStatCreated: '创建于',
+  photosMoByMonth: '按月分布',
+    expect(v).toMatchObject({ id: 7, title: '旅行', cover: 'a1', count: 12, dateRange: 'Jun 2025', createdAt: '2025-07-01T00:00:00Z', dateStart: '2025-06-01' })
```
Three i18n values (all verbatim from `939a7d3a:zh_CN.json`) plus one pre-existing fixture line
in `albumView.test.ts` that had to be re-emitted because the `dateEnd` expectation inside it was
replaced. No newly-authored Chinese prose, comment or test description.

## Final gate numbers

| Gate | Result |
|---|---|
| `pnpm exec vue-tsc --noEmit` | clean |
| `pnpm exec vitest run src/views/__tests__ src/photos` | 128 files / 2551 passing |
| `pnpm exec vitest run src/i18n/parity.test.ts src/styles` | 5 files / 1087 passing |
| `pnpm test` | see below |

`pnpm test` on a dirty tree measured **686 files, 4 failed / 10856 passed / 70 skipped** — three
`oss/*.test.mjs` failures (`cli-args` ×2, `export-rsync`; plus `media-wave.test.mjs` /
`tree.test.mjs` aborting at import) explained entirely by the uncommitted working tree per the
ledger's CONTROLLER FACT, and one `DesktopContextMenu.test.ts` failure, the known flake listed
in spec §7. Re-measured after committing — numbers in the closing section below.

### Post-commit re-run

The oss suite asserts a clean tree, so this is the only `pnpm test` run whose numbers mean
anything. Measured after the three commits landed, working tree clean:

```
$ pnpm exec vue-tsc --noEmit
TSC-OK
$ pnpm test
 Test Files  686 passed (686)
      Tests  10930 passed (10930)
```

686 files — unchanged, because this wave added no new test *files*, only cases to existing ones
(nothing to register in `oss/manifest.mjs`, and `photosStripCoverage` is unaffected). Zero
failures: the four "failures" seen before committing were the three dirty-tree `oss/*.test.mjs`
cases and the `DesktopContextMenu.test.ts` flake, and both classes are green on a clean tree.
color-guard, `parity.test.ts`, `deepLinkCoverage` and `photosStripCoverage` are all inside that
run.

Commits: `00fd8c8` (Critical), `63142a3` (the eight Importants + the Minors), and a third
carrying this report plus the phase's acceptance checklist, which had been sitting untracked.

### One gate trap worth recording

color-guard does not strip comments **and** matches a `#nnn` issue reference as a 3-digit hex.
Writing `#113` inside the `PhotosAlbums.vue` style block failed the gate
(`views/PhotosAlbums.vue 无裸颜色字面量`). Rewritten as `Vue2 939a7d3a`. The same `#112`
reference in `PhotosSmartViewDetail.vue` is fine because it sits in the template, not the style
block — the guard only scans `<style>`.
