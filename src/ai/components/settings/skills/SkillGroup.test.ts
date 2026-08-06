import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import SkillGroup from './SkillGroup.vue'
import type { Skill } from '../../../types/skill'

// SP8-P3a Task 4 —— 对齐 Vue2 src/views/AI/Skills/SkillGroup.vue(64 行)。
// 公共约束 §9:构造数据一律用多条目数组,避免单元素数组上测 .some/.every 之类
// 判别力弱的写法(单条目时 "只有它 active" 与 "第一条 active" 无法区分)。

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 's1',
    name: 'Skill One',
    title: 'Skill One',
    description: 'does a thing',
    trigger: 'manual',
    trigger_human: 'Manual',
    color: 'blue',
    icon: 'sparkle',
    enabled: true,
    system: false,
    author: 'Alice',
    last_used: '',
    calls: 3,
    files: [],
    examples: [],
    md: '',
    ...overrides,
  }
}

const mountGroup = (props: { label: string; items: Skill[]; activeId: string | null }) =>
  mount(SkillGroup, { props, global: { plugins: [i18n] } })

describe('SkillGroup', () => {
  it('默认展开,渲染全部条目', () => {
    const items = [makeSkill({ id: 'a' }), makeSkill({ id: 'b' }), makeSkill({ id: 'c' })]
    const w = mountGroup({ label: '内置技能', items, activeId: null })
    expect(w.find('.sk-group-label').attributes('data-collapsed')).toBe('false')
    expect(w.findAll('.sk-item')).toHaveLength(3)
    expect(w.find('.sk-group-count').text()).toBe('3')
  })

  it('点击组标题折叠后隐藏条目,再点一次恢复展示', async () => {
    const items = [makeSkill({ id: 'a' }), makeSkill({ id: 'b' })]
    const w = mountGroup({ label: '我的技能', items, activeId: null })
    await w.find('.sk-group-label').trigger('click')
    expect(w.find('.sk-group-label').attributes('data-collapsed')).toBe('true')
    expect(w.findAll('.sk-item')).toHaveLength(0)

    await w.find('.sk-group-label').trigger('click')
    expect(w.find('.sk-group-label').attributes('data-collapsed')).toBe('false')
    expect(w.findAll('.sk-item')).toHaveLength(2)
  })

  it('点击条目 emit pick 且携带正确的 id(多条目验证不是恒定第一项)', async () => {
    const items = [makeSkill({ id: 'a' }), makeSkill({ id: 'b' }), makeSkill({ id: 'c' })]
    const w = mountGroup({ label: 'g', items, activeId: null })
    await w.findAll('.sk-item')[1].trigger('click')
    expect(w.emitted('pick')).toEqual([['b']])

    await w.findAll('.sk-item')[2].trigger('click')
    expect(w.emitted('pick')).toEqual([['b'], ['c']])
  })

  it('data-active 只在匹配 activeId 的那一条为 true,其余为 false', () => {
    const items = [makeSkill({ id: 'a' }), makeSkill({ id: 'b' }), makeSkill({ id: 'c' })]
    const w = mountGroup({ label: 'g', items, activeId: 'b' })
    const rows = w.findAll('.sk-item')
    expect(rows.map((r) => r.attributes('data-active'))).toEqual(['false', 'true', 'false'])
  })

  it('data-disabled 只在 enabled=false 的那一条为 true,其余为 false;禁用条附带「已关闭」徽标', () => {
    const items = [
      makeSkill({ id: 'a', enabled: true }),
      makeSkill({ id: 'b', enabled: false }),
      makeSkill({ id: 'c', enabled: true }),
    ]
    const w = mountGroup({ label: 'g', items, activeId: null })
    const rows = w.findAll('.sk-item')
    expect(rows.map((r) => r.attributes('data-disabled'))).toEqual(['false', 'true', 'false'])
    expect(rows[0].find('.sk-item-off').exists()).toBe(false)
    expect(rows[1].find('.sk-item-off').exists()).toBe(true)
    expect(rows[1].find('.sk-item-off').text()).toBe('已关闭')
    expect(rows[2].find('.sk-item-off').exists()).toBe(false)
  })

  it('三种 trigger 各自映射到正确的 data-kind 与短标签文案', () => {
    const items = [
      makeSkill({ id: 'a', trigger: 'auto' }),
      makeSkill({ id: 'b', trigger: 'slash' }),
      makeSkill({ id: 'c', trigger: 'manual' }),
    ]
    const w = mountGroup({ label: 'g', items, activeId: null })
    const tags = w.findAll('.sk-item-tag')
    expect(tags.map((t) => t.attributes('data-kind'))).toEqual(['auto', 'slash', 'manual'])
    expect(tags.map((t) => t.text())).toEqual(['自动', '命令', '手动'])
  })

  it('未知 trigger 值落到 manual 分支(对齐 Vue2 :56 triggerKind 的兜底)', () => {
    const items = [makeSkill({ id: 'a', trigger: 'unknown-thing' }), makeSkill({ id: 'b', trigger: 'auto' })]
    const w = mountGroup({ label: 'g', items, activeId: null })
    const tags = w.findAll('.sk-item-tag')
    expect(tags[0].attributes('data-kind')).toBe('manual')
    expect(tags[0].text()).toBe('手动')
    expect(tags[1].attributes('data-kind')).toBe('auto')
  })

  it("author='You' 被本地化成「你」,同组里其它真实人名原样显示", () => {
    const items = [
      makeSkill({ id: 'a', author: 'You' }),
      makeSkill({ id: 'b', author: 'Bob Chen' }),
    ]
    const w = mountGroup({ label: 'g', items, activeId: null })
    const rows = w.findAll('.sk-item')
    expect(rows[0].find('.sk-item-meta span').text()).toBe('你')
    expect(rows[1].find('.sk-item-meta span').text()).toBe('Bob Chen')
  })

  it('运行次数用 {count} 次运行 且经过 toLocaleString 格式化,calls 缺省当 0', () => {
    const items = [
      makeSkill({ id: 'a', calls: 1234 }),
      makeSkill({ id: 'b', calls: 0 }),
      makeSkill({ id: 'c', calls: undefined as unknown as number }),
    ]
    const w = mountGroup({ label: 'g', items, activeId: null })
    const rows = w.findAll('.sk-item')
    expect(rows[0].find('.sk-item-meta').text()).toContain('1,234 次运行')
    expect(rows[1].find('.sk-item-meta').text()).toContain('0 次运行')
    expect(rows[2].find('.sk-item-meta').text()).toContain('0 次运行')
  })
})
