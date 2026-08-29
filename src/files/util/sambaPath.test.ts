import { describe, it, expect } from 'vitest'
import { buildSmbPaths, shareName } from './sambaPath'

describe('sambaPath', () => {
  it('buildSmbPaths → Windows UNC + Mac smb', () => {
    expect(buildSmbPaths('192.168.1.9', 'Documents')).toEqual({
      windows: '\\\\192.168.1.9\\Documents',
      mac: 'smb://192.168.1.9/Documents',
    })
  })
  it('shareName extracts the last path segment', () => {
    expect(shareName('/DATA/Documents')).toBe('Documents')
    expect(shareName('/DATA/Media/Movies/')).toBe('Movies')
    expect(shareName('Solo')).toBe('Solo')
  })
})
