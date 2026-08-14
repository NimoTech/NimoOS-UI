/**
 * Breadcrumb middle-level collapsing.
 *
 * The breadcrumb is capped at two rendered lines. Deciding *how many* levels have
 * to disappear is a geometry question (container width, font, label lengths) that
 * only the browser can answer, so the component measures and feeds the answer in
 * here as `collapseCount`. This module owns the other half: given that count,
 * which levels survive and what the display sequence looks like. Keeping it a
 * pure function is what makes the rule testable without a layout engine — jsdom
 * reports `scrollHeight` as 0, so the measuring loop itself can only be verified
 * in a real browser.
 *
 * Rule: the first level (the storage root the user recognises) and the last two
 * (the current folder and its parent) always stay. Everything squeezed out in
 * between is folded into a single clickable ellipsis. That leaves nothing to hide
 * until there are at least four levels — with three, the ellipsis would take more
 * room than the level it replaces.
 */

export interface CrumbSeg {
  label: string
  vpath: string
}

export type CrumbItem =
  | { kind: 'seg'; seg: CrumbSeg }
  | { kind: 'ellipsis'; hidden: CrumbSeg[] }

/**
 * How many levels can be hidden at most: everything but the first and the last
 * `keepTail`. `keepTail` is 2 by default (current folder + its parent); a caller
 * that has run out of room may drop to 1, which keeps only the current folder —
 * still better than clipping it out of view entirely.
 */
export function maxCollapsible(total: number, keepTail = 2): number {
  return Math.max(0, total - 1 - keepTail)
}

/**
 * Build the display sequence. `collapseCount` is clamped to `maxCollapsible`, so
 * an over-eager measuring loop can never eat the levels that must stay visible.
 */
export function collapseCrumbs(segs: CrumbSeg[], collapseCount: number, keepTail = 2): CrumbItem[] {
  const n = Math.min(Math.max(0, Math.trunc(collapseCount)), maxCollapsible(segs.length, keepTail))
  if (n === 0) return segs.map((seg) => ({ kind: 'seg', seg }))
  return [
    { kind: 'seg', seg: segs[0] },
    { kind: 'ellipsis', hidden: segs.slice(1, 1 + n) },
    ...segs.slice(1 + n).map((seg): CrumbItem => ({ kind: 'seg', seg })),
  ]
}
