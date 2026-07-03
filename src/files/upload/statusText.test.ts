import { describe, it, expect } from 'vitest'
import { uploadErrorKey } from './statusText'

describe('uploadErrorKey', () => {
  it('maps codes to i18n keys', () => {
    expect(uploadErrorKey('duplicate')).toBe('filesUploadErrDuplicate')
    expect(uploadErrorKey('expired')).toBe('filesUploadErrExpired')
    expect(uploadErrorKey('no_space')).toBe('filesUploadErrNoSpace')
    expect(uploadErrorKey('anything_else')).toBe('filesUploadErrServer')
  })

  it('maps all 7 scheduler codes explicitly (never falls through)', () => {
    expect(uploadErrorKey('protected')).toBe('filesUploadErrProtected')
    expect(uploadErrorKey('bad_name')).toBe('filesUploadErrBadName')
    expect(uploadErrorKey('server')).toBe('filesUploadErrServer')
    expect(uploadErrorKey('network')).toBe('filesUploadErrNetwork')
  })
})
