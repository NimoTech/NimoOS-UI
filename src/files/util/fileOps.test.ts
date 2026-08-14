import { describe, it, expect } from 'vitest'
import { parseFileOperate, filterActive, shouldReload, buildPastePayload, taskPercent, landedName, landedSources } from './fileOps'

const mk = (over: Partial<Record<string, unknown>> = {}) => ({
  id: '1', type: 'copy', finished: false, status: 'PROCESSING',
  processing_path: '/DATA/a.mkv', processed_size: 50, total_size: 100, to: '/DATA/x', ...over,
})

describe('fileOps util', () => {
  it('parseFileOperate 解 socket 信封(file_operate 是 JSON 串 → .data 数组)', () => {
    const props = { file_operate: JSON.stringify({ data: [mk(), mk({ id: '2' })] }) }
    const tasks = parseFileOperate(props)
    expect(tasks).toHaveLength(2)
    expect(tasks[0].id).toBe('1')
  })

  it('parseFileOperate 容错:非字符串 / 坏 JSON / 无 data → []', () => {
    expect(parseFileOperate(null)).toEqual([])
    expect(parseFileOperate({ file_operate: 123 })).toEqual([])
    expect(parseFileOperate({ file_operate: '{bad' })).toEqual([])
    expect(parseFileOperate({ file_operate: JSON.stringify({}) })).toEqual([])
  })

  it('filterActive 只留未完成', () => {
    const list = [mk({ id: '1', finished: false }), mk({ id: '2', finished: true })]
    expect(filterActive(list).map((t) => t.id)).toEqual(['1'])
  })

  it('shouldReload:有已完成任务且 to===当前目录 → true', () => {
    const list = [mk({ finished: true, to: '/DATA/here' })]
    expect(shouldReload(list, '/DATA/here')).toBe(true)
    expect(shouldReload(list, '/DATA/elsewhere')).toBe(false)
    expect(shouldReload([mk({ finished: false, to: '/DATA/here' })], '/DATA/here')).toBe(false)
  })

  // B5: 'skip' was never a real backend style -- the new conflict flow filters
  // skipped/cancelled items out before submitting anything, so buildPastePayload
  // never actually receives it. The dead 'skip' branch in its type signature is
  // removed alongside this test.
  it('buildPastePayload accepts the keep-both style the backend calls "rename"', () => {
    const o = { type: 'copy' as const, item: [{ from: '/DATA/a', is_dir: false }] }
    expect(buildPastePayload(o, '/DATA/dst', 'rename')).toEqual({
      type: 'copy', item: [{ from: '/DATA/a' }], to: '/DATA/dst', style: 'rename',
    })
  })

  // B6: is_dir rides on OperateItem purely for the local conflict dialog (see
  // clipboard.ts) and must never reach the backend -- Vue2's FilePanel.vue
  // strips it before submitting for the same reason.
  it('buildPastePayload strips is_dir before the request body leaves the client', () => {
    const o = { type: 'copy' as const, item: [{ from: '/DATA/Trip', is_dir: true }, { from: '/DATA/a.txt', is_dir: false }] }
    expect(buildPastePayload(o, '/DATA/dst', 'overwrite')).toEqual({
      type: 'copy', item: [{ from: '/DATA/Trip' }, { from: '/DATA/a.txt' }], to: '/DATA/dst', style: 'overwrite',
    })
  })

  it('taskPercent:floor(50/100*100)=50;total 0 → 0', () => {
    expect(taskPercent(mk({ processed_size: 50, total_size: 100 }) as never)).toBe(50)
    expect(taskPercent(mk({ processed_size: 1, total_size: 3 }) as never)).toBe(33)
    expect(taskPercent(mk({ processed_size: 5, total_size: 0 }) as never)).toBe(0)
  })

  // The landing check behind the favourite repoint: the backend reported a
  // move as complete without having executed it (an empty-directory batch was
  // dequeued as "already done"), so "the task said finished" is not on its own
  // evidence that anything moved. These read the destination listing instead.
  describe('landing verification', () => {
    it('landedName keeps the last segment -- a move swaps the parent, not the name', () => {
      expect(landedName('/DATA/Documents/Trip')).toBe('Trip')
      expect(landedName('/DATA/a.txt')).toBe('a.txt')
    })

    it('landedName tolerates a trailing slash', () => {
      expect(landedName('/DATA/Documents/Trip/')).toBe('Trip')
    })

    it('landedSources keeps only the sources actually visible in the destination', () => {
      const entries = [{ name: 'Trip' }, { name: 'other' }]
      expect(landedSources(['/DATA/Documents/Trip', '/DATA/Documents/Gone'], entries)).toEqual(['/DATA/Documents/Trip'])
    })

    it('landedSources returns nothing when the destination is empty (the backend lied about finishing)', () => {
      expect(landedSources(['/DATA/Documents/Trip'], [])).toEqual([])
    })

    it('landedSources matches whole names, not prefixes', () => {
      expect(landedSources(['/DATA/a'], [{ name: 'ab' }])).toEqual([])
    })
  })
})
