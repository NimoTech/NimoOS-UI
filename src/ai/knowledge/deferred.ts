// SP8-P5a 占位机制(偏离 K7)—— 承 P2a 的 DEFERRED_SECTIONS 先例:rail 保持
// Vue2 的 9 项 1:1,未迁页面落占位页,分批替换。P5f 会把 DEFERRED_TABS 清空,
// **但机制本身保留**(承 P4 I2 的教训:清空后要仍有用例证明它有能力,而不是
// 只剩一段没人测的代码)。
//
// 【SP8-P5b Task 5,2026-08-01】'queue' 已迁(QueueView.vue + knowledgeRoutes.ts
// 反转),从这里摘掉,机制本身不变。
export type KnowledgeTabId =
  | 'dashboard'
  | 'search'
  | 'wiki'
  | 'notes'
  | 'indexed-files'
  | 'queue'
  | 'roots'
  | 'allowlist'
  | 'settings'

export const DEFERRED_TABS = [
  'search',
  'wiki',
  'notes',
  'indexed-files',
  'roots',
  'allowlist',
  'settings',
] as const satisfies readonly KnowledgeTabId[]

export function isDeferred(id: KnowledgeTabId): boolean {
  return (DEFERRED_TABS as readonly string[]).includes(id)
}
