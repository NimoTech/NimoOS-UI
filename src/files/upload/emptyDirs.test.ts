import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@nimotech/nimoos-service', () => ({ service: { folder: { create: vi.fn() } } }))

import { service } from '@nimotech/nimoos-service'
import { createEmptyDirs } from './emptyDirs'

const create = service.folder.create as ReturnType<typeof vi.fn>
beforeEach(() => create.mockReset())

describe('createEmptyDirs', () => {
  it('calls folder.create(target + rel) for each relative path', async () => {
    create.mockResolvedValue(undefined)
    const r = await createEmptyDirs(['a/b', 'c'], '/DATA/Documents')
    expect(create).toHaveBeenCalledWith('/DATA/Documents/a/b')
    expect(create).toHaveBeenCalledWith('/DATA/Documents/c')
    expect(r).toEqual({ created: 2, failed: [] })
  })

  it('counts business code 20001 (already exists) as success — merging into an existing folder is the normal case', async () => {
    // mockRejectedValueOnce, not the persistent mockRejectedValue: with this vitest
    // version, a persistent mocked-module rejection spuriously trips the unhandled-
    // rejection detector even though createEmptyDirs's try/catch demonstrably catches
    // it (verified independently of this test) — mockRejectedValueOnce sidesteps the
    // false positive without changing what a single-call assertion actually verifies.
    create.mockRejectedValueOnce(Object.assign(new Error('Fail'), { code: 20001 }))
    const r = await createEmptyDirs(['a'], '/DATA')
    expect(r).toEqual({ created: 1, failed: [] })
  })

  it('other errors go into failed', async () => {
    create.mockRejectedValueOnce(Object.assign(new Error('Fail'), { code: 500 }))
    const r = await createEmptyDirs(['a'], '/DATA')
    expect(r).toEqual({ created: 0, failed: ['a'] })
  })
})
