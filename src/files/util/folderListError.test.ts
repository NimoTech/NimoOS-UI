import { describe, it, expect } from 'vitest'
import { folderListErrorMsg } from './folderListError'

describe('folderListErrorMsg', () => {
  it('prefers the unwrapped envelope detail over the generic message', () => {
    const e = Object.assign(new Error('Fail'), { detail: 'open /DATA/x: permission denied' })
    expect(folderListErrorMsg(e)).toBe('open /DATA/x: permission denied')
  })

  it('falls back to an axios response body data string', () => {
    const e = { response: { data: { data: 'no such directory', message: 'Fail' } }, message: 'Request failed' }
    expect(folderListErrorMsg(e)).toBe('no such directory')
  })

  it('falls back to the response message when data is not a string', () => {
    const e = { response: { data: { data: { x: 1 }, message: 'Fail' } }, message: 'Request failed' }
    expect(folderListErrorMsg(e)).toBe('Fail')
  })

  it('falls back to the error message when there is no response body', () => {
    expect(folderListErrorMsg(new Error('Network Error'))).toBe('Network Error')
  })

  it('returns an empty string for a thrown value with nothing usable', () => {
    expect(folderListErrorMsg(null)).toBe('')
    expect(folderListErrorMsg({})).toBe('')
  })
})
