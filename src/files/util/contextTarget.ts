import type { FileEntry } from '../stores/files'

/**
 * The effective target set of a context-menu action.
 *
 * Ported verbatim from Vue2 `ContextMenu.vue:271-279`: the current selection
 * wins only when it holds more than one entry AND the right-clicked entry is
 * part of it. Otherwise the action applies to the clicked entry alone.
 *
 * Since 2026-08-13 this is the actual mechanism, not defence-in-depth:
 * `Files.vue`'s `onItemContextmenu` no longer touches the selection on
 * right-click (it used to collapse it via `files.selectOnly()`, which lit up
 * the row and summoned the top SelectionToolbar for a plain right-click — an
 * owner-requested removal). A right-clicked entry outside the selection is
 * therefore genuinely targeted alone while the selection stays intact, and
 * both the action dispatch and the menu's single-vs-multi shape read this one
 * function, so they cannot drift apart.
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
