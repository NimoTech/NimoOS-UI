import { ref, watch, onScopeDispose, type Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { snapshotBrowsePath } from '../util/snapshotPath'
import type { FileEntry } from '../stores/files'

// 卡片放大到 3/4 屏后,正面那张就是一整块可以滚轮上下翻的文件区网格 —— 能翻就得给够,
// 只给一屏的量等于翻两下就到底。上限提到 200:再多的目录留给"进入此快照"去逐页看,
// 卡片只是预览,不做无限列表(没有虚拟滚动,几千个 DOM 节点会拖垮翻卡动画)。
// 超出的条数由卡片末尾的 "+N" 交代,total 始终是真实条目数。
// 注:每格的缩略图走 FileThumb 的 IntersectionObserver 懒加载,而 IntersectionObserver
// 会把"被带滚动条的祖先裁掉"算作不可见 —— 所以卡片里没滚到的那些格子不会发缩略图请求。
const MAX_TILES = 200
const HIDDEN = new Set(['lost+found'])

export interface DeckPreview {
  status: 'loading' | 'ready' | 'missing' | 'failed'
  /** 已按文件区默认规则排好序、最多 MAX_TILES 条的真实条目(卡片直接喂给 FileThumb) */
  entries: FileEntry[]
  total: number
}

// 与 stores/files.ts 的 sortedEntries 默认档一致:文件夹在前,再按名字不分大小写升序。
// 卡片是"进去之后会看到什么"的预览,顺序两边对不上会让人以为进错了目录。
// 这里刻意不读用户在文件区选的排序偏好:卡片不带排序控件,跟着一个看不见的开关变
// 反而更难解释;固定成默认档,与首次打开文件区看到的顺序一致。
function sortLikeFiles(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (!!a.is_dir !== !!b.is_dir) return a.is_dir ? -1 : 1
    const ka = a.name.toLowerCase(), kb = b.name.toLowerCase()
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
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
    previews.value = { ...previews.value, [name]: { status: 'loading', entries: [], total: 0 } }
    try {
      const data = await service.folder.getList(dir)
      if (disposed || myEpoch !== epoch) return // 过期响应/已卸载:整段丢弃,不写 state
      const content = ((data as { content?: FileEntry[] })?.content ?? [])
        .filter((e) => !e.name.startsWith('.') && !HIDDEN.has(e.name))
      const entries = sortLikeFiles(content).slice(0, MAX_TILES)
      previews.value = { ...previews.value, [name]: { status: 'ready', entries, total: content.length } }
    } catch (e) {
      if (disposed || myEpoch !== epoch) return
      // 404 = 那时候还没有这个文件夹(卡片要说人话);其它一律 failed,静默退回纯文字卡。
      const status = statusOf(e)
      previews.value = {
        ...previews.value,
        [name]: { status: status === 404 ? 'missing' : 'failed', entries: [], total: 0 },
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
        const cached = previews.value[name]
        // A `failed` entry means the request blew up -- usually a blip. It used to
        // count as "already fetched" and the card stayed a text card for as long as
        // it remained visible, even after the network came back. `missing` (404) is
        // a stable fact about that snapshot and is never retried.
        if (!cached || cached.status === 'failed') fetchOne(name, epoch)
      }
    },
    { immediate: true },
  )

  return { previews }
}
