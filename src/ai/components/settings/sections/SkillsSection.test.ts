import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import type { Skill } from '../../../types/skill'
import SkillGroup from '../skills/SkillGroup.vue'
import SkillDetail from '../skills/SkillDetail.vue'

// SP8-P3a Task 6 —— 承接 Vue2 src/views/AI/Skills/SkillsSection.vue(226 行)只读半。
// SP8-P3b Task 8 —— 加四个写操作(onToggle/onDelete/onCreate/onTest)+ `+` 按钮接线。
// 公共约束 §9:vi.mock 骨架用 vi.hoisted() 避免 ESM 提升的 TDZ ReferenceError。
const h = vi.hoisted(() => ({
  listSkills: vi.fn(),
  updateSkill: vi.fn(),
  deleteSkill: vi.fn(),
  createSkill: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))

// SkillDetail.vue 内部 useRouter()('在对话中试用'按钮),本文件不测试该交互,
// 但挂载 SkillsSection 会一并挂载 SkillDetail,必须提供替身避免真实 vue-router
// 报错(同 SkillDetail.test.ts 先例)。
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

import SkillsSection from './SkillsSection.vue'
import { useToast } from '../../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
// Task 8:AddSkillModal 走 SkModal(reka Dialog),portal 目标默认 '.set-app'(见
// SkModal.vue 头注释 D1)——attachTo document.body + 单独挂一个 .set-app host,
// 手法同 ChannelsSection.test.ts。对既有(P3a)只读半用例无副作用,只读半从不打开弹窗。
const mountSection = () => mount(SkillsSection, { global: { plugins: [i18n] }, attachTo: document.body })
const flush = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}
// AddSkillModal 打开时的聚焦覆盖用 setTimeout(fn, 0)(宏任务,见该组件头注释「reka 初始
// 焦点实测结论」),纯微任务级的 flush() 追不上;先例 AddSkillModal.test.ts::macroFlush。
const macroFlush = async () => { await flush(); await new Promise((r) => setTimeout(r, 0)); await flush() }

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
    h.updateSkill.mockReset()
    h.deleteSkill.mockReset()
    h.createSkill.mockReset()
    push.mockClear()
    // SkModal 的 DialogPortal 目标元素必须在组件挂载前就存在于 DOM(同上方注释)。
    const host = document.createElement('div')
    host.className = 'set-app'
    document.body.appendChild(host)
  })

  afterEach(() => {
    document.body.innerHTML = ''
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

// ============================================================================
// SP8-P3b Task 8 —— `+` 按钮 + 四个写操作接线。
//
// 除新建流程外,四个动作走 `w.findComponent(SkillDetail).vm.$emit(...)` 直接触发
// (先例:本文件同一 SkillDetail 树里的 TestPanel 用 `tp.vm.$emit('test')`,见
// `SkillDetail.test.ts:665`)——SkillDetail 自己的 UI 交互(开关点击/菜单/确认弹窗)
// 已在 SkillDetail.test.ts 覆盖,这里只测 SkillsSection 收到 emit 后的处理逻辑
// (单层取数/busy 生命周期/activeId 落位条件),用直接 emit 而不是重新走一遍点击链路,
// 也能覆盖 brief §10.2 明确要求的「删的不是当前选中项」这种用点击链路走不到的场景
// (UI 上只有 activeSkill 会渲染删除入口)。
// ============================================================================
describe('SkillsSection(P3b 写操作半)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    h.listSkills.mockReset()
    h.updateSkill.mockReset()
    h.deleteSkill.mockReset()
    h.createSkill.mockReset()
    push.mockClear()
    // SkModal 的 DialogPortal 目标元素必须在组件挂载前就存在于 DOM(同上方只读半 host 手法)。
    const host = document.createElement('div')
    host.className = 'set-app'
    document.body.appendChild(host)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('点击 + 按钮打开新建弹窗(标题正确);再次点击不会叠加打开第二个弹窗', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a' })])
    const w = mountSection()
    await flush()
    expect(document.querySelector('.sk-modal')).toBeNull()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    const titles = document.querySelectorAll('.sk-modal-title')
    expect(titles).toHaveLength(1)
    expect(titles[0].textContent).toBe(zh.aiSkAddTitle)
  })

  it('toggle 成功:后端返回裸 skill,列表项原地替换,toast 按新状态提示对应文案', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', name: 'skill-a', enabled: true })])
    h.updateSkill.mockResolvedValue(makeSkill({ id: 'a', name: 'skill-a', enabled: false }))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('toggle', 'a', false)
    await flush()

    expect(h.updateSkill).toHaveBeenCalledWith('a', { enabled: false })
    // 列表项原地替换成后端返回的新对象(enabled:false → 渲染 off 标记)。
    expect(w.find('.sk-item-off').exists()).toBe(true)
    expect(show).toHaveBeenCalledWith(zh.aiSkPausedToast)
  })

  // 单层取数口径(反)—— 对齐 P3a Task 6 reload() 那两条钉法(第 86/97 行),同一
  // 手法用在 onToggle 上:喂一个 axios 层形状的 mock,证明本仓消费端是单层取数,
  // 不是给实现留“多剥一层也凑合能跑”的退路。
  it('单层取数口径(反):toggle 喂 { data: skill } 信封形状 → 列表项名称变空(不是信封里的真实值),证明消费端是单层取数', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', name: 'skill-a' })])
    h.updateSkill.mockResolvedValue(
      { data: makeSkill({ id: 'a', name: 'renamed', title: 'Renamed' }) } as unknown as Skill,
    )
    const w = mountSection()
    await flush()

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('toggle', 'a', false)
    await flush()

    // 单层取数下,信封对象本身被当成 skill 塞进列表——它没有 `.name` 字段,渲染成
    // 空字符串。若未来有人在 onToggle 里多剥一层 `.data`(回到 Vue2 的缺陷模具),
    // 这里会变成 'renamed',此断言精确报红(RED 探针见任务报告)。
    expect(w.find('.sk-item-name').text()).toBe('')
    expect(w.find('.sk-item-name').text()).not.toBe('renamed')
  })

  it('toggle 飞行中:busy[id]=true 传给 SkillDetail(开关禁用),请求落地后立即清空', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', enabled: true })])
    let resolvePromise: (v: unknown) => void = () => {}
    h.updateSkill.mockImplementation(() => new Promise((res) => { resolvePromise = res }))
    const w = mountSection()
    await flush()

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('toggle', 'a', false)
    await nextTick()
    expect(detail.props('busy')).toEqual({ a: true })

    resolvePromise(makeSkill({ id: 'a', enabled: false }))
    await flush()
    expect(detail.props('busy')).toEqual({})
  })

  it('toggle 失败:danger toast(3000ms),列表项不变', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', name: 'skill-a', enabled: true })])
    h.updateSkill.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('toggle', 'a', false)
    await flush()

    expect(show).toHaveBeenCalledWith(zh.aiSkUpdateFailed, 3000, 'danger')
    // 仍是 enabled:true,不显示 off 标记 —— 列表项没被改动。
    expect(w.find('.sk-item-off').exists()).toBe(false)
  })

  it('删除成功:从列表消失,toast 文案按 system 区分(内置=卸载,用户=删除)', async () => {
    h.listSkills.mockResolvedValue([
      makeSkill({ id: 'a', name: 'skill-a', system: true }),
      makeSkill({ id: 'b', name: 'skill-b', system: false }),
    ])
    h.deleteSkill.mockResolvedValue(undefined)
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('delete', 'a')
    await flush()

    expect(h.deleteSkill).toHaveBeenCalledWith('a')
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(show).toHaveBeenCalledWith('已卸载 skill-a')
  })

  // brief §10.2 明确点名的条件:钉住「只有删的是当前选中项才落到剩余第一项」——
  // 这里删的是 b(非当前选中的 a),activeId 必须原地不动。
  it('删的不是当前选中项时 activeId 不变,详情面板仍显示原选中的技能', async () => {
    h.listSkills.mockResolvedValue([
      makeSkill({ id: 'a', name: 'skill-a', title: 'Skill A' }),
      makeSkill({ id: 'b', name: 'skill-b', title: 'Skill B' }),
    ])
    h.deleteSkill.mockResolvedValue(undefined)
    const w = mountSection()
    await flush()
    expect(w.find('.sk-name span').text()).toBe('Skill A') // reload() 默认选中第一项

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('delete', 'b')
    await flush()

    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-name span').text()).toBe('Skill A') // activeId 未被 b 的删除牵动
  })

  it('删除失败:danger toast,列表项存活', async () => {
    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', name: 'skill-a' })])
    h.deleteSkill.mockRejectedValue(new Error('boom'))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('delete', 'a')
    await flush()

    expect(show).toHaveBeenCalledWith(zh.aiSkDeleteFailed, 3000, 'danger')
    expect(w.findAll('.sk-item')).toHaveLength(1)
  })

  // 必须在改值与点击之间 `await flush()`——`valid` computed 驱动的 `disabled` 属性要等
  // Vue 把新值同步进真实 DOM 后才会摘掉,同一 tick 内连续 set value → click 会点在还
  // 带着 `disabled` 的按钮上(先例:AddSkillModal.test.ts 的 setValue()/click() 之间都有
  // 独立的 `await flush()`)。
  async function fillAndSubmitAddForm(name: string, description: string) {
    const nameEl = document.querySelector('.sk-modal .sk-field:nth-of-type(1) input') as HTMLInputElement
    const descEl = document.querySelector('.sk-modal .sk-field:nth-of-type(2) textarea') as HTMLTextAreaElement
    nameEl.value = name
    nameEl.dispatchEvent(new Event('input'))
    descEl.value = description
    descEl.dispatchEvent(new Event('input'))
    await flush()
    const submitEl = document.querySelector('.sk-modal-foot .sk-btn.primary') as HTMLButtonElement
    submitEl.click()
  }

  it('创建成功:新技能 push 进列表并被选中、弹窗关闭、toast 提示', async () => {
    h.listSkills.mockResolvedValue([])
    h.createSkill.mockResolvedValue(makeSkill({ id: 'new-1', name: 'invoice-tagger', title: 'invoice-tagger' }))
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    const w = mountSection()
    await flush()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    await fillAndSubmitAddForm('invoice-tagger', 'Tags invoices automatically')
    await flush()

    expect(h.createSkill).toHaveBeenCalledTimes(1)
    expect(w.findAll('.sk-item')).toHaveLength(1)
    expect(w.find('.sk-name span').text()).toBe('invoice-tagger') // 新建后立即选中
    expect(document.querySelector('.sk-modal')).toBeNull() // 弹窗已关
    expect(show).toHaveBeenCalledWith('已添加 invoice-tagger')
  })

  it('创建失败(409 skill already exists):行内错误显示 aiSkErrDuplicate 文案,弹窗仍开,列表不变', async () => {
    h.listSkills.mockResolvedValue([])
    h.createSkill.mockRejectedValue({ response: { data: { message: 'skill already exists' } } })
    const w = mountSection()
    await flush()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    await fillAndSubmitAddForm('invoice-tagger', 'Tags invoices automatically')
    await flush()

    const errEl = document.querySelector('.sk-modal .sk-field-err')
    expect(errEl?.textContent).toBe(zh.aiSkErrDuplicate)
    expect(document.querySelector('.sk-modal')).not.toBeNull() // 弹窗仍开,用户能改完重试
    expect(w.findAll('.sk-item')).toHaveLength(0) // 列表不变
  })

  // 关弹窗要清 createError(brief「协调者预先解掉的两处」第 2 处):上一次创建失败留下
  // 的行内错误,取消关闭后再次打开不能残留。
  it('创建失败后取消关闭弹窗,再次打开:行内错误已被清空', async () => {
    h.listSkills.mockResolvedValue([])
    h.createSkill.mockRejectedValue({ response: { data: { message: 'skill already exists' } } })
    const w = mountSection()
    await flush()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    await fillAndSubmitAddForm('invoice-tagger', 'Tags invoices automatically')
    await flush()
    expect(document.querySelector('.sk-modal .sk-field-err')).not.toBeNull()

    const cancelBtn = Array.from(document.querySelectorAll('.sk-modal-foot .sk-btn.ghost'))
      .find((b) => b.textContent?.trim() === zh.aiCancel) as HTMLButtonElement
    cancelBtn.click()
    await flush()
    expect(document.querySelector('.sk-modal')).toBeNull()

    await w.find('.sk-add-btn').trigger('click')
    await macroFlush()
    expect(document.querySelector('.sk-modal .sk-field-err')).toBeNull()
  })

  it('onTest:只改当前选中项的 calls/last_used,不影响其它技能(乐观本地值,不落库)', async () => {
    h.listSkills.mockResolvedValue([
      makeSkill({ id: 'a', name: 'skill-a', title: 'Skill A', calls: 3, last_used: '' }),
      makeSkill({ id: 'b', name: 'skill-b', title: 'Skill B', calls: 5, last_used: '' }),
    ])
    const w = mountSection()
    await flush()
    expect(w.find('.sk-name span').text()).toBe('Skill A') // 默认选中第一项

    const detail = w.findComponent(SkillDetail)
    detail.vm.$emit('test')
    await flush()

    expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).toContain('Just now')
    expect(w.findAll('.sk-meta-cell')[3].find('.total').text()).toBe('· 共 4 次')

    // 切到 b,确认它的数据完全没被污染。
    await w.findAll('.sk-item')[1].trigger('click')
    await flush()
    expect(w.find('.sk-name span').text()).toBe('Skill B')
    expect(w.findAll('.sk-meta-cell')[3].find('.total').text()).toBe('· 共 5 次')
    expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).not.toContain('Just now')
  })
})
