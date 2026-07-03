import type { FileEntry } from '../stores/files'

// Vue2 把这份列表抄在 mixin/ContextMenu/FilePanel 共 5 处;New-UI 收拢一处。
export const PROTECTED = ['AppData', 'Documents', 'Downloads', 'Gallery', 'Media']

// 可否对该项做重命名/删除/剪切等破坏性操作。复制/下载/收藏不走这里。
export function canOperate(entry: FileEntry): boolean {
  if (entry.is_dir && PROTECTED.includes(entry.name)) return false // 系统默认文件夹
  if (entry.extensions?.share?.shared === 'true') return false // 已分享
  if ((entry.extensions as { mounted?: boolean } | null | undefined)?.mounted) return false // 挂载点
  return true
}
