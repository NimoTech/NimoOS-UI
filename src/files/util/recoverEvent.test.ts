import { describe, it, expect } from 'vitest'
import { parseRecover } from './recoverEvent'

describe('parseRecover', () => {
  it('directly read props.{status,driver,message} and strip quotes', () => {
    expect(parseRecover({ status: '"success"', driver: "'Dropbox'", message: '"ok"' }))
      .toEqual({ status: 'success', driver: 'Dropbox', message: 'ok' })
  })
  it('keep as-is without quotes', () => {
    expect(parseRecover({ status: 'fail', driver: 'OneDrive', message: 'x' }))
      .toEqual({ status: 'fail', driver: 'OneDrive', message: 'x' })
  })
  it('all three fields missing → null', () => {
    expect(parseRecover({})).toBeNull()
    expect(parseRecover(null)).toBeNull()
  })
})
