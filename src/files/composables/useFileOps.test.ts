import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import { useFileOps } from './useFileOps'
import { useFilesStore } from '../stores/files'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import { useToast } from '../../stores/toast'

const folderCreate = vi.fn().mockResolvedValue(undefined)
const fileCreate = vi.fn().mockResolvedValue(undefined)
const fileRename = vi.fn().mockResolvedValue(undefined)
const batchDelete = vi.fn().mockResolvedValue(undefined)
const batchTask = vi.fn().mockResolvedValue(undefined)
const getList = vi.fn().mockResolvedValue({ content: [] })
const fileUrl = vi.fn((p: string) => `/v3/file?token=TK&path=${encodeURIComponent(p)}`)
const batchUrl = vi.fn((f: string) => `/v1/batch?token=TK&files=${encodeURIComponent(f)}`)
const refreshMock = vi.fn().mockResolvedValue('new-token')

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: { create: (...a: unknown[]) => folderCreate(...a), getList: (...a: unknown[]) => getList(...a) },
    file: { create: (...a: unknown[]) => fileCreate(...a), rename: (...a: unknown[]) => fileRename(...a), fileUrl: (...a: unknown[]) => fileUrl(...(a as [string])) },
    batch: { delete: (...a: unknown[]) => batchDelete(...a), task: (...a: unknown[]) => batchTask(...a), batchUrl: (...a: unknown[]) => batchUrl(...(a as [string])) },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
  },
  refreshAccessToken: (...a: unknown[]) => refreshMock(...a),
}))

const triggerMock = vi.fn()
vi.mock('../util/iframeDownload', () => ({ triggerIframeDownload: (...a: unknown[]) => triggerMock(...(a as [string])) }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

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

  it('download 单文件 → service.file.fileUrl(真实路径) 并触发 iframe', async () => {
    localStorage.setItem('expires_at', String(Math.floor(Date.now() / 1000) + 3600)) // 充裕,不刷新
    const ops = makeOps()
    await ops.download([{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }])
    expect(fileUrl).toHaveBeenCalledWith('/DATA/a.txt')
    expect(batchUrl).not.toHaveBeenCalled()
    expect(triggerMock).toHaveBeenCalledWith('/v3/file?token=TK&path=%2FDATA%2Fa.txt')
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('download 单目录/多选 → service.batch.batchUrl(逗号连接真实路径)', async () => {
    localStorage.setItem('expires_at', String(Math.floor(Date.now() / 1000) + 3600))
    const ops = makeOps()
    await ops.download([
      { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
      { name: 'Docs', path: '/DATA/Docs', is_dir: true },
    ])
    expect(batchUrl).toHaveBeenCalledWith('/DATA/a.txt,/DATA/Docs')
    expect(fileUrl).not.toHaveBeenCalled()
    expect(triggerMock).toHaveBeenCalledTimes(1)
  })

  it('download token 快过期 → 先 refreshAccessToken 再构 URL', async () => {
    localStorage.setItem('expires_at', String(Math.floor(Date.now() / 1000) + 10)) // 10s 后过期,进缓冲
    const ops = makeOps()
    await ops.download([{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }])
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(triggerMock).toHaveBeenCalledTimes(1)
  })

  it('download expires_at 缺失 → 保守刷新', async () => {
    localStorage.removeItem('expires_at')
    const ops = makeOps()
    await ops.download([{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }])
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('download 刷新失败 → 不触发下载', async () => {
    localStorage.removeItem('expires_at') // 触发刷新
    refreshMock.mockRejectedValueOnce(new Error('auth fail'))
    const ops = makeOps()
    await ops.download([{ name: 'a.txt', path: '/DATA/a.txt', is_dir: false }])
    expect(triggerMock).not.toHaveBeenCalled()
  })

  it('download 空选区 → 无操作', async () => {
    const ops = makeOps()
    await ops.download([])
    expect(fileUrl).not.toHaveBeenCalled()
    expect(batchUrl).not.toHaveBeenCalled()
    expect(triggerMock).not.toHaveBeenCalled()
  })

  describe('快照只读态拦截写操作', () => {
    const enterSnapshot = () => {
      const browse = useSnapshotBrowseStore()
      browse.status = 'ready'
      browse.volumes = [{ volume_uuid: 'u-data', mount: '/DATA', supported: true }]
      useFilesStore().currentPath = '/DATA/.snapshots/snap1/Photos'
      return browse
    }

    it('新建文件夹被拦,不发请求', async () => {
      enterSnapshot()
      const ops = makeOps()
      await ops.createFolder('新建文件夹')
      expect(folderCreate).not.toHaveBeenCalled()
      expect(useToast().msg).toContain('只读')
    })
    it('新建文件被拦', async () => {
      enterSnapshot()
      const ops = makeOps()
      await ops.createFile('a.txt')
      expect(fileCreate).not.toHaveBeenCalled()
    })
    it('重命名被拦', async () => {
      enterSnapshot()
      const ops = makeOps()
      await ops.rename({ name: 'a', path: '/DATA/.snapshots/snap1/a', is_dir: false }, 'b')
      expect(fileRename).not.toHaveBeenCalled()
    })
    it('删除被拦', async () => {
      enterSnapshot()
      const ops = makeOps()
      await ops.remove([{ name: 'a', path: '/DATA/.snapshots/snap1/a', is_dir: false }])
      expect(batchDelete).not.toHaveBeenCalled()
    })
    it('粘贴被拦', async () => {
      enterSnapshot()
      const { useClipboardStore } = await import('../stores/clipboard')
      useClipboardStore().operate('copy', ['/DATA/a'])
      const ops = makeOps()
      await ops.paste('overwrite')
      expect(batchTask).not.toHaveBeenCalled()
    })
    it('不在快照里时这些操作照常放行', async () => {
      useFilesStore().currentPath = '/DATA/Photos'
      const ops = makeOps()
      await ops.createFolder('新建文件夹')
      expect(folderCreate).toHaveBeenCalled()
    })
  })
})
