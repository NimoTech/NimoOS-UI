// How many readings rows a widget card can actually show, and which ones to keep.
//
// Why this is measured at runtime instead of sized in CSS: the card's height comes
// from the desktop grid's cell size, which is derived from the *viewport in CSS px*,
// while the row height comes from the font size -- and neither is under this
// component's control. Browser zoom shrinks the viewport (a 4x3 GPU card is 288px
// tall inside at 2560x1440 but only 101px at 1280x800), and Chrome's minimum font
// size -- which is what a Windows "make text bigger" setting ends up driving -- forces
// a 10px row up to 16px no matter what the stylesheet asks for. Measured on the
// deployed build: 1600x1000 with minimumFontSize=16 needs 211px of content in a 171px
// box. No amount of clamp() tuning fixes that; a 101px box cannot hold a legible ring
// plus five rows, so the content has to give.

export interface FitRow {
  key: string
  /** false when the row would only show an em dash -- nothing to read. */
  has: boolean
}

// First to go, once the rows with no reading are gone. The model name is the most
// droppable: it is static, it is the longest, and the card's own header already says
// which widget this is. Frequency is last because on integrated graphics it is the
// only field the driver fills in at all.
export const STAT_DROP_ORDER = ['model', 'vramUse', 'vram', 'temp', 'freq']

/**
 * Rows that fit in `availH`, given each row costs `rowH` and `blockedH` is already
 * spent on whatever shares the column (the ring, plus the gap under it).
 * Returns Infinity when rowH is unknown -- jsdom reports every box as 0px, and a
 * widget that hides all its rows under test would be worse than one that shows them.
 */
export function fitRowCount(availH: number, blockedH: number, rowH: number): number {
  if (!(rowH > 0)) return Infinity
  return Math.max(0, Math.floor((availH - blockedH) / rowH))
}

/** Keeps at most `budget` rows, dropping the least informative ones first. */
export function pickRows<T extends FitRow>(rows: T[], budget: number): T[] {
  if (budget >= rows.length) return rows
  const dropped = new Set<string>()
  const left = () => rows.length - dropped.size
  const has = (key: string) => rows.some((r) => r.key === key)
  // Two passes down the same importance order. An em-dash row costs exactly as much
  // height as a real reading and carries none, so every one of those is considered
  // before any live reading -- on an integrated GPU that is three of the five rows,
  // and dropping them loses nothing at all. Both passes go in importance order rather
  // than display order: when only one row has to go, dropping "VRAM usage" and keeping
  // "Temp" is a choice, whereas dropping whichever em-dash row happens to be listed
  // first is not.
  for (const key of STAT_DROP_ORDER) {
    if (left() <= budget) break
    if (rows.some((r) => r.key === key && !r.has)) dropped.add(key)
  }
  for (const key of STAT_DROP_ORDER) {
    if (left() <= budget) break
    if (has(key)) dropped.add(key)
  }
  return rows.filter((r) => !dropped.has(r.key))
}
