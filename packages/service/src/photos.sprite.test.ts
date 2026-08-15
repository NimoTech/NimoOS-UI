import { describe, it, expect } from 'vitest'
import type { AxiosInstance } from 'axios'
import { createPhotos } from './photos.js'

describe('photos video hover sprite', () => {
  it('spriteMeta reads X-Sprite-* from response headers (lowercased by axios)', async () => {
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
    // With no token, the URL has no ?token= (noToken fallback), but it must still be /v1-prefixed and match the same path as spriteUrl(id).
    expect(seenUrl).toBe('/v1/photos/assets/a1/sprite')
  })
  it('spriteMeta falls back to defaults when response headers are missing (matches Vue2 spritePreview.js)', async () => {
    const http = {
      get: async (url: string) => ({ data: new Blob(), headers: {}, config: { url } }),
    } as unknown as AxiosInstance
    const meta = await createPhotos(http, () => null).spriteMeta('a1')
    expect(meta).toEqual({ frames: 10, durationMs: 0, frameW: 240, frameH: 135 })
  })
  it('spriteMeta request URL exactly matches the overlay <img>\'s spriteUrl(id) (fixes double download, restores browser cache hits)', async () => {
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
  it('spriteUrl/previewUrl include token', () => {
    const p = createPhotos({} as AxiosInstance, () => 'T1')
    expect(p.spriteUrl('a1')).toBe('/v1/photos/assets/a1/sprite?token=T1')
    expect(p.previewUrl('a1')).toBe('/v1/photos/assets/a1/preview?token=T1')
  })
})
