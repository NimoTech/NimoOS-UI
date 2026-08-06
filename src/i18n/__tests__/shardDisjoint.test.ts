// SP8-P6-T4:i18n 分片不相交守卫(常驻)。
//
// 背景与三条安全前提见 photosSlice.test.ts 顶部注释:分片靠对象展开合并
// (`{...base, ...photos, ...ai}`),重复键会被后展开的静默覆盖 —— git 不报冲突,
// parity.test.ts 只测「合并后」的键集,两语言若以同样方式撞车、合并结果仍然相等,
// parity 也照过。这类错误此前完全无声。
//
// 本文件补 photosSlice.test.ts 没覆盖的三个缺口(该文件已经守住了「三片(base/
// photos/ai)两两不相交」「出口是纯合并」,不在此重复):
//
//   ① 真实分片是 **4 片**,不是 3 片。`zh_cn.sp9.ts` / `en_us.sp9.ts` 不经过
//      `zh_cn.ts` / `en_us.ts` 那个出口 —— 它在 `src/i18n/index.ts` 里单独并入
//      (`{ ...zh, ...zhSp9 }`),是第二条独立的装配路径。photosSlice.test.ts 只验
//      `zh_cn.ts` 出口(base+photos+ai),漏掉了 sp9 这一片与其余三片的撞车风险,
//      而 sp9 是整个 SP9 期文案,体量(459 键)不小。
//   ② ai 分片自身的前缀守卫(该分片是 T3 新建的,还没有专属守卫)。
//   ③ 两语言分片结构对称 —— 每一片 zh 与 en 的键集须完全一致。若两语言各自以
//      不同方式撞车,「合并后键数相等」这类聚合检查会失明(键数凑巧相等但键不同)。
//
// 「无损划分」这条刻意验证**真实装配路径**:import '../index' 拿到的 createI18n
// 实例(index.ts 里 `messages.zh_cn` / `messages.en_us`),而不是只测 zh_cn.ts 那个
// 不含 sp9 的出口 —— 后者会漏掉 sp9 分片撞车的可能性。
import { describe, it, expect } from 'vitest'
import zhBase from '../zh_cn.base'
import zhPhotos from '../zh_cn.photos'
import zhAi from '../zh_cn.ai'
import zhSp9 from '../zh_cn.sp9'
import enBase from '../en_us.base'
import enPhotos from '../en_us.photos'
import enAi from '../en_us.ai'
import enSp9 from '../en_us.sp9'
import { i18n } from '../index'

type Dict = Record<string, unknown>

function overlap(a: Dict, b: Dict): string[] {
  const kb = new Set(Object.keys(b))
  return Object.keys(a).filter((k) => kb.has(k))
}

describe('zh 四片两两不相交(base / photos / ai / sp9)', () => {
  it('六对组合全部不相交', () => {
    expect(overlap(zhBase as Dict, zhPhotos as Dict), 'base × photos').toEqual([])
    expect(overlap(zhBase as Dict, zhAi as Dict), 'base × ai').toEqual([])
    expect(overlap(zhBase as Dict, zhSp9 as Dict), 'base × sp9').toEqual([])
    expect(overlap(zhPhotos as Dict, zhAi as Dict), 'photos × ai').toEqual([])
    expect(overlap(zhPhotos as Dict, zhSp9 as Dict), 'photos × sp9').toEqual([])
    expect(overlap(zhAi as Dict, zhSp9 as Dict), 'ai × sp9').toEqual([])
  })
})

describe('en 四片两两不相交(base / photos / ai / sp9)', () => {
  it('六对组合全部不相交', () => {
    expect(overlap(enBase as Dict, enPhotos as Dict), 'base × photos').toEqual([])
    expect(overlap(enBase as Dict, enAi as Dict), 'base × ai').toEqual([])
    expect(overlap(enBase as Dict, enSp9 as Dict), 'base × sp9').toEqual([])
    expect(overlap(enPhotos as Dict, enAi as Dict), 'photos × ai').toEqual([])
    expect(overlap(enPhotos as Dict, enSp9 as Dict), 'photos × sp9').toEqual([])
    expect(overlap(enAi as Dict, enSp9 as Dict), 'ai × sp9').toEqual([])
  })
})

