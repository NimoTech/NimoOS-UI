import { describe, it, expect } from 'vitest'
import { groupByBatch, batchLabel, isBatchSettled } from './uploadBatches'
import type { UploadItem } from './types'

const mk = (p: Partial<UploadItem>): UploadItem => ({
  id: Math.random().toString(36), file: null, fileName: 'f', fileType: '', size: 100,
  targetPath: '/DATA/x', relativePath: 'f', status: 'pending', progress: 0, bytesSent: 0, speed: 0,
  tusUploadUrl: null, retryCount: 0, error: '', createdAt: 0, batchId: 'b', batchTotal: 1,
  restored: false, conflictPolicy: '', oversize: false, ...p,
})

describe('batchLabel', () => {
  it('single file → its name', () => {
    expect(batchLabel([mk({ fileName: 'a.txt', relativePath: 'a.txt' })])).toEqual({ kind: 'single', name: 'a.txt', count: 1 })
  })
  it('folder → shared top segment', () => {
    const items = [mk({ relativePath: 'Docs/a.txt' }), mk({ relativePath: 'Docs/sub/b.txt' })]
    expect(batchLabel(items)).toEqual({ kind: 'folder', name: 'Docs', count: 2 })
  })
  it('loose multi-select → count', () => {
    const items = [mk({ relativePath: 'a.txt' }), mk({ relativePath: 'b.txt' })]
    expect(batchLabel(items)).toEqual({ kind: 'files', name: '', count: 2 })
  })
})

describe('groupByBatch', () => {
  it('collapses a folder batch into one aggregate view with bytes-weighted progress', () => {
    const items = [
      mk({ batchId: 'B', batchTotal: 2, relativePath: 'Docs/a', size: 100, status: 'done', bytesSent: 100 }),
      mk({ batchId: 'B', batchTotal: 2, relativePath: 'Docs/b', size: 100, status: 'uploading', bytesSent: 50 }),
    ]
    const views = groupByBatch(items)
    expect(views).toHaveLength(1)
    expect(views[0].multi).toBe(true)
    expect(views[0].label).toEqual({ kind: 'folder', name: 'Docs', count: 2 })
    expect(views[0].doneCount).toBe(1)
    expect(views[0].progress).toBe(75) // (100 + 50) / 200
    expect(views[0].zone).toBe('active')
  })
  it('separates distinct batches, preserves order', () => {
    const views = groupByBatch([mk({ batchId: 'A' }), mk({ batchId: 'B' })])
    expect(views.map((v) => v.batchId)).toEqual(['A', 'B'])
  })
  it('zone=problem when any item errored; done when all done', () => {
    expect(groupByBatch([mk({ batchId: 'A', status: 'error' }), mk({ batchId: 'A', status: 'done' })])[0].zone).toBe('problem')
    expect(groupByBatch([mk({ batchId: 'A', status: 'done', bytesSent: 100 })])[0].zone).toBe('done')
  })
})

describe('isBatchSettled', () => {
  it('true only when every item is done/error', () => {
    expect(isBatchSettled([mk({ status: 'done' }), mk({ status: 'error' })])).toBe(true)
    expect(isBatchSettled([mk({ status: 'done' }), mk({ status: 'uploading' })])).toBe(false)
    expect(isBatchSettled([mk({ status: 'conflict' })])).toBe(false)
    expect(isBatchSettled([])).toBe(false)
  })
})
