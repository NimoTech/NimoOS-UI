import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import type { Skill } from '../../../types/skill'
import SkillGroup from '../skills/SkillGroup.vue'

// SP8-P3a Task 6 —— 承接 Vue2 src/views/AI/Skills/SkillsSection.vue(226 行)只读半。
// 公共约束 §9:vi.mock 骨架用 vi.hoisted() 避免 ESM 提升的 TDZ ReferenceError。
const h = vi.hoisted(() => ({ listSkills: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))

// SkillDetail.vue 内部 useRouter()('在对话中试用'按钮),本文件不测试该交互,
// 但挂载 SkillsSection 会一并挂载 SkillDetail,必须提供替身避免真实 vue-router
// 报错(同 SkillDetail.test.ts 先例)。
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

import SkillsSection from './SkillsSection.vue'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountSection = () => mount(SkillsSection, { global: { plugins: [i18n] } })
const flush = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'sk-1',
    name: 'weekly-report',
    title: 'Weekly Report',
    description: 'Summarizes the week and posts it to the family channel.',
    trigger: 'manual',
    trigger_human: 'Manual',
    color: 'blue',
    icon: 'sparkle',
    enabled: true,
    system: true,
    author: 'Nimo',
    last_used: '',
    calls: 0,
    files: [],
    examples: [],
    md: '',
    ...overrides,
  }
}

