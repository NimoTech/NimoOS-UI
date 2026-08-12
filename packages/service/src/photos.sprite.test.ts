import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPhotos } from './photos.js'

describe('photos 视频悬停 sprite', () => {
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
    const meta = await createPhotos(http, () => null).spriteMeta('a1')
    expect(meta).toEqual({ frames: 24, durationMs: 4000, frameW: 160, frameH: 90 })
    // 无 token 时 URL 不带 ?token=(noToken 兜底), 但仍须是 /v1 前缀、与 spriteUrl(id) 同路径。
    expect(seenUrl).toBe('/v1/photos/assets/a1/sprite')
  })
  it('spriteMeta 缺响应头时兜底默认值(对齐 Vue2 spritePreview.js)', async () => {
    const http = {
      get: async (url: string) => ({ data: new Blob(), headers: {}, config: { url } }),
    } as unknown as AxiosInstance
    const meta = await createPhotos(http, () => null).spriteMeta('a1')
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
