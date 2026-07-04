import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  refreshAccessToken: () => Promise.resolve(null),
  service: { file: { cancelUpload: vi.fn(), listActiveUploads: vi.fn(),
    uploadPrecheck: vi.fn(() => Promise.resolve({ results: [] })) } },
}))
vi.mock('../upload/persist', () => ({
  persistNewItem: () => {}, persistItemMeta: () => {}, dropPersisted: () => {},
  restoreFromIDB: () => Promise.resolve({ items: [], resumedCount: 0 }),
  pruneOldItems: () => Promise.resolve(0),
}))
vi.mock('../upload/conflict', async (orig) => {
  const actual = await (orig as any)()
  return { ...actual, precheckExisting: () => Promise.resolve(new Set<string>()) }
})

import { useUploadsStore } from './uploads'

describe('addFilesToQueue oversize flag', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('never marks a 0-byte file oversize', async () => {
    const s = useUploadsStore()
    const empty = new File([], 'empty.txt')
    await s.addFilesToQueue([{ file: empty, targetPath: '/DATA/Documents', relativePath: 'empty.txt' }])
    const row = s.queue.find((i) => i.fileName === 'empty.txt')
    expect(row?.oversize).toBe(false)
  })
})
