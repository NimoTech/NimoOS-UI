import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createSnapshot } from './snapshot'

describe('createSnapshot', () => {
  it('listVolumes/list/getPolicy pass volume_uuid as query and unwrap', async () => {
    const log: Array<[string, string, unknown]> = []
    const http = { get: async (u: string, cfg?: { params?: unknown }) => { log.push(['get', u, cfg?.params]); return { data: { success: 200, data: [] } } } } as unknown as AxiosInstance
    const s = createSnapshot(http)
    await s.listVolumes(); await s.list('uu-1'); await s.getPolicy('uu-1')
    expect(log).toEqual([
      ['get', '/v2/snapshot/volumes', undefined],
      ['get', '/v2/snapshot', { volume_uuid: 'uu-1' }],
      ['get', '/v2/snapshot/policy', { volume_uuid: 'uu-1' }],
    ])
  })

  it('patchPolicy does read-modify-write (PUT body = current policy + patch)', async () => {
    let putBody: unknown
    const current = { volume_uuid: 'uu-1', enabled: false, hourly_keep: 6, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 }
    const http = {
      get: async () => ({ data: { success: 200, data: current } }),
      put: async (_u: string, b?: unknown) => { putBody = b; return { data: { success: 200, data: 'ok' } } },
    } as unknown as AxiosInstance
    await createSnapshot(http).togglePolicy('uu-1', true)
    expect(putBody).toEqual({ ...current, enabled: true })
  })

  it('remove URL-encodes Chinese snapshot names in the path segment', async () => {
    let seen = ''
    const http = { delete: async (u: string, cfg?: { params?: unknown }) => { seen = u + ':' + JSON.stringify(cfg?.params); return { data: { success: 200, data: 'ok' } } } } as unknown as AxiosInstance
    await createSnapshot(http).remove('20260712T101502Z_manual_改版前', 'uu-1')
    expect(seen).toBe(`/v2/snapshot/${encodeURIComponent('20260712T101502Z_manual_改版前')}:{"volume_uuid":"uu-1"}`)
  })

  it('create posts to root; restore posts {volume_uuid,snapshot,path}', async () => {
    const log: Array<[string, string, unknown]> = []
    const http = { post: async (u: string, b?: unknown) => { log.push(['post', u, b]); return { data: { success: 200, data: 'ok' } } } } as unknown as AxiosInstance
    const s = createSnapshot(http)
    await s.create({ volume_uuid: 'uu-1', type: 'manual' })
    await s.restore({ volume_uuid: 'uu-1', snapshot: 'snap', path: 'docs/a.txt' })
    expect(log).toEqual([
      ['post', '/v2/snapshot', { volume_uuid: 'uu-1', type: 'manual' }],
      ['post', '/v2/snapshot/restore', { volume_uuid: 'uu-1', snapshot: 'snap', path: 'docs/a.txt' }],
    ])
  })
})
