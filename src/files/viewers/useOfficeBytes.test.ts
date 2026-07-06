import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useOfficeBytes } from './useOfficeBytes'
import type { FileEntry } from '../stores/files'

const getBytesMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { file: { getBytes: (...a: unknown[]) => getBytesMock(...a) } },
}))

const item = { name: 'a.pdf', path: '/DATA/a.pdf', is_dir: false } as FileEntry

// 在组件 setup 内实例化 composable,拿到其 API + wrapper(便于卸载)
function makeViewer() {
  let api!: ReturnType<typeof useOfficeBytes>
  const Host = defineComponent({ setup() { api = useOfficeBytes(item); return () => h('div') } })
  const wrapper = mount(Host)
  return { api, wrapper }
}

beforeEach(() => { getBytesMock.mockReset() })

describe('useOfficeBytes', () => {
  it('starts loading, fetches bytes with real path, stays loading until onRendered', async () => {
    const buf = new ArrayBuffer(4)
    getBytesMock.mockResolvedValue(buf)
    const { api } = makeViewer()
    expect(api.state.value).toBe('loading')
    await nextTick(); await nextTick()
    expect(getBytesMock).toHaveBeenCalledWith('/DATA/a.pdf')
    expect(api.buffer.value).toBe(buf)
    expect(api.state.value).toBe('loading')   // 字节到位仍 loading
    api.onRendered()
    expect(api.state.value).toBe('ready')
  })

  it('goes error on fetch failure', async () => {
    getBytesMock.mockRejectedValue(new Error('boom'))
    const { api } = makeViewer()
    await nextTick(); await nextTick()
    expect(api.state.value).toBe('error')
    expect(api.buffer.value).toBeNull()
  })

  it('onRenderError sets error', async () => {
    getBytesMock.mockResolvedValue(new ArrayBuffer(4))
    const { api } = makeViewer()
    await nextTick(); await nextTick()
    api.onRenderError()
    expect(api.state.value).toBe('error')
  })

  it('disposed guard: unmount before resolve → no state/buffer flip', async () => {
    let resolve!: (b: ArrayBuffer) => void
    getBytesMock.mockReturnValue(new Promise<ArrayBuffer>((r) => { resolve = r }))
    const { api, wrapper } = makeViewer()
    wrapper.unmount()                 // 在 getBytes resolve 前卸载
    resolve(new ArrayBuffer(4))
    await nextTick(); await nextTick()
    expect(api.buffer.value).toBeNull()
    expect(api.state.value).toBe('loading')  // 卸载后不再翻状态
  })
})
