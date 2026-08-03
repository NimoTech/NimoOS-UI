import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import IsoBrowser from './IsoBrowser.vue'
import { i18n } from '../../i18n'

const items = { value: [] as unknown[] }
const isLoading = { value: false }
const path = { value: '/' }
const fetchFn = vi.fn(); const upFn = vi.fn()
vi.mock('../composables/useIsoBrowser', () => ({
  useIsoBrowser: () => ({ path, items, isLoading, fetch: fetchFn, up: upFn, dispose: vi.fn() }),
}))

const ISOS = [{ id: 'win11', name: 'Windows 11', version: '24H2', category: 'windows', size: '5.8 GB', status: 'available', progress: 0, recommendedVcpu: 2, recommendedMemory: 8192, minMemory: 4096, minDisk: 60, _downloading: false, _downloaded: false, _progress: 0, _downloadedBytes: 0 }]

let w: VueWrapper | null = null
const mk = () => {
  w = mount(IsoBrowser, { props: { isos: ISOS as never }, global: { plugins: [i18n] } })
  return w
}
afterEach(() => { w?.unmount(); w = null; items.value = []; isLoading.value = false; path.value = '/'; fetchFn.mockReset(); upFn.mockReset() })

describe('IsoBrowser', () => {
  it('默认收起,点标题条展开并拉根目录(照 Vue2 :56-60 + :130-136)', async () => {
    const wr = mk()
    expect(wr.find('.custom-browse').exists()).toBe(false)
    await wr.get('.custom-divider').trigger('click')
    expect(wr.find('.custom-browse').exists()).toBe(true)
    expect(fetchFn).toHaveBeenCalledWith('/')
  })

  it('根目录时上一级按钮 disabled', async () => {
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    expect(wr.get('.custom-back-btn').attributes('disabled')).toBeDefined()
  })

  it('非根目录时上一级可点并调 up()', async () => {
    path.value = '/DATA'
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    await wr.get('.custom-back-btn').trigger('click')
    expect(upFn).toHaveBeenCalled()
  })

  it('空目录显示空态文案', async () => {
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    expect(wr.text()).toContain('此目录为空')
  })

  it('目录项显示名字与右箭头、点击进入;文件项显示大小、无箭头', async () => {
    items.value = [
      { name: 'KVM', path: '/DATA/KVM', is_dir: true, is_symlink: false, size: 4096 },
      { name: 'win11.iso', path: '/DATA/win11.iso', is_dir: false, is_symlink: false, size: 6227151974 },
    ]
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    const rows = wr.findAll('.custom-file-item')
    expect(rows[0].find('.custom-file-arrow').exists()).toBe(true)
    expect(rows[1].find('.custom-file-arrow').exists()).toBe(false)
    expect(rows[1].text()).toContain('5.8 GB')
    await rows[0].trigger('click')
    expect(fetchFn).toHaveBeenLastCalledWith('/DATA/KVM')
  })

  it('点 .iso 文件 emit select:isLocal=true,并按文件名反查出 win11 的推荐规格', async () => {
    items.value = [{ name: 'Win11_24H2.iso', path: '/DATA/Win11_24H2.iso', is_dir: false, is_symlink: false, size: 6227151974 }]
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    await wr.get('.custom-file-item').trigger('click')
    expect(wr.emitted('select')![0][0]).toMatchObject({
      isLocal: true, id: 'win11', name: 'Win11_24H2.iso', path: '/DATA/Win11_24H2.iso',
      recommendedVcpu: 2, recommendedMemory: 8192, minMemory: 4096, minDisk: 60,
    })
  })

  it('反查不到时 id 落 local、推荐规格全 undefined(照 Vue2 :350-357)', async () => {
    items.value = [{ name: 'haiku-r1.iso', path: '/DATA/haiku-r1.iso', is_dir: false, is_symlink: false, size: 1 }]
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    await wr.get('.custom-file-item').trigger('click')
    expect(wr.emitted('select')![0][0]).toMatchObject({ isLocal: true, id: 'local' })
    expect((wr.emitted('select')![0][0] as { minDisk?: number }).minDisk).toBeUndefined()
  })

  it('点非 .iso 文件什么都不做', async () => {
    items.value = [{ name: 'readme.txt', path: '/DATA/readme.txt', is_dir: false, is_symlink: false, size: 1 }]
    const wr = mk(); await wr.get('.custom-divider').trigger('click')
    // 过滤发生在 composable 层,这里模拟"漏进来"的情况,组件也不该派发
    await wr.get('.custom-file-item').trigger('click')
    expect(wr.emitted('select')).toBeUndefined()
  })
})
