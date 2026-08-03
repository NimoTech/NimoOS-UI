// 文件区快照浏览的路径纯函数。从 Vue2 NimoOS-UI/src/service/snapshot.js(6 个)与
// components/filebrowser/snapshotBrowse.js(3 个)逐字移植 —— 判定逻辑、返回形状、
// fail-safe 方向一律未改,只补了 TS 类型。这些函数完全不认识"卷"这个概念(除了两个
// 显式接收 volumes 的查找函数),纯按路径段工作,因此对任意挂载点一视同仁。

export interface SnapshotBrowseInfo {
  mount: string
  snapshotName: string
  /** 相对快照根的路径,浏览快照自身根目录时为空串 */
  relPath: string
}

export interface SnapshotVolumeLike {
  volume_uuid?: string
  mount?: string
  supported?: boolean
  [k: string]: unknown
}

export interface VolumesState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  volumes: SnapshotVolumeLike[]
}

/** 每个支持快照的挂载点下那个只读子卷目录的名字 —— "进入快照"和"识别出正在快照里"
 *  两个方向共用同一个常量,不会漂移。 */
export const SNAPSHOTS_DIR_NAME = '.snapshots'

const stripTrailingSlash = (p: string | undefined | null): string => (p || '').replace(/\/+$/, '')

export function snapshotBrowsePath(mount: string, snapshotName: string): string {
  return `${mount}/${SNAPSHOTS_DIR_NAME}/${snapshotName}`
}

// 段匹配(不是 includes 子串匹配):一个名字里恰好含 ".snapshots" 文本的普通目录不会误判。
// 有多个 ".snapshots" 段时取最左边那个 —— 外层那个才是挂载边界,内层是快照里真实存在的
// 普通数据目录。
export function parseSnapshotBrowsePath(absPath: string | null | undefined): SnapshotBrowseInfo | null {
  if (!absPath || typeof absPath !== 'string') return null
  const clean = stripTrailingSlash(absPath)
  if (!clean) return null
  const segments = clean.split('/')
  const idx = segments.indexOf(SNAPSHOTS_DIR_NAME)
  if (idx === -1) return null
  const mount = segments.slice(0, idx).join('/')
  // mount 为空说明路径直接以 "/.snapshots" 开头(或压根没有前导斜杠)—— 前面没有真实挂载点
  if (!mount) return null
  const snapshotName = segments[idx + 1]
  if (!snapshotName) return null // ".../.snapshots" 自身:还没选中任何快照
  return { mount, snapshotName, relPath: segments.slice(idx + 2).join('/') }
}

export function liveVolumePath(mount: string, relPath: string): string {
  return relPath ? `${mount}/${relPath}` : mount
}

// 对应后端 NimoOS-LocalStorage service/snapshot/naming.go 的 ParseName,但只取横幅需要的
// "什么时候拍的";**故意不校验**类型段是否在已知类型表里 —— 浏览进一个未识别/被 reconcile 成
// unknown 类型的快照目录时,仍应显示真实时间而不是一片空白。永不抛错。
export function parseSnapshotName(name: string | null | undefined): { createdAt: Date } | null {
  if (!name || typeof name !== 'string') return null
  const tsPart = name.split('_')[0]
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(tsPart)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const createdAt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)))
  if (Number.isNaN(createdAt.getTime())) return null
  return { createdAt }
}

/** 横幅上的人话时间。解析不出来就回退成原始名字(不抛错、不留空)。 */
export function formatSnapshotBannerTime(name: string): string {
  const parsed = parseSnapshotName(name)
  return parsed ? parsed.createdAt.toLocaleString() : name
}

// 入口按钮用:只有文件区那个任意的 currentPath(可能在挂载点下深处好几层),要找出它落在
// 哪个卷里 —— 最长挂载前缀匹配。注意 clean !== mount 时必须要求 `${mount}/` 前缀,
// 否则 "/DATAX" 会被判成属于 "/DATA"。
export function findVolumeForPath(volumes: SnapshotVolumeLike[], path: string): SnapshotVolumeLike | null {
  if (!path || typeof path !== 'string' || !Array.isArray(volumes)) return null
  const clean = stripTrailingSlash(path)
  let best: SnapshotVolumeLike | null = null
  for (const v of volumes) {
    const mount = stripTrailingSlash(v.mount)
    if (!mount) continue
    if (clean !== mount && !clean.startsWith(`${mount}/`)) continue
    if (!best || mount.length > stripTrailingSlash(best.mount).length) best = v
  }
  return best
}

