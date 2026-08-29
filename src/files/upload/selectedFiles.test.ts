import { describe, it, expect } from 'vitest'
import { toSelectedFiles } from './selectedFiles'

describe('toSelectedFiles', () => {
  it('strips a leading slash from relativePath', () => {
    const f = new File(['x'], 'a.txt')
    const out = toSelectedFiles([{ file: f, relativePath: '/Docs/a.txt' }], '/DATA/Documents')
    expect(out).toEqual([{ file: f, targetPath: '/DATA/Documents', relativePath: 'Docs/a.txt' }])
  })

  it('strips multiple leading slashes', () => {
    const f = new File(['x'], 'a.txt')
    const out = toSelectedFiles([{ file: f, relativePath: '///a.txt' }], '/DATA')
    expect(out[0].relativePath).toBe('a.txt')
  })

  it('leaves a relativePath with no leading slash untouched', () => {
    const f = new File(['x'], 'a.txt')
    const out = toSelectedFiles([{ file: f, relativePath: 'Docs/a.txt' }], '/DATA')
    expect(out[0].relativePath).toBe('Docs/a.txt')
  })

  it('propagates targetPath onto every entry', () => {
    const f1 = new File(['x'], 'a.txt')
    const f2 = new File(['y'], 'b.txt')
    const out = toSelectedFiles(
      [{ file: f1, relativePath: 'a.txt' }, { file: f2, relativePath: 'b.txt' }],
      '/DATA/Shared',
    )
    expect(out.every((e) => e.targetPath === '/DATA/Shared')).toBe(true)
  })

  it('returns an empty array for empty input', () => {
    expect(toSelectedFiles([], '/DATA')).toEqual([])
  })
})
