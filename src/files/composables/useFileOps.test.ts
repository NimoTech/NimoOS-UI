import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { messages } from '../../i18n/zh_cn'
import { useFileOps } from './useFileOps'
import { useFilesStore } from '../stores/files'

const folderCreate = vi.fn().mockResolvedValue(undefined)
const fileCreate = vi.fn().mockResolvedValue(undefined)
const fileRename = vi.fn().mockResolvedValue(undefined)
const batchDelete = vi.fn().mockResolvedValue(undefined)
const getList = vi.fn().mockResolvedValue({ content: [] })

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: { create: (...a: unknown[]) => folderCreate(...a), getList: (...a: unknown[]) => getList(...a) },
    file: { create: (...a: unknown[]) => fileCreate(...a), rename: (...a: unknown[]) => fileRename(...a) },
    batch: { delete: (...a: unknown[]) => batchDelete(...a) },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages })

// 在组件 setup 内实例化 composable,拿到其 API
function makeOps() {
  let api!: ReturnType<typeof useFileOps>
  const Host = defineComponent({ setup() { api = useFileOps(); return () => h('div') } })
  mount(Host, { global: { plugins: [i18n] } })
  return api
}

describe('useFileOps', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('createFolder 用当前真实路径拼子路径并 reload', async () => {
    const files = useFilesStore(); files.currentPath = '/DATA/Docs'
    const ops = makeOps()
    await ops.createFolder('New Folder')
    expect(folderCreate).toHaveBeenCalledWith('/DATA/Docs/New Folder')
    expect(getList).toHaveBeenCalledWith('/DATA/Docs') // reload 当前目录
  })

  it('createFile 同理走 file.create', async () => {
    const files = useFilesStore(); files.currentPath = '/DATA'
    const ops = makeOps()
    await ops.createFile('a.txt')
    expect(fileCreate).toHaveBeenCalledWith('/DATA/a.txt')
  })

  it('rename 同名直接返回不请求', async () => {
    useFilesStore().currentPath = '/DATA'
    const ops = makeOps()
    await ops.rename({ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }, 'a.txt')
    expect(fileRename).not.toHaveBeenCalled()
  })

  it('rename 用 file.rename(old,new)', async () => {
    useFilesStore().currentPath = '/DATA'
    const ops = makeOps()
    await ops.rename({ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }, 'b.txt')
    expect(fileRename).toHaveBeenCalledWith('/DATA/a.txt', '/DATA/b.txt')
  })

  it('remove 同步 DELETE /batch 传 JSON 字符串数组', async () => {
    useFilesStore().currentPath = '/DATA'
    const ops = makeOps()
    await ops.remove([{ name: 'a', path: '/DATA/a', is_dir: false }])
    expect(batchDelete).toHaveBeenCalledWith(JSON.stringify(['/DATA/a']))
  })

  it('remove 受保护项被前端挡下,不请求', async () => {
    useFilesStore().currentPath = '/DATA'
    const ops = makeOps()
    await ops.remove([{ name: 'Documents', path: '/DATA/Documents', is_dir: true }])
    expect(batchDelete).not.toHaveBeenCalled()
  })

  it('copyPath 写虚拟路径(不含 /DATA)', async () => {
    const files = useFilesStore()
    files.displayNames = { '/DATA': 'NimoOS-HD' }
    const ops = makeOps()
    await ops.copyPath({ name: 'a', path: '/DATA/a', is_dir: false })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/NimoOS-HD/a')
    const arg = (navigator.clipboard.writeText as any).mock.calls[0][0]
    expect(arg).not.toContain('/DATA')
  })
})
