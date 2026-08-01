// SP8-P5b Task 7 —— 移植自 Vue2
// `src/views/AI/Knowledge/IndexedFilesView.vue:396-444`(main@7a6ee6b7)。
// 每处「照抄的怪行为」各有一条专门用例把返回值钉死,并标注蓝本行号。
//
// 🔴 边界断言纪律(P5a T6 教训:`fmtAgo` 的 `h < 24` 改成 `h < 48`,
// 16/16 用例仍全绿——因为原用例只在每档"中段"取样,阈值本身改错测不出来)。
// 本文件对 `fmtBytes`/`fmtRel` 的**每个档位两侧**都各有一条断言,防止同款回归。
import { describe, it, expect, vi } from 'vitest'
import { fmtBytes, fmtRel, fmtAbs, simplifyMime, topSegment } from './indexedFilesView'

describe('fmtBytes', () => {
  // 三个特例:null / undefined / 0。`n == null`(宽松相等)不拦 0——
  // 0 会走 `n < 1024` 分支返回 '0 B',不是 '—'。IndexedFilesView.vue:397。
  it('null/undefined 返回 em dash，0 返回 \'0 B\'（宽松相等 == 不拦 0）— IndexedFilesView.vue:397, copied verbatim', () => {
    expect(fmtBytes(null)).toBe('—')
    expect(fmtBytes(undefined)).toBe('—')
    expect(fmtBytes(0)).toBe('0 B')
    expect(fmtBytes(0)).not.toBe('—')
  })

  it('B 档:普通值', () => {
    expect(fmtBytes(1)).toBe('1 B')
    expect(fmtBytes(500)).toBe('500 B')
  })

  // B/KB 边界:1023 (< 1024) 仍是 B 档；1024 (= 1024) 进入 KB 档。
  it('B/KB 边界:1023 -> \'1023 B\'；1024 -> \'1.0 KB\'', () => {
    expect(fmtBytes(1023)).toBe('1023 B')
    expect(fmtBytes(1024)).toBe('1.0 KB')
  })

  // 🔴 KB 档内部 toFixed 位数切换点(蓝本 :398 `n < 10240 ? 1 : 0`)——
  // 全任务书里最容易漏的一处边界:10239 (< 10240) 用 1 位小数；
  // 10240 (= 10240) 用 0 位小数。这不是 B/KB 或 KB/MB 分档边界，是**同一档
  // 内部**小数位数的切换点，只测分档边界的话这条永远测不出来。
  it('KB 档 toFixed 位数切换:10239 -> \'10.0 KB\'（1 位小数）；10240 -> \'10 KB\'（0 位小数）— IndexedFilesView.vue:398, copied verbatim', () => {
    expect(fmtBytes(10239)).toBe('10.0 KB')
    expect(fmtBytes(10240)).toBe('10 KB')
    expect(fmtBytes(10240)).not.toBe('10.0 KB')
  })

  it('KB 档:普通值（< 10240,保留 1 位小数）', () => {
    expect(fmtBytes(2048)).toBe('2.0 KB')
  })

  // 🔴 MB 档内部 toFixed 位数切换点(蓝本 :399 `n < 10485760 ? 1 : 0`)，
  // 与上面 KB 档同一个模具,同样两侧都要断。
  it('MB 档 toFixed 位数切换:10485759 -> \'10.0 MB\'；10485760 -> \'10 MB\' — IndexedFilesView.vue:399, copied verbatim', () => {
    expect(fmtBytes(10485759)).toBe('10.0 MB')
    expect(fmtBytes(10485760)).toBe('10 MB')
    expect(fmtBytes(10485760)).not.toBe('10.0 MB')
  })

  it('MB 档:普通值（< 10485760,保留 1 位小数）', () => {
    expect(fmtBytes(5 * 1048576)).toBe('5.0 MB')
  })

  // MB/GB 边界:1073741823 (< 1024^3) 仍是 MB 档；1073741824 (= 1024^3) 进 GB 档，
  // GB 档恒 2 位小数(蓝本 :400 `.toFixed(2)`，不是条件式)。
  it('MB/GB 边界:1073741823 -> \'1024 MB\'；1073741824 -> \'1.00 GB\'', () => {
    expect(fmtBytes(1073741823)).toBe('1024 MB')
    expect(fmtBytes(1073741824)).toBe('1.00 GB')
  })

  it('GB 档:普通值，恒 2 位小数', () => {
    expect(fmtBytes(1.5 * 1073741824)).toBe('1.50 GB')
  })
})

