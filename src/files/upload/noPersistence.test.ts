import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// SP12: the IndexedDB resume path was retired in favour of server-side batch
// reconciliation. These two are the load-bearing assertions — a reintroduced
// idb/persist module, or a lingering indexedDB call in the upload layer, means
// the old and new models are both live and will fight over what "unfinished"
// means.
describe('upload layer carries no client-side byte persistence', () => {
  const dir = resolve(__dirname)

  it('has no idb/persist/budget modules', () => {
    const names = readdirSync(dir)
    expect(names).not.toContain('idb.ts')
    expect(names).not.toContain('persist.ts')
    expect(names).not.toContain('budget.ts')
  })

  it('never touches indexedDB', () => {
    const hits = readdirSync(dir)
      .filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))
      .filter((n) => readFileSync(resolve(dir, n), 'utf8').includes('indexedDB'))
    expect(hits).toEqual([])
  })

  it('has no needs_file status left in the upload layer', () => {
    const hits = readdirSync(dir)
      .filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))
      .filter((n) => readFileSync(resolve(dir, n), 'utf8').includes('needs_file'))
    expect(hits).toEqual([])
  })
})
