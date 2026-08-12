import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { RaidReattachableMember } from '@nimotech/nimoos-service'
import RaidReclaimCard from './RaidReclaimCard.vue'
import zh from '../../i18n/zh_cn'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountCard = (members: RaidReattachableMember[], busy = false) =>
  mount(RaidReclaimCard, { props: { members, busy }, global: { plugins: [i18n] } })

const M = (o: Partial<RaidReattachableMember> = {}): RaidReattachableMember => ({
  path: '/dev/sdc',
  serial: 'WD-XYZ123',
  role: 'Active device 1',
  last_update: 'Wed Aug 12 03:43:02 2026',
  ...o,
})

describe('RaidReclaimCard', () => {
  it('提示句含 serial(身份首选 serial,不是 path)', () => {
    const w = mountCard([M()])
    expect(w.find('.rrc-hint').text()).toContain('WD-XYZ123')
    expect(w.find('.rrc-hint').text()).not.toContain('/dev/sdc')
    expect(w.find('.rrc-hint').text()).toContain('已插回')
  })
  it('无 serial 的盘退回 path', () => {
    const w = mountCard([M({ serial: '' })])
    expect(w.find('.rrc-hint').text()).toContain('/dev/sdc')
    expect(w.find('.rrc-id').text()).toBe('/dev/sdc')
  })
  it('多盘:serial 逗号连接;逐盘行展示 role 与 last_update(超块字符串仅插值渲染)', () => {
    const w = mountCard([M(), M({ path: '/dev/sdd', serial: 'WD-ABC999', role: 'Active device 2' })])
    expect(w.find('.rrc-hint').text()).toContain('WD-XYZ123, WD-ABC999')
    const rows = w.findAll('.rrc-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Active device 1')
    expect(rows[0].text()).toContain('Wed Aug 12 03:43:02 2026')
  })
  // 超块字段是不可信外部字符串 —— 必须按文本渲染,不能变成 DOM(红线:只 {{ }} 插值)
  it('role 里的 HTML 按文本渲染,不注入 DOM', () => {
    const w = mountCard([M({ role: '<img src=x onerror=alert(1)>' })])
    expect(w.find('.rrc-row img').exists()).toBe(false)
    expect(w.find('.rrc-row').text()).toContain('<img')
  })
  it('点按钮 emit reclaim;busy 时按钮禁用', async () => {
    const w = mountCard([M()])
    await w.find('.rrc-btn').trigger('click')
    expect(w.emitted('reclaim')).toHaveLength(1)
    const busy = mountCard([M()], true)
    expect(busy.find('.rrc-btn').attributes('disabled')).toBeDefined()
  })
})
