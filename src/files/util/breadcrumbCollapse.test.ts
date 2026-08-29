import { describe, it, expect } from 'vitest'
import { collapseCrumbs, maxCollapsible, type CrumbSeg } from './breadcrumbCollapse'

function segs(...labels: string[]): CrumbSeg[] {
  let acc = ''
  return labels.map((label) => {
    acc += '/' + label
    return { label, vpath: acc }
  })
}

describe('maxCollapsible', () => {
  it('never collapses anything below 4 levels (the "…" costs more than it saves)', () => {
    expect(maxCollapsible(0)).toBe(0)
    expect(maxCollapsible(1)).toBe(0)
    expect(maxCollapsible(2)).toBe(0)
    expect(maxCollapsible(3)).toBe(0)
  })

  it('can hide everything except the first level and the last two', () => {
    expect(maxCollapsible(4)).toBe(1)
    expect(maxCollapsible(7)).toBe(4)
  })
})

describe('collapseCrumbs', () => {
  it('returns every level untouched when nothing needs collapsing', () => {
    const s = segs('NimoOS-HD', 'Documents', 'Reports', '2026')
    expect(collapseCrumbs(s, 0)).toEqual([
      { kind: 'seg', seg: s[0] },
      { kind: 'seg', seg: s[1] },
      { kind: 'seg', seg: s[2] },
      { kind: 'seg', seg: s[3] },
    ])
  })

  it('treats a negative collapse count as no collapsing', () => {
    const s = segs('a', 'b', 'c', 'd', 'e')
    expect(collapseCrumbs(s, -3)).toEqual(collapseCrumbs(s, 0))
  })

  it('keeps the first level and the last two, replacing one hidden level with an ellipsis', () => {
    const s = segs('NimoOS-HD', 'Documents', 'Reports', '2026')
    expect(collapseCrumbs(s, 1)).toEqual([
      { kind: 'seg', seg: s[0] },
      { kind: 'ellipsis', hidden: [s[1]] },
      { kind: 'seg', seg: s[2] },
      { kind: 'seg', seg: s[3] },
    ])
  })

  it('folds several hidden levels into a single ellipsis entry, in path order', () => {
    const s = segs('NimoOS-HD', 'Documents', 'Reports', 'Q3', 'Drafts', '2026')
    expect(collapseCrumbs(s, 3)).toEqual([
      { kind: 'seg', seg: s[0] },
      { kind: 'ellipsis', hidden: [s[1], s[2], s[3]] },
      { kind: 'seg', seg: s[4] },
      { kind: 'seg', seg: s[5] },
    ])
  })

  it('clamps an over-large collapse count instead of eating the retained levels', () => {
    const s = segs('a', 'b', 'c', 'd', 'e')
    expect(collapseCrumbs(s, 99)).toEqual([
      { kind: 'seg', seg: s[0] },
      { kind: 'ellipsis', hidden: [s[1], s[2]] },
      { kind: 'seg', seg: s[3] },
      { kind: 'seg', seg: s[4] },
    ])
  })

  it('never collapses a path with three or fewer levels, whatever the count', () => {
    for (const s of [segs(), segs('a'), segs('a', 'b'), segs('a', 'b', 'c')]) {
      expect(collapseCrumbs(s, 5)).toEqual(s.map((seg) => ({ kind: 'seg', seg })))
    }
  })

  // Last resort: on a very narrow container even the maximum collapse can still
  // overflow two lines, and the row that gets clipped is the last one -- i.e. the
  // folder the user is actually in. keepTail=1 lets the caller trade the parent
  // level away so the current level always survives.
  it('can trade the parent level away so only the first and the current level stay', () => {
    const s = segs('a', 'b', 'c', 'd', 'e')
    expect(maxCollapsible(5, 1)).toBe(3)
    expect(collapseCrumbs(s, 3, 1)).toEqual([
      { kind: 'seg', seg: s[0] },
      { kind: 'ellipsis', hidden: [s[1], s[2], s[3]] },
      { kind: 'seg', seg: s[4] },
    ])
  })

  it('still refuses to collapse when the tighter rule would save nothing', () => {
    expect(maxCollapsible(2, 1)).toBe(0)
    expect(collapseCrumbs(segs('a', 'b'), 5, 1)).toEqual(segs('a', 'b').map((seg) => ({ kind: 'seg', seg })))
    // Three levels with keepTail=1: exactly one middle level is worth hiding.
    expect(maxCollapsible(3, 1)).toBe(1)
  })

  it('always ends with the current level so the caller can keep rendering it as non-interactive', () => {
    const s = segs('a', 'b', 'c', 'd', 'e', 'f')
    const out = collapseCrumbs(s, 2)
    expect(out[out.length - 1]).toEqual({ kind: 'seg', seg: s[5] })
    expect(out.filter((i) => i.kind === 'ellipsis')).toHaveLength(1)
  })
})
