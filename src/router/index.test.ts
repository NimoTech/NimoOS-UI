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

  it('主路由表已展开 knowledge 路由', async () => {
    const { router } = await import('./index')
    const paths = router.getRoutes().map((r) => r.path)
    expect(paths).toContain('/ai/knowledge')
    expect(paths).toContain('/ai/knowledge/notes')
    expect(paths).toContain('/ai/parser/test')
  })
})