/** 恢复用:已经知道确切挂载点,精确匹配出 volume_uuid(容忍末尾斜杠)。 */
export function findVolumeUuidForMount(volumes: SnapshotVolumeLike[], mount: string): string | null {
  const hit = (volumes || []).find((v) => stripTrailingSlash(v.mount) === stripTrailingSlash(mount))
  return hit && hit.volume_uuid ? hit.volume_uuid : null
}

// 评审修复(Critical 1,第二轮):`<挂载点>/.snapshots` 这个容器目录本身 —— parseSnapshotBrowsePath
// 对它故意返回 null(".snapshots 自身:还没选中任何快照",语义不能改,恢复编排等处依赖它),
// 但这意味着只靠 shouldGuardSnapshotView 时这一层完全不锁:没有 parsed 结果,直接判不是快照
// 视图,写入工具条、右键菜单、时间机器入口 chip 全部一起冒出来。这个容器目录通常仍然可写,
// 用户能在快照命名空间里建垃圾文件/对只读子卷操作拿到原始文件系统报错。
//
// 第一轮的 isSnapshotsContainerPath(absPath, volumes) 自己攒了一套 `volumes.some(...)` 判定,
// volumes 为空(idle/loading/error 三态)时恒为 false —— 复核用真实探针实测:这三态下
// `.snapshots` 容器目录全部漏锁,而 error 是 ensureVolumes() 的本会话终态(这台设备
// /v2/snapshot/* 全 404),漏锁会持续整个会话。且原函数完全不看 supported,会反过来误锁
// supported:false 卷上恰好叫 .snapshots 的普通目录。
//
// 这一轮不再写第二套三态判断:只做纯路径解析(不认识"卷"这个概念,与 parseSnapshotBrowsePath
// 同一职责边界),合成一个 snapshotName:'' 的 SnapshotBrowseInfo,交给下面唯一的闸门函数
// shouldGuardSnapshotView 复用同一套 idle/loading/error/ready+supported 判定 —— idle/loading/
// error 自动保持锁定,supported:false 的确证豁免也自动继承,不会再出现两条路径(有快照名 vs
// 容器本身)fail-safe 方向不一致的情况。
export function parseSnapshotsContainerPath(absPath: string | null | undefined): SnapshotBrowseInfo | null {
  if (!absPath || typeof absPath !== 'string') return null
  const clean = stripTrailingSlash(absPath)
  if (!clean) return null
  const segments = clean.split('/')
  if (segments.length < 2 || segments[segments.length - 1] !== SNAPSHOTS_DIR_NAME) return null
  const mount = segments.slice(0, -1).join('/')
  // mount 为空说明路径直接是 "/.snapshots"(没有前导真实挂载点)—— 与
  // parseSnapshotBrowsePath 的同一条规则保持一致,不命中。
  if (!mount) return null
  return { mount, snapshotName: '', relPath: '' }
}

// 只读锁的最终闸门,坐在 parseSnapshotBrowsePath 前面。
//
// fail-safe 方向是**有意的产品决定,不是疏漏**:除非从一次已经 resolved 的卷列表里
// 肯定地知道"这个挂载点确认 supported: false",否则一律保持锁定。误锁只是让一个恰好叫
// ".snapshots" 的普通目录短暂显示成只读(烦人);漏锁则让写请求打到真只读的 btrfs 快照上,
// 用户拿到的是一句原始文件系统报错(更糟)。所以 idle / loading / error / 列表里没有这个
// 挂载点 —— 四种都保持锁定。
export function shouldGuardSnapshotView(
  parsed: SnapshotBrowseInfo | null,
  state: VolumesState | null | undefined,
): boolean {
  if (!parsed) return false
  if (!state || state.status !== 'ready') return true
  const match = (state.volumes || []).find((v) => stripTrailingSlash(v.mount) === stripTrailingSlash(parsed.mount))
  if (match && match.supported === false) return false
  return true
}

/** 当前路径相对卷根的部分 —— 时间机器用它决定卡片展示哪个目录、以及进入快照后落在哪里。
 *  路径不在该挂载点下时返回空串(退回卷根),不做任何猜测。 */
export function relPathUnderMount(mount: string, absPath: string): string {
  const m = stripTrailingSlash(mount)
  const p = stripTrailingSlash(absPath)
  if (!m || !p) return ''
  if (p === m) return ''
  if (!p.startsWith(`${m}/`)) return ''
  return p.slice(m.length + 1)
}

/** 「退出快照」该落到哪:活卷上的同名目录;该目录在活卷上已不存在则回卷根。 */
export async function resolveExitTarget(
  info: SnapshotBrowseInfo | null,
  dirExists: (p: string) => Promise<boolean>,
): Promise<string | null> {
  if (!info) return null
  const target = liveVolumePath(info.mount, info.relPath)
  const exists = await dirExists(target)
  return exists ? target : info.mount
}
