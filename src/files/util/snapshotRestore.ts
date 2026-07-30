// 快照浏览态下的写拦截与恢复编排。保持无 Vue 依赖(toast / 网络调用都靠注入),
// 这样两者都能不挂载任何组件直接单测 —— 与 Vue2 snapshotBrowse.js 同一边界。

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