describe('fmtRel', () => {
  const now = 1_800_000_000_000

  it('null/undefined/0 全部返回 em dash（与 fmtAgo 一致，但与 fmtBytes 的 0 特例相反）', () => {
    expect(fmtRel(null)).toBe('—')
    expect(fmtRel(undefined)).toBe('—')
    expect(fmtRel(0)).toBe('—')
  })

  // 🔴 秒/分 边界:44 秒 -> "刚刚"；45 秒 -> 进入分钟档，m = floor(45/60) = 0,
  // 渲染出 "0 分钟前"（蓝本 :406-407 就是这个行为，照抄不改，不是应该拦到 44
  // 才切换的"错误"）。
  it('秒/分 边界:44 秒(s=44)→ 刚刚；45 秒(s=45,m=0)→ 0 分钟前 — IndexedFilesView.vue:406-407, copied verbatim', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRel(now - 44_000)).toBe('刚刚')
    expect(fmtRel(now - 45_000)).toBe('0 分钟前')
    vi.restoreAllMocks()
  })

  // 中文渲染文案(不只比分支,比确切串;值回附录 A 核对:aiKbMinAgo = '{m} 分钟前')
  it('普通分钟档:3 分钟前', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRel(now - 3 * 60_000)).toBe('3 分钟前')
    vi.restoreAllMocks()
  })

  // 分/时 边界:59 分钟(m=59)→ 59 分钟前；60 分钟(m=60,=1 小时)→ 1 小时前
  it('分/时 边界:59 分钟(m=59)→ 59 分钟前；60 分钟(m=60)→ 1 小时前', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRel(now - 3599_000)).toBe('59 分钟前')
    expect(fmtRel(now - 3600_000)).toBe('1 小时前')
    vi.restoreAllMocks()
  })

  // 时/天 边界:23 小时(h=23)→ 23 小时前；24 小时(h=24,=1 天)→ 1 天前
  it('时/天 边界:23 小时(h=23)→ 23 小时前；24 小时(h=24)→ 1 天前', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRel(now - 82800_000)).toBe('23 小时前')
    expect(fmtRel(now - 86400_000)).toBe('1 天前')
    vi.restoreAllMocks()
  })

  // 🔴 天/月 边界(蓝本独有的第 5 档，store 版 fmtAgo 没有):29 天(d=29)→
  // 29 天前；30 天(d=30,=1 个月)→ 1 个月前。
  it('天/月 边界:29 天(d=29)→ 29 天前；30 天(d=30)→ 1 个月前 — IndexedFilesView.vue:414-415, copied verbatim', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRel(now - 29 * 86400_000)).toBe('29 天前')
    expect(fmtRel(now - 30 * 86400_000)).toBe('1 个月前')
    vi.restoreAllMocks()
  })

  it('月档:普通值,2 个月前', () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRel(now - 65 * 86400_000)).toBe('2 个月前')
    vi.restoreAllMocks()
  })
})

