// 1:1 移植自 Vue2 src/views/AI/Agent/stream/groupBlocks.spec.js
import { describe, it, expect } from 'vitest'
import { groupBlocks } from './groupBlocks'

const think = (text: string) => ({ type: 'thinking', text })
const tool = (name: string) => ({ type: 'tool', name })
const md = (text: string) => ({ type: 'md', text })

describe('groupBlocks', () => {
  it('returns [] for empty / nullish', () => {
    expect(groupBlocks([])).toEqual([])
    expect(groupBlocks(null as unknown as never)).toEqual([])
  })

  it('passes through non thinking/tool blocks untouched', () => {
    const blocks = [md('a'), md('b')]
    expect(groupBlocks(blocks)).toEqual(blocks)
  })

  it('merges consecutive thinking + tool into one process group', () => {
    const out = groupBlocks([think('t'), tool('read'), tool('scan'), md('done')])
    expect(out).toHaveLength(2)
    expect((out[0] as { __process: boolean }).__process).toBe(true)
    expect((out[0] as { steps: unknown[] }).steps).toHaveLength(3)
    expect(out[1]).toEqual(md('done'))
  })

  it('breaks the group when a non thinking/tool block interrupts', () => {
    const out = groupBlocks([tool('a'), md('x'), tool('b')])
    expect(out).toHaveLength(3)
    expect((out[0] as { __process: boolean }).__process).toBe(true)
    expect((out[0] as { steps: unknown[] }).steps).toHaveLength(1)
    expect(out[1]).toEqual(md('x'))
    expect((out[2] as { __process: boolean }).__process).toBe(true)
    expect((out[2] as { steps: unknown[] }).steps).toHaveLength(1)
  })

  it('keeps md before and process after in order', () => {
    const out = groupBlocks([md('intro'), think('t'), tool('a')])
    expect(out[0]).toEqual(md('intro'))
    expect((out[1] as { __process: boolean }).__process).toBe(true)
    expect((out[1] as { steps: unknown[] }).steps).toHaveLength(2)
  })
})
