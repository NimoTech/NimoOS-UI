import { describe, it, expect } from 'vitest'
import { barSpeakers, speakerToken, segMatches, segChapterIndex, barChapterIndex } from './speakerWave'

// 双说话人构造数据:s1 主导,s2 只在 0:30–0:33 有 3 秒插话。
// duration=100s、n=4 → 每根竖条覆盖 25s。
const SEGS = [
  { t: '0:00', speaker: 's1' },
  { t: '0:30', speaker: 's2' },
  { t: '0:33', speaker: 's1' },
  { t: '1:10', speaker: 's1' },
]

describe('barSpeakers(竖条→说话人归属,窗口内覆盖时长最大者)', () => {
  it('竖条归窗口内覆盖时长最大的说话人(3 秒插话盖不过 22 秒主导)', () => {
    const bars = barSpeakers(SEGS, 100, 4)
    expect(bars[0]).toBe('s1') // 0–25s 只有 s1
    expect(bars[1]).toBe('s1') // 25–50s 内 s1 覆盖 22s、s2 只有 3s 插话 → 归 s1
    expect(bars[2]).toBe('s1')
    expect(bars[3]).toBe('s1')
  })
  it('细粒度轮次数据:各竖条反映该时段真正的主导说话人', () => {
    // 0–50s 由 s2 主导(s1 两次 2s 插话),50–100s 由 s1 主导 → 前后两半颜色不同。
    const turns = [
      { t: '0:00', speaker: 's2' },
      { t: '0:20', speaker: 's1' },
      { t: '0:22', speaker: 's2' },
      { t: '0:40', speaker: 's1' },
      { t: '0:42', speaker: 's2' },
      { t: '0:50', speaker: 's1' },
    ]
    expect(barSpeakers(turns, 100, 2)).toEqual(['s2', 's1'])
  })
  it('覆盖时长打平 → 归全局段数少的一方', () => {
    // duration=120、n=1:窗口内 s1(0–60)与 s2(60–120)各覆盖 60s;
    // s1 全局 2 段、s2 全局 1 段 → 打平归 s2。
    const tie = [
      { t: '0:00', speaker: 's1' },
      { t: '1:00', speaker: 's2' },
      { t: '2:00', speaker: 's1' },
    ]
    expect(barSpeakers(tie, 120, 1)).toEqual(['s2'])
  })
  it('窗口内无任何分段 → null', () => {
    const bars = barSpeakers([{ t: '0:50', speaker: 's1' }], 100, 4)
    expect(bars[0]).toBe(null) // 0–25s 无段
    expect(bars[1]).toBe(null) // 25–50s 无段(唯一段从 50s 起)
    expect(bars[2]).toBe('s1')
    expect(bars[3]).toBe('s1')
  })
  it('duration=0(元数据未就绪)→ 全 null', () => {
    expect(barSpeakers(SEGS, 0, 4)).toEqual([null, null, null, null])
  })
  it('单说话人全程 → 全该人', () => {
    expect(barSpeakers([{ t: '0:00', speaker: 's1' }], 100, 4)).toEqual(['s1', 's1', 's1', 's1'])
  })
  it('n<=0 → 空数组(不抛 RangeError)', () => {
    expect(barSpeakers(SEGS, 100, 0)).toEqual([])
    expect(barSpeakers(SEGS, 100, -1)).toEqual([])
  })
})

describe('speakerToken(序号→CSS token,5 色循环)', () => {
  it('0 → var(--spk-1)', () => expect(speakerToken(0)).toBe('var(--spk-1)'))
  it('4 → var(--spk-5)', () => expect(speakerToken(4)).toBe('var(--spk-5)'))
  it('5 → var(--spk-1)(%5 循环)', () => expect(speakerToken(5)).toBe('var(--spk-1)'))
})

describe('segMatches(过滤谓词:master-checkbox 语义,与 highlightsOnly AND 叠加)', () => {
  const segs = [
    { t: '0:00', speaker: 's1', highlight: false },
    { t: '0:10', speaker: 's2', highlight: true },
    { t: '0:20', speaker: 's1', highlight: true },
  ]
  it('picked=null(无说话人数据,不启用过滤)= 全显', () => {
    for (const s of segs) expect(segMatches(s, null, false)).toBe(true)
  })
  it('全选 = 全显', () => {
    const picked = new Set(['s1', 's2'])
    for (const s of segs) expect(segMatches(s, picked, false)).toBe(true)
  })
  it('picked 空集(全不选)= 全隐藏', () => {
    for (const s of segs) expect(segMatches(s, new Set(), false)).toBe(false)
  })
  it('picked={s2} 只剩 s2 段', () => {
    const picked = new Set(['s2'])
    expect(segs.map((s) => segMatches(s, picked, false))).toEqual([false, true, false])
  })
  it('与 highlightsOnly AND 叠加', () => {
    const picked = new Set(['s1'])
    expect(segs.map((s) => segMatches(s, picked, true))).toEqual([false, false, true])
  })
  it('过滤保留原始索引:同一索引仍是同一段(锁需求5,不重排)', () => {
    const rows = segs.map((seg, i) => ({ seg, i })).filter(({ seg }) => segMatches(seg, new Set(['s1']), true))
    expect(rows).toEqual([{ seg: segs[2], i: 2 }])
  })
  it('无 speaker 字段的段:说话人过滤启用时被过滤,null 时放行', () => {
    expect(segMatches({ t: '0:00' } as { speaker?: string }, new Set(['s1']), false)).toBe(false)
    expect(segMatches({ t: '0:00' } as { speaker?: string }, null, false)).toBe(true)
  })
})

describe('segChapterIndex(段落→章节归属)', () => {
  const chapters = [{ t: '0:10' }, { t: '1:00' }]
  it('按段落起始时间归章;跨章边界正确', () => {
    expect(
      segChapterIndex(
        [{ t: '0:00' }, { t: '0:10' }, { t: '0:59' }, { t: '1:00' }, { t: '2:00' }],
        chapters,
      ),
    ).toEqual([-1, 0, 0, 1, 1])
  })
  it('chapters 空 → 全 -1', () => {
    expect(segChapterIndex([{ t: '0:00' }, { t: '0:30' }], [])).toEqual([-1, -1])
  })
  it('segments 空 → 空数组', () => {
    expect(segChapterIndex([], chapters)).toEqual([])
  })
})

describe('barChapterIndex(竖条中点→章节归属)', () => {
  it('按竖条中点时间归章', () => {
    // duration=100、n=4 → 中点 12.5 / 37.5 / 62.5 / 87.5;章节起点 0 与 50
    expect(barChapterIndex([{ t: '0:00' }, { t: '0:50' }], 100, 4)).toEqual([0, 0, 1, 1])
  })
  it('第一章之前的竖条 → -1', () => {
    expect(barChapterIndex([{ t: '0:50' }], 100, 4)).toEqual([-1, -1, 0, 0])
  })
  it('duration=0(元数据未就绪)→ 全 -1', () => {
    expect(barChapterIndex([{ t: '0:00' }], 0, 4)).toEqual([-1, -1, -1, -1])
  })
  it('chapters 空 → 全 -1;n<=0 → 空数组', () => {
    expect(barChapterIndex([], 100, 2)).toEqual([-1, -1])
    expect(barChapterIndex([{ t: '0:00' }], 100, 0)).toEqual([])
    expect(barChapterIndex([{ t: '0:00' }], 100, -1)).toEqual([])
  })
})
