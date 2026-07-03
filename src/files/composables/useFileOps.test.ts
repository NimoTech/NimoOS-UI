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
const batchTask = vi.fn().mockResolvedValue(undefined)
const getList = vi.fn().mockResolvedValue({ content: [] })

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: { create: (...a: unknown[]) => folderCreate(...a), getList: (...a: unknown[]) => getList(...a) },
    file: { create: (...a: unknown[]) => fileCreate(...a), rename: (...a: unknown[]) => fileRename(...a) },
    batch: { delete: (...a: unknown[]) => batchDelete(...a), task: (...a: unknown[]) => batchTask(...a) },
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

  it('rename 受保护项被前端挡下,不请求', async () => {
    useFilesStore().currentPath = '/DATA'
    const ops = makeOps()
    await ops.rename({ name: 'Documents', path: '/DATA/Documents', is_dir: true }, 'Docs')
    expect(fileRename).not.toHaveBeenCalled()
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

  it('copy 把选中项真实路径写进剪贴板(type:copy)', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    const ops = makeOps()
    ops.copy([{ name: 'a', path: '/DATA/a', is_dir: false } as never])
    expect(clip.operateObject).toEqual({ type: 'copy', item: [{ from: '/DATA/a' }] })
  })

  it('cut 写 type:move;受保护项被挡(不写剪贴板)', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    const ops = makeOps()
    ops.cut([{ name: 'AppData', path: '/DATA/AppData', is_dir: true } as never])
    expect(clip.operateObject).toBeNull() // 受保护 → 挡下
    ops.cut([{ name: 'a', path: '/DATA/a', is_dir: false } as never])
    expect(clip.operateObject?.type).toBe('move')
  })

  it('paste 发 batch.task({type,item,to,style}) 后清空剪贴板', async () => {
    const { useClipboardStore } = await import('../stores/clipboard')
    const clip = useClipboardStore()
    clip.operate('copy', ['/DATA/a'])
    const files = useFilesStore(); files.currentPath = '/DATA/dst'
    const ops = makeOps()
    await ops.paste('overwrite')
    expect(batchTask).toHaveBeenCalledWith({ type: 'copy', item: [{ from: '/DATA/a' }], to: '/DATA/dst', style: 'overwrite' })
    expect(clip.operateObject).toBeNull()
  })

  it('paste 无剪贴板内容时不发请求', async () => {
    const ops = makeOps()
    await ops.paste('overwrite')
    expect(batchTask).not.toHaveBeenCalled()
  })
})
