import { describe, it, expect } from 'vitest'
import { DEFERRED_TABS, isDeferred, type KnowledgeTabId } from './deferred'

describe('Placeholder mechanism (K7)', () => {
  // [SP8-P5b Task 5, 2026-08-01, reverse (not delete)] 'queue' migrated to real QueueView.vue
  // (knowledgeRoutes.ts synchronized reverse), removed from placeholder list; mechanism itself
  // (isDeferred source still DEFERRED_TABS) unchanged.
  //
  // Before (P5a T3 original):
  //   it('P5a 只实现 dashboard,其余 8 个 tab 挂占位', () => {
  //     expect([...DEFERRED_TABS].sort()).toEqual(
  //       ['allowlist', 'indexed-files', 'notes', 'queue', 'roots', 'search', 'settings', 'wiki'])
  //     expect(isDeferred('dashboard')).toBe(false)
  //   })
  //
  // [SP8-P5b Task 10, 2026-08-02, second reverse (not delete)] 'indexed-files' migrated to
  // real IndexedFilesView.vue (T8/T9/T10 three-move completion, knowledgeRoutes.ts synchronized
  // reverse), removed from placeholder list; mechanism itself (isDeferred source still DEFERRED_TABS)
  // unchanged. Following T5 same pattern: reverse + add one forward assertion, delete no existing.
  //
  // Before (P5b T5 original, before reverse):
  //   it('P5a 实现 dashboard,P5b-T5 实现 queue,其余 7 个 tab 挂占位', () => {
  //     expect([...DEFERRED_TABS].sort()).toEqual(
  //       ['allowlist', 'indexed-files', 'notes', 'roots', 'search', 'settings', 'wiki'])
  //     expect(isDeferred('dashboard')).toBe(false)
  //     expect(isDeferred('queue')).toBe(false)
  //   })
  // [SP8-P5c Task 10, 2026-08-04, third reverse (not delete)] 'settings' migrated to real
  // SettingsView.vue (T8 first half + T9 second half, knowledgeRoutes.ts synchronized reverse),
  // removed from placeholder list → 6 items become 5; mechanism itself (isDeferred source still
  // DEFERRED_TABS) unchanged. Following T5 / P5b T10 same pattern: reverse + add forward assertion.
  // 🔴 'allowlist' **still in list**: upper design originally included AllowlistView in P5c, user
  // explicitly moved out this period 2026-08-03 (governance §2.2) → it stays in placeholder
  // list **as expected**, not migration miss. 🔴 Two parser routes reversed together **are
  // top-level routes, not rail tabs**, never in DEFERRED_TABS, so this assertion unrelated
  // (governance §5.1).
  //
  // 改前(P5b T10 原文,反转前):
  //   it('P5a 实现 dashboard,P5b-T5 实现 queue,P5b-T10 实现 indexed-files,其余 6 个 tab 挂占位', () => {
  //     expect([...DEFERRED_TABS].sort()).toEqual(
  //       ['allowlist', 'notes', 'roots', 'search', 'settings', 'wiki'])
  //     expect(isDeferred('dashboard')).toBe(false)
  //     expect(isDeferred('queue')).toBe(false)
  //     expect(isDeferred('indexed-files')).toBe(false)
  //   })
  //
  // 【SP8-P5d Task 10,2026-08-05,第四次反转(不是删除)】'notes' 已迁到真正的
  // NotesView.vue(T6-T9 四刀收官,knowledgeRoutes.ts 同步反转),从占位列表摘掉
  // → 5 项变 4 项;机制本身(isDeferred 的判定来源仍是 DEFERRED_TABS)不变。
  // 承 T5 / P5b T10 / P5c T10 的同一模式:反转 + 新增一条正向断言,不删任何既有
  // 断言。**本刀是本期(P5d)最后一环。**
  // 🔴 'allowlist' 仍在列表里(用户 2026-08-03 明示移出本期,治理 §2.2),'search' /
  // 'wiki' / 'roots' 也仍在列表里 —— 三者归哪一期反转见 `deferred.ts` 文件头
  // (`search`→P5e;`wiki`/`roots`/`allowlist`→P5f)。
  //
  // 改前(P5c T10 原文,反转前):
  //   it('P5a 实现 dashboard,P5b-T5 实现 queue,P5b-T10 实现 indexed-files,P5c-T10 实现 settings,其余 5 个 tab 挂占位', () => {
  //     expect([...DEFERRED_TABS].sort()).toEqual(
  //       ['allowlist', 'notes', 'roots', 'search', 'wiki'])
  //     expect(isDeferred('dashboard')).toBe(false)
  //     expect(isDeferred('queue')).toBe(false)
  //     expect(isDeferred('indexed-files')).toBe(false)
  //     expect(isDeferred('settings')).toBe(false)
  //   })
  //
  // 【SP8-P5e Task 8,2026-08-05,第五次反转(不是删除)】'search' 已迁到真正的
  // SearchView.vue(T4-T7 四刀收官,knowledgeRoutes.ts 同步反转),从占位列表摘掉
  // → 4 项变 3 项;机制本身(isDeferred 的判定来源仍是 DEFERRED_TABS)不变。
  // 承 T5 / P5b T10 / P5c T10 / P5d T10 的同一模式:反转 + 新增一条正向断言,不删
  // 任何既有断言。**本刀是本期(P5e)最后一环。**
  // 🔴 'wiki' / 'roots' / 'allowlist' 仍在列表里 —— 三者全部归 P5f(见 `deferred.ts`
  // 文件头);没有再拆出别期。
  //
  // 改前(P5d T10 原文,反转前):
  //   it('P5a 实现 dashboard,P5b-T5 实现 queue,P5b-T10 实现 indexed-files,P5c-T10 实现 settings,P5d-T10 实现 notes,其余 4 个 tab 挂占位', () => {
  //     expect([...DEFERRED_TABS].sort()).toEqual(
  //       ['allowlist', 'roots', 'search', 'wiki'])
  //     expect(isDeferred('dashboard')).toBe(false)
  //     expect(isDeferred('queue')).toBe(false)
  //     expect(isDeferred('indexed-files')).toBe(false)
  //     expect(isDeferred('settings')).toBe(false)
  //     expect(isDeferred('notes')).toBe(false)
  //   })
  // 【SP8-P5f Task 8,2026-08-06,第六次反转(不是删除)—— 收官刀】'wiki' / 'roots' /
  // 'allowlist' 三项已迁到真页面(P5f T4 = AllowlistView.vue · T5 = RootsView.vue ·
  // T6+T7 = WikiView.vue 上下半;knowledgeRoutes.ts 同刀同步反转),从占位列表摘掉
  // → 3 项变 **0 项**。承 T5 / P5b T10 / P5c T10 / P5d T10 / P5e T8 的同一模式:
  // 反转 + 新增正向断言,不删任何既有断言。**本刀是本期(P5f)最后一环,也是
  // SP8-P5 六批的收官** —— DEFERRED_TABS 从此为空,rail 9 项零占位页。
  // 🔴 机制本身(isDeferred 的判定来源仍是 DEFERRED_TABS)不变,见下方两条守卫。
  //
  // 改前(P5e T8 原文,反转前):
  //   it('P5a 实现 dashboard,P5b-T5 实现 queue,P5b-T10 实现 indexed-files,P5c-T10 实现 settings,P5d-T10 实现 notes,P5e-T8 实现 search,其余 3 个 tab 挂占位', () => {
  //     expect([...DEFERRED_TABS].sort()).toEqual(
  //       ['allowlist', 'roots', 'wiki'])
  //     expect(isDeferred('dashboard')).toBe(false)
  //     expect(isDeferred('queue')).toBe(false)
  //     expect(isDeferred('indexed-files')).toBe(false)
  //     expect(isDeferred('settings')).toBe(false)
  //     expect(isDeferred('notes')).toBe(false)
  //     expect(isDeferred('search')).toBe(false)
  //   })
  it('P5a…P5f 六批全部完成:占位清单已空,rail 9 个 tab 全部 isDeferred === false', () => {
    expect([...DEFERRED_TABS].sort()).toEqual([])
    // 🔴 §9.20:「空清单下 isDeferred(任意 tab) 为 false」—— 逐个列全 9 项,不许只断
    //    空数组(KnowledgeLayout 的 NAV 顺序即 rail 顺序,见 KnowledgeLayout.vue)。
    const ALL_TABS: readonly KnowledgeTabId[] = [
      'dashboard', 'search', 'wiki', 'notes', 'indexed-files',
      'queue', 'roots', 'allowlist', 'settings',
    ]
    // 防空转:上面这张表必须真的是 9 项(漏写一项会让下面的循环少验一个 tab)。
    expect(ALL_TABS).toHaveLength(9)
    for (const id of ALL_TABS) expect(isDeferred(id), `${id} 仍被判成占位页`).toBe(false)
  })

  // 【SP8-P5f Task 8】🔴 清单清空后,下面这行 `for (const id of DEFERRED_TABS)` 成了
  // **空循环、零判别力**(治理「参数化守卫要防空循环」)。本刀**不改它的断言体**
  // (承本文件五代「只加不改既有断言」的惯例 + §9.10 只许加固):它的判别力已由下面
  // 「机制钉子」用例的**临时非空清单**接管;而将来一旦有新 tab 加回 DEFERRED_TABS,
  // 这行会**自动重新上膛**。已在 p5f-task-8-report.md 显式申报。
  it('isDeferred 对每个已列 tab 返回 true', () => {
    for (const id of DEFERRED_TABS) expect(isDeferred(id)).toBe(true)
  })

  // 机制钉子(承 P4 I2:「留了代码没留能力」)——将来 DEFERRED_TABS 清空后,
  // 这条用例仍必须证明 isDeferred 真的在读那个常量,而不是恒返回 false。
  // 【SP8-P5f Task 8,2026-08-06】🔴 **本刀 brief 要求「机制钉子用例一字不许动」——
  // 实测不成立**,已按治理 §10 申报纪律 3(裁定 R18:brief 给的判据只是提示)+ 裁定
  // R21(推翻既有结论须两条独立口径)处理,两段原始输出见 p5f-task-8-report.md:
  //   口径① `pnpm exec vue-tsc --noEmit`:
  //     deferred.test.ts(109,34): error TS2493: Tuple type 'readonly []' of length '0'
  //                               has no element at index '0'.
  //     deferred.test.ts(110,23): error TS2345: Argument of type 'undefined' is not
  //                               assignable to parameter of type 'KnowledgeTabId'.
  //   口径② `pnpm exec vitest run src/ai/knowledge/deferred.test.ts`:
  //     FAIL … > isDeferred 的判定来源是 DEFERRED_TABS 本身
  //     AssertionError: expected false to be true   ← :110 `isDeferred(listed)`
  // 原因是**构造性的、不是实现错**:原文最后两行断言的是「清单里第 0 项必须判真」,
  // 而清单已空 ⇒ 该前提永远不成立(`DEFERRED_TABS[0]` 类型上不存在、运行时 undefined)。
  // ⇒ 守「反转不删」:原文整段留档如下,并换成**判别力更强**的写法 ——
  //   用 **临时非空清单**(`as const` 只在编译期生效,数组对象运行时可变)证明
  //   isDeferred 真的在读那个常量。这正是 §9.20 第二条要的「不许只断空数组」:
  //   只断空数组的话,把 isDeferred 硬编码成 `return false` 会全绿。
  //
  // 改前(P5a T3 原文,历经五代未动,本刀第一次动):
  //   it('isDeferred 的判定来源是 DEFERRED_TABS 本身', () => {
  //     const notListed = 'dashboard' as const
  //     // brief 原文是 `DEFERRED_TABS.includes(notListed)`——vue-tsc 报 TS2345:
  //     // DEFERRED_TABS 的元组类型只含 8 个字面量(不含 'dashboard'),.includes<T>
  //     // 要求实参属于 T。这是测试代码的类型严格性问题,不是 Vue2 逻辑冲突,已按治理
  //     // 文件 §2「brief 测试错不是实现让步」申报;用 isDeferred 内部同款的
  //     // widen 成 readonly string[] 写法修正,断言力不变(仍真的做成员检查)。
  //     expect((DEFERRED_TABS as readonly string[]).includes(notListed)).toBe(false)
  //     expect(isDeferred(notListed)).toBe(false)
  //     const listed = DEFERRED_TABS[0]
  //     expect(isDeferred(listed)).toBe(true)
  //   })
  it('isDeferred 的判定来源是 DEFERRED_TABS 本身(清单已空:用临时非空清单证明机制仍能判真)', () => {
    // 前置:本刀之后清单确实是空的 —— 没有这条,下面「加进去才判真」的对比失去基准。
    expect(DEFERRED_TABS).toHaveLength(0)

    const notListed = 'dashboard' as const
    expect((DEFERRED_TABS as readonly string[]).includes(notListed)).toBe(false)
    expect(isDeferred(notListed)).toBe(false)

    // 🔴 临时非空清单(§9.20 第二条)。判据:把 isDeferred 改成 `return false`
    //    → 下面 `isDeferred('wiki') === true` 那行必须报红。
    const mutable = DEFERRED_TABS as unknown as KnowledgeTabId[]
    try {
      mutable.push('wiki')
      expect(isDeferred('wiki'), 'isDeferred 没在读 DEFERRED_TABS —— 塞进去了却仍判假').toBe(true)
      // 只有被塞进去的那一个判真,别的仍判假 ⇒ 它做的是成员检查,不是恒真。
      expect(isDeferred('roots')).toBe(false)
      expect(isDeferred('allowlist')).toBe(false)
    } finally {
      mutable.length = 0
    }

    // 还原自证:临时项必须已清干净(否则会污染同文件其它用例与后续导入方)。
    expect(DEFERRED_TABS).toHaveLength(0)
    expect(isDeferred('wiki')).toBe(false)
  })
})
