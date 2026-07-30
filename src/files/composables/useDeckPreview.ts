import { ref, watch, type Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { snapshotBrowsePath } from '../util/snapshotPath'
import { isImageEntry } from '../util/isImage'
import type { FileEntry } from '../stores/files'

const MAX_TILES = 6
const HIDDEN = new Set(['lost+found'])

export interface DeckPreviewTile { path: string; name: string; isImage: boolean; isDir: boolean }
export interface DeckPreview {
  status: 'loading' | 'ready' | 'missing' | 'failed'
  tiles: DeckPreviewTile[]
  total: number
}

// 从抛出来的错误里取 HTTP 状态,与 files/util/snapshotRestore.ts 的 statusOf 同一套判法:
// 共享包 unwrap() 抛的是 Error & {code}(信封 success 字段),网络层 4xx 由 axios 抛出时
// 状态在 response.status —— 两种都要认。
function statusOf(e: unknown): number | undefined {
  const withCode = e as { code?: number; response?: { status?: number } } | undefined
  return withCode?.code ?? withCode?.response?.status
}

// 卡片上的"那一刻这个文件夹长什么样":快照内容就是普通只读目录,所以直接用文件区现成的
// 列目录接口读 <快照根>/<当前相对路径>。只给**当前可见的**几张卡拉(卡堆窗口是 5+2 张),
// 结果按快照名缓存 —— 来回拨刻度不会重复打请求;换卷或换目录时缓存整体作废重拉。
export function useDeckPreview(opts: {
  mountPoint: () => string
  relPath: () => string
  visibleNames: () => string[]
}): { previews: Ref<Record<string, DeckPreview>> } {
  const previews = ref<Record<string, DeckPreview>>({})
  let cacheKey = ''

  async function fetchOne(name: string) {
    const dir = opts.relPath()
      ? `${snapshotBrowsePath(opts.mountPoint(), name)}/${opts.relPath()}`
      : snapshotBrowsePath(opts.mountPoint(), name)
    previews.value = { ...previews.value, [name]: { status: 'loading', tiles: [], total: 0 } }
    try {
      const data = await service.folder.getList(dir)
      const content = ((data as { content?: FileEntry[] })?.content ?? [])
        .filter((e) => !e.name.startsWith('.') && !HIDDEN.has(e.name))
      const tiles = content.slice(0, MAX_TILES).map((e) => ({
        path: e.path, name: e.name, isImage: isImageEntry(e), isDir: !!e.is_dir,
      }))
      previews.value = { ...previews.value, [name]: { status: 'ready', tiles, total: content.length } }
    } catch (e) {
      // 404 = 那时候还没有这个文件夹(卡片要说人话);其它一律 failed,静默退回纯文字卡。
      const status = statusOf(e)
      previews.value = {
        ...previews.value,
        [name]: { status: status === 404 ? 'missing' : 'failed', tiles: [], total: 0 },
      }
    }
  }

  watch(
    () => [opts.mountPoint(), opts.relPath(), opts.visibleNames().join('|')].join('::'),
    () => {
      const key = `${opts.mountPoint()}::${opts.relPath()}`
      // 换了卷或换了目录,之前缓存的目录内容全部作废
      if (key !== cacheKey) { cacheKey = key; previews.value = {} }
      if (!opts.mountPoint()) return
      for (const name of opts.visibleNames()) {
        if (!previews.value[name]) fetchOne(name)
      }
    },
    { immediate: true },
  )

  return { previews }
}
