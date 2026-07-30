import { ref, watch, onScopeDispose, type Ref } from 'vue'
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
  // 过期响应守卫(T9 评审 Important):换目录/换卷时下面的 watch 会清空 previews 并立刻为
  // 仍可见的快照重新发起请求,但**上一个目录那次已经在途的请求没人拦** —— 如果它后于新
  // 请求落地,会把上一个文件夹的内容静默写进当前目录的卡片里,且没有任何报错/提示,拨
  // 刻度也不会修复它(下一次名字相同就被 `!previews.value[name]` 当成"已经拉过"跳过重拉)。
  // 每次真正换目录/换卷都把 epoch 往前拨一格;每次 fetchOne 认领自己发起时的那一代,
  // 写 previews 前确认自己这一代还没被顶掉,顶掉了就整段丢弃 —— 同 snapshotBrowse.ts 的
  // epoch 守卫、storage/stores/snapshot.ts 的 volumeRequestUuid 同一套语义。
  let epoch = 0
  // 组件卸载后还挂着的请求落地时也不该再写 previews(同一个守卫顺带盖住,Minor)。
  let disposed = false
  onScopeDispose(() => { disposed = true })

  async function fetchOne(name: string, myEpoch: number) {
    const dir = opts.relPath()
      ? `${snapshotBrowsePath(opts.mountPoint(), name)}/${opts.relPath()}`
      : snapshotBrowsePath(opts.mountPoint(), name)
    previews.value = { ...previews.value, [name]: { status: 'loading', tiles: [], total: 0 } }
    try {
      const data = await service.folder.getList(dir)
      if (disposed || myEpoch !== epoch) return // 过期响应/已卸载:整段丢弃,不写 state
      const content = ((data as { content?: FileEntry[] })?.content ?? [])
        .filter((e) => !e.name.startsWith('.') && !HIDDEN.has(e.name))
      const tiles = content.slice(0, MAX_TILES).map((e) => ({
        path: e.path, name: e.name, isImage: isImageEntry(e), isDir: !!e.is_dir,
      }))
      previews.value = { ...previews.value, [name]: { status: 'ready', tiles, total: content.length } }
    } catch (e) {
      if (disposed || myEpoch !== epoch) return
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
      // 换了卷或换了目录,之前缓存的目录内容全部作废,并顶掉任何还在途的旧请求
      if (key !== cacheKey) { cacheKey = key; previews.value = {}; epoch += 1 }
      if (!opts.mountPoint()) return
      for (const name of opts.visibleNames()) {
        if (!previews.value[name]) fetchOne(name, epoch)
      }
    },
    { immediate: true },
  )

  return { previews }
}
