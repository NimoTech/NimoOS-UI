import { describe, it, expect } from 'vitest'
import { parseRecover } from './recoverEvent'

describe('parseRecover', () => {
  it('直接读 props.{status,driver,message} 并剥引号', () => {
    expect(parseRecover({ status: '"success"', driver: "'Dropbox'", message: '"ok"' }))
      .toEqual({ status: 'success', driver: 'Dropbox', message: 'ok' })
  })
  it('无引号原样', () => {
    expect(parseRecover({ status: 'fail', driver: 'OneDrive', message: 'x' }))
      .toEqual({ status: 'fail', driver: 'OneDrive', message: 'x' })
  })
  it('三字段全缺 → null', () => {
    expect(parseRecover({})).toBeNull()
    expect(parseRecover(null)).toBeNull()
  })
})
