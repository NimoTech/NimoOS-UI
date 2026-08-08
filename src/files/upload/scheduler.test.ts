import { describe, it, expect, vi } from 'vitest'
import { createScheduler, BACKOFF_MS } from './scheduler'
import type { UploadItem } from './types'

const mkItem = (p: Partial<UploadItem>): UploadItem => ({
  id: 'i', file: new Blob(['x']), fileName: 'f', fileType: '', size: 1, targetPath: '/DATA', relativePath: 'f',
  status: 'pending', progress: 0, bytesSent: 0, speed: 0, tusUploadUrl: null, retryCount: 0, error: '',
  createdAt: 0, batchId: 'b', batchTotal: 1, conflictPolicy: '', ...p,
})

function harness(item: UploadItem, uploadImpl: any) {
  const patches: any[] = []
  let claimed = false
  const deps = {
    claimNext: () => { if (claimed) return null; claimed = true; return item },
    patch: (id: string, patch: any) => patches.push({ id, ...patch }),
    refresh: vi.fn().mockResolvedValue('newtok'),
    concurrency: 1,
    sleepFn: () => Promise.resolve(),
    upload: uploadImpl,
  }
  return { deps, patches }
}

describe('scheduler', () => {
  it('has the outer backoff sequence', () => expect(BACKOFF_MS).toEqual([1000, 3000, 9000]))

  it('marks done on success', async () => {
    const { deps, patches } = harness(mkItem({}), () => Promise.resolve())
    await createScheduler(deps).run()
    expect(patches.some(p => p.status === 'done' && p.progress === 100)).toBe(true)
  })

  it('treats 409 as done(duplicate)', async () => {
    const err: any = { originalResponse: { getStatus: () => 409 } }
    const { deps, patches } = harness(mkItem({}), () => Promise.reject(err))
    await createScheduler(deps).run()
    const done = patches.find(p => p.status === 'done')
    expect(done?.error).toBe('duplicate')
  })

  it('on 401 refreshes then retries; second attempt succeeds', async () => {
    const err: any = { originalResponse: { getStatus: () => 401 } }
    let calls = 0
    const upload = () => { calls++; return calls === 1 ? Promise.reject(err) : Promise.resolve() }
    const { deps, patches } = harness(mkItem({}), upload)
    await createScheduler(deps).run()
    expect(deps.refresh).toHaveBeenCalledTimes(1)
    expect(calls).toBe(2)
    expect(patches.some(p => p.status === 'done')).toBe(true)
  })

  it('on 401 with failed refresh marks error', async () => {
    const err: any = { originalResponse: { getStatus: () => 401 } }
    const { deps, patches } = harness(mkItem({}), () => Promise.reject(err))
    deps.refresh = vi.fn().mockResolvedValue(null)
    await createScheduler(deps).run()
    expect(patches.some(p => p.status === 'error')).toBe(true)
  })

  it('silently returns on abort', async () => {
    const { deps, patches } = harness(mkItem({}), () => Promise.reject(Object.assign(new Error('a'), { isAbort: true })))
    await createScheduler(deps).run()
    expect(patches.some(p => p.status === 'error' || p.status === 'done')).toBe(false)
  })

  it('pause(id) triggers the in-flight handle.pause()', async () => {
    const pauseSpy = vi.fn().mockResolvedValue(undefined)
    const upload = (args: any) => new Promise<void>(() => {
      args.onStart({ abort: async () => {}, pause: pauseSpy })
    })
    const { deps } = harness(mkItem({}), upload)
    const sch = createScheduler(deps)
    const run = sch.run()
    await new Promise((r) => setTimeout(r, 0)) // let the worker start + register handle
    sch.pause('i')
    await new Promise((r) => setTimeout(r, 0)) // let the async pause() invocation flush
    expect(pauseSpy).toHaveBeenCalled()
    void run
  })

  it('pause(id) is a no-op when there is no active handle', () => {
    const { deps } = harness(mkItem({}), () => Promise.resolve())
    const sch = createScheduler(deps)
    expect(() => sch.pause('nope')).not.toThrow()
  })

  it('pause(id) with no active handle falls back to patching status: paused (retry-backoff/401-refresh gap)', () => {
    const { deps, patches } = harness(mkItem({}), () => Promise.resolve())
    const sch = createScheduler(deps)
    sch.pause('gap-id')
    expect(patches.some((p) => p.id === 'gap-id' && p.status === 'paused')).toBe(true)
  })

  it('isPause error marks item paused, not retried/errored', async () => {
    const upload = (args: any) => new Promise<void>((_res, rej) => {
      args.onStart({ abort: async () => {}, pause: async () => {} })
      const e: any = new Error('p')
      e.isPause = true
      rej(e)
    })
    const { deps, patches } = harness(mkItem({}), upload)
    await createScheduler(deps).run()
    expect(patches.some(p => p.id === 'i' && p.status === 'paused' && p.speed === 0)).toBe(true)
    expect(patches.some(p => p.status === 'error')).toBe(false)
    expect(patches.some(p => p.status === 'done')).toBe(false)
  })
})
