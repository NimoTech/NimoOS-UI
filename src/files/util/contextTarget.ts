import type { FileEntry } from '../stores/files'

/**
 * The effective target set of a context-menu action.
 *
 * Ported verbatim from Vue2 `ContextMenu.vue:271-279`: the current selection
 * wins only when it holds more than one entry AND the right-clicked entry is
 * part of it. Otherwise the action applies to the clicked entry alone.
 *
 * New-UI had regressed to "any non-empty selection wins", so right-clicking an
 * unselected file and hitting Copy operated on the previous selection instead
 * (pending-ledger F11). Both the action dispatch and the menu's single-vs-multi
 * shape must read this same set, or the menu keeps lying about what it acts on.
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
