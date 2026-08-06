// SP8-P5d Task 3 —— 1:1 移植自 Vue2
// `NimoOS-UI`(main@7a6ee6b7)`src/views/AI/Knowledge/noteEditHelpers.js`(11 行)。
//
// N23:`conflictMessage` 返回的是硬编码英文串,不进 i18n —— 唯一调用点
// `NoteEditPane.vue:293` 是 `if (conflictMessage(e) && !this.isNew)`,只当布尔谓词用,
// 该返回值从来不被显示给用户。给它补 i18n 键 = 凭空多出一个死键。
// 但 Vue2 既有单测 `__tests__/noteEditHelpers.spec.js:11` 断言 `.toContain('4')`
// (revision 出现在串里)—— 这条行为要承接,串内容不许简化成 `return true`。

/** 蓝本 :1-3 —— 分隔符 `/[,\s]+/`(逗号与空白都算),trim + 去空 + 去重。 */
export function parseTags(str: string | null | undefined): string[] {
  return [
    ...new Set(
      String(str || '')
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ]
}

interface ConflictLikeError {
  response?: {
    status?: number
    data?: { current_revision?: unknown }
  }
}

/**
 * 蓝本 :6-10 —— 只在 HTTP 409 时返回非 null,读 `r.data.current_revision`。
 * T0 已回后端源码坐实 409 的字段名就是 `current_revision`(`agent/main.py:2870-2872`),
 * 治理担心的「revision undefined」不成立。
 */
export function conflictMessage(err: ConflictLikeError | null | undefined): string | null {
  const r = err && err.response
  if (!r || r.status !== 409) return null
  const rev = r.data && r.data.current_revision
  return `Note changed elsewhere (now revision ${rev}) — reload and retry`
}
