// SP8-P5b Task 4 —— Ported from Vue2 `src/views/AI/Knowledge/QueueView.vue:393-404`
// (main@7a6ee6b7). Three "copied quirky behaviors" each have a dedicated test pinning the
// return value; see tests marked "original QueueView.vue:<line> behavior, copied verbatim".
import { describe, it, expect } from 'vitest'
import { distillIconState, basename, dirname } from './queueView'

describe('distillIconState', () => {
  it('pending status -> pending', () => {
    expect(distillIconState({ status: 'pending' })).toBe('pending')
  })

  it('running status -> running', () => {
    expect(distillIconState({ status: 'running' })).toBe('running')
  })

  it('failed status -> failed', () => {
    expect(distillIconState({ status: 'failed' })).toBe('failed')
  })

  // Original QueueView.vue:396 behavior, copied verbatim:
  // `return 'failed' // failed + skipped share the same danger tone`
  // skipped and failed share same 'failed' return (same danger icon state),
  // not a separate state for skipped.
  it('skipped status shares the failed danger tone — QueueView.vue:396, copied verbatim', () => {
    expect(distillIconState({ status: 'skipped' })).toBe('failed')
  })

  // Original QueueView.vue:393-397 has no third `if`, all non-pending/running
  // status (unknown, default) fall through to final 'failed' —— not 'pending'.
  it('unknown status falls through to failed, not pending — QueueView.vue:393-397, copied verbatim', () => {
    expect(distillIconState({ status: 'some-unrecognized-status' })).toBe('failed')
  })

  it('missing status falls through to failed', () => {
    expect(distillIconState({})).toBe('failed')
  })
})

describe('basename', () => {
  // Original QueueView.vue:398 behavior, copied verbatim:
  // `basename(p) { return p ? (...) : '—' }` —— empty returns U+2014 em dash '—',
  // not hyphen '-'.
  it("empty/null/undefined return the em dash '—', not a hyphen — QueueView.vue:398, copied verbatim", () => {
    expect(basename('')).toBe('—')
    expect(basename(null)).toBe('—')
    expect(basename(undefined)).toBe('—')
    expect(basename('')).not.toBe('-')
  })

  it('single segment (no slash) returns the segment itself', () => {
    expect(basename('foo.txt')).toBe('foo.txt')
  })

  it('multi segment path returns the last segment', () => {
    expect(basename('a/b/c.txt')).toBe('c.txt')
  })

  it('trailing slash is ignored, still returns the last real segment', () => {
    expect(basename('/a/b/')).toBe('b')
  })

  // Fallback branch: `p.split('/').filter(Boolean).pop() || p`. When p is only slashes,
  // after filter(Boolean) array is empty, pop() returns undefined, `|| p` falls back to
  // raw input itself (not em dash, p is truthy).
  it('path made only of slashes falls back to the raw input via `|| p`', () => {
    expect(basename('/')).toBe('/')
  })
})

describe('dirname', () => {
  // Original QueueView.vue:399-404 behavior, copied verbatim:
  // `if (!p) return ''` —— empty path returns empty string, not '/'.
  it("empty/null/undefined return '' — QueueView.vue:399-404, copied verbatim", () => {
    expect(dirname('')).toBe('')
    expect(dirname(null)).toBe('')
    expect(dirname(undefined)).toBe('')
  })

  // Original QueueView.vue:399-404 behavior, copied verbatim: single-segment path (no '/')
  // after `parts.pop()` becomes empty array, `'/' + parts.join('/') + '/'` concatenates to '//'
  // —— this is original quirk, not a bug to be "fixed" to '/'.
  it("single-segment path (no slash) returns '//', not '/' — QueueView.vue:399-404, copied verbatim", () => {
    expect(dirname('foo.txt')).toBe('//')
    expect(dirname('foo.txt')).not.toBe('/')
  })

  it('multi segment path returns the parent path with leading/trailing slash', () => {
    expect(dirname('a/b/c.txt')).toBe('/a/b/')
  })

  it('trailing slash on input does not change the result', () => {
    expect(dirname('/a/b/')).toBe('/a/')
  })

  it('path made only of slashes also collapses to an empty parts list -> //', () => {
    expect(dirname('/')).toBe('//')
  })
})
