import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, type PropType } from 'vue'
import { createI18n } from 'vue-i18n'
import type { RaidStatus } from '@nimotech/nimoos-service'
import { useRaidEta } from './useRaidEta'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

const Host = defineComponent({
  props: { status: { type: Object as PropType<RaidStatus | null>, default: null } },
  setup(props) {
    const { etaText } = useRaidEta(() => props.status)
    return () => h('span', etaText.value)
  },
})
const mountHost = (status: Record<string, unknown> | null) =>
  mount(Host, { props: { status: status as RaidStatus | null }, global: { plugins: [i18n] } })

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

const base = { live_state: 'recovering', rebuild_pct: 12, rebuild_finish: '18926.6min', rebuild_speed: '1M/s', total_bytes: 0, used_bytes: 0, free_bytes: 0, members: [] }

describe('useRaidEta', () => {
  it('优先 rebuild_eta_seconds:不显示内核膨胀串,先给「剩余约 时长」', () => {
    const w = mountHost({ ...base, rebuild_eta_seconds: 2 * 3600 + 5 * 60 })
    expect(w.text()).toBe('剩余约 2 小时 5 分钟')
    expect(w.text()).not.toContain('18926')
  })
  it('每 5 秒交替:时长 ↔ 完成时刻(今天/明天/日期句式)', async () => {
    vi.setSystemTime(new Date(2026, 7, 12, 10, 0, 0))
    const w = mountHost({ ...base, rebuild_eta_seconds: 2 * 3600 })
    expect(w.text()).toBe('剩余约 2 小时 0 分钟')
    await vi.advanceTimersByTimeAsync(5000)
    expect(w.text()).toBe('预计今天 12:00 完成')
    await vi.advanceTimersByTimeAsync(5000)
    expect(w.text()).toBe('剩余约 2 小时 0 分钟')
  })
  it('跨午夜 → 明天句式;跨多天 → 具体日期句式', async () => {
    vi.setSystemTime(new Date(2026, 7, 12, 10, 0, 0))
    const w = mountHost({ ...base, rebuild_eta_seconds: 16 * 3600 })
    await vi.advanceTimersByTimeAsync(5000)
    expect(w.text()).toBe('预计明天 02:00 完成')
    const w2 = mountHost({ ...base, rebuild_eta_seconds: 50 * 3600 })
    await vi.advanceTimersByTimeAsync(5000)
    expect(w2.text()).toBe('预计 8月14日 12:00 完成')
  })
  it('eta = -1(没有重建/样本不够,--re-add 后头 ~15s)→ 正在估算', () => {
    const w = mountHost({ ...base, rebuild_eta_seconds: -1 })
    expect(w.text()).toBe('正在估算剩余时间…')
  })
  it('时长分档:分钟 / 小时+分钟 / 天+小时+分钟;不足 1 分钟不显示 0', () => {
    expect(mountHost({ ...base, rebuild_eta_seconds: 35 * 60 }).text()).toBe('剩余约 35 分钟')
    expect(mountHost({ ...base, rebuild_eta_seconds: 26 * 3600 + 30 * 60 }).text()).toBe('剩余约 1 天 2 小时 30 分钟')
    expect(mountHost({ ...base, rebuild_eta_seconds: 20 }).text()).toBe('剩余约 1 分钟')
  })
  it('老后端(无 rebuild_eta_seconds 字段)回退内核原始串,带「预计完成」标签', () => {
    const w = mountHost({ ...base, rebuild_finish: '2min' })
    expect(w.text()).toBe('预计完成 2min')
  })
  it('既无 eta 也无 legacy 串 → 空串(调用方不渲染)', () => {
    const w = mountHost({ ...base, rebuild_finish: '' })
    expect(w.text()).toBe('')
    expect(mountHost(null).text()).toBe('')
  })
  it('卸载时清掉 5s 交替定时器(不泄漏)', () => {
    const spy = vi.spyOn(window, 'clearInterval')
    const w = mountHost({ ...base, rebuild_eta_seconds: 60 })
    w.unmount()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
