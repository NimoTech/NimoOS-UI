// 快照浏览态下的写拦截与恢复编排。保持无 Vue 依赖(toast / 网络调用都靠注入),
// 这样两者都能不挂载任何组件直接单测 —— 与 Vue2 snapshotBrowse.js 同一边界。

import { parseSnapshotBrowsePath, findVolumeUuidForMount, type SnapshotVolumeLike } from './snapshotPath'

/**
 * 在只读快照里挡住一次写操作:命中就把友好文案吐成 toast 并返回 true(调用方必须 return)。
 * 这是第二道防线 —— 第一道是把写入入口本身移除(顶栏 chip / 右键菜单 / 选中工具条),
 * 但拖拽投放、快捷键粘贴这些路径绕得过 UI,所以每个写方法开头都要再拦一次。
 */
export function blockedBySnapshotView(
  isSnapshotView: boolean,
  toast: (message: string) => void,
  message: string,
): boolean {
  if (!isSnapshotView) return false
  toast(message)
  return true
}

export type RestoreResult =
  | { ok: true; restoredPath: string }
  | { ok: false; reason: 'invalid' | 'not-found' | 'error' }

// 从抛出来的错误里取 HTTP 状态。共享包的 unwrap() 抛的是 Error & {code}(信封里的 success
// 字段);网络层 4xx 由 axios 抛出时状态在 response.status 上 —— 两种都要认。
function statusOf(e: unknown): number | undefined {
  const withCode = e as { code?: number; response?: { status?: number } } | undefined
  return withCode?.code ?? withCode?.response?.status
}

// 响应形状容错:共享包已解一层信封,但历史上后端也出现过再包一层 data 的写法,两种都取。
function restoredPathOf(res: unknown): string | null {
  const r = res as { restored_path?: string; data?: { restored_path?: string } } | undefined
  return r?.restored_path || r?.data?.restored_path || null
}

/**
 * 「恢复到原位置」的完整编排:把条目的快照侧绝对路径解析回**相对卷根**的路径(后端契约,
 * 不是相对快照目录),用挂载点精确匹配出 volume_uuid,再提交恢复。
 * 后端永不覆盖 —— 目标名由它定为 `<原名>.restored-<时间戳>`,所以这里没有任何冲突处理。
 */
export async function performSnapshotRestore(deps: {
  item: { path: string }
  info: { mount: string; snapshotName: string } | null
  listVolumes: () => Promise<unknown>
  restore: (body: { volume_uuid: string; snapshot: string; path: string }) => Promise<unknown>
}): Promise<RestoreResult> {
  const { item, info, listVolumes, restore } = deps
  if (!info || !item || !item.path) return { ok: false, reason: 'invalid' }
  const parsed = parseSnapshotBrowsePath(item.path)
  if (!parsed || !parsed.relPath) return { ok: false, reason: 'invalid' }

  let volumeUuid: string | null
  try {
    const list = await listVolumes()
    volumeUuid = findVolumeUuidForMount((Array.isArray(list) ? list : []) as SnapshotVolumeLike[], info.mount)
  } catch {
    return { ok: false, reason: 'error' }
  }
  if (!volumeUuid) return { ok: false, reason: 'invalid' }

  try {
    const res = await restore({ volume_uuid: volumeUuid, snapshot: info.snapshotName, path: parsed.relPath })
    const restoredPath = restoredPathOf(res)
    if (!restoredPath) return { ok: false, reason: 'error' }
    return { ok: true, restoredPath }
  } catch (e) {
    const status = statusOf(e)
    if (status === 404) return { ok: false, reason: 'not-found' }
    if (status === 400) return { ok: false, reason: 'invalid' }
    return { ok: false, reason: 'error' }
  }
}
