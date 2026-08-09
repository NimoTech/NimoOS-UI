import type { FileEntry } from '../stores/files'

/**
 * The effective target set of a context-menu action.
 *
 * Ported verbatim from Vue2 `ContextMenu.vue:271-279`: the current selection
 * wins only when it holds more than one entry AND the right-clicked entry is
 * part of it. Otherwise the action applies to the clicked entry alone.
 *
 * This is defence-in-depth, not a bug fix: the pre-existing, divergent logic
 * this replaces ("any non-empty selection wins") was never actually observable
 * through the UI, because `Files.vue`'s `onItemContextmenu` (`:81-85`) always
 * collapses the selection to the clicked entry via `files.selectOnly()`
 * (`files.ts:145`) *before* the menu opens or this function is consulted —
 * right-clicking an unselected entry already leaves the selection holding only
 * that entry by the time anything here runs. What this buys instead is a
 * single source of truth: both the action dispatch and the menu's
 * single-vs-multi shape read this one function, so they cannot drift apart
 * even though today they'd happen to agree anyway.
 *
 * @param entry the right-clicked entry, or null for toolbar batch entry points
 * @param selected the current selection, in listing order
 */
export function contextTargets(entry: FileEntry | null, selected: FileEntry[]): FileEntry[] {
  if (!entry) return selected
  const inSelection = selected.some((e) => e.path === entry.path)
  if (selected.length > 1 && inSelection) return selected
  return [entry]
}
