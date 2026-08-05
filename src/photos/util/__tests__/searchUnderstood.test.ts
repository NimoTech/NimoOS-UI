import { describe, it, expect } from 'vitest'
import { understood, type PersonOption } from '../searchUnderstood'
import { QUICK_KEYS, QUICK_LABEL_KEYS } from '../dateRange'

const person = (id: string, name: string): PersonOption => ({ id, name, count: 0, coverFaceId: '' })

describe('understood', () => {
  it('空 query / 全空格 → []', () => {
    expect(understood('', [])).toEqual([])
    expect(understood('   ', [])).toEqual([])
  })

  // fix round 1 · M4:Vue2 :475 是 `(this.query || '').toLowerCase()`,同期两个
  // 兄弟函数(queryParts/searchStateMatchesQuery)都补了 `query || ''` 守卫,唯独
  // understood 之前是裸的 `query.toLowerCase()`——下游 T16 真实来源很可能是
  // vue-router 的 route.query.q(类型含 undefined),传 undefined 进来会直接抛
  // TypeError。签名仍保持 query: string(不放宽 TS 侧),但运行时要能扛住。
  it('query 为 undefined(如路由 query 缺省)→ 不抛错,返回 []', () => {
    expect(understood(undefined as unknown as string, [])).toEqual([])
  })

  it('中文人名命中(§7e-5 主守卫,Vue2 用 \\b 时这条不命中)', () => {
    const tokens = understood('小明的照片', [person('p1', '小明')])
    expect(tokens).toEqual([{ k: 'person', v: '小明', id: 'p1' }])
  })

  it('中文人名前紧跟 ASCII 词字符(如数字)仍命中——专门钉住 beforeOk 第三条件(needle 首字符非词字符即边界恒成立),与上一条的"needle 在串首"场景互补', () => {
    // '2025小明的照片':needle '小明' 前一个字符是数字 '5'(WORDISH),若无
    // beforeOk 第三条件,会被误判为"词内延续"而不命中。
    const tokens = understood('2025小明的照片', [person('p1', '小明')])
    expect(tokens.filter(t => t.k === 'person')).toEqual([{ k: 'person', v: '小明', id: 'p1' }])
  })

  it('英文人名词边界:Sara 命中,Sarah 不命中(词内延续),句点后仍命中,前缀粘连不命中', () => {
    const people = [person('p1', 'Sara')]
    const personTokens = (q: string) => understood(q, people).filter(t => t.k === 'person')
    expect(personTokens('Sara at beach').length).toBe(1)
    expect(personTokens('Sarah at beach').length).toBe(0)
    // 'photos of Sara.' 同时也会命中 type:Photos token,这里只关心 person 那一条。
    expect(personTokens('photos of Sara.').length).toBe(1)
    expect(personTokens('xSara').length).toBe(0)
  })

  it('多人同时命中 → 按 people 数组顺序出 token', () => {
    const people = [person('p2', 'Bob'), person('p1', 'Alice')]
    const tokens = understood('Alice and Bob at the park', people)
    expect(tokens.map(t => t.id)).toEqual(['p2', 'p1'])
  })

  it('type:videos 命中 Videos,photo 命中 Photos,两者同时出现只出 Videos(else if 顺序),中文「视频」不命中(照搬已知局限)', () => {
    expect(understood('my videos', []).find(t => t.k === 'type')?.v).toBe('Videos')
    expect(understood('a photo', []).find(t => t.k === 'type')?.v).toBe('Photos')
    const both = understood('my videos and photos', [])
    expect(both.filter(t => t.k === 'type')).toEqual([{ k: 'type', v: 'Videos' }])
    expect(understood('视频', []).find(t => t.k === 'type')).toBeUndefined()
  })

  it('time 六条快捷/年份判据(fix round 1 · I2:五个快捷分支的完整 token —— 含 v —— 都要断言,不能只验 quick;否则 v 键错也测不出来)', () => {
    expect(understood('last week', []).find(t => t.k === 'time')).toEqual({ k: 'time', v: QUICK_LABEL_KEYS.last7, quick: 'last7' })
    expect(understood('last month', []).find(t => t.k === 'time')).toEqual({ k: 'time', v: QUICK_LABEL_KEYS.last30, quick: 'last30' })
    expect(understood('last year', []).find(t => t.k === 'time')).toEqual({ k: 'time', v: QUICK_LABEL_KEYS.lastYear, quick: 'lastYear' })
    expect(understood('this year', []).find(t => t.k === 'time')).toEqual({ k: 'time', v: QUICK_LABEL_KEYS.thisYear, quick: 'thisYear' })
    expect(understood('today', []).find(t => t.k === 'time')).toEqual({ k: 'time', v: QUICK_LABEL_KEYS.today, quick: 'today' })
    const yr = understood('2025 trip', []).find(t => t.k === 'time')
    expect(yr?.v).toBe('2025')
    expect(yr?.quick).toBe(2025)
  })

  it('优先级:last year 2025 → 只出 lastYear(年份分支在 else 里,不会重复出)', () => {
    const tokens = understood('last year 2025', []).filter(t => t.k === 'time')
    expect(tokens).toEqual([{ k: 'time', v: QUICK_LABEL_KEYS.lastYear, quick: 'lastYear' }])
  })

  it('大小写不敏感:LAST WEEK 命中', () => {
    expect(understood('LAST WEEK', []).find(t => t.k === 'time')?.quick).toBe('last7')
  })

  it('五个快捷 time token 的 quick 值全部落在 QUICK_KEYS 里(T9 遗留 M4:quickRange 无 default 分支,quick 若跑出这 5 个字面量之外,下游调用会拿到 undefined 却仍标注为 DateRange 而崩溃)', () => {
    const queries = ['last week', 'last month', 'last year', 'this year', 'today']
    for (const q of queries) {
      const tok = understood(q, []).find(t => t.k === 'time')!
      expect(tok.quick).toBeTypeOf('string')
      expect(QUICK_KEYS).toContain(tok.quick)
      expect((tok.quick as string) in QUICK_LABEL_KEYS).toBe(true)
    }
  })
})
