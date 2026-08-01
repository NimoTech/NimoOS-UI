// SP8-P5b Task 4 —— 1:1 移植自 Vue2
// `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/QueueView.vue:393-404`。
//
// 蓝本这三个函数(`distillIconState`/`basename`/`dirname`)是 methods 里的纯展示
// 帮助函数,先于 T5(整体搬运 `QueueView.vue`)单独抽出并测透,让 T5 的组件测试
// 不用再覆盖这些分支。同段的 `fmtAgo`(`:405-414`)不抽到这里 —— T5 直接
// `import { fmtAgo } from '../stores/knowledgeStore'`(store 里已有等价实现,
// P5a 落的,K11)。
//
// 以下三处是蓝本自身的「怪行为」,K12 明确要求逐字照抄,不许「顺手改对」:
//   1. distillIconState:failed 与 skipped 共用同一个 'failed' 返回值
//      (蓝本注释原文 `// failed + skipped share the same danger tone`),
//      未知/缺省 status 同样落 'failed'(不是 'pending')。
//   2. basename:空值(含 falsy 的 ''/null/undefined)返回 U+2014 破折号
//      '—',不是连字符 '-'。
//   3. dirname:返回 '/' + parts.join('/') + '/',因此单段路径(无 '/')
//      落到 parts = [] 之后拼成 '//';空路径落到 !p 分支返回 ''。
//      这两处是蓝本 :399-404 的行为,照抄不改。

/** 蓝本 :393-397 —— failed 与 skipped 共用 danger 色,未知 status 同样落 'failed'。 */
export function distillIconState(
  row: { status?: string },
): 'pending' | 'running' | 'failed' {
  if (row.status === 'pending') return 'pending'
  if (row.status === 'running') return 'running'
  return 'failed' // failed + skipped share the same danger tone —— 蓝本 :396 原文注释,照抄
}

/** 蓝本 :398 —— 空值(falsy)返回 U+2014 破折号 '—',不是连字符 '-'。 */
export function basename(p: string | null | undefined): string {
  return p ? p.split('/').filter(Boolean).pop() || p : '—'
}

/**
 * 蓝本 :399-404 —— 空路径返回 ''；单段路径(无 '/')在 filter(Boolean) 后
 * parts 为空数组,拼接结果为 '//'。两处都是蓝本行为,照抄不改。
 */
export function dirname(p: string | null | undefined): string {
  if (!p) return ''
  const parts = p.split('/').filter(Boolean)
  parts.pop()
  return '/' + parts.join('/') + '/'
}
