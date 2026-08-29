import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createApps } from './apps'

const httpReturning = (data: unknown): AxiosInstance =>
  ({ get: async () => ({ data }) }) as unknown as AxiosInstance

const httpRecordingPut = () => {
  const calls: { url: string; body: unknown; config?: unknown }[] = []
  const http = {
    put: async (url: string, body: unknown, config?: unknown) => {
      calls.push({ url, body, config })
      return { data: {} }
    },
  } as unknown as AxiosInstance
  return { http, calls }
}

describe('createApps.getGrid', () => {
  it('unwraps an envelope whose data is an array', async () => {
    const a = createApps(httpReturning({ success: 200, data: [{ name: 'x' }] }))
    expect(await a.getGrid()).toEqual([{ name: 'x' }])
  })
  it('tolerates a bare array (no envelope)', async () => {
    const a = createApps(httpReturning([{ name: 'y' }]))
    expect(await a.getGrid()).toEqual([{ name: 'y' }])
  })
  it('tolerates an envelope whose data is { data: [...] }', async () => {
    const a = createApps(httpReturning({ success: 200, data: { data: [{ name: 'z' }] } }))
    expect(await a.getGrid()).toEqual([{ name: 'z' }])
  })
  it('tolerates the REAL production bare envelope {data, message} without success (2026-07-15 real-device gotcha)', async () => {
    const a = createApps(httpReturning({ data: [{ name: 'w', desktop: true }], message: 'This data is for internal use ONLY' }))
    expect(await a.getGrid()).toEqual([{ name: 'w', desktop: true }])
  })
})

describe('createApps.start', () => {
  it('v2 compose app: PUT /v2/.../compose/{name}/status with JSON string "start"', async () => {
    const { http, calls } = httpRecordingPut()
    await createApps(http).start({ name: 'jellyfin', app_type: 'v2app' })
    expect(calls[0].url).toBe('/v2/app_management/compose/jellyfin/status')
    // openapi RequestComposeAppStatus is a bare JSON string; passing 'start' to axios directly would send text/plain,
    // so explicit JSON.stringify + application/json is required
    expect(calls[0].body).toBe('"start"')
    expect((calls[0].config as { headers: Record<string, string> }).headers['Content-Type']).toBe('application/json')
  })
  it('v1/container app: PUT /v1/container/{id}/state with {state:"start"}', async () => {
    const { http, calls } = httpRecordingPut()
    await createApps(http).start({ name: 'abc123', app_type: 'container' })
    expect(calls[0].url).toBe('/v1/container/abc123/state')
    expect(calls[0].body).toEqual({ state: 'start' })
  })
  it('missing app_type falls back to the v1 container endpoint', async () => {
    const { http, calls } = httpRecordingPut()
    await createApps(http).start({ name: 'x' })
    expect(calls[0].url).toBe('/v1/container/x/state')
  })
})