describe('无损划分 · 真实装配路径(src/i18n/index.ts 的 createI18n 实例)', () => {
  // 用真实 i18n 实例的 messages,而不是重新手写一遍 {...a, ...b, ...c, ...d} ——
  // 否则本测试和被测代码用同一条(可能同样错的)装配公式,查不出装配路径本身写错的情况。
  //
  // 这条断言的判别力边界(独立评审做过变异实测,结论记在这里免得后人误读):
  //   能抓:某个分片游离在真实装配路径之外(比如以后新增第五片却忘了在 index.ts 里并进
  //     去),或真实 messages 里混进了这四个已知分片之外的来源。sp9×ai 定向撞车的变异
  //     (往 zh_cn.sp9.ts 塞一个与 zh_cn.ai.ts 重名的键)会同时把这条和「两两不相交」
  //     一起打红 —— 这也是 shardDisjoint.test.ts 存在的核心理由:同一变异下
  //     photosSlice.test.ts 的 12 条断言全绿、完全失明(它没有 sp9 这一片)。
  //   抓不到:某个分片内部纯删除/纯增加而不撞名的情况 —— 例如从 zh_cn.sp9.ts 删掉
  //     一个键。这时「四片键数之和」与「真实装配后键数」两边同步减 1,等式在集合论上
  //     恒成立(只要「四片两两不相交」这个前提没被破坏),此断言必然保持绿,不代表
  //     文案没被误删。防"误删文案"要靠别的手段(比如 messageSyntax.test.ts 那类值域
  //     检查,或对已知键名做存在性断言),不归本条断言管。
  const realMessages = i18n.global.messages.value as Record<string, Dict>

  it('zh_cn: base+photos+ai+sp9 键数之和 == messages.zh_cn 键数', () => {
    const sum = Object.keys(zhBase as Dict).length + Object.keys(zhPhotos as Dict).length +
      Object.keys(zhAi as Dict).length + Object.keys(zhSp9 as Dict).length
    expect(sum).toBe(Object.keys(realMessages.zh_cn).length)
  })

  it('en_us: base+photos+ai+sp9 键数之和 == messages.en_us 键数', () => {
    const sum = Object.keys(enBase as Dict).length + Object.keys(enPhotos as Dict).length +
      Object.keys(enAi as Dict).length + Object.keys(enSp9 as Dict).length
    expect(sum).toBe(Object.keys(realMessages.en_us).length)
  })
})

describe('ai 分片前缀守卫', () => {
  it('zh_cn.ai.ts 键全部以 ai 开头', () => {
    const bad = Object.keys(zhAi as Dict).filter((k) => !k.startsWith('ai'))
    expect(bad, `非 ai 前缀键: ${bad.join(', ')}`).toEqual([])
  })

  it('en_us.ai.ts 键全部以 ai 开头', () => {
    const bad = Object.keys(enAi as Dict).filter((k) => !k.startsWith('ai'))
    expect(bad, `非 ai 前缀键: ${bad.join(', ')}`).toEqual([])
  })
})

describe('两语言分片结构对称(每一片 zh 与 en 键集完全一致)', () => {
  // photos 这一条与 photosSlice.test.ts「两语言键集完全一致」重复 —— 保留是为了让
  // 本文件本身就是「四片对称性」的完整清单,不必跳去另一个文件才能确认 photos 也被
  // 覆盖到。base / ai / sp9 三条是本文件独有,此前没有任何测试守这三片的中英对称。
  it('base 分片: zh 与 en 键集完全一致', () => {
    expect(Object.keys(zhBase as Dict).sort()).toEqual(Object.keys(enBase as Dict).sort())
  })

  it('photos 分片: zh 与 en 键集完全一致', () => {
    expect(Object.keys(zhPhotos as Dict).sort()).toEqual(Object.keys(enPhotos as Dict).sort())
  })

  it('ai 分片: zh 与 en 键集完全一致', () => {
    expect(Object.keys(zhAi as Dict).sort()).toEqual(Object.keys(enAi as Dict).sort())
  })

  it('sp9 分片: zh 与 en 键集完全一致', () => {
    expect(Object.keys(zhSp9 as Dict).sort()).toEqual(Object.keys(enSp9 as Dict).sort())
  })
})
