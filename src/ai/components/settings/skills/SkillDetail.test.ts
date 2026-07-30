import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import SkillDetail from './SkillDetail.vue'
import type { Skill } from '../../../types/skill'

// SP8-P3a Task 5 —— 对齐 Vue2 src/views/AI/Skills/SkillDetail.vue(271 行)只读半。
// 公共约束 §9:vi.mock 骨架用 vi.hoisted() 避免 ESM 提升的 TDZ ReferenceError。
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'sk-1',
    name: 'weekly-report',
    title: 'Weekly Report',
    description: 'Summarizes the week and posts it to the family channel.',
    trigger: 'manual',
    // 故意写一个与真实 trigger 语义不符的 trigger_human,专门钉住偏离 4
    // (界面绝不能读这个字段——见下方「trigger_human 陷阱」用例)。
    trigger_human: 'WRONG',
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

const mountDetail = (skill: Skill | null) =>
  mount(SkillDetail, { props: { skill }, global: { plugins: [i18n] } })

describe('SkillDetail(只读半)', () => {
  beforeEach(() => {
    push.mockClear()
  })

  it('空态:skill=null 时展示两行文案,不渲染详情条', () => {
    const w = mountDetail(null)
    expect(w.find('.sk-detail-empty').exists()).toBe(true)
    expect(w.find('.empty-title').text()).toBe('在左侧选择一个技能')
    expect(w.find('.empty-sub').text()).toBe('或者新建一个 —— Nimo 会在触发器命中时自动调用。')
    expect(w.find('.sk-detail-bar').exists()).toBe(false)
  })

  it('顶部条:标题/name code/试用按钮,不渲染开关与更多菜单(P3b 范围)', () => {
    const w = mountDetail(makeSkill({ title: 'Weekly Report', name: 'weekly-report' }))
    expect(w.find('.sk-name span').text()).toBe('Weekly Report')
    expect(w.find('.sk-name code').text()).toBe('weekly-report')
    expect(w.find('.sk-pill-try').exists()).toBe(true)
    expect(w.find('.sk-pill-try').text()).toContain('在对话中试用')
    // §5.2 明确不取的写操作控件,必须完全不出现。
    expect(w.find('.sw').exists()).toBe(false)
    expect(w.find('.sk-pill-more').exists()).toBe(false)
    expect(w.find('.sk-menu').exists()).toBe(false)
  })

  it('四格元信息:状态(启用)/触发方式/来源/上次运行 + 累计次数', () => {
    const w = mountDetail(makeSkill({
      enabled: true,
      trigger: 'manual',
      author: 'Alice',
      last_used: '2026-07-29 08:00',
      calls: 1234,
    }))
    const cells = w.findAll('.sk-meta-cell')
    expect(cells).toHaveLength(4)
    expect(cells[0].find('.lbl').text()).toBe('状态')
    expect(cells[0].find('.val').text()).toContain('已启用')
    expect(cells[0].find('.val').attributes('data-disabled')).toBe('false')
    expect(cells[1].find('.lbl').text()).toBe('触发方式')
    expect(cells[2].find('.lbl').text()).toBe('来源')
    expect(cells[2].find('.val').text()).toBe('Alice')
    expect(cells[3].find('.lbl').text()).toBe('上次运行')
    expect(cells[3].find('.val').text()).toContain('2026-07-29 08:00')
    expect(cells[3].find('.total').text()).toBe('· 共 1,234 次')
  })

  it('状态格:停用态显示「已暂停」且 data-disabled=true', () => {
    const w = mountDetail(makeSkill({ enabled: false }))
    const statusVal = w.findAll('.sk-meta-cell')[0].find('.val')
    expect(statusVal.text()).toContain('已暂停')
    expect(statusVal.attributes('data-disabled')).toBe('true')
  })

  it('状态圆点不带任何内联样式(颜色完全交给 SCSS 的 data-disabled 选择器,不是内联 rgba)', () => {
    const wEnabled = mountDetail(makeSkill({ enabled: true }))
    const wDisabled = mountDetail(makeSkill({ enabled: false }))
    expect(wEnabled.find('.dot').attributes('style')).toBeUndefined()
    expect(wDisabled.find('.dot').attributes('style')).toBeUndefined()
  })

  it('三种 trigger 在详情格的显示:auto=自动触发,manual=手动,slash=/技能名', () => {
    const wAuto = mountDetail(makeSkill({ trigger: 'auto' }))
    expect(wAuto.findAll('.sk-meta-cell')[1].find('.val').text()).toBe('自动触发')

    const wManual = mountDetail(makeSkill({ trigger: 'manual' }))
    expect(wManual.findAll('.sk-meta-cell')[1].find('.val').text()).toBe('手动')

    const wSlash = mountDetail(makeSkill({ trigger: 'slash', name: 'weekly-report' }))
    expect(wSlash.findAll('.sk-meta-cell')[1].find('.val').text()).toBe('/weekly-report')
  })

  it('未知 trigger 原样显示 trigger 字符串本身(triggerLabel 返回 null 的兜底)', () => {
    const w = mountDetail(makeSkill({ trigger: 'some-future-trigger' }))
    expect(w.findAll('.sk-meta-cell')[1].find('.val').text()).toBe('some-future-trigger')
  })

  it('trigger_human 陷阱:trigger=auto 但 trigger_human=WRONG,界面必须显示「自动触发」而不是 WRONG(钉住偏离 4)', () => {
    const w = mountDetail(makeSkill({ trigger: 'auto', trigger_human: 'WRONG' }))
    const text = w.findAll('.sk-meta-cell')[1].find('.val').text()
    expect(text).toBe('自动触发')
    expect(text).not.toContain('WRONG')
    expect(w.text()).not.toContain('WRONG')
  })

  it("author='You' 本地化成「你」,真实人名原样显示", () => {
    const wYou = mountDetail(makeSkill({ author: 'You' }))
    expect(wYou.findAll('.sk-meta-cell')[2].find('.val').text()).toBe('你')

    const wBob = mountDetail(makeSkill({ author: 'Bob Chen' }))
    expect(wBob.findAll('.sk-meta-cell')[2].find('.val').text()).toBe('Bob Chen')
  })

  it('last_used 为空字符串时显示 em dash(—),不做任何相对时间映射', () => {
    const w = mountDetail(makeSkill({ last_used: '' }))
    expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).toContain('—')
  })

  it('描述段:原样显示 description,不经过任何本地化', () => {
    const w = mountDetail(makeSkill({ description: '一段自由文本描述,含标点。' }))
    expect(w.find('.sk-description').text()).toBe('一段自由文本描述,含标点。')
  })

  it('TestPanel 占位:描述段与 SKILL.md 段之间没有渲染任何写操作控件(P3b 范围)', () => {
    const w = mountDetail(makeSkill())
    expect(w.findComponent({ name: 'TestPanel' }).exists()).toBe(false)
    expect(w.find('.sk-test').exists()).toBe(false)
  })

  it('SKILL.md 段:markdown 渲染出真实 HTML(不是转义后的原文本)', () => {
    const w = mountDetail(makeSkill({ md: '# Title\n\nSome **bold** text.' }))
    const mdHtml = w.find('.sk-md').html()
    expect(mdHtml).toContain('<strong>bold</strong>')
    expect(mdHtml).not.toContain('# Title')
  })

  it('SKILL.md 为空字符串时不抛错,渲染空内容', () => {
    const w = mountDetail(makeSkill({ md: '' }))
    expect(w.find('.sk-md').text()).toBe('')
  })

  it('附带文件:逐行渲染 name/size,段头 hint 显示文件数', () => {
    const w = mountDetail(makeSkill({
      files: [
        { name: 'notes.txt', size: '12 B' },
        { name: 'archive.zip', size: '1.0 MB' },
      ],
    }))
    const rows = w.findAll('.sk-file-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].find('.name').text()).toBe('notes.txt')
    expect(rows[0].find('.size').text()).toBe('12 B')
    expect(rows[1].find('.name').text()).toBe('archive.zip')
    expect(rows[1].find('.size').text()).toBe('1.0 MB')
    // 终审 M2:详情页共有 3 个 `.sk-section-hint`(描述段 :152 / SKILL.md 段 :165 /
    // 附带文件段 :175),`w.find()` 只返回第一个(描述段的 hint),原断言只查
    // `.exists()` 命中的是描述段、对 `filesHint` 计算属性(SkillDetail.vue:78)
    // 零覆盖(把 `n` 写死成任意常数仍然全绿)。改成精确定位第三个 hint 并断言
    // 其文案(aiSkNFiles = '{n} 个文件',2 个文件 → '2 个文件')。
    const hints = w.findAll('.sk-section-hint')
    expect(hints).toHaveLength(3)
    expect(hints[2].text()).toBe('2 个文件')
  })

  it('目录尺寸 "(3 files)" 被本地化成中文「3 个文件」,普通文件字节单位原样透传', () => {
    const w = mountDetail(makeSkill({
      files: [
        { name: 'assets', size: '(3 files)' },
        { name: 'notes.txt', size: '12 B' },
      ],
    }))
    const rows = w.findAll('.sk-file-row')
    expect(rows[0].find('.size').text()).toBe('3 个文件')
    expect(rows[1].find('.size').text()).toBe('12 B')
  })

  it('附带文件为空数组时展示空态文案「没有附带文件」', () => {
    const w = mountDetail(makeSkill({ files: [] }))
    const rows = w.findAll('.sk-file-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].find('.name').text()).toBe('没有附带文件')
  })

  it('附带文件为 null(后端 nil slice 序列化坑)时同样展示空态,不抛错', () => {
    const w = mountDetail(makeSkill({ files: null as unknown as Skill['files'] }))
    const rows = w.findAll('.sk-file-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].find('.name').text()).toBe('没有附带文件')
  })

  it('「在对话中试用」:点击 push 到 /ai/agent 并带正确的 skill id 查询参数', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-42' }))
    await w.find('.sk-pill-try').trigger('click')
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({ path: '/ai/agent', query: { skill: 'sk-42' } })
  })
})
