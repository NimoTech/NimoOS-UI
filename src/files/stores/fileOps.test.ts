import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const deleteTask = vi.fn().mockResolvedValue(undefined)
const getList = vi.fn().mockResolvedValue({ content: [] })
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    batch: { deleteTask: (...a: unknown[]) => deleteTask(...a) },
    folder: { getList: (...a: unknown[]) => getList(...a) },
  },
  getHttp: () => ({ get: vi.fn(async () => ({ data: { data: [] } })) }),
}))

import { useFileOpsStore } from './fileOps'
import { useFilesStore } from './files'

const envelope = (tasks: unknown[]) => ({ file_operate: JSON.stringify({ data: tasks }) })
const task = (o: Record<string, unknown>) => ({
  id: '1', type: 'copy', finished: false, status: 'PROCESSING',
  processing_path: '/DATA/a', processed_size: 1, total_size: 2, to: '/DATA/x', ...o,
})

describe('fileOps store', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('ingest 只保留活动任务,visible 随之切换', () => {
    const s = useFileOpsStore()
    expect(s.visible).toBe(false)
    s.ingest(envelope([task({ id: '1', finished: false }), task({ id: '2', finished: true })]))
    expect(s.active.map((t) => t.id)).toEqual(['1'])
    expect(s.visible).toBe(true)
  })

  it('ingest:已完成任务 to===当前目录 → reload 当前目录', () => {
    const files = useFilesStore(); files.currentPath = '/DATA/here'
    const spy = vi.spyOn(files, 'load')
    const s = useFileOpsStore()
    s.ingest(envelope([task({ finished: true, to: '/DATA/here' })]))
    expect(spy).toHaveBeenCalledWith('/DATA/here')
  })

  it('ingest:完成任务 to 非当前目录 → 不 reload', () => {
    const files = useFilesStore(); files.currentPath = '/DATA/here'
    const spy = vi.spyOn(files, 'load')
    const s = useFileOpsStore()
    s.ingest(envelope([task({ finished: true, to: '/DATA/other' })]))
    expect(spy).not.toHaveBeenCalled()
  })

  it('cancelAll 调 batch.deleteTask(0)', async () => {
    const s = useFileOpsStore()
    await s.cancelAll()
    expect(deleteTask).toHaveBeenCalledWith(0)
  })
})
