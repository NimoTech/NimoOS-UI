import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { RaidStatus } from '@nimotech/nimoos-service'
import RaidReplacingCard from './RaidReplacingCard.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const task = { arrayId: '1', arrayName: 'Main-storage', oldPath: '/dev/sda', newPath: '/dev/sdd' }
const mountCard = (status?: Record<string, unknown> | null) =>
  mount(RaidReplacingCard, {
    props: { task, status: status as unknown as RaidStatus | null },
    global: { plugins: [i18n] },
  })

describe('RaidReplacingCard', () => {
  it('显示阵列名与 旧盘 → 新盘', () => {
    const w = mountCard(null)
    expect(w.text()).toContain('Main-storage')
    expect(w.text()).toContain('/dev/sda')
    expect(w.text()).toContain('/dev/sdd')
    expect(w.text()).toContain('替换中')
  })

  // 混合进度第一段:内核尚未报数(rebuild_pct = -1)。这里必须是不确定态扫动条,
  // 不能显示 "0%" —— 刚提交那几秒显示 0% 会看起来像卡死。
  it('rebuild_pct = -1 → 不确定态扫动条,不显示百分比数字', () => {
    const w = mountCard({ rebuild_pct: -1, rebuild_finish: '', rebuild_speed: '' })
    expect(w.find('.rpc-fill-indet').exists()).toBe(true)
    expect(w.find('.rpc-fill-det').exists()).toBe(false)
    expect(w.find('.rpc-pct').exists()).toBe(false)
    expect(w.text()).not.toContain('%')
  })

  it('status 缺失 → 同样落不确定态', () => {
    const w = mountCard(null)
    expect(w.find('.rpc-fill-indet').exists()).toBe(true)
    expect(w.find('.rpc-pct').exists()).toBe(false)
  })

  // 混合进度第二段:内核开始报数 → 真实百分比条 + 数字 + 剩余时间 + 速度
  it('rebuild_pct >= 0 → 确定态进度条 + 百分比 + 剩余时间 + 速度', () => {
    const w = mountCard({ rebuild_pct: 67.4, rebuild_finish: '12.3min', rebuild_speed: '88888K/sec' })
    expect(w.find('.rpc-fill-indet').exists()).toBe(false)
    const det = w.find('.rpc-fill-det')
    expect(det.exists()).toBe(true)
    expect(det.attributes('style')).toContain('width: 67.4%')
    expect(w.find('.rpc-pct').text()).toBe('67.4%')
    expect(w.text()).toContain('12.3min')
    expect(w.text()).toContain('88888K/sec')
  })

  it('rebuild_pct = 0 属"已开始报数",走确定态(区别于 -1)', () => {
    const w = mountCard({ rebuild_pct: 0, rebuild_finish: '', rebuild_speed: '' })
    expect(w.find('.rpc-fill-det').exists()).toBe(true)
    expect(w.find('.rpc-pct').text()).toBe('0%')
  })

  it('百分比夹在 0..100(后端异常值不撑破进度条)', () => {
    expect(mountCard({ rebuild_pct: 140 }).find('.rpc-fill-det').attributes('style')).toContain('width: 100%')
  })

  it('✕ 逃生门 emit dismiss(重建挂住时用户能关掉看板)', async () => {
    const w = mountCard({ rebuild_pct: -1 })
    await w.find('.rpc-dismiss').trigger('click')
    expect(w.emitted('dismiss')).toHaveLength(1)
  })
})
