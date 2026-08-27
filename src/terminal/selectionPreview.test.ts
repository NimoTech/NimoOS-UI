import { describe, it, expect } from 'vitest'
import { selectionPreview, PREVIEW_MAX } from './selectionPreview'

describe('selectionPreview', () => {
  it('collapses newlines and pad spaces into one line', () => {
    expect(selectionPreview('total 12\n  drwxr-xr-x   2 root  \n')).toBe('total 12 drwxr-xr-x 2 root')
  })
  it('returns short text untouched', () => {
    expect(selectionPreview('ls -la')).toBe('ls -la')
  })
  it('caps long selections with an ellipsis at PREVIEW_MAX', () => {
    const out = selectionPreview('x'.repeat(200))
    expect(out.length).toBe(PREVIEW_MAX)
    expect(out.endsWith('…')).toBe(true)
  })
})
