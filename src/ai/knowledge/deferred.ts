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
//
// 【SP8-P5f Task 8,2026-08-06,第六次反转(不是删除)—— 收官刀】'wiki' / 'roots' /
// 'allowlist' 三项已迁(P5f,T4-T7 四刀:T4 = AllowlistView.vue · T5 = RootsView.vue ·
// T6 + T7 = WikiView.vue 上下半;knowledgeRoutes.ts 同刀同步反转三条子路由),
// 从这里摘掉 → DEFERRED_TABS 由 3 项变 **0 项**。
// 🔴 **SP8-P5 六批(P5a / P5b / P5c / P5d / P5e / P5f)全部完成,占位清单已空** ——
// `/ai/knowledge` 左栏 rail 9 项(dashboard / search / wiki / notes / indexed-files /
// queue / roots / allowlist / settings)**零占位页**,每一项都落到真页面。
// 🔴 **机制本身按 K8 / 承 P4 I2 的教训保留** —— 清单空了不等于机制该删。P4 I2 的
// 原教训是「留了代码没留能力」;反过来同样成立:**只断「数组是空的」是零判别力的**
// (把下面 isDeferred 硬编码成 `return false`,只断空数组的用例照样全绿)。故
// deferred.test.ts 保留三层守卫:
//   ① 空清单下 isDeferred(9 个 tab 里的任意一个) 恒 false;
//   ② 机制钉子 —— 判定来源必须是 DEFERRED_TABS 本身;
//   ③ 🔴 **临时非空清单** —— 运行时往清单里塞一项(`as const` 只在编译期,数组对象
//      本身运行时可变),isDeferred 必须立刻对它判真、对别的判假;用完清空并自证还原。
//      这一条才是「机制仍有牙」的真判据,**不许退化成只断空数组**。
// 🔴 将来若有新页面要挂占位:把 tab id 加回下面的 DEFERRED_TABS 即可,机制无需重建。
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

// 改前(P5e T8 原文,反转前 —— 守「反转不删」,原文留档):
//   export const DEFERRED_TABS = [
//     'wiki',
//     'roots',
//     'allowlist',
//   ] as const satisfies readonly KnowledgeTabId[]
export const DEFERRED_TABS = [] as const satisfies readonly KnowledgeTabId[]

export function isDeferred(id: KnowledgeTabId): boolean {
  return (DEFERRED_TABS as readonly string[]).includes(id)
}
