import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import SkillGroup from './SkillGroup.vue'
import type { Skill } from '../../../types/skill'

// Aligned with Vue2 src/views/AI/Skills/SkillGroup.vue (64 lines).
// Shared constraint §9: always construct test data as multi-item arrays, avoiding weak
// discriminating patterns like testing .some/.every on single-element arrays (with a single
// item, "only it is active" and "the first item is active" can't be distinguished).

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
  it('expanded by default, renders all items', () => {
    const items = [makeSkill({ id: 'a' }), makeSkill({ id: 'b' }), makeSkill({ id: 'c' })]
    const w = mountGroup({ label: '内置技能', items, activeId: null })
    expect(w.find('.sk-group-label').attributes('data-collapsed')).toBe('false')
    expect(w.findAll('.sk-item')).toHaveLength(3)
    expect(w.find('.sk-group-count').text()).toBe('3')
  })

  it('clicking the group title collapses and hides the items; clicking again restores them', async () => {
    const items = [makeSkill({ id: 'a' }), makeSkill({ id: 'b' })]
    const w = mountGroup({ label: '我的技能', items, activeId: null })
    await w.find('.sk-group-label').trigger('click')
    expect(w.find('.sk-group-label').attributes('data-collapsed')).toBe('true')
    expect(w.findAll('.sk-item')).toHaveLength(0)

    await w.find('.sk-group-label').trigger('click')
    expect(w.find('.sk-group-label').attributes('data-collapsed')).toBe('false')
    expect(w.findAll('.sk-item')).toHaveLength(2)
  })

  it('clicking an item emits pick with the correct id (multi-item case verifies it\'s not always the first item)', async () => {
    const items = [makeSkill({ id: 'a' }), makeSkill({ id: 'b' }), makeSkill({ id: 'c' })]
    const w = mountGroup({ label: 'g', items, activeId: null })
    await w.findAll('.sk-item')[1].trigger('click')
    expect(w.emitted('pick')).toEqual([['b']])

    await w.findAll('.sk-item')[2].trigger('click')
    expect(w.emitted('pick')).toEqual([['b'], ['c']])
  })

  it('data-active is true only for the entry matching activeId, false for the rest', () => {
    const items = [makeSkill({ id: 'a' }), makeSkill({ id: 'b' }), makeSkill({ id: 'c' })]
    const w = mountGroup({ label: 'g', items, activeId: 'b' })
    const rows = w.findAll('.sk-item')
    expect(rows.map((r) => r.attributes('data-active'))).toEqual(['false', 'true', 'false'])
  })

  it('data-disabled is true only for the entry with enabled=false, false for the rest; a disabled entry carries the「已关闭」badge', () => {
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

  it('each of the three trigger values maps to the correct data-kind and short tag copy', () => {
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

  it('an unknown trigger value falls into the manual branch (aligned with Vue2 :56 triggerKind\'s fallback)', () => {
    const items = [makeSkill({ id: 'a', trigger: 'unknown-thing' }), makeSkill({ id: 'b', trigger: 'auto' })]
    const w = mountGroup({ label: 'g', items, activeId: null })
    const tags = w.findAll('.sk-item-tag')
    expect(tags[0].attributes('data-kind')).toBe('manual')
    expect(tags[0].text()).toBe('手动')
    expect(tags[1].attributes('data-kind')).toBe('auto')
  })

  it("author='You' is localized to「你」, other real names in the same group render as-is", () => {
    const items = [
      makeSkill({ id: 'a', author: 'You' }),
      makeSkill({ id: 'b', author: 'Bob Chen' }),
    ]
    const w = mountGroup({ label: 'g', items, activeId: null })
    const rows = w.findAll('.sk-item')
    expect(rows[0].find('.sk-item-meta span').text()).toBe('你')
    expect(rows[1].find('.sk-item-meta span').text()).toBe('Bob Chen')
  })

  it('the run count uses {count} 次运行 and is formatted via toLocaleString; missing calls defaults to 0', () => {
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
