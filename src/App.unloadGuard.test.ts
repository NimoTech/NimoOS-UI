import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import zh from './i18n/zh_cn'

// Ticket A (SP12 Plan B carry-over): the upload queue is an app-lifetime
// Pinia store that keeps transferring after navigating away from /files, but
// installUnloadGuard used to be mounted/unmounted with Files.vue -- so
// closing the tab from any other route sent no interrupt signal and showed
// no leave-site prompt. These tests mount App.vue with a route that is
// deliberately NOT Files.vue, to prove the guard now fires at the app shell
// regardless of which view is on screen.
const interruptBatch = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    uploadBatches: {
      interruptBatch: (...a: unknown[]) => interruptBatch(...(a as [string])),
    },
  },
}))

import App from './App.vue'
import { useUploadsStore } from './files/stores/uploads'
import type { UploadItem } from './files/upload/types'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mk(p: Partial<UploadItem>): UploadItem {
  return {
    id: 'x', file: null, fileName: 'f', fileType: '', size: 1, targetPath: '/DATA', relativePath: 'f',
    status: 'pending', progress: 0, bytesSent: 0, speed: 0, tusUploadUrl: null, retryCount: 0, error: '',
    createdAt: 0, batchId: 'b', batchTotal: 1, conflictPolicy: '', ...p,
  }
}

async function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    // Deliberately a plain placeholder route, not Files.vue -- the whole
    // point of this suite is proving the guard fires when Files is NOT
    // mounted.
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()
  return router
}

let activeWrapper: ReturnType<typeof mount> | null = null

describe('App-level unload guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    interruptBatch.mockReset()
  })

  afterEach(() => {
    activeWrapper?.unmount()
    activeWrapper = null
  })

  it('signals every active batch on pagehide even when Files is not mounted', async () => {
    const router = await makeRouter()
    activeWrapper = mount(App, { global: { plugins: [i18n, router] } })
    await flushPromises()

    const uploads = useUploadsStore()
    uploads.queue.push(mk({ status: 'uploading', batchId: 'b1' }))
    window.dispatchEvent(new Event('pagehide'))

    expect(interruptBatch).toHaveBeenCalledWith('b1')
  })

  it('warns before leaving while an upload is in flight', async () => {
    const router = await makeRouter()
    activeWrapper = mount(App, { global: { plugins: [i18n, router] } })
    await flushPromises()

    const uploads = useUploadsStore()
    uploads.queue.push(mk({ status: 'uploading' }))
    const e = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(e)

    expect(e.defaultPrevented).toBe(true)
  })
})
