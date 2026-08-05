// SP8-P5a 占位机制(偏离 K7)—— 承 P2a 的 DEFERRED_SECTIONS 先例:rail 保持
// Vue2 的 9 项 1:1,未迁页面落占位页,分批替换。P5f 会把 DEFERRED_TABS 清空,
// **但机制本身保留**(承 P4 I2 的教训:清空后要仍有用例证明它有能力,而不是
// 只剩一段没人测的代码)。
//
// 【SP8-P5b Task 5,2026-08-01】'queue' 已迁(QueueView.vue + knowledgeRoutes.ts
// 反转),从这里摘掉,机制本身不变。
// 【SP8-P5b Task 10,2026-08-02】'indexed-files' 已迁(IndexedFilesView.vue 三刀
// 收官 + knowledgeRoutes.ts 反转),从这里摘掉,机制本身不变。
// 【SP8-P5c Task 10,2026-08-04】'settings' 已迁(SettingsView.vue,T8 上半 + T9
// 下半 + knowledgeRoutes.ts 反转),从这里摘掉 → DEFERRED_TABS 由 6 项变 5 项。
// 🔴 'allowlist' **留着**:上级设计原把 AllowlistView 算在 P5c,用户 2026-08-03
// 明示移出本期(治理 §2.2),本期不做,仍落占位页。
// 🔴 同刀反转的 `/ai/parser` 与 `/ai/parser/test` 是**顶层路由、不是 rail tab**,
// 从来不在 DEFERRED_TABS 里,故这里无对应项可摘(治理 §5.1 / T10 brief §2)。
// 【SP8-P5d Task 10,2026-08-05】'notes' 已迁(NotesView.vue,T6-T9 四刀收官 +
// knowledgeRoutes.ts 反转),从这里摘掉 → DEFERRED_TABS 由 5 项变 4 项。
// 🔴 兑现治理 §15.1「跨期占位烂尾」的通用教训 —— 本期票 1 的起因就是「前三期都
// 漏了导航入口」,占位烂尾没人认领。逐项写明剩下 4 个占位项归哪一期反转:
//   · 'search'                       → **P5e**
//   · 'wiki' / 'roots' / 'allowlist' → **P5f**
// K7 占位机制本身不变(承 P4 I2 的教训,见下方 KnowledgeTabId 注释与 deferred.test.ts)。
//
// 【SP8-P5e Task 8,2026-08-05,第五次反转(不是删除)】'search' 已迁(SearchView.vue,
// T4-T7 四刀收官 + knowledgeRoutes.ts 反转),从这里摘掉 → DEFERRED_TABS 由 4 项变
// 3 项。承 T5(queue)/ P5b-T10(indexed-files)/ P5c-T10(settings)/ P5d-T10(notes)
// 四次同款先例:反转 + 新增一条正向断言,不删任何既有断言(deferred.test.ts 同步)。
// 🔴 逐项重申剩下 **3** 个占位项归哪一期反转:
//   · 'wiki' / 'roots' / 'allowlist' → **P5f**(全部三个都归 P5f,没有再拆出别期)。
// K7 占位机制本身仍不变(承 P4 I2 的教训 —— 清单摘空之前,每一步都要仍有用例证明
// 机制本身有能力工作,而不是只剩一段没人测的代码,见下方 KnowledgeTabId 注释与
// deferred.test.ts 的「机制钉子」用例)。
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
  'wiki',
  'roots',
  'allowlist',
] as const satisfies readonly KnowledgeTabId[]

export function isDeferred(id: KnowledgeTabId): boolean {
  return (DEFERRED_TABS as readonly string[]).includes(id)
}
