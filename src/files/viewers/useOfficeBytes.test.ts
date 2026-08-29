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

// Instantiate composable inside component setup, get its API + wrapper (convenient for unmounting)
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
    expect(api.state.value).toBe('loading')   // bytes arrived, still loading
    api.onRendered()
    expect(api.state.value).toBe('ready')
  })

  it('goes error on fetch failure with friendly detail', async () => {
    getBytesMock.mockRejectedValue(new Error('boom'))
    const { api } = makeViewer()
    await nextTick(); await nextTick()
    expect(api.state.value).toBe('error')
    expect(api.buffer.value).toBeNull()
    expect(api.errorDetail.value).toBe('获取文件失败,请重试')
  })

  it('onRenderError maps JSZip "central directory" error to legacy-binary hint', async () => {
    getBytesMock.mockResolvedValue(new ArrayBuffer(4))
    const { api } = makeViewer()
    await nextTick(); await nextTick()
    api.onRenderError(new Error("Can't find end of central directory : is this a zip file ?"))
    expect(api.state.value).toBe('error')
    expect(api.errorDetail.value).toContain('旧版二进制格式')
  })

  it('onRenderError without payload falls back to generic parse-failure detail', async () => {
    getBytesMock.mockResolvedValue(new ArrayBuffer(4))
    const { api } = makeViewer()
    await nextTick(); await nextTick()
    api.onRenderError()
    expect(api.state.value).toBe('error')
    expect(api.errorDetail.value).toBe('文件解析失败,无法预览')
  })

  it('disposed guard: unmount before resolve → no state/buffer flip', async () => {
    let resolve!: (b: ArrayBuffer) => void
    getBytesMock.mockReturnValue(new Promise<ArrayBuffer>((r) => { resolve = r }))
    const { api, wrapper } = makeViewer()
    wrapper.unmount()                 // unmount before getBytes resolves
    resolve(new ArrayBuffer(4))
    await nextTick(); await nextTick()
    expect(api.buffer.value).toBeNull()
    expect(api.state.value).toBe('loading')  // no state flip after unmount
  })
})
