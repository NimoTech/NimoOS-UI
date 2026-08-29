import { describe, it, expect } from 'vitest'
import { opsTaskPercent, opsTaskLabelKey, opsTaskBasename, resolveUploaderHeader } from './opsRow'
import type { FileTask } from './fileOps'
import zh from '../../i18n/zh_cn'
import en from '../../i18n/en_us'

function task(over: Partial<FileTask> = {}): FileTask {
  return {
    id: 't1', type: 'copy', finished: false, status: 'PROCESSING',
    processing_path: '/DATA/Documents/report.pdf',
    processed_size: 50, total_size: 200, to: '/DATA/Downloads',
    ...over,
  }
}

describe('opsTaskPercent', () => {
  it('floors the processed/total ratio to a whole percent', () => {
    expect(opsTaskPercent(task({ processed_size: 50, total_size: 200 }))).toBe(25)
    expect(opsTaskPercent(task({ processed_size: 1, total_size: 3 }))).toBe(33)
  })

  it('returns null when the total size is unknown, so callers do not draw a false 0%', () => {
    expect(opsTaskPercent(task({ total_size: 0 }))).toBeNull()
    expect(opsTaskPercent(task({ total_size: -1 }))).toBeNull()
  })

  it('returns 0 when the size is known but nothing has been processed yet', () => {
    expect(opsTaskPercent(task({ processed_size: 0, total_size: 200 }))).toBe(0)
  })

  it('never exceeds 100 even if the backend overshoots', () => {
    expect(opsTaskPercent(task({ processed_size: 300, total_size: 200 }))).toBe(100)
  })
})

describe('opsTaskLabelKey', () => {
  it('maps copy and move onto their i18n keys', () => {
    expect(opsTaskLabelKey(task({ type: 'copy' }))).toBe('filesOpCopy')
    expect(opsTaskLabelKey(task({ type: 'move' }))).toBe('filesOpMove')
  })

  it('falls back to the move key for any unknown type, matching the old ternary', () => {
    expect(opsTaskLabelKey(task({ type: 'something-else' }))).toBe('filesOpMove')
  })
})

describe('opsTaskBasename', () => {
  it('keeps only the last segment so the full /DATA path is not shown', () => {
    expect(opsTaskBasename('/DATA/Documents/report.pdf')).toBe('report.pdf')
  })

  it('ignores trailing slashes on directories', () => {
    expect(opsTaskBasename('/DATA/Documents/')).toBe('Documents')
  })

  it('returns the input unchanged when there is no separator to strip', () => {
    expect(opsTaskBasename('report.pdf')).toBe('report.pdf')
    expect(opsTaskBasename('')).toBe('')
  })
})

describe('resolveUploaderHeader', () => {
  it('shows the uploading header whenever an upload is in flight', () => {
    expect(resolveUploaderHeader({ uploadCount: 3, opsCount: 0 })).toBe('filesUploadHeaderUploading')
  })

  it('prefers uploading over processing when both are running', () => {
    expect(resolveUploaderHeader({ uploadCount: 1, opsCount: 5 })).toBe('filesUploadHeaderUploading')
  })

  it('shows the processing header when only file operations are running', () => {
    expect(resolveUploaderHeader({ uploadCount: 0, opsCount: 2 })).toBe('filesUploadHeaderProcessing')
  })

  it('falls back to the plain title when nothing is running', () => {
    expect(resolveUploaderHeader({ uploadCount: 0, opsCount: 0 })).toBe('filesUploadTitle')
  })

  it('resolves every header key it can return in both locales', () => {
    const keys = [
      resolveUploaderHeader({ uploadCount: 1, opsCount: 0 }),
      resolveUploaderHeader({ uploadCount: 0, opsCount: 1 }),
      resolveUploaderHeader({ uploadCount: 0, opsCount: 0 }),
    ]
    for (const k of keys) {
      expect(zh[k as keyof typeof zh]).toBeTruthy()
      expect(en[k as keyof typeof en]).toBeTruthy()
    }
  })
})
