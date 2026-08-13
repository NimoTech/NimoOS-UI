// "Hidden entry" rule shared by the Files area and the home Add panel's folder picker:
// dot-prefixed entries (system dirs like .system_data) and lost+found are never shown.
// Extracted into a single predicate so both places always share one logic — the picker
// once missed this rule and system directories could be dragged onto the desktop.
const HIDDEN = new Set(['lost+found'])

export function isHiddenEntry(name: string): boolean {
  return name.startsWith('.') || HIDDEN.has(name)
}
