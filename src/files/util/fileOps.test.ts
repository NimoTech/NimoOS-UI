import { describe, it, expect } from 'vitest'
import { parseFileOperate, filterActive, shouldReload, buildPastePayload, taskPercent } from './fileOps'

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

  it('buildPastePayload 组装 {type,item,to,style}', () => {
    const o = { type: 'move' as const, item: [{ from: '/DATA/a', is_dir: false }] }
    expect(buildPastePayload(o, '/DATA/dst', 'skip')).toEqual({
      type: 'move', item: [{ from: '/DATA/a', is_dir: false }], to: '/DATA/dst', style: 'skip',
    })
  })

  it('buildPastePayload accepts the keep-both style the backend calls "rename"', () => {
    const o = { type: 'copy' as const, item: [{ from: '/DATA/a', is_dir: false }] }
    expect(buildPastePayload(o, '/DATA/dst', 'rename')).toEqual({
      type: 'copy', item: [{ from: '/DATA/a', is_dir: false }], to: '/DATA/dst', style: 'rename',
    })
  })

  it('taskPercent:floor(50/100*100)=50;total 0 → 0', () => {
    expect(taskPercent(mk({ processed_size: 50, total_size: 100 }) as never)).toBe(50)
    expect(taskPercent(mk({ processed_size: 1, total_size: 3 }) as never)).toBe(33)
    expect(taskPercent(mk({ processed_size: 5, total_size: 0 }) as never)).toBe(0)
  })
})
