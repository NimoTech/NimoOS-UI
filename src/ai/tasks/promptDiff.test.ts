import { describe, it, expect } from 'vitest'
import { diffLines } from './promptDiff'

describe('diffLines', () => {
  it('identical texts are all same-rows', () => {
    expect(diffLines('a\nb', 'a\nb')).toEqual([
      { left: 'a', right: 'a', type: 'same' },
      { left: 'b', right: 'b', type: 'same' },
    ])
  })

  it('a replaced line pairs old and new on one change-row', () => {
    expect(diffLines('keep\nold line\nend', 'keep\nnew line\nend')).toEqual([
      { left: 'keep', right: 'keep', type: 'same' },
      { left: 'old line', right: 'new line', type: 'change' },
      { left: 'end', right: 'end', type: 'same' },
    ])
  })

  it('pure additions leave the left half empty; deletions the right', () => {
    expect(diffLines('a', 'a\nb')).toEqual([
      { left: 'a', right: 'a', type: 'same' },
      { left: null, right: 'b', type: 'add' },
    ])
    expect(diffLines('a\nb', 'a')).toEqual([
      { left: 'a', right: 'a', type: 'same' },
      { left: 'b', right: null, type: 'del' },
    ])
  })

  it('uneven change blocks zip pairwise, remainder unpaired', () => {
    expect(diffLines('x\ny\nz', 'x\nY')).toEqual([
      { left: 'x', right: 'x', type: 'same' },
      { left: 'y', right: 'Y', type: 'change' },
      { left: 'z', right: null, type: 'del' },
    ])
  })

  it('null/empty inputs behave like empty single lines', () => {
    expect(diffLines('', '')).toEqual([{ left: '', right: '', type: 'same' }])
    expect(diffLines(null, 'a')).toEqual([{ left: '', right: 'a', type: 'change' }])
  })
})
