// Task 6 (网格重刻) migrates the single source of truth for grid geometry from
// PhotosGrid.vue's own <style> to src/photos/styles/vue2-parity/photos.scss (ported
// verbatim from NimoOS-UI's photos.scss) — the component no longer carries ANY column/
// gap CSS of its own; `.grid[data-density]`'s three fixed-column rules live only in the
// parity stylesheet now. This file's job stays the same (catch a silent drift between the
// TS geometry table and the CSS that actually renders the grid), it just now reads the new
// file: scanning PhotosGrid.vue for these rules would find nothing and this test would
// pass for the wrong reason (no rule to disagree with the table) rather than the right one
// (the rule agrees).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { GRID_COLUMNS, GRID_GAP } from '../gridMetrics'

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
})
