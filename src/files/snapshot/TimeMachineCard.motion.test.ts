// Source-text guard on the two motion decisions that a real browser proved and that a passing
// component test cannot see (jsdom applies no scoped stylesheet and computes no transform).
// The screenshots and the CDP measurements are the real evidence; this file exists so the two
// values cannot be quietly reverted, since nothing else in the suite would go red if they were.
/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const css = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'TimeMachineCard.vue'),
  'utf8',
)
const rule = (selector: string): string => {
  const at = css.indexOf(selector + ' {')
  expect(at, `${selector} rule not found`).toBeGreaterThan(-1)
  return css.slice(at, css.indexOf('}', at))
}

describe('card flip motion', () => {
  // Owner's report: "when flipping, the page that leaves should be opaque", and its other half,
  // "flipping back, there is no animation of the previous page being turned in". Both were the
  // same fade: an outgoing card at opacity 0 dissolves instead of leaving, and on the way back it
  // materialises out of nothing instead of flying in.
  it('the outgoing card stays opaque instead of fading out', () => {
    const past = rule('.is-past')
    expect(past).toContain('opacity: 1')
    expect(past).not.toMatch(/opacity:\s*0\b/)
  })
  // Because it is opaque the whole way, the travel has to actually leave the window; while it was
  // invisible, stopping short (62vh) was harmless.
  it('the outgoing card travels far enough to clear the viewport', () => {
    const m = rule('.is-past').match(/translate3d\(0,\s*(\d+)vh/)
    expect(m, 'expected a vh-based Y travel on .is-past').not.toBeNull()
    expect(Number(m![1])).toBeGreaterThanOrEqual(100)
  })
  // Depth via translateZ alone. scale() on top of it counted the recession twice and read as the
  // cards shrinking, because perspective already shrinks a receding card on its own.
  it('rear cards carry depth with translateZ only, never with scale()', () => {
    for (const d of [1, 2, 3, 4]) {
      expect(rule(`.is-behind.depth-${d}`)).not.toContain('scale(')
    }
  })
})
