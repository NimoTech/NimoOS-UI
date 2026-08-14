import { describe, it, expect } from 'vitest'
import { barSpeakers, speakerToken, segMatches, segChapterIndex, barChapterIndex } from './speakerWave'

// Dual-speaker test data: s1 dominant, s2 only interjects at 0:30–0:33 for 3 seconds.
// duration=100s, n=4 → each bar covers 25s.
const SEGS = [
  { t: '0:00', speaker: 's1' },
  { t: '0:30', speaker: 's2' },
  { t: '0:33', speaker: 's1' },
  { t: '1:10', speaker: 's1' },
]

describe('barSpeakers(bar → speaker assignment, largest coverage duration within window)', () => {
  it('bar assigned to speaker with largest coverage duration in window (3s interject cannot beat 22s dominant)', () => {
    const bars = barSpeakers(SEGS, 100, 4)
    expect(bars[0]).toBe('s1') // 0–25s only s1
    expect(bars[1]).toBe('s1') // 25–50s: s1 covers 22s, s2 only 3s interject → assign to s1
    expect(bars[2]).toBe('s1')
    expect(bars[3]).toBe('s1')
  })
  it('fine-grained turn data: each bar reflects true dominant speaker for that interval', () => {
    // 0–50s dominated by s2 (s1 has 2s interjects twice), 50–100s dominated by s1 → two halves have different colors
    const turns = [
      { t: '0:00', speaker: 's2' },
      { t: '0:20', speaker: 's1' },
      { t: '0:22', speaker: 's2' },
      { t: '0:40', speaker: 's1' },
      { t: '0:42', speaker: 's2' },
      { t: '0:50', speaker: 's1' },
    ]
    expect(barSpeakers(turns, 100, 2)).toEqual(['s2', 's1'])
  })
  it('coverage duration tie → assign to globally fewer-segment speaker', () => {
    // duration=120, n=1: window has s1(0–60) and s2(60–120) each covering 60s;
    // s1 global 2 segments, s2 global 1 segment → tie goes to s2
    const tie = [
      { t: '0:00', speaker: 's1' },
      { t: '1:00', speaker: 's2' },
      { t: '2:00', speaker: 's1' },
    ]
    expect(barSpeakers(tie, 120, 1)).toEqual(['s2'])
  })
  it('no segments within window → null', () => {
    const bars = barSpeakers([{ t: '0:50', speaker: 's1' }], 100, 4)
    expect(bars[0]).toBe(null) // 0–25s no segments
    expect(bars[1]).toBe(null) // 25–50s no segments (only segment starts at 50s)
    expect(bars[2]).toBe('s1')
    expect(bars[3]).toBe('s1')
  })
  it('duration=0 (metadata not ready) → all null', () => {
    expect(barSpeakers(SEGS, 0, 4)).toEqual([null, null, null, null])
  })
  it('single speaker throughout → all that speaker', () => {
    expect(barSpeakers([{ t: '0:00', speaker: 's1' }], 100, 4)).toEqual(['s1', 's1', 's1', 's1'])
  })
  it('n<=0 → empty array (no RangeError thrown)', () => {
    expect(barSpeakers(SEGS, 100, 0)).toEqual([])
    expect(barSpeakers(SEGS, 100, -1)).toEqual([])
  })
})

describe('speakerToken (index → CSS token, 5-color cycle)', () => {
  it('0 → var(--spk-1)', () => expect(speakerToken(0)).toBe('var(--spk-1)'))
  it('4 → var(--spk-5)', () => expect(speakerToken(4)).toBe('var(--spk-5)'))
  it('5 → var(--spk-1) (%5 cycle)', () => expect(speakerToken(5)).toBe('var(--spk-1)'))
})

describe('segMatches (filter predicate: master-checkbox semantics, ANDed with highlightsOnly)', () => {
  const segs = [
    { t: '0:00', speaker: 's1', highlight: false },
    { t: '0:10', speaker: 's2', highlight: true },
    { t: '0:20', speaker: 's1', highlight: true },
  ]
  it('picked=null (no speaker data, filtering disabled) = show all', () => {
    for (const s of segs) expect(segMatches(s, null, false)).toBe(true)
  })
  it('all selected = show all', () => {
    const picked = new Set(['s1', 's2'])
    for (const s of segs) expect(segMatches(s, picked, false)).toBe(true)
  })
  it('picked empty set (all unselected) = hide all', () => {
    for (const s of segs) expect(segMatches(s, new Set(), false)).toBe(false)
  })
  it('picked={s2} only s2 segments remain', () => {
    const picked = new Set(['s2'])
    expect(segs.map((s) => segMatches(s, picked, false))).toEqual([false, true, false])
  })
  it('ANDed with highlightsOnly', () => {
    const picked = new Set(['s1'])
    expect(segs.map((s) => segMatches(s, picked, true))).toEqual([false, false, true])
  })
  it('filtering preserves original indices: same index still same segment (req 5, no reordering)', () => {
    const rows = segs.map((seg, i) => ({ seg, i })).filter(({ seg }) => segMatches(seg, new Set(['s1']), true))
    expect(rows).toEqual([{ seg: segs[2], i: 2 }])
  })
  it('segments without speaker field: filtered when speaker filter enabled, pass through when null', () => {
    expect(segMatches({ t: '0:00' } as { speaker?: string }, new Set(['s1']), false)).toBe(false)
    expect(segMatches({ t: '0:00' } as { speaker?: string }, null, false)).toBe(true)
  })
})

describe('segChapterIndex (segment → chapter assignment)', () => {
  const chapters = [{ t: '0:10' }, { t: '1:00' }]
  it('assign by segment start time; correct across chapter boundary', () => {
    expect(
      segChapterIndex(
        [{ t: '0:00' }, { t: '0:10' }, { t: '0:59' }, { t: '1:00' }, { t: '2:00' }],
        chapters,
      ),
    ).toEqual([-1, 0, 0, 1, 1])
  })
  it('chapters empty → all -1', () => {
    expect(segChapterIndex([{ t: '0:00' }, { t: '0:30' }], [])).toEqual([-1, -1])
  })
  it('segments empty → empty array', () => {
    expect(segChapterIndex([], chapters)).toEqual([])
  })
})

describe('barChapterIndex (bar midpoint → chapter assignment)', () => {
  it('assign by bar midpoint time', () => {
    // duration=100, n=4 → midpoints 12.5 / 37.5 / 62.5 / 87.5; chapter starts at 0 and 50
    expect(barChapterIndex([{ t: '0:00' }, { t: '0:50' }], 100, 4)).toEqual([0, 0, 1, 1])
  })
  it('bars before first chapter → -1', () => {
    expect(barChapterIndex([{ t: '0:50' }], 100, 4)).toEqual([-1, -1, 0, 0])
  })
  it('duration=0 (metadata not ready) → all -1', () => {
    expect(barChapterIndex([{ t: '0:00' }], 0, 4)).toEqual([-1, -1, -1, -1])
  })
  it('chapters empty → all -1; n<=0 → empty array', () => {
    expect(barChapterIndex([], 100, 2)).toEqual([-1, -1])
    expect(barChapterIndex([{ t: '0:00' }], 100, 0)).toEqual([])
    expect(barChapterIndex([{ t: '0:00' }], 100, -1)).toEqual([])
  })
})
