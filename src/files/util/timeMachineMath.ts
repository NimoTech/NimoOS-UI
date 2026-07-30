// 时间机器的 DOM-free 数学。fisheyeScale / computeFisheyeScales / stepSelectedIndex 从
// Vue2 components/filebrowser/components/snapshotStackMath.js 逐字移植(曲线参数一并保留);
// buildVisibleStack 在 Vue2 版基础上**扩展**出 past 态(新视觉里比选中更新的卡片要朝观众
// 飞出屏幕,Vue2 那版只有"往后退"一个方向);buildRailNodes 是新写的。
//
// Vue2 的 generateStarfieldShadow 有意不移植:新设计的星点由 CSS 承担,且浅色主题下没有星空。

export interface StackEntry<T> {
  item: T
  /** 在扁平列表中的下标(newest-first),点卡片回填选中用 */
  index: number
  /** 距离选中项的层数:front 恒为 0;behind/past 都是 1、2、3… */
  depth: number
  state: 'front' | 'behind' | 'past'
}

export interface RailNode {
  type: 'day' | 'main' | 'sub'
  key: string
  /** type === 'day' 时的日期文案 */
  label?: string
  /** type === 'main' 时该快照的扁平下标 */
  flatIndex?: number
  /** type === 'sub' 时吸附到的主刻度下标 */
  anchorIndex?: number
}

interface FisheyeOptions { radius?: number; maxScale?: number; minScale?: number }

// macOS Time Machine 的刻度带(以及它借鉴的 Dock)是随光标距离**连续**放大的,不是
// hover/near/far 几档 —— 这只能靠读光标位置算一个真正的距离函数,任何纯 CSS :hover 规则
// 都表达不了。这就是那个函数:距离 0 时 maxScale,到 radius 平滑降到 minScale,超出保持 minScale。
export function fisheyeScale(distance: number, options: FisheyeOptions = {}): number {
  const { radius = 70, maxScale = 2.2, minScale = 1 } = options
  const d = Math.abs(distance)
  if (!Number.isFinite(d) || d >= radius) return minScale
  const t = 1 - d / radius // 半径边缘为 0,光标正下方为 1
  // 升余弦缓动:两端斜率都是 0,所以相邻刻度是"融"进放大区再"融"出来的,不会出现折角。
  const eased = (1 - Math.cos(t * Math.PI)) / 2
  return minScale + (maxScale - minScale) * eased
}

export function computeFisheyeScales(centers: number[], cursorY: number, options: FisheyeOptions = {}): number[] {
  return (centers || []).map((c) => fisheyeScale(c - cursorY, options))
}

// items 是 newest-first。选中项在最前(front);更老的快照(下标更大)依次往后退(behind);
// 比选中更新的快照(下标更小)已经"翻过去了",朝观众飞出屏幕(past)。
export function buildVisibleStack<T>(
  items: T[],
  selectedIndex: number,
  maxDepth = 5,
  pastDepth = 2,
): StackEntry<T>[] {
  const list = items || []
  if (list.length === 0) return []
  const start = Math.min(Math.max(selectedIndex, 0), list.length - 1)
  const out: StackEntry<T>[] = []
  for (let depth = 0; depth < maxDepth && start + depth < list.length; depth++) {
    out.push({ item: list[start + depth], index: start + depth, depth, state: depth === 0 ? 'front' : 'behind' })
  }
  // 再放 past(渲染顺序无关紧要,层级由 CSS 的 z-index 决定;这里保证 depth 从近到远)
  for (let depth = 1; depth <= pastDepth && start - depth >= 0; depth++) {
    out.push({ item: list[start - depth], index: start - depth, depth, state: 'past' })
  }
  return out
}

export function stepSelectedIndex(currentIndex: number, delta: number, length: number): number {
  if (!length || length <= 0) return 0
  const next = currentIndex + delta
  return Math.min(Math.max(next, 0), length - 1)
}

// 把按天分好的快照摊平成刻度尺要渲染的节点序列:每组前一个日期标题,每个快照一条主刻度,
// 相邻主刻度之间插 subPerGap 条装饰性子刻度(参考稿的 sub tick)。子刻度不可独立选中,
// 点它吸附到 anchorIndex 那条主刻度。
export function buildRailNodes(
  groups: { dayKey: string; labelText: string; items: { flatIndex: number }[] }[],
  subPerGap = 2,
): RailNode[] {
  const nodes: RailNode[] = []
  const mains: number[] = []
  for (const g of groups || []) {
    nodes.push({ type: 'day', key: `day-${g.dayKey}`, label: g.labelText })
    for (const item of g.items) {
      nodes.push({ type: 'main', key: `main-${item.flatIndex}`, flatIndex: item.flatIndex })
      mains.push(nodes.length - 1)
    }
  }
  if (subPerGap <= 0 || mains.length < 2) return nodes
  // 从后往前插,避免边插边改动前面已记录的下标
  const out = [...nodes]
  for (let i = mains.length - 2; i >= 0; i--) {
    const anchorNode = out[mains[i]]
    const subs: RailNode[] = []
    for (let j = 0; j < subPerGap; j++) {
      subs.push({ type: 'sub', key: `sub-${anchorNode.flatIndex}-${j}`, anchorIndex: anchorNode.flatIndex })
    }
    out.splice(mains[i] + 1, 0, ...subs)
  }
  return out
}
