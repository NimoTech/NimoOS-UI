// Standing guard that the i18n shards stay disjoint.
//
// Background and the three safety premises are in photosSlice.test.ts's top comment:
// shards are combined by object spread (`{...base, ...photos, ...ai}`), so a duplicate key
// is silently overwritten by whichever spread comes last -- git reports no conflict, and
// parity.test.ts only checks the *merged* key set, so if both languages collide the same
// way the merged results still match and parity passes too. This class of mistake used to
// be completely silent.
//
// This file covers the three gaps photosSlice.test.ts leaves (that file already pins
// "the three shards (base/photos/ai) are pairwise disjoint" and "the entry point is a
// pure merge", neither of which is repeated here):
//
//   ① There are **4** real shards, not 3. `zh_cn.sp9.ts` / `en_us.sp9.ts` do not go
//      through the `zh_cn.ts` / `en_us.ts` entry point -- they are merged separately in
//      `src/i18n/index.ts` (`{ ...zh, ...zhSp9 }`), a second, independent assembly path.
//      photosSlice.test.ts only checks the `zh_cn.ts` entry point (base+photos+ai), so it
//      misses the risk of sp9 colliding with the other three, and sp9 is a whole sprint's
//      worth of copy (459 keys) -- not a small shard.
//   ② A prefix guard for the ai shard itself (that shard was added in T3 and had no
//      guard of its own).
//   ③ Per-shard structural symmetry between the two languages -- every shard's zh and en
//      key sets must be identical. If the two languages each collide in a different way,
//      an aggregate check like "the merged key counts are equal" goes blind (the counts
//      happen to match while the keys differ).
//
// The "lossless partition" case deliberately exercises the **real assembly path**: the
// createI18n instance obtained via import '../index' (`messages.zh_cn` / `messages.en_us`
// inside index.ts), rather than only the zh_cn.ts entry point, which does not include sp9
// and would therefore miss the possibility of an sp9 collision.
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

describe('zh: the four shards are pairwise disjoint (base / photos / ai / sp9)', () => {
  it('all six pairings are disjoint', () => {
    expect(overlap(zhBase as Dict, zhPhotos as Dict), 'base × photos').toEqual([])
    expect(overlap(zhBase as Dict, zhAi as Dict), 'base × ai').toEqual([])
    expect(overlap(zhBase as Dict, zhSp9 as Dict), 'base × sp9').toEqual([])
    expect(overlap(zhPhotos as Dict, zhAi as Dict), 'photos × ai').toEqual([])
    expect(overlap(zhPhotos as Dict, zhSp9 as Dict), 'photos × sp9').toEqual([])
    expect(overlap(zhAi as Dict, zhSp9 as Dict), 'ai × sp9').toEqual([])
  })
})

describe('en: the four shards are pairwise disjoint (base / photos / ai / sp9)', () => {
  it('all six pairings are disjoint', () => {
    expect(overlap(enBase as Dict, enPhotos as Dict), 'base × photos').toEqual([])
    expect(overlap(enBase as Dict, enAi as Dict), 'base × ai').toEqual([])
    expect(overlap(enBase as Dict, enSp9 as Dict), 'base × sp9').toEqual([])
    expect(overlap(enPhotos as Dict, enAi as Dict), 'photos × ai').toEqual([])
    expect(overlap(enPhotos as Dict, enSp9 as Dict), 'photos × sp9').toEqual([])
    expect(overlap(enAi as Dict, enSp9 as Dict), 'ai × sp9').toEqual([])
  })
})

describe('lossless partition · the real assembly path (src/i18n/index.ts createI18n instance)', () => {
  // Read the real i18n instance's messages instead of hand-writing {...a, ...b, ...c, ...d}
  // again -- otherwise this test and the code under test would share the same (possibly
  // equally wrong) assembly formula and could never catch the assembly path itself being
  // wrong.
  //
  // What this assertion can and cannot discriminate (an independent review ran mutation
  // tests; the conclusion is recorded here so nobody misreads it later):
  //   Catches: a shard drifting outside the real assembly path (say a fifth shard is added
  //     later and nobody merges it in index.ts), or the real messages picking up a source
  //     beyond these four known shards. A targeted sp9×ai collision (planting a key in
  //     zh_cn.sp9.ts that also exists in zh_cn.ai.ts) turns this red together with the
  //     pairwise-disjoint cases -- which is the core reason shardDisjoint.test.ts exists:
  //     under that same mutation all 12 assertions in photosSlice.test.ts stay green and
  //     completely blind (it has no sp9 shard).
  //   Misses: a pure deletion or pure addition inside one shard that collides with
  //     nothing -- say removing a key from zh_cn.sp9.ts. Then "the sum of the four shards'
  //     key counts" and "the assembled key count" both drop by 1, and the equation holds
  //     by set theory (as long as the pairwise-disjoint premise is intact), so this stays
  //     green without meaning that no copy was lost. Guarding against accidental copy
  //     deletion needs other means (value-range checks like messageSyntax.test.ts, or
  //     existence assertions on known key names); it is not this assertion's job.
  const realMessages = i18n.global.messages.value as Record<string, Dict>

  it('zh_cn: base+photos+ai+sp9 key counts sum to the messages.zh_cn key count', () => {
    const sum = Object.keys(zhBase as Dict).length + Object.keys(zhPhotos as Dict).length +
      Object.keys(zhAi as Dict).length + Object.keys(zhSp9 as Dict).length
    expect(sum).toBe(Object.keys(realMessages.zh_cn).length)
  })

  it('en_us: base+photos+ai+sp9 key counts sum to the messages.en_us key count', () => {
    const sum = Object.keys(enBase as Dict).length + Object.keys(enPhotos as Dict).length +
      Object.keys(enAi as Dict).length + Object.keys(enSp9 as Dict).length
    expect(sum).toBe(Object.keys(realMessages.en_us).length)
  })
})

describe('ai shard prefix guard', () => {
  it('every zh_cn.ai.ts key starts with ai', () => {
    const bad = Object.keys(zhAi as Dict).filter((k) => !k.startsWith('ai'))
    expect(bad, `keys without the ai prefix: ${bad.join(', ')}`).toEqual([])
  })

  it('every en_us.ai.ts key starts with ai', () => {
    const bad = Object.keys(enAi as Dict).filter((k) => !k.startsWith('ai'))
    expect(bad, `keys without the ai prefix: ${bad.join(', ')}`).toEqual([])
  })
})

describe('per-shard symmetry between the two languages (each shard has identical zh and en key sets)', () => {
  // The photos case overlaps with photosSlice.test.ts's "both languages have identical key
  // sets" -- it is kept so that this file is a complete inventory of four-shard symmetry on
  // its own, without having to open another file to confirm photos is covered too. The
  // base / ai / sp9 cases are unique to this file; nothing guarded those three shards'
  // zh/en symmetry before.
  it('base shard: zh and en key sets are identical', () => {
    expect(Object.keys(zhBase as Dict).sort()).toEqual(Object.keys(enBase as Dict).sort())
  })

  it('photos shard: zh and en key sets are identical', () => {
    expect(Object.keys(zhPhotos as Dict).sort()).toEqual(Object.keys(enPhotos as Dict).sort())
  })

  it('ai shard: zh and en key sets are identical', () => {
    expect(Object.keys(zhAi as Dict).sort()).toEqual(Object.keys(enAi as Dict).sort())
  })

  it('sp9 shard: zh and en key sets are identical', () => {
    expect(Object.keys(zhSp9 as Dict).sort()).toEqual(Object.keys(enSp9 as Dict).sort())
  })
})
