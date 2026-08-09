// SP15-P1-T2: Moments 马赛克布局引擎 —— 纯函数,无 Date/random/DOM 依赖。
// 逐行照 Vue2 NimoOS-UI 899af59b:src/views/Photos/PhotosSmartViewsView.vue:322-357
// 移植(那边就是 module-level `export function`,本就是为可单测设计的),只做
// snake_case → camelCase 的字段改名与类型标注,规则一字不改。

export type MomentSize = 'standard' | 'wide' | 'tall'
export type MomentTemplate = 'T1' | 'T2' | 'T3' | 'T4' | 'single'

/** 布局只需要这五个字段;刻意不收整个 Moment,让本模块与 store 解耦、便于构造测试夹具。 */
export interface MomentLayoutInput {
  id: string
  recipeKey: string
  assetCount: number
  /** 封面宽高比 w/h。后端约定 0 = 未知(封面尚未 EXIF 索引),不参与判定。 */
  coverRatio: number
  featuredAssetIds: string[]
}

/**
 * 尺寸分档 —— 只看单条时刻自身内容,按顺序判定、首个命中即返回:
 *   tall:     coverRatio ∈ (0, 0.85) —— 竖版封面
 *   wide:     recipeKey 以 'trip' 开头 且 assetCount >= 100 —— 大行程
 *   standard: 其余
 * 不含"间隔配额"(那是序列级规则,见 assignMomentSizes)。
 */
export function classifyMomentSize(moment: MomentLayoutInput): MomentSize {
  const ratio = typeof moment.coverRatio === 'number' ? moment.coverRatio : 0
  if (ratio > 0 && ratio < 0.85) return 'tall'
  const key = moment.recipeKey || ''
  const count = moment.assetCount || 0
  if (key.startsWith('trip') && count >= 100) return 'wide'
  return 'standard'
}

/**
 * 模板选择 —— 由尺寸档 + 精选张数 n 决定,随 n 递减回落:
 *   n >= 2 → 该档自己的模板(tall→T2 / wide→T4 / standard→T1)
 *   n == 1 → 任意档都落 T3(封面与唯一精选左右对半),而不是直接掉单图
 *   n == 0 → single
 */
export function pickMomentTemplate(size: MomentSize, featuredCount: number): MomentTemplate {
  if (featuredCount >= 2) return size === 'tall' ? 'T2' : size === 'wide' ? 'T4' : 'T1'
  if (featuredCount === 1) return 'T3'
  return 'single'
}

/**
 * 主分配函数 —— 按序遍历,在内容驱动的候选尺寸之上叠加"间隔配额"打散:
 * 距上一张 wide 不足 3 位、或距上一张 tall 不足 2 位,降级为 standard,
 * 避免宽卡/高卡挤在一起。
 *
 * 关键:**只有降级之后仍然保留的尺寸才更新"上一张的位置"** —— 若把降级项
 * 也计入基准,后续项会被连锁错误降级(测试里有一条专门钉死这点)。
 */
export function assignMomentSizes(
  moments: MomentLayoutInput[],
): Record<string, { size: MomentSize; template: MomentTemplate }> {
  const map: Record<string, { size: MomentSize; template: MomentTemplate }> = {}
  let lastWideIdx = -Infinity
  let lastTallIdx = -Infinity
  ;(moments || []).forEach((m, idx) => {
    let size = classifyMomentSize(m)
    if (size === 'wide' && idx - lastWideIdx < 3) size = 'standard'
    else if (size === 'tall' && idx - lastTallIdx < 2) size = 'standard'
    if (size === 'wide') lastWideIdx = idx
    if (size === 'tall') lastTallIdx = idx
    const featuredCount = Array.isArray(m.featuredAssetIds) ? m.featuredAssetIds.length : 0
    map[m.id] = { size, template: pickMomentTemplate(size, featuredCount) }
  })
  return map
}
