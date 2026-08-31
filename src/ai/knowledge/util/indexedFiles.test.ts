// Ported from Vue2 `src/views/AI/Knowledge/__tests__/indexedFiles.spec.js`
// (main@7a6ee6b7). This task only ports `buildListParams`/`anyIndexing` functions,
// correspondingly only their original test cases (other functions' tests left for tasks
// porting their bodies).
import { describe, it, expect } from 'vitest'
import { buildListParams, anyIndexing } from './indexedFiles'

describe('buildListParams', () => {
  it('drops empty string and null values', () => {
    const out = buildListParams({
      root_id: null,
      path_prefix: '',
      mime_prefix: 'application/legacy-office/',
      has_error: false,
      limit: 100,
      offset: 0,
    })
    expect(out).toEqual({
      has_error: false,
      mime_prefix: 'application/legacy-office/',
      limit: 100,
      offset: 0,
    })
  })
})

describe('anyIndexing', () => {
  it('detects an indexing row', () => {
    expect(anyIndexing([{ status: 'ok' }, { status: 'indexing' }])).toBe(true)
    expect(anyIndexing([{ status: 'ok' }, { status: 'error' }])).toBe(false)
    expect(anyIndexing([])).toBe(false)
  })
})
