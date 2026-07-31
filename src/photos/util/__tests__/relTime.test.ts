import { describe, it, expect } from 'vitest'
import { relTime } from '../relTime'

const t = (k: string, p?: Record<string, unknown>) => k + JSON.stringify(p ?? {})

describe('relTime', () => {
  it('空/null iso → ""', () => {
    expect(relTime('', 0, t, 'zh_cn')).toBe('')
    expect(relTime(null, 0, t, 'zh_cn')).toBe('')
    expect(relTime(undefined, 0, t, 'zh_cn')).toBe('')
  })

  it('坏串(Invalid Date)→ ""(新增守卫)', () => {
    expect(relTime('not-a-date', Date.parse('2026-07-31'), t, 'zh_cn')).toBe('')
  })

  it('30 秒前 → photosSvRelMinutes 且 n===1', () => {
    const now = Date.parse('2026-07-31T12:00:30Z')
    const iso = new Date('2026-07-31T12:00:00Z').toISOString()
    const out = relTime(iso, now, t, 'zh_cn')
    expect(out).toBe('photosSvRelMinutes' + JSON.stringify({ n: 1 }))
  })

  // 发现(任务报告已登记):brief 把 30 秒前标注为"Math.max(1,…) 下界"用例,但实测
  // 30/60=0.5,JS 的 Math.round(0.5)===1(四舍五入向 +∞),即便删掉 Math.max(1,…) 这个
  // 用例的 n 依然是 1 —— 30 秒这个点本身根本没有触到下界。真正触底的是 diff<30s(round
  // 到 0)的区间,这里用 10 秒前顶上,才是能在删码验证里让"下界"这条真正变红的用例。
  it('10 秒前 → 仍是 n===1(真正触到 Math.max(1,…) 下界,round(10/60)=0)', () => {
    const now = Date.parse('2026-07-31T12:00:10Z')
    const iso = new Date('2026-07-31T12:00:00Z').toISOString()
    const out = relTime(iso, now, t, 'zh_cn')
    expect(out).toBe('photosSvRelMinutes' + JSON.stringify({ n: 1 }))
  })

  it('90 分钟前 → photosSvRelHours 且 n===2(Math.round(5400/3600)=2)', () => {
    const iso = new Date('2026-07-31T10:30:00Z').toISOString()
    const now = Date.parse('2026-07-31T12:00:00Z')
    const out = relTime(iso, now, t, 'zh_cn')
    expect(out).toBe('photosSvRelHours' + JSON.stringify({ n: 2 }))
  })

  it('59 分钟前(3599 秒)仍是 photosSvRelMinutes', () => {
    const now = Date.parse('2026-07-31T12:00:00Z')
    const iso = new Date(now - 3599 * 1000).toISOString()
    const out = relTime(iso, now, t, 'zh_cn')
    expect(out.startsWith('photosSvRelMinutes')).toBe(true)
  })

  it('3600 秒整 → photosSvRelHours(边界另一侧)', () => {
    const now = Date.parse('2026-07-31T12:00:00Z')
    const iso = new Date(now - 3600 * 1000).toISOString()
    const out = relTime(iso, now, t, 'zh_cn')
    expect(out.startsWith('photosSvRelHours')).toBe(true)
  })

  it('86400 秒整 → 绝对日期档(结果不含 photosSvRel)', () => {
    const now = Date.parse('2026-07-31T12:00:00Z')
    const iso = new Date(now - 86400 * 1000).toISOString()
    const out = relTime(iso, now, t, 'zh_cn')
    expect(out).not.toContain('photosSvRel')
    expect(out.length).toBeGreaterThan(0)
  })

  it('locale 生效:同一 iso 传 zh_cn 与 en_us 得到不同字符串(绝对日期档)', () => {
    const now = Date.parse('2026-07-31T12:00:00Z')
    const iso = new Date(now - 200000 * 1000).toISOString()
    const zhOut = relTime(iso, now, t, 'zh_cn')
    const enOut = relTime(iso, now, t, 'en_us')
    expect(zhOut).not.toBe(enOut)
  })
})
