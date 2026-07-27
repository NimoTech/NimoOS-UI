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
})
