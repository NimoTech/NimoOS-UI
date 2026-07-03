import { describe, it, expect } from 'vitest'
import { groupUploadQueue } from './uploadListGroups'
import type { UploadItem } from './types'
const mk = (p: Partial<UploadItem>): UploadItem => ({
  id: 'x', file: null, fileName: 'f', fileType: '', size: 1, targetPath: '/DATA', relativePath: 'f',
  status: 'pending', progress: 0, bytesSent: 0, speed: 0, tusUploadUrl: null, retryCount: 0, error: '',
  createdAt: 0, batchId: 'b', batchTotal: 1, restored: false, conflictPolicy: '', oversize: false, ...p,
})
describe('groupUploadQueue', () => {
  it('splits into problem/active/done with active uploading-first', () => {
    const q = [mk({ id: 'e', status: 'error' }), mk({ id: 'p', status: 'pending' }),
      mk({ id: 'u', status: 'uploading' }), mk({ id: 'd', status: 'done', doneAt: 5 })]
    const g = groupUploadQueue(q)
    expect(g.problemItems.map(i => i.id)).toEqual(['e'])
    expect(g.activeItems.map(i => i.id)).toEqual(['u', 'p'])
    expect(g.doneItems.map(i => i.id)).toEqual(['d'])
  })
})