describe('fmtRel 与 store 的 fmtAgo 不是同一个函数（K12 硬约束，不许合并）', () => {
  it('fmtRel 有 5 档（多一个"月"档），fmtAgo 只有 4 档——用同一个 30 天差值验证行为不同', () => {
    // fmtAgo（knowledgeStore.ts）在天档封顶，30 天差值仍然会输出"30 天前"这类
    // 天数（4 档没有月），而 fmtRel 在 d>=30 时切到月档，输出"1 个月前"。
    // 这里只断言 fmtRel 自己的行为，不 import fmtAgo（那是 T5 的既有测试范围，
    // 本文件不重复也不修改它）——但明确写出两者档数不同，供报告与评审核对。
    const now = 1_800_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(fmtRel(now - 30 * 86400_000)).toBe('1 个月前')
    vi.restoreAllMocks()
  })
})

describe('fmtAbs', () => {
  it('null/undefined 返回 em dash', () => {
    expect(fmtAbs(null)).toBe('—')
    expect(fmtAbs(undefined)).toBe('—')
    expect(fmtAbs(0)).toBe('—')
  })

  // 🔴 时区纪律:蓝本读的是本地时间 getter(getFullYear/getMonth/getDate/
  // getHours/getMinutes),不是 UTC。这里用 `new Date(year, monthIdx, day,
  // hours, minutes)` 这种"本地分量构造函数"生成时间戳,断言值也用同样的本地
  // 分量拼出来——两边都锚定在"本地时间"这同一个参照系里，跟运行测试的机器
  // 时区无关(不管机器在哪个时区，`new Date(2026,0,5,3,7).getHours()` 恒是
  // 3,因为构造与读取用的是同一套本地 getter)。
  it('padStart 补零，且不受运行机器时区影响 — 单位数月/日/时/分', () => {
    const ts = new Date(2026, 0, 5, 3, 7, 0).getTime()
    expect(fmtAbs(ts)).toBe('2026-01-05 03:07')
  })

  it('两位数月/日/时/分不受影响', () => {
    const ts = new Date(2026, 11, 31, 23, 59, 0).getTime()
    expect(fmtAbs(ts)).toBe('2026-12-31 23:59')
  })

  it('午夜 00:00 的补零', () => {
    const ts = new Date(2026, 6, 1, 0, 0, 0).getTime()
    expect(fmtAbs(ts)).toBe('2026-07-01 00:00')
  })
})

