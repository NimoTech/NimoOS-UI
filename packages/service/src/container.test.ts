import { describe, it, expect, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createContainer } from './container.js'

const http = (data: unknown) => ({ get: async () => ({ data }) }) as unknown as AxiosInstance

describe('container.getNetworks', () => {
  it('unwraps the v1 standard envelope', async () => {
    const c = createContainer(http({ success: 200, message: 'ok', data: [{ driver: 'bridge', id: 'x', name: 'bridge' }] }))
    expect(await c.getNetworks()).toEqual([{ driver: 'bridge', id: 'x', name: 'bridge' }])
  })
  it('falls back to an empty array when data is not an array', async () => {
    const c = createContainer(http({ success: 200, message: 'ok', data: null }))
    expect(await c.getNetworks()).toEqual([])
  })
})

describe('container.prune', () => {
  it('prune sends POST /v1/container/prune and strips the standard envelope', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        success: 200,
        message: 'ok',
        data: {
          containers: { ContainersDeleted: ['abc123'], SpaceReclaimed: 159700 },
          images: { ImagesDeleted: [{ Deleted: 'sha256:a2501141440f' }], SpaceReclaimed: 1940000000 },
        },
      },
    })
    const c = createContainer({ post } as never)
    const r = await c.prune()
    expect(post).toHaveBeenCalledWith('/container/prune')
    expect(r.containers?.SpaceReclaimed).toBe(159700)
    expect(r.images?.ImagesDeleted).toHaveLength(1)
  })

  it('prune falls back to null (not a throw) when data fields are missing', async () => {
    const post = vi.fn().mockResolvedValue({ data: { success: 200, message: 'ok', data: {} } })
    const c = createContainer({ post } as never)
    await expect(c.prune()).resolves.toEqual({ containers: null, images: null })
  })

  it('prune throws the backend message on a non-200 envelope', async () => {
    const post = vi.fn().mockResolvedValue({ data: { success: 50001, message: 'docker daemon unreachable', data: null } })
    const c = createContainer({ post } as never)
    await expect(c.prune()).rejects.toThrow('docker daemon unreachable')
  })
})
