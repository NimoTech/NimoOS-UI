// SP8-P5a Task 6 —— 1:1 移植自 Vue2
// `NimoOS-UI` (main@7a6ee6b7) `src/views/AI/Knowledge/indexedFiles.js`。
//
// 蓝本该文件共 5 个纯函数(`buildListParams`/`rowStatusLabel`/`formatSize`/
// `anyIndexing`/`rootsFromFolderRules`),T6 brief 只点名搬 `buildListParams`
// 与 `anyIndexing`(`indexedFiles` 数据流与轮询守卫要用到);其余三个是
// IndexedFilesView 的展示层帮助函数,留给消费该视图的任务(P5b)落地时一并
// 搬进本文件——本文件路径按设计 §5.1 是共享的 `util/indexedFiles.ts`。

/** indexedFiles.js:5-14 —— 拷贝 filters,丢弃值为 ''/null/undefined 的键。 */
export function buildListParams(
  filters: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  Object.keys(filters || {}).forEach((k) => {
    const v = (filters as Record<string, unknown>)[k]
    if (v === '' || v === null || v === undefined) return
    out[k] = v
  })
  return out
}

/** indexedFiles.js:32-34 —— 是否存在处于 indexing 态的行(轮询是否该继续的判据)。 */
export function anyIndexing(
  files: Array<{ status?: string } | null | undefined> | null | undefined,
): boolean {
  return Array.isArray(files) && files.some((f) => !!f && f.status === 'indexing')
}