describe('simplifyMime — 8 条 if 分支各一条', () => {
  it('无 mime(null/undefined/空串)-> FILE/doc（guard clause，不计入 8 条）', () => {
    expect(simplifyMime(null)).toEqual({ label: 'FILE', kind: 'doc' })
    expect(simplifyMime(undefined)).toEqual({ label: 'FILE', kind: 'doc' })
    expect(simplifyMime('')).toEqual({ label: 'FILE', kind: 'doc' })
  })

  it('分支 1:docling -> DOCX/doc', () => {
    expect(simplifyMime('application/vnd.docling+json')).toEqual({ label: 'DOCX', kind: 'doc' })
  })

  it('分支 1:wordprocessing -> DOCX/doc（同一条 if 的另一个 || 分量）', () => {
    expect(simplifyMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
      .toEqual({ label: 'DOCX', kind: 'doc' })
  })

  it('分支 2:legacy-office -> DOC/doc，legacy: true — IndexedFilesView.vue:428', () => {
    expect(simplifyMime('application/legacy-office-doc')).toEqual({ label: 'DOC', kind: 'doc', legacy: true })
  })

  it('分支 3:pdf -> PDF/pdf（无 legacy 字段）', () => {
    const r = simplifyMime('application/pdf')
    expect(r).toEqual({ label: 'PDF', kind: 'pdf' })
    expect(r.legacy).toBeUndefined()
  })

  it('分支 4:spreadsheet -> XLSX/txt', () => {
    expect(simplifyMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
      .toEqual({ label: 'XLSX', kind: 'txt' })
  })

  it('分支 5:ms-powerpoint -> PPT/code，legacy: true — IndexedFilesView.vue:431', () => {
    expect(simplifyMime('application/vnd.ms-powerpoint')).toEqual({ label: 'PPT', kind: 'code', legacy: true })
  })

  it('分支 5:presentation -> PPT/code，legacy: true（同一条 if 的另一个 || 分量）', () => {
    expect(simplifyMime('application/vnd.openxmlformats-officedocument.presentationml.presentation'))
      .toEqual({ label: 'PPT', kind: 'code', legacy: true })
  })

  it('分支 6:markdown -> MD/md', () => {
    expect(simplifyMime('text/markdown')).toEqual({ label: 'MD', kind: 'md' })
  })

  it('分支 7:text/x- -> CODE/code', () => {
    expect(simplifyMime('text/x-python')).toEqual({ label: 'CODE', kind: 'code' })
  })

  it('分支 8:text/plain -> TXT/txt', () => {
    expect(simplifyMime('text/plain')).toEqual({ label: 'TXT', kind: 'txt' })
  })

  it('未匹配任何分支的 mime(非空)落到末尾兜底 FILE/doc', () => {
    expect(simplifyMime('application/octet-stream')).toEqual({ label: 'FILE', kind: 'doc' })
  })
})

describe('simplifyMime — 顺序陷阱（8 条 if 的顺序有意义，任务书要求的定向用例）', () => {
  // 任务书明确要求的陷阱串:同时含 'presentation' 与 'legacy-office'。
  // legacy-office 是分支 2，ms-powerpoint/presentation 是分支 5——分支 2 先
  // 判定，所以命中 DOC/doc,legacy:true，而不是 PPT/code,legacy:true。
  it("同时含 'legacy-office' 与 'presentation' -> 落在先判定的 legacy-office 分支（DOC），不是 presentation 分支（PPT）— IndexedFilesView.vue:428 先于 :431, copied verbatim", () => {
    const r = simplifyMime('application/legacy-office-presentation')
    expect(r).toEqual({ label: 'DOC', kind: 'doc', legacy: true })
    expect(r.label).not.toBe('PPT')
  })

  // 🔴 对应 RED 探针「前两条 if 互换」:分支 1(docling/wordprocessing)与
  // 分支 2(legacy-office)互换顺序才会改变这条串的结果——上面那条陷阱串测的
  // 是分支 2 vs 分支 5 的顺序，这条测的是分支 1 vs 分支 2 的顺序，两条互不
  // 覆盖，缺一个都测不出对应的顺序回归。
  it("同时含 'wordprocessing' 与 'legacy-office' -> 落在先判定的 docling/wordprocessing 分支（DOCX），不是 legacy-office 分支（DOC）— IndexedFilesView.vue:427 先于 :428, copied verbatim", () => {
    const r = simplifyMime('application/legacy-office-wordprocessing')
    expect(r).toEqual({ label: 'DOCX', kind: 'doc' })
    expect(r.legacy).toBeUndefined()
  })
})

describe('topSegment', () => {
  it('null/undefined/空串 -> null', () => {
    expect(topSegment(null)).toBeNull()
    expect(topSegment(undefined)).toBeNull()
    expect(topSegment('')).toBeNull()
  })

  // 🔴 核心边界:正则 /^\/([^/]+)\// 要求首段后面还有第二个斜杠。
  // '/DATA' 没有第二个斜杠 -> null；'/DATA/x' 有 -> 'DATA'。两侧都要断，
  // 否则「去掉尾斜杠」这种回归（RED 探针 3）测不出来。
  it("'/DATA'（无第二个斜杠）-> null；'/DATA/x'（有）-> 'DATA' — IndexedFilesView.vue:442-444, copied verbatim", () => {
    expect(topSegment('/DATA')).toBeNull()
    expect(topSegment('/DATA/x')).toBe('DATA')
  })

  it('多段路径只取首段', () => {
    expect(topSegment('/DATA/Wiki/foo/bar.md')).toBe('DATA')
  })

  it('不以斜杠开头的路径 -> null（正则锚定 ^\\/)', () => {
    expect(topSegment('DATA/x')).toBeNull()
  })
})
