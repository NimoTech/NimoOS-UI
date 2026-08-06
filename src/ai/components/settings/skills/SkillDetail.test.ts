import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { setActivePinia, createPinia } from 'pinia'
import zh from '../../../../i18n/zh_cn'
import SkillDetail from './SkillDetail.vue'
import type { Skill } from '../../../types/skill'

// SP8-P3a Task 5 —— 对齐 Vue2 src/views/AI/Skills/SkillDetail.vue(271 行)只读半。
// SP8-P3b Task 6 —— 加写操作:开关 + 更多菜单(禁用/复制/导出/删除)+ 删除确认弹窗。
// 公共约束 §9:vi.mock 骨架用 vi.hoisted() 避免 ESM 提升的 TDZ ReferenceError。
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

// Task 6 —— 导出按钮走同步 URL builder(不是 axios 调用),复制按钮走
// `useCopyFeedback` 内部的 `copyText`(非安全上下文 execCommand 兜底,见该模块头注释)。
// mock 手法与 McpTokensSection.test.ts 完全一致(同一对函数的既有 mock 先例)。
const h = vi.hoisted(() => ({
  exportSkillURL: vi.fn((id: string) => `/v1/ai/skills/${id}/export?token=abc`),
  copyText: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: { ai: { exportSkillURL: h.exportSkillURL } },
}))
vi.mock('../../../../files/util/clipboard', () => ({ copyText: h.copyText }))

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

// Task 6 —— 删除确认弹窗 portal 到 `.set-app`(见组件头注释「偏离申报 2」/
// SkModal.vue D1),测试须先在 body 里放一个同名宿主,先例 SkModal.test.ts::withHost()。
function withHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'set-app'
  document.body.appendChild(host)
  return host
}

