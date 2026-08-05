# P1 restyle: photos timeline selection → Files-region style

Branch: sp7-photos. Base: d784689.

## Scope

Two changes, both driven by user acceptance feedback on the timeline grid:

1. **Checkbox**: replaced the per-tile custom `.tile-checkbox`/`.check-mark`
   (✓ glyph in a circle) with the Files region's native-checkbox pattern —
   `<span class="tile-check"><input type="checkbox" class="tile-check-box" ...></span>`,
   mirroring `src/files/components/FileTile.vue` exactly. Reveal-on-hover/selected
   rule kept the same trigger condition PhotosGrid already used
   (`.tile[data-selected="true"]`, since PhotosGrid doesn't have FileTile's
   `.selected` class on the root) — `.tile:hover .tile-check-box,
   .tile[data-selected="true"] .tile-check-box { opacity: 1; }`.

2. **Selection bar**: moved from a `position: sticky; bottom: 0` bar living
   inside `PhotosGrid.vue` to a new top-of-content component,
   `src/photos/components/PhotosSelectionToolbar.vue`, styled identically to
   `src/files/components/SelectionToolbar.vue` (`.selection-toolbar`/`.sel-count`/
   `.sel-btn`/`.danger`, same padding/radius/gap/tokens, same ≤768px
   flex-wrap media query — copied verbatim, not reinvented). It exposes only
   `count` in / `clear` + `delete` out (P1 keeps the reduced Photos action
   set: no select-all/copy/cut/download/share, those don't apply to a photo
   timeline).

   `PhotosGrid.vue` no longer owns any selection-bar UI or emits for it —
   `Photos.vue` now renders `<PhotosSelectionToolbar v-if="selected.length"
   :count="selected.length" @clear="cancelSelection"
   @delete="onBatchDelete([...selected])" />` directly above `<PhotosToolbar>`,
   driven by its own existing `selected` ref / `cancelSelection` /
   `onBatchDelete(ids)`.

## Emit surface change (as flagged in the brief)

Verified after removing the bottom bar from `PhotosGrid.vue`: `batch-delete`
and `cancel` were emitted from nowhere else in that component (only the
removed bar's buttons referenced them), so **both emit declarations were
removed** from `PhotosGrid.vue`'s `defineEmits`. It now only emits `open`
and `toggle-select`. The `onBatchDelete()` local function in PhotosGrid
(which did `emit('batch-delete', [...props.selected])`) was deleted too —
batch-delete now lives entirely in `Photos.vue`, calling the store method
directly with a spread copy of `selected`, same as before.

## Files changed

- `src/photos/components/PhotosGrid.vue` — checkbox markup + CSS swap;
  removed bottom `.selectbar` block, its CSS, the `batch-delete`/`cancel`
  emits, and `onBatchDelete()`.
- `src/photos/components/PhotosSelectionToolbar.vue` — new component.
- `src/views/Photos.vue` — imports + renders `PhotosSelectionToolbar` above
  `PhotosToolbar`; `PhotosGrid` no longer wired to `@batch-delete`/`@cancel`.
- `src/photos/components/__tests__/PhotosGrid.test.ts` — checkbox markup
  tests rewritten for the native `<input>`; two-button/absent selectbar
  tests replaced with a single "PhotosGrid renders no bar at all" test.
- `src/photos/components/__tests__/PhotosSelectionToolbar.test.ts` — new,
  covers count text, two-button render, clear/delete emit wiring, `.danger`
  class on the delete button.
- `src/views/__tests__/Photos.integration.test.ts` — batch-delete test
  updated to select via `.tile-check-box` `change` events and find the
  delete button inside `.selection-toolbar` / `.sel-delete`; added a DOM-order
  assertion that the bar renders above `PhotosToolbar`, plus a clear-button
  wiring check.

## i18n

No new keys — reused existing `photosSelectedCount` / `photosDelete` /
`photosCancel` (already in both `zh_cn.ts` and `en_us.ts`), per the brief's
guidance to prefer `photosCancel` over inventing a distinct "clear" label.

## Theme rule

No hardcoded colors introduced. `PhotosSelectionToolbar.vue`'s CSS is a
verbatim copy of Files' `SelectionToolbar.vue` token usage
(`var(--chip-bg, ...)`, `var(--chip-border, ...)`, `var(--remove-fg, ...)`,
`color-mix(in srgb, var(--remove-fg, ...) NN%, transparent)`).
`color-guard.test.ts` passes with no new offenders.

## Verification

- Focused run (`vitest run src/photos src/views/__tests__/Photos.integration.test.ts
  src/i18n/parity.test.ts src/styles/color-guard.test.ts`): 14 files / 234
  tests, all green.
- Full `vitest run`: 227 files / 1334 tests, all green.
- `npx tsc --noEmit`: clean, no errors.

## Commit

One commit on `sp7-photos`:
`feat(photos): 时间线选择改用 files 风格(原生复选框 + 顶部选择栏),移除底部浮条`

## Concerns / follow-ups

- Not deployed to the device — this was implementation + test verification
  only, per task scope. Run `./scripts/deploy.sh` when ready for real-machine
  acceptance (per the long-standing New-UI deploy convention).
- P1 already carved out favorite/add-to-album/ask-nimo from the Photos
  selection bar (see PhotosGrid.vue's header comment, item 3) — that scope
  cut is unchanged by this restyle; the new top bar still only offers
  clear + delete.
