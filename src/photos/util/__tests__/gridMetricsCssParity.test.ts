// Task 6 (grid rewrite) migrates the single source of truth for grid geometry from
// PhotosGrid.vue's own <style> to src/photos/styles/vue2-parity/photos.scss (ported
// verbatim from the Vue 2 panel's photos.scss) — the component no longer carries ANY column/
// gap CSS of its own; `.grid[data-density]`'s three fixed-column rules live only in the
// parity stylesheet now. This file's job stays the same (catch a silent drift between the
// TS geometry table and the CSS that actually renders the grid), it just now reads the new
// file: scanning PhotosGrid.vue for these rules would find nothing and this test would
// pass for the wrong reason (no rule to disagree with the table) rather than the right one
// (the rule agrees).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { GRID_COLUMNS, GRID_GAP, CONTENT_INSET } from '../gridMetrics'

const SRC = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')

function ruleLine(startsWith: string): string {
  const line = SRC.split('\n').find((l) => l.trimStart().startsWith(startsWith))
  expect(line, `no CSS rule in photos.scss starting with ${startsWith}`).toBeTruthy()
  return line as string
}
function numberAfter(line: string, re: RegExp): number {
  const m = re.exec(line)
  expect(m, `pattern ${re} did not match: ${line}`).toBeTruthy()
  return Number((m as RegExpExecArray)[1])
}

const RULES: Array<[keyof typeof GRID_COLUMNS, string]> = [
  ['compact', '.photos-root .grid[data-density="compact"]'],
  ['comfortable', '.photos-root .grid[data-density="comfortable"]'],
  ['loose', '.photos-root .grid[data-density="loose"]'],
]

describe('gridMetrics matches the Vue2-parity stylesheet', () => {
  for (const [density, selector] of RULES) {
    it(`${density}: fixed column count and gap agree with the CSS`, () => {
      const line = ruleLine(selector)
      expect(numberAfter(line, /repeat\((\d+),\s*1fr\)/)).toBe(GRID_COLUMNS[density])
      expect(numberAfter(line, /gap:\s*(\d+)px/)).toBe(GRID_GAP[density])
    })
  }
  // Whole-branch review, minor 8 (carried over from the pre-rewrite version of this
  // file): the fourth number this file has to defend is the one that is not written as
  // a number. tileEdge() returns a WIDTH and estimateSectionBodyHeight multiplies it by
  // a row count — that is only sound because a tile is square. Drop `aspect-ratio: 1/1`
  // from `.tile` (or change it to 4/3) and every unloaded month gets the wrong height,
  // silently, with the TS side still self-consistent and no other gate able to notice.
  it('tileEdge doubling as a row height requires .tile to stay square', () => {
    expect(ruleLine('.photos-root .tile {')).toBeTruthy()
    expect(SRC).toMatch(/\.photos-root \.tile \{[^}]*aspect-ratio:\s*1\s*\/\s*1/)
  })

  // final-review fix (item 5): this test used to anchor CONTENT_INSET to nothing — the
  // comment at gridMetrics.ts:19-27 explains that the 40 comes from `.grid`'s own
  // left+right padding (20px each side), but no assertion here actually checked the CSS
  // still agrees. Without this, someone could edit the parity scss's `.grid` padding (or
  // CONTENT_INSET) alone and every unloaded-month placeholder height (tileEdge/
  // estimateSectionBodyHeight) would silently drift from the real rendered layout — no
  // test would fail to say so.
  it('CONTENT_INSET matches 2x the horizontal padding of .photos-root .grid', () => {
    const line = ruleLine('.photos-root .grid {')
    const m = /padding:\s*(\d+)(?:px)?\s+(\d+)px\s+(\d+)px/.exec(line)
    expect(m, `padding shorthand (top right/left bottom) not found in: ${line}`).toBeTruthy()
    const horizontalPadding = Number((m as RegExpExecArray)[2])
    expect(horizontalPadding * 2).toBe(CONTENT_INSET)
  })
})
