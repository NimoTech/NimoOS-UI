import { describe, it, expect } from 'vitest'
import { createImage } from './image'

describe('createImage', () => {
  it('thumbUrl builds /v1/image with encoded path + token + type=thumbnail', () => {
    const img = createImage(() => 'a b')
    expect(img.thumbUrl('/DATA/x y.png')).toBe('/v1/image?path=%2FDATA%2Fx%20y.png&token=a%20b&type=thumbnail')
  })

  it('thumbUrl omits token when null', () => {
    const img = createImage(() => null)
    expect(img.thumbUrl('/DATA/x.png')).toBe('/v1/image?path=%2FDATA%2Fx.png&type=thumbnail')
  })

  it('imageUrl includes type when provided, omits when not', () => {
    const img = createImage(() => 'TK')
    expect(img.imageUrl('/DATA/x.png', 'raw')).toBe('/v1/image?path=%2FDATA%2Fx.png&token=TK&type=raw')
    expect(img.imageUrl('/DATA/x.png')).toBe('/v1/image?path=%2FDATA%2Fx.png&token=TK')
  })
})