const mountDetail = (skill: Skill | null, props: { busy?: Record<string, boolean> } = {}) =>
  mount(SkillDetail, {
    props: { skill, ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })

// 公共约束 §9:异步断言用 flushPromises(),不用单个 await nextTick()。
const flush = async () => { await flushPromises(); await nextTick() }

describe('SkillDetail(只读半 + P3b 写操作半)', () => {
  let host: HTMLElement

  beforeEach(() => {
    push.mockClear()
    h.exportSkillURL.mockClear()
    h.copyText.mockClear()
    // useCopyFeedback() 内部调用 useToast()(Pinia store),组件 setup() 时无条件
    // 调用一次,故每个测试都要有一个 active Pinia,不只是涉及复制的用例。
    setActivePinia(createPinia())
    host = withHost()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('空态:skill=null 时展示两行文案,不渲染详情条', () => {
    const w = mountDetail(null)
    expect(w.find('.sk-detail-empty').exists()).toBe(true)
    expect(w.find('.empty-title').text()).toBe('在左侧选择一个技能')
    expect(w.find('.empty-sub').text()).toBe('或者新建一个 —— Nimo 会在触发器命中时自动调用。')
    expect(w.find('.sk-detail-bar').exists()).toBe(false)
  })

  // 【反转,SP8-P3b Task 6,公共约束 §9 明确要求「反转不是删除」】P3a 版本断言这
  // 三个写操作控件「必须完全不出现」;P3b 落地后 `.sw`/`.sk-pill-more` 必须渲染,
  // `.sk-menu` 仍是 false ——但语义已经从「永不渲染」变成「默认收起」(菜单展开的
  // 交互由下方专项用例覆盖)。改前/改后原文已贴进任务报告。
  it('顶部条:标题/name code/试用按钮/开关/更多菜单按钮全部渲染(P3b 写操作落地)', () => {
    const w = mountDetail(makeSkill({ title: 'Weekly Report', name: 'weekly-report' }))
    expect(w.find('.sk-name span').text()).toBe('Weekly Report')
    expect(w.find('.sk-name code').text()).toBe('weekly-report')
    expect(w.find('.sk-pill-try').exists()).toBe(true)
    expect(w.find('.sk-pill-try').text()).toContain('在对话中试用')
    expect(w.find('.sw').exists()).toBe(true)
    expect(w.find('.sk-pill-more').exists()).toBe(true)
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

  // 【反转,SP8-P3b Task 7,公共约束 §9 明确要求「反转不是删除」】P3a 版本(改前原文见
  // 上方本次 diff)断言 TestPanel「完全不渲染」;T7 把它挂回 Vue2 :108-112 对应的位置,
  // 现在要断言的是**存在且顺序正确**——不只是"存在"就算数(存在但被塞到文件末尾也会
  // 通过一个弱断言,钉不住"夹在描述段与 SKILL.md 段之间"这个位置要求),所以按 DOM
  // 顺序遍历所有 `.sk-section-title`,断言 TestPanel 自己的段头标题恰好夹在
  // "描述"与"SKILL.md"两个标题之间。
  it('TestPanel 挂载在描述段与 SKILL.md 段之间(P3b 落地,按 DOM 顺序断言,不只是「存在」)', () => {
    const w = mountDetail(makeSkill())
    const tp = w.findComponent({ name: 'TestPanel' })
    expect(tp.exists()).toBe(true)
    const titles = w.findAll('.sk-section-title').map((n) => n.text())
    expect(titles).toEqual(['描述', '沙箱测试', 'SKILL.md', '附带文件'])
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
    // 【SP8-P3b Task 7 更新】TestPanel 挂回描述段与 SKILL.md 段之间后,它自己的段头
    // 也带一个 `.sk-section-hint`(aiSkTestHint),序列从 3 个变成 4 个,「附带文件」
    // 段的 hint 相应从下标 2 挪到下标 3——这是结构性位移,不是断言被削弱。
    const hints = w.findAll('.sk-section-hint')
    expect(hints).toHaveLength(4)
    expect(hints[3].text()).toBe('2 个文件')
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

  // ===== SP8-P3b Task 6 —— 顶部条写操作 + 删除确认弹窗 =====

  it('开关:data-on/aria-checked 反映 enabled,点击 emit toggle(id, !enabled)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-1', enabled: true }))
    const sw = w.find('.sw')
    expect(sw.attributes('data-on')).toBe('true')
    expect(sw.attributes('aria-checked')).toBe('true')
    await sw.trigger('click')
    expect(w.emitted('toggle')).toEqual([['sk-1', false]])
  })

  it('停用态开关:data-on=false,点击 emit toggle(id, true)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-1', enabled: false }))
    const sw = w.find('.sw')
    expect(sw.attributes('data-on')).toBe('false')
    await sw.trigger('click')
    expect(w.emitted('toggle')).toEqual([['sk-1', true]])
  })

  it('busy[id] 为真时开关禁用(aria-disabled=true),为空对象/其它 id 时不禁用', () => {
    const wBusy = mountDetail(makeSkill({ id: 'sk-9' }), { busy: { 'sk-9': true } })
    expect(wBusy.find('.sw').attributes('aria-disabled')).toBe('true')

    const wIdle = mountDetail(makeSkill({ id: 'sk-9' }), { busy: {} })
    expect(wIdle.find('.sw').attributes('aria-disabled')).toBe('false')

    const wOther = mountDetail(makeSkill({ id: 'sk-9' }), { busy: { 'sk-other': true } })
    expect(wOther.find('.sw').attributes('aria-disabled')).toBe('false')
  })

  it('更多菜单:点击 .sk-pill-more 开合', async () => {
    const w = mountDetail(makeSkill())
    expect(w.find('.sk-menu').exists()).toBe(false)
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(false)
  })

  it('更多菜单:外部 mousedown 关闭菜单,菜单内部点击不触发外部关闭逻辑', async () => {
    const w = mountDetail(makeSkill())
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(false)

    // 【P3b 终审 M2】上面只测了"外部"，标题里承诺的"菜单内部点击不触发外部关闭逻辑"
    // 之前零断言——`useClickOutside` 判定用 `el.contains(event.target)`（见该 composable
    // 头注释），`.sk-menu` 是 `menuWrap` 的子元素，在它内部 mousedown 理应被判定为
    // "在内部"、不关闭菜单。这里补回标题承诺的那一半。
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)
    w.find('.sk-menu button').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(true)
  })

  it('菜单项顺序与文案:暂停/启用 → 复制 SKILL.md → 导出技能 → <hr> → 危险项', async () => {
    const w = mountDetail(makeSkill({ enabled: true, system: false }))
    await w.find('.sk-pill-more').trigger('click')
    const menu = w.find('.sk-menu')
    const buttons = menu.findAll('button')
    expect(buttons).toHaveLength(4)
    expect(buttons[0].text()).toContain('临时禁用')
    expect(buttons[1].text()).toContain('复制 SKILL.md')
    expect(buttons[2].text()).toContain('导出技能')
    expect(buttons[3].attributes('data-danger')).toBe('true')
    expect(buttons[3].text()).toContain('删除技能')
    expect(menu.find('hr').exists()).toBe(true)
  })

  it('菜单第一项(暂停/启用):enabled 时文案「临时禁用」,disabled 时文案「启用」,点击都 emit toggle', async () => {
    const wEnabled = mountDetail(makeSkill({ id: 'sk-1', enabled: true }))
    await wEnabled.find('.sk-pill-more').trigger('click')
    const btnsEnabled = wEnabled.findAll('.sk-menu button')
    expect(btnsEnabled[0].text()).toContain('临时禁用')
    await btnsEnabled[0].trigger('click')
    expect(wEnabled.emitted('toggle')).toEqual([['sk-1', false]])
    // closeAnd 先收起菜单再执行动作。
    expect(wEnabled.find('.sk-menu').exists()).toBe(false)

    const wDisabled = mountDetail(makeSkill({ id: 'sk-1', enabled: false }))
    await wDisabled.find('.sk-pill-more').trigger('click')
    const btnsDisabled = wDisabled.findAll('.sk-menu button')
    expect(btnsDisabled[0].text()).toContain('启用')
    await btnsDisabled[0].trigger('click')
    expect(wDisabled.emitted('toggle')).toEqual([['sk-1', true]])
  })

  it('危险项文案:内置技能显示「卸载」,用户技能显示「删除技能」', async () => {
    const wSystem = mountDetail(makeSkill({ system: true }))
    await wSystem.find('.sk-pill-more').trigger('click')
    const dangerSystem = wSystem.findAll('.sk-menu button')[3]
    expect(dangerSystem.text()).toContain('卸载')
    expect(dangerSystem.text()).not.toContain('删除')

    const wUser = mountDetail(makeSkill({ system: false }))
    await wUser.find('.sk-pill-more').trigger('click')
    const dangerUser = wUser.findAll('.sk-menu button')[3]
    expect(dangerUser.text()).toContain('删除技能')
  })

  it('点击「复制 SKILL.md」调用 copyText 传入 skill.md,点击后菜单立即收起', async () => {
    const w = mountDetail(makeSkill({ md: '# Title\n\nBody.' }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[1].trigger('click')
    expect(h.copyText).toHaveBeenCalledWith('# Title\n\nBody.')
    expect(w.find('.sk-menu').exists()).toBe(false)
  })

  it('复制 SKILL.md 为空字符串时,copyText 收到空字符串(不是 undefined)', async () => {
    const w = mountDetail(makeSkill({ md: '' }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[1].trigger('click')
    expect(h.copyText).toHaveBeenCalledWith('')
  })

  it('点击「导出技能」:创建的 <a> 的 href/download 正确且被点击一次', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const w = mountDetail(makeSkill({ id: 'sk-7', name: 'weekly-report' }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[2].trigger('click')

    expect(h.exportSkillURL).toHaveBeenCalledWith('sk-7')
    const anchor = appendSpy.mock.calls.find((c) => c[0] instanceof HTMLAnchorElement)?.[0] as HTMLAnchorElement
    expect(anchor).toBeTruthy()
    expect(anchor.getAttribute('href')).toBe('/v1/ai/skills/sk-7/export?token=abc')
    expect(anchor.getAttribute('download')).toBe('weekly-report.tar.gz')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    // 点击后菜单立即收起。
    expect(w.find('.sk-menu').exists()).toBe(false)

    clickSpy.mockRestore()
    appendSpy.mockRestore()
  })

  it('导出:技能没有 name 时,download 回落成 "skill.tar.gz"', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const w = mountDetail(makeSkill({ id: 'sk-8', name: '' }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[2].trigger('click')

    const anchor = appendSpy.mock.calls.find((c) => c[0] instanceof HTMLAnchorElement)?.[0] as HTMLAnchorElement
    expect(anchor.getAttribute('download')).toBe('skill.tar.gz')

    clickSpy.mockRestore()
    appendSpy.mockRestore()
  })

  it('点击危险项:打开确认弹窗(portal 进 .set-app),菜单同时收起', async () => {
    const w = mountDetail(makeSkill({ system: false }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[3].trigger('click')
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(false)
    expect(host.querySelector('.sk-confirm')).not.toBeNull()
    // 关键断言:弹窗节点落在 .set-app 容器内,不是直挂 body(D1,同 SkModal.test.ts)。
    expect(host.querySelector('.sk-confirm')!.closest('.set-app')).toBe(host)
  })

  it('确认弹窗:内置技能标题/正文(D3 实话文案,不含"重新安装")/按钮/历史运行次数', async () => {
    const w = mountDetail(makeSkill({ system: true, calls: 7, name: 'built-in-skill' }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[3].trigger('click')
    await flush()

    expect(host.querySelector('.sk-confirm-body h3')?.textContent).toBe('卸载这个技能?')
    const body = host.querySelector('.sk-confirm-body p')?.textContent ?? ''
    expect(body).not.toContain('重新安装')
    expect(host.querySelector('.sk-confirm-skill .name')?.textContent).toBe('built-in-skill')
    expect(host.querySelector('.sk-confirm-skill .runs')?.textContent).toBe('历史运行 7 次')
    expect(host.querySelector('.sk-btn.danger')?.textContent).toContain('卸载')
  })

  it('确认弹窗:用户技能标题/正文/按钮文案(与内置技能不同措辞)', async () => {
    const w = mountDetail(makeSkill({ system: false, calls: 7 }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[3].trigger('click')
    await flush()

    expect(host.querySelector('.sk-confirm-body h3')?.textContent).toBe('删除这个技能?')
    expect(host.querySelector('.sk-confirm-body p')?.textContent)
      .toBe('这会永久删除该技能及其 SKILL.md 文件,无法恢复。')
    expect(host.querySelector('.sk-btn.danger')?.textContent).toContain('删除')
    expect(host.querySelector('.sk-btn.danger')?.textContent).not.toContain('卸载')
  })

  it('确认弹窗:点确认按钮 emit delete(id) 且弹窗关闭', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-3', system: false }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[3].trigger('click')
    await flush()

    const confirmBtn = host.querySelector('.sk-btn.danger') as HTMLButtonElement
    confirmBtn.click()
    await flush()

    expect(w.emitted('delete')).toEqual([['sk-3']])
    expect(host.querySelector('.sk-confirm')).toBeNull()
  })

  it('确认弹窗:点取消按钮不 emit delete,弹窗关闭', async () => {
    const w = mountDetail(makeSkill({ system: false }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[3].trigger('click')
    await flush()

    const cancelBtn = host.querySelector('.sk-btn.ghost') as HTMLButtonElement
    cancelBtn.click()
    await flush()

    expect(w.emitted('delete')).toBeUndefined()
    expect(host.querySelector('.sk-confirm')).toBeNull()
  })

  it('skill.id 变化时复位菜单(菜单打开中途切换技能,菜单自动收起)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-1' }))
    await w.find('.sk-pill-more').trigger('click')
    expect(w.find('.sk-menu').exists()).toBe(true)

    await w.setProps({ skill: makeSkill({ id: 'sk-2' }) })
    await flush()
    expect(w.find('.sk-menu').exists()).toBe(false)
  })

  it('skill.id 变化时复位确认弹窗(弹窗打开中途切换技能,弹窗自动关闭)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-1', system: false }))
    await w.find('.sk-pill-more').trigger('click')
    await w.findAll('.sk-menu button')[3].trigger('click')
    await flush()
    expect(host.querySelector('.sk-confirm')).not.toBeNull()

    await w.setProps({ skill: makeSkill({ id: 'sk-2' }) })
    await flush()
    expect(host.querySelector('.sk-confirm')).toBeNull()
  })

  // ===== SP8-P3b Task 7 —— D4 弹窗(停用技能「在对话中试用」先提示) + TestPanel test 转发 =====
  // D4 弹窗走 SkModal(标准壳),不是上面删除确认弹窗那套裸 reka 原语,故断言走
  // `.sk-modal-title`/`.sk-btn.primary`/`.sk-btn.ghost` 这套 SkModal 既有先例
  // (同 ChannelsSection.test.ts「3. genCode…」用例查 `.sk-modal` 的手法),而不是
  // `.sk-confirm*`(那是删除弹窗专属的类名)。

  it('D4:停用技能点「在对话中试用」不跳转,弹出确认弹窗(标题/正文命中 i18n 文案)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-1', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    expect(push).not.toHaveBeenCalled()
    expect(host.querySelector('.sk-modal-title')?.textContent).toBe('该技能已停用')
    expect(host.querySelector('.sk-modal')?.textContent).toContain('停用的技能不会被加载')
  })

  // 【评审 Important 1,任务书简化了设计文档 §9.4:「成功才跳转;失败则留在弹窗 +
  // danger toast,不跳转」——弹窗必须保持打开直到父组件真的把 enabled 改成 true,不是
  // 发 toggle 那一刻就关。下面三条覆盖 ①点了之后弹窗仍开且未 push ②enabled 变 true
  // 后弹窗关闭+push ③失败(prop 不变)→ 弹窗仍开、永不 push。】

  it('D4「启用并试用」:点击后弹窗仍开、未 push,只 emit toggle(id,true)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-5', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()

    const enableBtn = host.querySelector('.sk-btn.primary') as HTMLButtonElement
    enableBtn.click()
    await flush()
    expect(w.emitted('toggle')).toEqual([['sk-5', true]])
    // 发 toggle 那一刻还没跳转——父组件还没告知启用是否成功,弹窗必须留在原地
    // (设计文档 §9.4,不是「发了就关」)。
    expect(push).not.toHaveBeenCalled()
    expect(host.querySelector('.sk-modal-title')?.textContent).toBe('该技能已停用')
  })

  it('D4「启用并试用」:父组件把 enabled 真的改成 true(toggle 成功)后,弹窗关闭 + push 同一步发生', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-5', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
    await flush()

    await w.setProps({ skill: makeSkill({ id: 'sk-5', enabled: true }) })
    await flush()
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({ path: '/ai/agent', query: { skill: 'sk-5' } })
    expect(host.querySelector('.sk-modal')).toBeNull()
  })

  it('D4:toggle 失败(父组件不改 enabled)→ 弹窗仍开、永不 push', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-6', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
    await flush()
    expect(w.emitted('toggle')).toEqual([['sk-6', true]])

    // 父组件请求失败:enabled 原样不变(仍是 false)——不是"取消"，是失败态。
    // 弹窗必须留在原地(设计文档 §9.4),用户能再点一次或点取消;danger toast 由
    // 父组件(T8 SkillsSection.onToggle)负责,本组件不重复发。
    await w.setProps({ skill: makeSkill({ id: 'sk-6', enabled: false }) })
    await flush()
    expect(push).not.toHaveBeenCalled()
    expect(host.querySelector('.sk-modal-title')?.textContent).toBe('该技能已停用')
  })

  it('D4:点「取消」关闭弹窗,不 push、不 emit toggle', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-7', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    ;(host.querySelector('.sk-btn.ghost') as HTMLButtonElement).click()
    await flush()
    expect(host.querySelector('.sk-modal')).toBeNull()
    expect(push).not.toHaveBeenCalled()
    expect(w.emitted('toggle')).toBeUndefined()
  })

  // 【P3b 终审 I1】点「取消」/`skill.id` 变化之外,SkModal 自带的 X 关闭按钮
  // (`.sk-x`)、reka 的 Esc、点遮罩都只走 `@update:open`——此前这条路径没清
  // `pendingTryId`,挂号悬着后,用户之后随便用顶部条开关把这个技能启用一次(与
  // 「启用并试用」毫无关系的操作)也会被误判成"待跳转"而 push。RED 验证:把
  // `onTryModalOpenChange` 里的 `if (!v) pendingTryId.value = null` 删掉 → 这条精确
  // 报红(push 被调用 1 次,断言期望 0 次)。
  it('D4:用 .sk-x 关闭弹窗(不是取消按钮)后清挂号——之后手动开关启用该技能不应触发 push', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-8', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
    await flush()
    expect(w.emitted('toggle')).toEqual([['sk-8', true]])

    // toggle 请求“失败”(父组件从不把 enabled 改成 true)——用 X 关掉弹窗,而不是点取消。
    ;(host.querySelector('.sk-x') as HTMLButtonElement).click()
    await flush()
    expect(host.querySelector('.sk-modal')).toBeNull()

    // 之后用户自己在顶部条把这个技能启用(与「启用并试用」无关的独立操作)。
    await w.setProps({ skill: makeSkill({ id: 'sk-8', enabled: true }) })
    await flush()
    expect(push).not.toHaveBeenCalled()
  })

  it('D4「启用并试用」挂号后切到别的技能,原技能迟到的 enabled=true 不再触发 push(残留清除,pendingTryId 一次性语义)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-10', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
    await flush()
    expect(w.emitted('toggle')).toEqual([['sk-10', true]])

    // 响应到达前,用户已经切到另一个技能——skill.id 变化的 watch 会清掉挂号。
    await w.setProps({ skill: makeSkill({ id: 'sk-11', enabled: false }) })
    await flush()

    // 迟到的响应此刻才把 sk-10 的 enabled 改成 true(用户又切回了 sk-10)——因为
    // 挂号已经在切换那一刻被清空,不应该被误读成"待跳转"而 push。
    await w.setProps({ skill: makeSkill({ id: 'sk-10', enabled: true }) })
    await flush()
    expect(push).not.toHaveBeenCalled()
  })

  // 【评审 Important 2 之①】钉住「跳转前清空 pendingTryId」这道防线本身(与上面「残留
  // 清除」那条不同——那条钉的是 skill.id 变化时的复位 watch;这条钉的是成功分支自己
  // 清空 pendingTryId,同一技能不换 id 也要成立)。RED 验证:把成功分支里的
  // `pendingTryId.value = null` 删掉 → 这条用例精确报红(第二次 push 被多算一次)。
  it('D4:成功跳转一次后,同一技能之后被手动开关多次,push 总次数仍是 1(挂号已被消费,不会残留重复触发)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-3', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
    await flush()
    await w.setProps({ skill: makeSkill({ id: 'sk-3', enabled: true }) })
    await flush()
    expect(push).toHaveBeenCalledTimes(1)

    // 用户之后自己用开关把这个技能关闭再打开——不该被误读成"待跳转"而再跳一次。
    await w.setProps({ skill: makeSkill({ id: 'sk-3', enabled: false }) })
    await flush()
    await w.setProps({ skill: makeSkill({ id: 'sk-3', enabled: true }) })
    await flush()
    expect(push).toHaveBeenCalledTimes(1)
  })

  // 【评审 Important 2 之②】钉住 `if (enabled === true)` 这个判断本身。构造合成竞态:
  // D4 弹窗打开期间(点确认之前),技能被别处启用(enabled 变 true)——此时 pendingTryId
  // 还是 null,watcher 空转;随后用户仍然点了确认(pendingTryId 挂号),因为 enabled
  // 已经是 true、不会再触发"从非 true 到 true"的变化,pendingTryId 悬而不清;紧接着
  // enabled 被别处改回 false,watcher 第一次真正触发,newVal=false——必须不 push。
  // RED 验证:把 `if (enabled === true)` 判断删掉(变成一进 if 块就无条件清挂号+push)
  // → 这条用例精确报红。
  it('D4:挂号后 watcher 第一次真正触发时 enabled 是 false(不是 true)→ 不 push(钉住 `if (enabled === true)` 判断)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-9', enabled: false }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    // 合成竞态:弹窗打开期间技能被别处启用(此时还没点确认,pendingTryId 仍是 null)。
    await w.setProps({ skill: makeSkill({ id: 'sk-9', enabled: true }) })
    await flush()
    expect(push).not.toHaveBeenCalled()
    // 用户仍然点了确认——enabled 已经是 true,不构成"变化",watcher 不会再触发,
    // pendingTryId 挂号后悬而不清。
    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
    await flush()
    expect(w.emitted('toggle')).toEqual([['sk-9', true]])
    // enabled 被别处改回 false——watcher 第一次真正触发,newVal 是 false。
    await w.setProps({ skill: makeSkill({ id: 'sk-9', enabled: false }) })
    await flush()
    expect(push).not.toHaveBeenCalled()
  })

  it('enabled === true 时点「在对话中试用」直接跳转,不弹 D4 弹窗(P3a 既有行为未回归)', async () => {
    const w = mountDetail(makeSkill({ id: 'sk-42', enabled: true }))
    await w.find('.sk-pill-try').trigger('click')
    await flush()
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith({ path: '/ai/agent', query: { skill: 'sk-42' } })
    expect(host.querySelector('.sk-modal')).toBeNull()
  })

  it('TestPanel 的 test 事件被向上转发成本组件的 test emit', async () => {
    const w = mountDetail(makeSkill())
    const tp = w.findComponent({ name: 'TestPanel' })
    expect(tp.exists()).toBe(true)
    tp.vm.$emit('test')
    await flush()
    expect(w.emitted('test')).toHaveLength(1)
  })
})
