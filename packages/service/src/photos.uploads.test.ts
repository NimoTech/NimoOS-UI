import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPhotos } from './photos.js'

type Call = { method: string; url: string; params?: unknown; body?: unknown; cfg?: unknown }
function capture(data: unknown = []) {
  const calls: Call[] = []
  const ok = { data, headers: {} }
  const http = {
    get: async (url: string, cfg?: { params?: unknown }) => { calls.push({ method: 'get', url, params: cfg?.params, cfg }); return ok },
    post: async (url: string, body?: unknown, cfg?: unknown) => { calls.push({ method: 'post', url, body, cfg }); return ok },
    put: async (url: string, body?: unknown) => { calls.push({ method: 'put', url, body }); return ok },
    patch: async (url: string, body?: unknown) => { calls.push({ method: 'patch', url, body }); return ok },
    delete: async (url: string, cfg?: { data?: unknown }) => { calls.push({ method: 'delete', url, cfg }); return ok },
  } as unknown as AxiosInstance
  return { http, calls }
}
const noToken = () => null

describe('photos 上传与 sprite', () => {
  it('uploadAsset 发 multipart POST', async () => {
    const { http, calls } = capture()
    const fd = new FormData()
    await createPhotos(http, noToken).uploadAsset(fd)
    expect(calls[0]).toMatchObject({ method: 'post', url: '/photos/assets/upload' })
    expect((calls[0].cfg as { headers?: Record<string, string> })?.headers).toEqual({ 'Content-Type': 'multipart/form-data' })
  })
  it('uploadAssetWithProgress 把 axios progress 事件换算成百分比回调', async () => {
    let onUp: ((e: { loaded: number; total?: number }) => void) | undefined
    const http = {
      post: async (_u: string, _b: unknown, cfg?: { onUploadProgress?: (e: { loaded: number; total?: number }) => void }) => {
        onUp = cfg?.onUploadProgress
        return { data: { success: 200, data: {} } }
      },
    } as unknown as AxiosInstance
    const seen: number[] = []
    await createPhotos(http, noToken).uploadAssetWithProgress(new FormData(), (pct) => seen.push(pct))
    onUp!({ loaded: 50, total: 200 })
    onUp!({ loaded: 200, total: 200 })
    onUp!({ loaded: 10 }) // 无 total 不回调
    expect(seen).toEqual([25, 100])
  })
  it('listUploads/cancelUpload 对齐 uploadsApi.js', async () => {
    const { http, calls } = capture()
    const p = createPhotos(http, noToken)
    await p.listUploads()
    await p.cancelUpload('u1')
    expect(calls[0]).toMatchObject({ url: '/photos/uploads', params: { status: 'active' } })
    expect(calls[1]).toMatchObject({ method: 'post', url: '/photos/uploads/u1/cancel' })
  })
  it('listUploads 从 {tasks:[...]} 抽取数组;缺 tasks 兜底 []', async () => {
    const { http: h1 } = capture({ tasks: [{ id: 'u1' }, { id: 'u2' }] })
    expect(await createPhotos(h1, noToken).listUploads()).toEqual([{ id: 'u1' }, { id: 'u2' }])
    const { http: h2 } = capture({})
    expect(await createPhotos(h2, noToken).listUploads()).toEqual([])
  })
  it('cancelUpload 从 {canceled} 抽取布尔;空体兜底 false', async () => {
    const { http: h1 } = capture({ canceled: true })
    expect(await createPhotos(h1, noToken).cancelUpload('u1')).toBe(true)
    const h2 = { post: async () => ({ data: '', headers: {} }) } as unknown as AxiosInstance
    expect(await createPhotos(h2, noToken).cancelUpload('u1')).toBe(false)
  })
  it('spriteMeta 从响应头读 X-Sprite-*(axios 小写化)', async () => {
    let seenUrl = ''
    const http = {
      get: async (url: string) => {
        seenUrl = url
        return {
          data: new Blob(),
          headers: { 'x-sprite-frames': '24', 'x-sprite-duration-ms': '4000', 'x-sprite-frame-w': '160', 'x-sprite-frame-h': '90' },
          config: { url },
        }
      },
    } as unknown as AxiosInstance
    const meta = await createPhotos(http, noToken).spriteMeta('a1')
    expect(meta).toEqual({ frames: 24, durationMs: 4000, frameW: 160, frameH: 90 })
    // 无 token 时 URL 不带 ?token=(noToken 兜底), 但仍须是 /v1 前缀、与 spriteUrl(id) 同路径。
    expect(seenUrl).toBe('/v1/photos/assets/a1/sprite')
  })
  it('spriteMeta 缺响应头时兜底默认值(对齐 Vue2 spritePreview.js)', async () => {
    const http = {
      get: async (url: string) => ({ data: new Blob(), headers: {}, config: { url } }),
    } as unknown as AxiosInstance
    const meta = await createPhotos(http, noToken).spriteMeta('a1')
    expect(meta).toEqual({ frames: 10, durationMs: 0, frameW: 240, frameH: 135 })
  })
  it('spriteMeta 请求 URL 与叠加层 <img> 的 spriteUrl(id) 完全一致(修双下载,恢复浏览器缓存命中)', async () => {
    let seenUrl = ''
    const http = {
      get: async (url: string) => {
        seenUrl = url
        return { data: new Blob(), headers: {}, config: { url } }
      },
    } as unknown as AxiosInstance
    const p = createPhotos(http, () => 'T1')
    await p.spriteMeta('a1')
    expect(seenUrl).toBe(p.spriteUrl('a1'))
    expect(seenUrl).toContain('token=T1')
  })
  it('spriteUrl/previewUrl 带 token', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T1')
    expect(p.spriteUrl('a1')).toBe('/v1/photos/assets/a1/sprite?token=T1')
    expect(p.previewUrl('a1')).toBe('/v1/photos/assets/a1/preview?token=T1')
  })
})
