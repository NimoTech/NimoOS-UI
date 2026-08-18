import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineComponent } from 'vue'

const storageList = vi.fn().mockResolvedValue([])
const raidList = vi.fn().mockResolvedValue([])
const getDiskList = vi.fn().mockResolvedValue({ disks: [] })
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: { list: (...a: unknown[]) => storageList(...a) },
    raid: { list: (...a: unknown[]) => raidList(...a) },
    disks: { getDiskList: (...a: unknown[]) => getDiskList(...a), umount: vi.fn() },
  },
}))

const handlers: Record<string, (p?: unknown) => void> = {}
const offs: Record<string, ReturnType<typeof vi.fn>> = {}
vi.mock('../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on: (ev: string, cb: (p?: unknown) => void) => {
      handlers[ev] = cb
      offs[ev] = vi.fn()
      return offs[ev]
    },
  }),
}))

import StorageDrives from './StorageDrives.vue'

const Stub = defineComponent({ template: '<div />' })

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/storage', component: Stub },
      { path: '/storage/drives', component: StorageDrives },
    ],
  })
  await router.push('/storage/drives')
  await router.isReady()
  return mount(StorageDrives, { global: { plugins: [router] } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('StorageDrives hot-plug wiring', () => {
  it('fetches data right on mount, and subscribes to both the added/removed events', async () => {
    await mountView()
    expect(getDiskList).toHaveBeenCalledTimes(1)
    expect(handlers['local-storage:disk:added']).toBeTypeOf('function')
    expect(handlers['local-storage:disk:removed']).toBeTypeOf('function')
  })
  it('debounces hot-plug events within 500ms into a single refresh', async () => {
    await mountView()
    getDiskList.mockClear()
    handlers['local-storage:disk:added']()
    handlers['local-storage:disk:removed']()
    expect(getDiskList).not.toHaveBeenCalled() // the handler itself doesn't hit the API (non-blocking)
    vi.advanceTimersByTime(500)
    expect(getDiskList).toHaveBeenCalledTimes(1)
  })
  it('unsubscribes when the component unmounts', async () => {
    const w = await mountView()
    w.unmount()
    expect(offs['local-storage:disk:added']).toHaveBeenCalled()
    expect(offs['local-storage:disk:removed']).toHaveBeenCalled()
  })
})
