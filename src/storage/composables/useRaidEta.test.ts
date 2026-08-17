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
  it('prefers rebuild_eta_seconds: does not show the raw bloated kernel string, renders "about H hours M minutes remaining" first', () => {
    const w = mountHost({ ...base, rebuild_eta_seconds: 2 * 3600 + 5 * 60 })
    expect(w.text()).toBe('剩余约 2 小时 5 分钟')
    expect(w.text()).not.toContain('18926')
  })
  it('alternates every 5s: duration ↔ completion time (today/tomorrow/date wording)', async () => {
    vi.setSystemTime(new Date(2026, 7, 12, 10, 0, 0))
    const w = mountHost({ ...base, rebuild_eta_seconds: 2 * 3600 })
    expect(w.text()).toBe('剩余约 2 小时 0 分钟')
    await vi.advanceTimersByTimeAsync(5000)
    expect(w.text()).toBe('预计今天 12:00 完成')
    await vi.advanceTimersByTimeAsync(5000)
    expect(w.text()).toBe('剩余约 2 小时 0 分钟')
  })
  it('crossing midnight → "tomorrow" wording; crossing multiple days → specific-date wording', async () => {
    vi.setSystemTime(new Date(2026, 7, 12, 10, 0, 0))
    const w = mountHost({ ...base, rebuild_eta_seconds: 16 * 3600 })
    await vi.advanceTimersByTimeAsync(5000)
    expect(w.text()).toBe('预计明天 02:00 完成')
    const w2 = mountHost({ ...base, rebuild_eta_seconds: 50 * 3600 })
    await vi.advanceTimersByTimeAsync(5000)
    expect(w2.text()).toBe('预计 8月14日 12:00 完成')
  })
  it('eta = -1 (no rebuild in progress / not enough samples yet, first ~15s after --re-add) → shows "estimating"', () => {
    const w = mountHost({ ...base, rebuild_eta_seconds: -1 })
    expect(w.text()).toBe('正在估算剩余时间…')
  })
  it('duration tiers: minutes / hours+minutes / days+hours+minutes; does not show 0 for under 1 minute', () => {
    expect(mountHost({ ...base, rebuild_eta_seconds: 35 * 60 }).text()).toBe('剩余约 35 分钟')
    expect(mountHost({ ...base, rebuild_eta_seconds: 26 * 3600 + 30 * 60 }).text()).toBe('剩余约 1 天 2 小时 30 分钟')
    expect(mountHost({ ...base, rebuild_eta_seconds: 20 }).text()).toBe('剩余约 1 分钟')
  })
  it('legacy backend (no rebuild_eta_seconds field) falls back to the raw kernel string, with an "estimated completion" label', () => {
    const w = mountHost({ ...base, rebuild_finish: '2min' })
    expect(w.text()).toBe('预计完成 2min')
  })
  it('no eta and no legacy string → empty string (caller does not render)', () => {
    const w = mountHost({ ...base, rebuild_finish: '' })
    expect(w.text()).toBe('')
    expect(mountHost(null).text()).toBe('')
  })
  it('clears the 5s alternating timer on unmount (no leak)', () => {
    const spy = vi.spyOn(window, 'clearInterval')
    const w = mountHost({ ...base, rebuild_eta_seconds: 60 })
    w.unmount()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
