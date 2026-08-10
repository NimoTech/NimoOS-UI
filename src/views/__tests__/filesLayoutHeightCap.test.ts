// Bidirectional regression guard for the Files area .files-layout height capping:
// forward checks the cap is present, backward checks it hasn't regressed back to the
// old unbounded-growth rule.
//
// Background: .files-layout originally had `min-height: 100%` (at least one viewport height,
// can grow unbounded) instead of `height: 100%`. The sidebar with align-self:stretch then
// stretched to content height instead of viewport height, and the only scroller became
// AreaShell's .area-body ⇒ sidebar and breadcrumb scrolled away with the file listing,
// and the sidebar's own overflow-y:auto never engaged (can't reach favorites when there are many).
//
// Files had no inner scroll container before this fix, so capping had to be done together
// with building one — capping .files-layout alone would clip the listing out of reach.
// The three CSS rules are one unit: the cap on .files-layout, min-height:0 on .files-main
// (unblocks the flex shrink chain so the cap actually propagates instead of the child
// bursting the parent), and overflow-y:auto on .files-listwrap (something has to take over
// scrolling once the outer layout stops growing). If any one of the three is missing the
// layout breaks, so this guard locks all three.
//
// jsdom doesn't do layout (getBoundingClientRect always 0), so actual behavior still needs to be
// verified on device (not yet done as of this writing — see the handoff doc's acceptance checklist);
// this guard only locks source text and prevents regressions. Always read files with node:fs —
// `?raw` is always empty in this repo's test environment.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/views/Files.vue', 'utf8')

describe('Files area .files-layout height capping', () => {
  it('forward: .files-layout uses height: 100% to cap', () => {
    expect(SRC).toContain('.files-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }')
  })

  it('backward: must not regress to min-height: 100%', () => {
    expect(
      SRC.includes('.files-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }'),
      '.files-layout regressed to min-height:100%, sidebar and breadcrumb will scroll away with the file listing again',
    ).toBe(false)
  })

  it('.files-main has explicit min-height: 0 (without it child elements burst the parent, capping does nothing)', () => {
    const rule = SRC.split('\n').find((l) => l.trimStart().startsWith('.files-main {'))
    expect(rule, 'could not find .files-main rule').toBeTruthy()
    expect(rule).toContain('min-height: 0')
  })

  it('.files-listwrap has overflow-y: auto (after capping, it takes over scrolling)', () => {
    const rule = SRC.split('\n').find((l) => l.trimStart().startsWith('.files-listwrap {'))
    expect(rule, 'could not find .files-listwrap rule').toBeTruthy()
    expect(rule).toContain('overflow-y: auto')
  })

  it('.files-listwrap no longer uses min-height: 200px to prop up height', () => {
    const rule = SRC.split('\n').find((l) => l.trimStart().startsWith('.files-listwrap {'))
    expect(rule).not.toContain('min-height: 200px')
  })
})
