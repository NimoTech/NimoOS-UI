import { describe, it, expect } from 'vitest'
import { resolveDefaultRoot, DATA_ROOT } from './defaultRoot'

describe('resolveDefaultRoot', () => {
  it('prefers the persisted location the user last picked', () => {
    expect(resolveDefaultRoot({ persisted: '/DATA/Media', diskRoot: '/DATA' })).toBe('/DATA/Media')
  })

  it('falls back to the first disk root when nothing is persisted', () => {
    expect(resolveDefaultRoot({ persisted: '', diskRoot: '/mnt/usb1' })).toBe('/mnt/usb1')
  })

  it('falls back to /DATA when the disk list failed to load', () => {
    expect(resolveDefaultRoot({ persisted: '', diskRoot: '' })).toBe(DATA_ROOT)
  })

  it('never returns an empty string', () => {
    expect(resolveDefaultRoot({ persisted: '', diskRoot: '' })).not.toBe('')
  })
})
