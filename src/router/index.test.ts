import { describe, it, expect, vi } from 'vitest'

// router/index.ts pulls in Welcome.vue → lottie-web, which calls canvas getContext();
// jsdom has no canvas backend. Same mock as Welcome.test.ts to make router importable here.
vi.mock('lottie-web', () => ({ default: { loadAnimation: vi.fn(() => ({ addEventListener: vi.fn(), destroy: vi.fn() })) } }))

import { router } from './index'

describe('router', () => {
  it('/files/shares 命中 files-shares 而非 catch-all files-path', () => {
    const m = router.resolve('/files/shares')
    expect(m.name).toBe('files-shares')
  })
  it('/files/NimoOS-HD/Documents 仍命中 files-path', () => {
    const m = router.resolve('/files/NimoOS-HD/Documents')
    expect(m.name).toBe('files-path')
  })
  it('/photos/favorites 命中 photos-favorites 路由', () => {
    const m = router.resolve('/photos/favorites')
    expect(m.name).toBe('photos-favorites')
  })
  it('/photos/trash 命中 photos-trash 路由', () => {
    const m = router.resolve('/photos/trash')
    expect(m.name).toBe('photos-trash')
  })
  it('/photos/albums 命中 photos-albums 路由', () => {
    const m = router.resolve('/photos/albums')
    expect(m.name).toBe('photos-albums')
  })
  it('/photos/albums/7 命中 photos-album-detail 路由,params.id 为字符串 "7"', () => {
    const m = router.resolve('/photos/albums/7')
    expect(m.name).toBe('photos-album-detail')
    expect(m.params.id).toBe('7')
  })
  it('/photos/people 命中 photos-people 路由', () => {
    const m = router.resolve('/photos/people')
    expect(m.name).toBe('photos-people')
  })
  it('/photos/people/7 命中 photos-person-detail 路由,params.id 为字符串 "7"', () => {
    const m = router.resolve('/photos/people/7')
    expect(m.name).toBe('photos-person-detail')
    expect(m.params.id).toBe('7')
  })
  // P6a-T11:新路由追加在 /photos/people/:id 之后、/login 之前(只追加,不重排)——
  // 完整的顺序/未重排断言见 PhotosPlaces.test.ts(读原始文本核对插入位置)。
  it('/photos/places 命中 photos-places 路由', () => {
    const m = router.resolve('/photos/places')
    expect(m.name).toBe('photos-places')
  })
})
