import { describe, it, expect } from 'vitest'
import { DEFERRED_TABS, isDeferred } from './deferred'

describe('占位机制(K7)', () => {
  // 【SP8-P5b Task 5,2026-08-01,反转(不是删除)】'queue' 已迁到真正的
  // QueueView.vue(knowledgeRoutes.ts 同步反转),从占位列表摘掉;机制本身
  // (isDeferred 的判定来源仍是 DEFERRED_TABS)不变。
  //
  // 改前(P5a T3 原文):
  //   it('P5a 只实现 dashboard,其余 8 个 tab 挂占位', () => {
  //     expect([...DEFERRED_TABS].sort()).toEqual(
  //       ['allowlist', 'indexed-files', 'notes', 'queue', 'roots', 'search', 'settings', 'wiki'])
  //     expect(isDeferred('dashboard')).toBe(false)
  //   })
  //
  // 【SP8-P5b Task 10,2026-08-02,再次反转(不是删除)】'indexed-files' 已迁到
  // 真正的 IndexedFilesView.vue(T8/T9/T10 三刀收官,knowledgeRoutes.ts 同步
  // 反转),从占位列表摘掉;机制本身(isDeferred 的判定来源仍是 DEFERRED_TABS)
  // 不变。承 T5 的同一模式:反转 + 新增一条正向断言,不删任何既有断言。
  //
  // 改前(P5b T5 原文,反转前):
  //   it('P5a 实现 dashboard,P5b-T5 实现 queue,其余 7 个 tab 挂占位', () => {
  //     expect([...DEFERRED_TABS].sort()).toEqual(
  //       ['allowlist', 'indexed-files', 'notes', 'roots', 'search', 'settings', 'wiki'])
  //     expect(isDeferred('dashboard')).toBe(false)
  //     expect(isDeferred('queue')).toBe(false)
  //   })
  it('P5a 实现 dashboard,P5b-T5 实现 queue,P5b-T10 实现 indexed-files,其余 6 个 tab 挂占位', () => {
    expect([...DEFERRED_TABS].sort()).toEqual(
      ['allowlist', 'notes', 'roots', 'search', 'settings', 'wiki'])
    expect(isDeferred('dashboard')).toBe(false)
    expect(isDeferred('queue')).toBe(false)
    expect(isDeferred('indexed-files')).toBe(false)
  })

  it('isDeferred 对每个已列 tab 返回 true', () => {
    for (const id of DEFERRED_TABS) expect(isDeferred(id)).toBe(true)
  })

  // 机制钉子(承 P4 I2:「留了代码没留能力」)——将来 DEFERRED_TABS 清空后,
  // 这条用例仍必须证明 isDeferred 真的在读那个常量,而不是恒返回 false。
  it('isDeferred 的判定来源是 DEFERRED_TABS 本身', () => {
    const notListed = 'dashboard' as const
    // brief 原文是 `DEFERRED_TABS.includes(notListed)`——vue-tsc 报 TS2345:
    // DEFERRED_TABS 的元组类型只含 8 个字面量(不含 'dashboard'),.includes<T>
    // 要求实参属于 T。这是测试代码的类型严格性问题,不是 Vue2 逻辑冲突,已按治理
    // 文件 §2「brief 测试错不是实现让步」申报;用 isDeferred 内部同款的
    // widen 成 readonly string[] 写法修正,断言力不变(仍真的做成员检查)。
    expect((DEFERRED_TABS as readonly string[]).includes(notListed)).toBe(false)
    expect(isDeferred(notListed)).toBe(false)
    const listed = DEFERRED_TABS[0]
    expect(isDeferred(listed)).toBe(true)
  })
})
