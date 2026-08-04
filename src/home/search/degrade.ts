import type { NormalizedAggregate } from '@nimotech/nimoos-service'
import type { DegradeState } from './types'

// spec §7.8。本区最重要的可见行为:本机四源里两源不可用,用户必须看得出
// 「这次只搜了文件名」,而不是以为搜索就这点结果。
//
// ⚠️ 「组是不是空」不能用来推「该源有没有参与」—— 实测 semantic 会返回 [](跑了,零命中),
//    也会返回 null(没跑)。**唯一可靠的信号是 warnings。**(spec §7.10a)
// ⚠️ notes 源本期不请求(债务 D2)。真收到 notes_unavailable 也不展示:
//    对用户说「笔记搜索不可用」而我们压根没搜笔记,是误导。

const UNAVAILABLE_SUFFIX = '_unavailable'
const KNOWN_SOURCES = ['semantic', 'filenames', 'images']
const NO_ROOTS = 'no_accessible_roots'

export function deriveDegrade(agg: NormalizedAggregate, totalRows: number): DegradeState {
  const unavailableSources: string[] = []
  const unknownWarnings: string[] = []
  let noRoots = false

  for (const w of agg.warnings) {
    if (w === NO_ROOTS) { noRoots = true; continue }
    if (w.endsWith(UNAVAILABLE_SUFFIX)) {
      const src = w.slice(0, -UNAVAILABLE_SUFFIX.length)
      if (src === 'notes') continue          // 本期不请求 notes,报它是误导
      if (KNOWN_SOURCES.includes(src)) { unavailableSources.push(src); continue }
    }
    unknownWarnings.push(w)                  // 认不出的原样透出,不静默丢
  }

  const empty: DegradeState['empty'] =
    noRoots ? 'no_roots'
    : totalRows > 0 ? 'none'
    : agg.warnings.length > 0 ? 'backend_not_ready'
    : 'no_match'

  return { unavailableSources, unknownWarnings, empty }
}
