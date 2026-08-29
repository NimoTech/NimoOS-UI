import { describe, it, expect } from 'vitest'
import { understood, type PersonOption } from '../searchUnderstood'
import { QUICK_KEYS, QUICK_LABEL_KEYS } from '../dateRange'

const person = (id: string, name: string): PersonOption => ({ id, name, count: 0, coverFaceId: '' })

describe('understood', () => {
  it('empty query / all-whitespace query -> []', () => {
    expect(understood('', [])).toEqual([])
    expect(understood('   ', [])).toEqual([])
  })

  // fix round 1 · M4: Vue2 :475 is `(this.query || '').toLowerCase()`; the two sibling
  // functions from the same period (queryParts/searchStateMatchesQuery) both got a
  // `query || ''` guard added, but understood alone was left with a bare
  // `query.toLowerCase()` -- downstream, T16's real source is likely vue-router's
  // route.query.q (whose type includes undefined), and passing undefined in would throw
  // a TypeError outright. The signature still stays query: string (not loosened on the TS
  // side), but the runtime needs to survive it.
  it('query is undefined (e.g. a missing route query) -> does not throw, returns []', () => {
    expect(understood(undefined as unknown as string, [])).toEqual([])
  })

  it('Chinese person name matches (§7e-5 main guard; Vue2\'s \\b would miss this one)', () => {
    const tokens = understood('小明的照片', [person('p1', '小明')])
    expect(tokens).toEqual([{ k: 'person', v: '小明', id: 'p1' }])
  })

  it('a Chinese person name still matches with an ASCII word char (e.g. a digit) directly before it -- pins down beforeOk\'s third condition (a non-word-char needle start always satisfies the boundary), complementing the previous case\'s "needle at string start" scenario', () => {
    // '2025小明的照片': the character right before the needle '小明' is the digit '5'
    // (WORDISH); without beforeOk's third condition this would be misjudged as "continuing
    // inside a word" and fail to match.
    const tokens = understood('2025小明的照片', [person('p1', '小明')])
    expect(tokens.filter(t => t.k === 'person')).toEqual([{ k: 'person', v: '小明', id: 'p1' }])
  })

  it('English person name word boundary: Sara matches, Sarah does not (continues inside a word), still matches after a period, does not match when glued to a prefix', () => {
    const people = [person('p1', 'Sara')]
    const personTokens = (q: string) => understood(q, people).filter(t => t.k === 'person')
    expect(personTokens('Sara at beach').length).toBe(1)
    expect(personTokens('Sarah at beach').length).toBe(0)
    // 'photos of Sara.' also matches a type:Photos token; this test only cares about the person one.
    expect(personTokens('photos of Sara.').length).toBe(1)
    expect(personTokens('xSara').length).toBe(0)
  })

  it('multiple people match at once -> tokens come out in the people array\'s order', () => {
    const people = [person('p2', 'Bob'), person('p1', 'Alice')]
    const tokens = understood('Alice and Bob at the park', people)
    expect(tokens.map(t => t.id)).toEqual(['p2', 'p1'])
  })

  it('type:videos matches Videos, photo matches Photos, and when both appear only Videos comes out (else-if order); Chinese "视频" does not match (a known, deliberately kept limitation)', () => {
    expect(understood('my videos', []).find(t => t.k === 'type')?.v).toBe('Videos')
    expect(understood('a photo', []).find(t => t.k === 'type')?.v).toBe('Photos')
    const both = understood('my videos and photos', [])
    expect(both.filter(t => t.k === 'type')).toEqual([{ k: 'type', v: 'Videos' }])
    expect(understood('视频', []).find(t => t.k === 'type')).toBeUndefined()
  })

  it('the six time-token quick/year criteria (fix round 1 · I2: the full token -- including v -- must be asserted for all five quick branches, not just quick; otherwise a wrong v key would slip through untested)', () => {
    expect(understood('last week', []).find(t => t.k === 'time')).toEqual({ k: 'time', v: QUICK_LABEL_KEYS.last7, quick: 'last7' })
    expect(understood('last month', []).find(t => t.k === 'time')).toEqual({ k: 'time', v: QUICK_LABEL_KEYS.last30, quick: 'last30' })
    expect(understood('last year', []).find(t => t.k === 'time')).toEqual({ k: 'time', v: QUICK_LABEL_KEYS.lastYear, quick: 'lastYear' })
    expect(understood('this year', []).find(t => t.k === 'time')).toEqual({ k: 'time', v: QUICK_LABEL_KEYS.thisYear, quick: 'thisYear' })
    expect(understood('today', []).find(t => t.k === 'time')).toEqual({ k: 'time', v: QUICK_LABEL_KEYS.today, quick: 'today' })
    const yr = understood('2025 trip', []).find(t => t.k === 'time')
    expect(yr?.v).toBe('2025')
    expect(yr?.quick).toBe(2025)
  })

  it('priority: "last year 2025" -> only lastYear comes out (the year branch is in the else, so it never duplicates)', () => {
    const tokens = understood('last year 2025', []).filter(t => t.k === 'time')
    expect(tokens).toEqual([{ k: 'time', v: QUICK_LABEL_KEYS.lastYear, quick: 'lastYear' }])
  })

  it('case-insensitive: LAST WEEK matches', () => {
    expect(understood('LAST WEEK', []).find(t => t.k === 'time')?.quick).toBe('last7')
  })

  it('the quick value for all five quick time tokens falls inside QUICK_KEYS (T9 leftover M4: quickRange has no default branch, so if quick ever strays outside these 5 literals, downstream callers would get undefined while it\'s still labeled a DateRange, and crash)', () => {
    const queries = ['last week', 'last month', 'last year', 'this year', 'today']
    for (const q of queries) {
      const tok = understood(q, []).find(t => t.k === 'time')!
      expect(tok.quick).toBeTypeOf('string')
      expect(QUICK_KEYS).toContain(tok.quick)
      expect((tok.quick as string) in QUICK_LABEL_KEYS).toBe(true)
    }
  })
})