describe('SkillsSection(只读半)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    h.listSkills.mockReset()
    push.mockClear()
  })

  it('挂载即加载,渲染内置/我的两组,且每组各自只含对应 system 归属的技能', async () => {
    h.listSkills.mockResolvedValue([
      makeSkill({ id: 'a', name: 'built-a', title: 'Built A', system: true }),
      makeSkill({ id: 'b', name: 'mine-b', title: 'Mine B', system: false }),
    ])
    const w = mountSection()
    await flush()
    const groupLabels = w.findAll('.sk-group-label').map((el) => el.text())
    expect(groupLabels).toHaveLength(2)
    expect(groupLabels[0]).toContain('内置技能')
    expect(groupLabels[1]).toContain('我的技能')
    expect(w.findAll('.sk-item')).toHaveLength(2)

    // 评审自查(判据同上):只数总数/只看两条标签文案,不足以钉住「builtIn/personal
    // 两个 computed 的 filter 条件被写反」这类回归(总数与标签都不变,只是内容
    // 装错组)——直接查每个 SkillGroup 实例收到的 props,而不是依赖 DOM 顺序推断。
    const groups = w.findAllComponents(SkillGroup)
    expect(groups).toHaveLength(2)
    expect(groups[0].props('label')).toBe('内置技能')
    expect(groups[0].props('items').map((s: Skill) => s.name)).toEqual(['built-a'])
    expect(groups[1].props('label')).toBe('我的技能')
    expect(groups[1].props('items').map((s: Skill) => s.name)).toEqual(['mine-b'])
  })

  // 单层取数口径(正)——公共约束 §4 / brief §6.3:裸数组是真实契约形状,必须非空。
  it('裸数组 mock → 列表非空(单层取数,不再多剥一层 .data)', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a' })])
    const w = mountSection()
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-col-empty').exists()).toBe(false)
  })

  // 单层取数口径(反)—— 钉住口径:若未来有人把 reload() 改回 Vue2 的
  // `resp.data`(多剥一层 axios 层),这条必须变红。给出 axios 形状的 mock,
  // 断言列表为空,证明本仓消费端就是单层取数。
  it('给 { data: [...] } 形状(axios 层)时列表为空——证明本仓是单层取数,不是给实现留退路', async () => {
    h.listSkills.mockResolvedValue({ data: [makeSkill({ id: 'a' })] } as unknown as Skill[])
    const w = mountSection()
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(0)
    expect(w.find('.sk-col-empty').exists()).toBe(true)
  })

  // 评审 Important(独立回合):原先只用一条共享词 'FAMILY' 命中 description,对
  // name/title 两个分支没有独立验证——评审探针删掉 `filtered` 里的 s.name 判断,
  // 9 例仍全绿。改成三条独立用例,每条各配一个「唯一 token 只出现在该字段」的
  // fixture(不与另外两个技能的任何字段重叠),分别断言只命中预期那条、不误伤
  // 另外两条。三个 token 互不包含、互不是彼此子串。
  function threeFieldFixture(): Skill[] {
    return [
      makeSkill({
        id: 'by-name',
        name: 'orion-alpha-token',
        title: 'Skill Alpha',
        description: 'plain description alpha',
        system: true,
      }),
      makeSkill({
        id: 'by-title',
        name: 'plain-name-beta',
        title: 'Zephyr-Beta-Token',
        description: 'plain description beta',
        system: false,
      }),
      makeSkill({
        id: 'by-desc',
        name: 'plain-name-gamma',
        title: 'Skill Gamma',
        description: 'nebula-gamma-token appears here',
        system: false,
      }),
    ]
  }

  it('搜索命中 name 字段(不误伤 title/description 都不含该词的另外两条)', async () => {
    h.listSkills.mockResolvedValue(threeFieldFixture())
    const w = mountSection()
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(3)

    await w.find('.sk-col-search input').setValue('orion-alpha')
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-item-name').text()).toBe('orion-alpha-token')
  })

  it('搜索命中 title 字段(大小写不敏感,不误伤 name/description 都不含该词的另外两条)', async () => {
    h.listSkills.mockResolvedValue(threeFieldFixture())
    const w = mountSection()
    await flush()

    await w.find('.sk-col-search input').setValue('ZEPHYR-BETA')
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-item-name').text()).toBe('plain-name-beta')
  })

  it('搜索命中 description 字段(不误伤 name/title 都不含该词的另外两条)', async () => {
    h.listSkills.mockResolvedValue(threeFieldFixture())
    const w = mountSection()
    await flush()

    await w.find('.sk-col-search input').setValue('nebula-gamma')
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-item-name').text()).toBe('plain-name-gamma')
  })

  it('两种空态文案:无 query 显示"还没有技能…",有 query 显示"没有匹配的技能"+回显 query', async () => {
    h.listSkills.mockResolvedValue([])
    const w = mountSection()
    await flush()
    expect(w.find('.sk-col-empty').text()).toBe('还没有技能,点击 + 添加一个。')

    await w.find('.sk-col-search input').setValue('nope')
    await flush()
    expect(w.find('.sk-col-empty').text()).toContain('没有匹配的技能')
    expect(w.find('.sk-col-empty code').text()).toBe('nope')
  })

  it('点条目切换 activeSkill(右侧详情联动)', async () => {
    h.listSkills.mockResolvedValue([
      makeSkill({ id: 'a', name: 'skill-a', title: 'Skill A', system: true }),
      makeSkill({ id: 'b', name: 'skill-b', title: 'Skill B', system: false }),
    ])
    const w = mountSection()
    await flush()
    // 挂载后默认选中第一项(reload() 里的选中态兜底)。
    expect(w.find('.sk-name span').text()).toBe('Skill A')

    await w.findAll('.sk-item')[1].trigger('click')
    await flush()
    expect(w.find('.sk-name span').text()).toBe('Skill B')
  })

  it('选中项被搜索过滤掉后不崩:详情仍显示原选中项,不强制清空/不抛错', async () => {
    h.listSkills.mockResolvedValue([
      makeSkill({ id: 'a', name: 'weekly-report', title: 'Weekly Report', system: true }),
      makeSkill({ id: 'b', name: 'other', title: 'Other', system: false }),
    ])
    const w = mountSection()
    await flush()
    expect(w.find('.sk-name span').text()).toBe('Weekly Report')

    // 搜索词把当前选中项过滤出左列列表,但 activeSkill 是从全量 skills(非
    // filtered)里查找的(对齐 Vue2 :116-118),详情面板不受影响、也不抛错。
    await w.find('.sk-col-search input').setValue('other')
    await flush()
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-item-name').text()).toBe('other')
    expect(w.find('.sk-name span').text()).toBe('Weekly Report')
  })

  it('reload 失败弹 danger toast 且 loading 复位', async () => {
    h.listSkills.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()
    expect(show).toHaveBeenCalledWith('无法加载技能列表', 3000, 'danger')
    expect(w.find('.sk-spinner').exists()).toBe(false)
  })

  it('刷新按钮触发重新加载', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a' })])
    const w = mountSection()
    await flush()
    expect(h.listSkills).toHaveBeenCalledTimes(1)
    expect(w.findAll('.sk-item')).toHaveLength(1)

    h.listSkills.mockResolvedValue([
      makeSkill({ id: 'a' }),
      makeSkill({ id: 'b', name: 'skill-b', system: false }),
    ])
    await w.find('.icon-btn').trigger('click')
    await flush()
    expect(h.listSkills).toHaveBeenCalledTimes(2)
    expect(w.findAll('.sk-item')).toHaveLength(2)
  })
})
