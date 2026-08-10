// gridMetrics.ts duplicates three numbers that only CSS can actually enforce:
// each density's minmax() floor and its gap, plus .photos-wrap's padding-right.
// If either side is edited alone, every unloaded month gets the wrong height —
// and no other gate can see it: vue-tsc does not read CSS, the build does not
// care, color-guard only looks at colors, and jsdom does no layout at all.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { GRID_METRICS, CONTENT_INSET } from '../gridMetrics'

const SRC = readFileSync('src/photos/components/PhotosGrid.vue', 'utf8')

function ruleLine(startsWith: string): string {
  const line = SRC.split('\n').find((l) => l.trimStart().startsWith(startsWith))
  expect(line, `no CSS rule in PhotosGrid.vue starting with ${startsWith}`).toBeTruthy()
  return line as string
}
function numberAfter(line: string, re: RegExp): number {
  const m = re.exec(line)
  expect(m, `pattern ${re} did not match: ${line}`).toBeTruthy()
  return Number((m as RegExpExecArray)[1])
}

const RULES: Array<[keyof typeof GRID_METRICS, string]> = [
  ['comfortable', '.grid {'],
  ['compact', '.grid[data-density="compact"]'],
  ['loose', '.grid[data-density="loose"]'],
]

describe('gridMetrics matches PhotosGrid.vue CSS', () => {
  for (const [density, selector] of RULES) {
    it(`${density}: minmax floor and gap agree with the CSS`, () => {
      const line = ruleLine(selector)
      expect(numberAfter(line, /minmax\((\d+)px/)).toBe(GRID_METRICS[density].minColWidth)
      expect(numberAfter(line, /gap:\s*(\d+)px/)).toBe(GRID_METRICS[density].gap)
    })
  }
  it('CONTENT_INSET matches .photos-wrap padding-right', () => {
    expect(numberAfter(ruleLine('.photos-wrap {'), /padding-right:\s*(\d+)px/)).toBe(CONTENT_INSET)
  })
  // Whole-branch review, minor 8: the fourth number this file has to defend is
  // the one that is not written as a number. tileEdge() returns a WIDTH and
  // estimateSectionBodyHeight multiplies it by a row count — that is only sound
  // because a tile is square. Drop `aspect-ratio: 1` from .tile (or change it to
  // 4/3) and every unloaded month gets the wrong height, silently, with the TS
  // side still self-consistent and no other gate able to notice.
  it('tileEdge doubling as a row height requires .tile to stay square', () => {
    expect(ruleLine('.tile {')).toMatch(/aspect-ratio:\s*1\s*;/)
  })
})
