import { describe, it, expect } from 'vitest'
import { contentKey, planServerSync } from './serverSync'
import type { UploadItem } from './types'

function localItem(over: Partial<UploadItem> = {}): UploadItem {
  return {
    id: 'fq_1_0_0.5', file: null, fileName: 'a.txt', fileType: '', size: 100,
    targetPath: '/DATA/Documents', relativePath: 'a.txt', status: 'needs_file',
    progress: 0, bytesSent: 0, speed: 0, tusUploadUrl: null, retryCount: 0,
    error: '', createdAt: 1, batchId: 'b1', batchTotal: 1,
    conflictPolicy: '', ...over,
  }
}
function serverTask(over: Record<string, unknown> = {}) {
  return {
    id: 'abc123', filename: 'a.txt', relative_path: 'a.txt', target_path: '/DATA/Documents',
    size: 100, mime: 'text/plain', offset: 40, upload_url: '/v2/nimoos/file/upload-tus/abc123',
    retry_count: 2, created_at: 1700, batch_id: 'srv-b', ...over,
  } as never
}

describe('contentKey', () => {
  it('joins target + relative + size', () => {
    expect(contentKey('/DATA/x', 'a.txt', 100)).toBe('/DATA/x a.txt 100')
  })
  it('tolerates empties', () => {
    expect(contentKey('', '', 0)).toBe('  0')
  })
})

describe('planServerSync', () => {
  it('skips a task whose id already exists locally', () => {
    const q = [localItem({ id: 'abc123' })]
    const plan = planServerSync(q, [serverTask()])
    expect(plan.merges).toEqual([])
    expect(plan.appends).toEqual([])
  })

  it('merges resume point into a content-matched local item (max offset, keep local url if set)', () => {
    const q = [localItem({ id: 'fq_x', bytesSent: 10, tusUploadUrl: null })]
    const plan = planServerSync(q, [serverTask({ offset: 40 })])
    expect(plan.appends).toEqual([])
    expect(plan.merges).toEqual([
      { id: 'fq_x', patch: { tusUploadUrl: '/v2/nimoos/file/upload-tus/abc123', bytesSent: 40 } },
    ])
  })

  it('keeps the larger of local bytesSent vs server offset', () => {
    const q = [localItem({ id: 'fq_x', bytesSent: 90, tusUploadUrl: '/keep/url' })]
    const plan = planServerSync(q, [serverTask({ offset: 40 })])
    expect(plan.merges[0].patch).toEqual({ tusUploadUrl: '/keep/url', bytesSent: 90 })
  })

  it('appends a needs_file row for a server-only task (id = tus id, offset preserved)', () => {
    const plan = planServerSync([], [serverTask()])
    expect(plan.merges).toEqual([])
    expect(plan.appends).toHaveLength(1)
    const a = plan.appends[0]
    expect(a.id).toBe('abc123')
    expect(a.status).toBe('needs_file')
    expect(a.file).toBeNull()
    expect(a.bytesSent).toBe(40)
    expect(a.tusUploadUrl).toBe('/v2/nimoos/file/upload-tus/abc123')
    expect(a.relativePath).toBe('a.txt')
    expect(a.retryCount).toBe(2)
    expect(a.createdAt).toBe(1700 * 1000) // created_at is unix seconds
    expect(a.batchId).toBe('srv-b')
  })

  it('falls back relative_path→filename when relative_path missing', () => {
    const plan = planServerSync([], [serverTask({ relative_path: '', filename: 'b.png' })])
    expect(plan.appends[0].relativePath).toBe('b.png')
  })
})
