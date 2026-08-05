# Task 6 review package — c27e050..HEAD

## commits
c13e102 sp8-ai P3b Task 6: SkillDetail write ops (switch/menu/copy/export) + delete confirm dialog

## diff --stat
 .../components/settings/skills/SkillDetail.test.ts | 295 ++++++++++++++++++++-
 src/ai/components/settings/skills/SkillDetail.vue  | 231 ++++++++++++++--
 2 files changed, 499 insertions(+), 27 deletions(-)

## diff -U10
diff --git a/src/ai/components/settings/skills/SkillDetail.test.ts b/src/ai/components/settings/skills/SkillDetail.test.ts
index 7aa8832..90a6203 100644
--- a/src/ai/components/settings/skills/SkillDetail.test.ts
+++ b/src/ai/components/settings/skills/SkillDetail.test.ts
@@ -1,24 +1,39 @@
-import { describe, it, expect, beforeEach, vi } from 'vitest'
-import { mount } from '@vue/test-utils'
+import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
+import { mount, flushPromises } from '@vue/test-utils'
+import { nextTick } from 'vue'
 import { createI18n } from 'vue-i18n'
+import { setActivePinia, createPinia } from 'pinia'
 import zh from '../../../../i18n/zh_cn'
 import SkillDetail from './SkillDetail.vue'
 import type { Skill } from '../../../types/skill'
 
 // SP8-P3a Task 5 —— 对齐 Vue2 src/views/AI/Skills/SkillDetail.vue(271 行)只读半。
+// SP8-P3b Task 6 —— 加写操作:开关 + 更多菜单(禁用/复制/导出/删除)+ 删除确认弹窗。
 // 公共约束 §9:vi.mock 骨架用 vi.hoisted() 避免 ESM 提升的 TDZ ReferenceError。
 const { push } = vi.hoisted(() => ({ push: vi.fn() }))
 vi.mock('vue-router', () => ({
   useRouter: () => ({ push }),
 }))
 
+// Task 6 —— 导出按钮走同步 URL builder(不是 axios 调用),复制按钮走
+// `useCopyFeedback` 内部的 `copyText`(非安全上下文 execCommand 兜底,见该模块头注释)。
+// mock 手法与 McpTokensSection.test.ts 完全一致(同一对函数的既有 mock 先例)。
+const h = vi.hoisted(() => ({
+  exportSkillURL: vi.fn((id: string) => `/v1/ai/skills/${id}/export?token=abc`),
+  copyText: vi.fn().mockResolvedValue(undefined),
+}))
+vi.mock('@nimotech/nimoos-service', () => ({
+  service: { ai: { exportSkillURL: h.exportSkillURL } },
+}))
+vi.mock('../../../../files/util/clipboard', () => ({ copyText: h.copyText }))
+
 const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
 
 function makeSkill(overrides: Partial<Skill> = {}): Skill {
   return {
     id: 'sk-1',
     name: 'weekly-report',
     title: 'Weekly Report',
     description: 'Summarizes the week and posts it to the family channel.',
     trigger: 'manual',
     // 故意写一个与真实 trigger 语义不符的 trigger_human,专门钉住偏离 4
@@ -31,45 +46,76 @@ function makeSkill(overrides: Partial<Skill> = {}): Skill {
     author: 'Alice',
     last_used: '',
     calls: 3,
     files: [],
     examples: [],
     md: '',
     ...overrides,
   }
 }
 
-const mountDetail = (skill: Skill | null) =>
-  mount(SkillDetail, { props: { skill }, global: { plugins: [i18n] } })
+// Task 6 —— 删除确认弹窗 portal 到 `.set-app`(见组件头注释「偏离申报 2」/
+// SkModal.vue D1),测试须先在 body 里放一个同名宿主,先例 SkModal.test.ts::withHost()。
+function withHost(): HTMLElement {
+  const host = document.createElement('div')
+  host.className = 'set-app'
+  document.body.appendChild(host)
+  return host
+}
+
+const mountDetail = (skill: Skill | null, props: { busy?: Record<string, boolean> } = {}) =>
+  mount(SkillDetail, {
+    props: { skill, ...props },
+    global: { plugins: [i18n] },
+    attachTo: document.body,
+  })
+
+// 公共约束 §9:异步断言用 flushPromises(),不用单个 await nextTick()。
+const flush = async () => { await flushPromises(); await nextTick() }
+
+describe('SkillDetail(只读半 + P3b 写操作半)', () => {
+  let host: HTMLElement
 
-describe('SkillDetail(只读半)', () => {
   beforeEach(() => {
     push.mockClear()
+    h.exportSkillURL.mockClear()
+    h.copyText.mockClear()
+    // useCopyFeedback() 内部调用 useToast()(Pinia store),组件 setup() 时无条件
+    // 调用一次,故每个测试都要有一个 active Pinia,不只是涉及复制的用例。
+    setActivePinia(createPinia())
+    host = withHost()
+  })
+
+  afterEach(() => {
+    document.body.innerHTML = ''
   })
 
   it('空态:skill=null 时展示两行文案,不渲染详情条', () => {
     const w = mountDetail(null)
     expect(w.find('.sk-detail-empty').exists()).toBe(true)
     expect(w.find('.empty-title').text()).toBe('在左侧选择一个技能')
     expect(w.find('.empty-sub').text()).toBe('或者新建一个 —— Nimo 会在触发器命中时自动调用。')
     expect(w.find('.sk-detail-bar').exists()).toBe(false)
   })
 
-  it('顶部条:标题/name code/试用按钮,不渲染开关与更多菜单(P3b 范围)', () => {
+  // 【反转,SP8-P3b Task 6,公共约束 §9 明确要求「反转不是删除」】P3a 版本断言这
+  // 三个写操作控件「必须完全不出现」;P3b 落地后 `.sw`/`.sk-pill-more` 必须渲染,
+  // `.sk-menu` 仍是 false ——但语义已经从「永不渲染」变成「默认收起」(菜单展开的
+  // 交互由下方专项用例覆盖)。改前/改后原文已贴进任务报告。
+  it('顶部条:标题/name code/试用按钮/开关/更多菜单按钮全部渲染(P3b 写操作落地)', () => {
     const w = mountDetail(makeSkill({ title: 'Weekly Report', name: 'weekly-report' }))
     expect(w.find('.sk-name span').text()).toBe('Weekly Report')
     expect(w.find('.sk-name code').text()).toBe('weekly-report')
     expect(w.find('.sk-pill-try').exists()).toBe(true)
     expect(w.find('.sk-pill-try').text()).toContain('在对话中试用')
-    // §5.2 明确不取的写操作控件,必须完全不出现。
-    expect(w.find('.sw').exists()).toBe(false)
-    expect(w.find('.sk-pill-more').exists()).toBe(false)
+    expect(w.find('.sw').exists()).toBe(true)
+    expect(w.find('.sk-pill-more').exists()).toBe(true)
     expect(w.find('.sk-menu').exists()).toBe(false)
   })
 
   it('四格元信息:状态(启用)/触发方式/来源/上次运行 + 累计次数', () => {
     const w = mountDetail(makeSkill({
       enabled: true,
       trigger: 'manual',
       author: 'Alice',
       last_used: '2026-07-29 08:00',
       calls: 1234,
@@ -209,11 +255,242 @@ describe('SkillDetail(只读半)', () => {
     expect(rows).toHaveLength(1)
     expect(rows[0].find('.name').text()).toBe('没有附带文件')
   })
 
   it('「在对话中试用」:点击 push 到 /ai/agent 并带正确的 skill id 查询参数', async () => {
     const w = mountDetail(makeSkill({ id: 'sk-42' }))
     await w.find('.sk-pill-try').trigger('click')
     expect(push).toHaveBeenCalledTimes(1)
     expect(push).toHaveBeenCalledWith({ path: '/ai/agent', query: { skill: 'sk-42' } })
   })
+
+  // ===== SP8-P3b Task 6 —— 顶部条写操作 + 删除确认弹窗 =====
+
+  it('开关:data-on/aria-checked 反映 enabled,点击 emit toggle(id, !enabled)', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-1', enabled: true }))
+    const sw = w.find('.sw')
+    expect(sw.attributes('data-on')).toBe('true')
+    expect(sw.attributes('aria-checked')).toBe('true')
+    await sw.trigger('click')
+    expect(w.emitted('toggle')).toEqual([['sk-1', false]])
+  })
+
+  it('停用态开关:data-on=false,点击 emit toggle(id, true)', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-1', enabled: false }))
+    const sw = w.find('.sw')
+    expect(sw.attributes('data-on')).toBe('false')
+    await sw.trigger('click')
+    expect(w.emitted('toggle')).toEqual([['sk-1', true]])
+  })
+
+  it('busy[id] 为真时开关禁用(aria-disabled=true),为空对象/其它 id 时不禁用', () => {
+    const wBusy = mountDetail(makeSkill({ id: 'sk-9' }), { busy: { 'sk-9': true } })
+    expect(wBusy.find('.sw').attributes('aria-disabled')).toBe('true')
+
+    const wIdle = mountDetail(makeSkill({ id: 'sk-9' }), { busy: {} })
+    expect(wIdle.find('.sw').attributes('aria-disabled')).toBe('false')
+
+    const wOther = mountDetail(makeSkill({ id: 'sk-9' }), { busy: { 'sk-other': true } })
+    expect(wOther.find('.sw').attributes('aria-disabled')).toBe('false')
+  })
+
+  it('更多菜单:点击 .sk-pill-more 开合', async () => {
+    const w = mountDetail(makeSkill())
+    expect(w.find('.sk-menu').exists()).toBe(false)
+    await w.find('.sk-pill-more').trigger('click')
+    expect(w.find('.sk-menu').exists()).toBe(true)
+    await w.find('.sk-pill-more').trigger('click')
+    expect(w.find('.sk-menu').exists()).toBe(false)
+  })
+
+  it('更多菜单:外部 mousedown 关闭菜单,菜单内部点击不触发外部关闭逻辑', async () => {
+    const w = mountDetail(makeSkill())
+    await w.find('.sk-pill-more').trigger('click')
+    expect(w.find('.sk-menu').exists()).toBe(true)
+
+    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
+    await flush()
+    expect(w.find('.sk-menu').exists()).toBe(false)
+  })
+
+  it('菜单项顺序与文案:暂停/启用 → 复制 SKILL.md → 导出技能 → <hr> → 危险项', async () => {
+    const w = mountDetail(makeSkill({ enabled: true, system: false }))
+    await w.find('.sk-pill-more').trigger('click')
+    const menu = w.find('.sk-menu')
+    const buttons = menu.findAll('button')
+    expect(buttons).toHaveLength(4)
+    expect(buttons[0].text()).toContain('临时禁用')
+    expect(buttons[1].text()).toContain('复制 SKILL.md')
+    expect(buttons[2].text()).toContain('导出技能')
+    expect(buttons[3].attributes('data-danger')).toBe('true')
+    expect(buttons[3].text()).toContain('删除技能')
+    expect(menu.find('hr').exists()).toBe(true)
+  })
+
+  it('菜单第一项(暂停/启用):enabled 时文案「临时禁用」,disabled 时文案「启用」,点击都 emit toggle', async () => {
+    const wEnabled = mountDetail(makeSkill({ id: 'sk-1', enabled: true }))
+    await wEnabled.find('.sk-pill-more').trigger('click')
+    const btnsEnabled = wEnabled.findAll('.sk-menu button')
+    expect(btnsEnabled[0].text()).toContain('临时禁用')
+    await btnsEnabled[0].trigger('click')
+    expect(wEnabled.emitted('toggle')).toEqual([['sk-1', false]])
+    // closeAnd 先收起菜单再执行动作。
+    expect(wEnabled.find('.sk-menu').exists()).toBe(false)
+
+    const wDisabled = mountDetail(makeSkill({ id: 'sk-1', enabled: false }))
+    await wDisabled.find('.sk-pill-more').trigger('click')
+    const btnsDisabled = wDisabled.findAll('.sk-menu button')
+    expect(btnsDisabled[0].text()).toContain('启用')
+    await btnsDisabled[0].trigger('click')
+    expect(wDisabled.emitted('toggle')).toEqual([['sk-1', true]])
+  })
+
+  it('危险项文案:内置技能显示「卸载」,用户技能显示「删除技能」', async () => {
+    const wSystem = mountDetail(makeSkill({ system: true }))
+    await wSystem.find('.sk-pill-more').trigger('click')
+    const dangerSystem = wSystem.findAll('.sk-menu button')[3]
+    expect(dangerSystem.text()).toContain('卸载')
+    expect(dangerSystem.text()).not.toContain('删除')
+
+    const wUser = mountDetail(makeSkill({ system: false }))
+    await wUser.find('.sk-pill-more').trigger('click')
+    const dangerUser = wUser.findAll('.sk-menu button')[3]
+    expect(dangerUser.text()).toContain('删除技能')
+  })
+
+  it('点击「复制 SKILL.md」调用 copyText 传入 skill.md,点击后菜单立即收起', async () => {
+    const w = mountDetail(makeSkill({ md: '# Title\n\nBody.' }))
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[1].trigger('click')
+    expect(h.copyText).toHaveBeenCalledWith('# Title\n\nBody.')
+    expect(w.find('.sk-menu').exists()).toBe(false)
+  })
+
+  it('复制 SKILL.md 为空字符串时,copyText 收到空字符串(不是 undefined)', async () => {
+    const w = mountDetail(makeSkill({ md: '' }))
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[1].trigger('click')
+    expect(h.copyText).toHaveBeenCalledWith('')
+  })
+
+  it('点击「导出技能」:创建的 <a> 的 href/download 正确且被点击一次', async () => {
+    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
+    const appendSpy = vi.spyOn(document.body, 'appendChild')
+    const w = mountDetail(makeSkill({ id: 'sk-7', name: 'weekly-report' }))
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[2].trigger('click')
+
+    expect(h.exportSkillURL).toHaveBeenCalledWith('sk-7')
+    const anchor = appendSpy.mock.calls.find((c) => c[0] instanceof HTMLAnchorElement)?.[0] as HTMLAnchorElement
+    expect(anchor).toBeTruthy()
+    expect(anchor.getAttribute('href')).toBe('/v1/ai/skills/sk-7/export?token=abc')
+    expect(anchor.getAttribute('download')).toBe('weekly-report.tar.gz')
+    expect(clickSpy).toHaveBeenCalledTimes(1)
+    // 点击后菜单立即收起。
+    expect(w.find('.sk-menu').exists()).toBe(false)
+
+    clickSpy.mockRestore()
+    appendSpy.mockRestore()
+  })
+
+  it('导出:技能没有 name 时,download 回落成 "skill.tar.gz"', async () => {
+    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
+    const appendSpy = vi.spyOn(document.body, 'appendChild')
+    const w = mountDetail(makeSkill({ id: 'sk-8', name: '' }))
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[2].trigger('click')
+
+    const anchor = appendSpy.mock.calls.find((c) => c[0] instanceof HTMLAnchorElement)?.[0] as HTMLAnchorElement
+    expect(anchor.getAttribute('download')).toBe('skill.tar.gz')
+
+    clickSpy.mockRestore()
+    appendSpy.mockRestore()
+  })
+
+  it('点击危险项:打开确认弹窗(portal 进 .set-app),菜单同时收起', async () => {
+    const w = mountDetail(makeSkill({ system: false }))
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[3].trigger('click')
+    await flush()
+    expect(w.find('.sk-menu').exists()).toBe(false)
+    expect(host.querySelector('.sk-confirm')).not.toBeNull()
+    // 关键断言:弹窗节点落在 .set-app 容器内,不是直挂 body(D1,同 SkModal.test.ts)。
+    expect(host.querySelector('.sk-confirm')!.closest('.set-app')).toBe(host)
+  })
+
+  it('确认弹窗:内置技能标题/正文(D3 实话文案,不含"重新安装")/按钮/历史运行次数', async () => {
+    const w = mountDetail(makeSkill({ system: true, calls: 7, name: 'built-in-skill' }))
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[3].trigger('click')
+    await flush()
+
+    expect(host.querySelector('.sk-confirm-body h3')?.textContent).toBe('卸载这个技能?')
+    const body = host.querySelector('.sk-confirm-body p')?.textContent ?? ''
+    expect(body).not.toContain('重新安装')
+    expect(host.querySelector('.sk-confirm-skill .name')?.textContent).toBe('built-in-skill')
+    expect(host.querySelector('.sk-confirm-skill .runs')?.textContent).toBe('历史运行 7 次')
+    expect(host.querySelector('.sk-btn.danger')?.textContent).toContain('卸载')
+  })
+
+  it('确认弹窗:用户技能标题/正文/按钮文案(与内置技能不同措辞)', async () => {
+    const w = mountDetail(makeSkill({ system: false, calls: 7 }))
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[3].trigger('click')
+    await flush()
+
+    expect(host.querySelector('.sk-confirm-body h3')?.textContent).toBe('删除这个技能?')
+    expect(host.querySelector('.sk-confirm-body p')?.textContent)
+      .toBe('这会永久删除该技能及其 SKILL.md 文件,无法恢复。')
+    expect(host.querySelector('.sk-btn.danger')?.textContent).toContain('删除')
+    expect(host.querySelector('.sk-btn.danger')?.textContent).not.toContain('卸载')
+  })
+
+  it('确认弹窗:点确认按钮 emit delete(id) 且弹窗关闭', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-3', system: false }))
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[3].trigger('click')
+    await flush()
+
+    const confirmBtn = host.querySelector('.sk-btn.danger') as HTMLButtonElement
+    confirmBtn.click()
+    await flush()
+
+    expect(w.emitted('delete')).toEqual([['sk-3']])
+    expect(host.querySelector('.sk-confirm')).toBeNull()
+  })
+
+  it('确认弹窗:点取消按钮不 emit delete,弹窗关闭', async () => {
+    const w = mountDetail(makeSkill({ system: false }))
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[3].trigger('click')
+    await flush()
+
+    const cancelBtn = host.querySelector('.sk-btn.ghost') as HTMLButtonElement
+    cancelBtn.click()
+    await flush()
+
+    expect(w.emitted('delete')).toBeUndefined()
+    expect(host.querySelector('.sk-confirm')).toBeNull()
+  })
+
+  it('skill.id 变化时复位菜单(菜单打开中途切换技能,菜单自动收起)', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-1' }))
+    await w.find('.sk-pill-more').trigger('click')
+    expect(w.find('.sk-menu').exists()).toBe(true)
+
+    await w.setProps({ skill: makeSkill({ id: 'sk-2' }) })
+    await flush()
+    expect(w.find('.sk-menu').exists()).toBe(false)
+  })
+
+  it('skill.id 变化时复位确认弹窗(弹窗打开中途切换技能,弹窗自动关闭)', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-1', system: false }))
+    await w.find('.sk-pill-more').trigger('click')
+    await w.findAll('.sk-menu button')[3].trigger('click')
+    await flush()
+    expect(host.querySelector('.sk-confirm')).not.toBeNull()
+
+    await w.setProps({ skill: makeSkill({ id: 'sk-2' }) })
+    await flush()
+    expect(host.querySelector('.sk-confirm')).toBeNull()
+  })
 })
diff --git a/src/ai/components/settings/skills/SkillDetail.vue b/src/ai/components/settings/skills/SkillDetail.vue
index c09014b..0181db6 100644
--- a/src/ai/components/settings/skills/SkillDetail.vue
+++ b/src/ai/components/settings/skills/SkillDetail.vue
@@ -1,16 +1,50 @@
 <!--
   SP8-P3a Task 5 —— 只读半,摘自 Vue2 src/views/AI/Skills/SkillDetail.vue(271 行)。
   本任务只取 brief §5.1 列的子集:空态 / 顶部条(去掉开关与更多菜单)/ 四格元信息 /
   描述段 / SKILL.md 段 / 附带文件段。写操作(开关、更多菜单、复制/导出/删除、
   TestPanel/runTest)全部留给 P3b(brief §5.2),本文件不出现任何相关状态或方法。
 
+  SP8-P3b Task 6 —— 顶部条写操作(开关 + 更多菜单 + 复制/导出)+ 删除/卸载确认弹窗。
+  对齐 Vue2 :21-56(顶部条控件)与 :155-184(确认弹窗),细节见下方就地注释。
+
+  【偏离申报 1,公共约束 §3 偏离 12】复制走 `useCopyFeedback`(内部 `copyText` 兜底
+  + toast + 打勾态),不照抄 Vue2 :243-253 手写的 `navigator.clipboard` try/catch +
+  临时 textarea 那份兜底。
+
+  【偏离申报 2,公共约束 §3 偏离 11 的延伸 / 任务书 6.1 协调者修订】删除确认弹窗不套
+  `SkModal`,直接用 reka Dialog 原语(`DialogRoot`/`DialogPortal`/`DialogOverlay`/
+  `DialogContent`)在本组件内拼出 Vue2 的确切 DOM——原因见任务书 6.1:`SkModal` 强制
+  渲染标题栏+关闭按钮(Vue2 的确认弹窗没有标题栏,标题是 `.sk-confirm-body` 里的
+  `<h3>`)、默认插槽套 `.sk-modal-body` 会与 `.sk-confirm-body` 自带 padding 叠加、
+  `.sk-modal` 类写死加不上 `.sk-confirm`。`DialogPortal to=".set-app"` 不可省——AI 区
+  token 定义在 `.agent-app` 作用域,portal 到 body 会让 `var(--bg-elevated)` 一类全部
+  解析失败(同 SkModal.vue 头注释 D1)。无障碍标题用
+  `<VisuallyHidden as-child><DialogTitle>`(reka 要求 DialogContent 内必须有
+  DialogTitle),先例 `src/home/components/SearchDialog.vue:317`。确认/取消按钮用普通
+  `<button>` 手写 `@click`(不用 `AlertDialogAction`/`DialogClose`)——那两个 reka 组件
+  模板里硬编码了 `@click="onOpenChange(false)"`,消费者的 `@click` 经 `$attrs` 合并后
+  `update:open` 必先于自定义 handler 触发(P1c1 Task 11 踩过的坑);本组件确认按钮的
+  handler 直接读 `props.skill.id`,不依赖 `open` 状态,天然不受此坑影响,但仍按
+  `SkModal.vue` 关闭按钮的既有写法(纯 `<button @click>`,非 DialogClose)保持一致,
+  不引入新模式。
+
+  【实现选择,非行为偏离,类比 SetSwitch.vue 头注释里 v-model/update:modelValue 那条
+  "框架 API 差异,非行为改动"】外部点击关闭菜单,复用已有的 `useClickOutside`
+  composable(`../../../composables/useClickOutside.ts`,已有先例
+  `ModelPicker.vue:26,69`),而不是手写 Vue2 :214-225 那份 `watch(menuOpen)` 里
+  条件式 addEventListener/removeEventListener。两者对用户可见行为完全等价(外部
+  mousedown 关闭菜单、组件卸载后监听器必移除),`useClickOutside` 用 onMounted/
+  onUnmounted 无条件挂/摘,反而**没有** Vue2 那种"仅当 menuOpen 为真才挂监听"的条件
+  竞态面(P1c1 Task 7 的泄漏正是出在条件式挂载的时序上)。`skill.id` 变化时复位
+  `menuOpen`/`confirmOpen` 仍用独立 `watch`,对齐 Vue2 :226-229。
+
   【偏离 2(公共约束 §3.2)】Vue2 :30 `SkillIcon` 不移植,统一用
   `../../icons/AgentIcon.vue`(sparkle 图标已有,SkillTile.vue 同款用法）。
 
   【偏离 4(公共约束 §3.2 / 类型 skill.ts 头注 / util/skillsFormat.ts 头注)】
   Vue2 :79 直接渲染 `skill.trigger_human || skill.trigger`。本仓弃用
   `trigger_human`,改用 `triggerLabel(skill.trigger, skill.name)`:命中则
   `t(key, params)`(slash 分支得到 `/{name}`),未命中（未知 trigger）原样显示
   `skill.trigger`。**本文件不读 `skill.trigger_human` 字段。**
 
   【颜色改动,公共约束 §6】Vue2 :64-73 的状态圆点是内联 `:style` 现场拼 `rgba(...)`
@@ -21,65 +55,166 @@
   `<span class="dot" />` 不再携带任何内联样式或颜色相关 data 属性。
 
   【last_used 不做映射】照 Vue2 :88 原样 `skill.last_used || '—'`。若后端将来在
   该字段写入英文相对时间串（如 "3 hours ago"），此处需要补一层本地化映射——目前
   后端契约（NimoOS-AI/service/skills.go）该字段就是任意字符串或空串，无需处理。
 
   【TestPanel 占位】Vue2 :108-112 里 `TestPanel` 夹在「描述」与「SKILL.md」两个
   `.sk-section` 之间。P3a 不渲染它，两段直接相邻；下方模板里留了一行注释标出
   P3b 要插回的确切位置，避免插错顺序。
 
-  【不取，§5.2】`.sw` 开关 · `.sk-pill-more` + `.sk-menu` 下拉 · 删除确认弹窗
-  (`.sk-modal-bg`/`.sk-confirm`) · `TestPanel` · `copyMarkdown`/`exportSkill`/
-  `runTest`/`doDelete`/`closeAnd` · `menuOpen` 与 document mousedown 监听 ·
-  `busy` prop · `watch('skill.id')` 里复位菜单/弹窗的逻辑。全部一个不写。
+  【不取,留给 T7】`TestPanel`/`runTest` 占位(:166-167 那处注释)不是本任务范围,
+  按协调者要求原样不动。
 
-  零 <style> 块:用到的每个 class（sk-detail*、sk-name、sk-pill-try、sk-meta-grid、
-  sk-meta-cell、sk-section*、sk-description、sk-md、sk-file-row）均已存在于
-  skills-styles.scss（Task 1）或 sk-shared.scss（既有）。
+  零 <style> 块:用到的每个 class(sk-detail*、sk-name、sk-pill-try、sk-meta-grid、
+  sk-meta-cell、sk-section*、sk-description、sk-md、sk-file-row、sw、sk-pill-more、
+  sk-menu、sk-modal-bg、sk-modal、sk-confirm*、sk-modal-foot、sk-btn)均已存在于
+  skills-styles.scss(Task 1)或 sk-shared.scss(既有)。
 -->
 <script setup lang="ts">
-import { computed } from 'vue'
+import { computed, ref, watch } from 'vue'
 import { useI18n } from 'vue-i18n'
 import { useRouter } from 'vue-router'
+import { service } from '@nimotech/nimoos-service'
+import {
+  DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, VisuallyHidden,
+} from 'reka-ui'
 import type { Skill } from '../../../types/skill'
 import { triggerLabel, authorLabel, fileSizeLabel } from '../../../util/skillsFormat'
 import { renderMarkdown } from '../../../markdown/renderMarkdown'
+import { useClickOutside } from '../../../composables/useClickOutside'
+import { useCopyFeedback } from '../../../composables/useCopyFeedback'
 import AgentIcon from '../../icons/AgentIcon.vue'
 import SkillTile from './SkillTile.vue'
+import SetSwitch from '../SetSwitch.vue'
 
-// Vue2 SkillDetail.vue:200 `skill: { type: Object, default: null }`。
-// `busy`（:201）不移植 —— 写操作专用 prop，本任务不涉及任何写操作。
-const props = defineProps<{ skill: Skill | null }>()
+// Vue2 SkillDetail.vue:200-201 `skill: { type: Object, default: null }` +
+// `busy: { type: Object, default: () => ({}) }`(飞行中禁用的技能 id 集合,由父组件
+// SkillsSection 在 toggle/delete 请求进行中维护,驱动开关的 disabled 态)。
+const props = withDefaults(
+  defineProps<{ skill: Skill | null; busy?: Record<string, boolean> }>(),
+  { busy: () => ({}) },
+)
+
+// 对齐 Vue2 :27(`$emit('toggle', …)`)与 :238(`$emit('delete', …)`)。
+const emit = defineEmits<{
+  (e: 'toggle', id: string, enabled: boolean): void
+  (e: 'delete', id: string): void
+}>()
 
 const { t } = useI18n()
 const router = useRouter()
 
+// 顶部条「更多」下拉菜单。对齐 Vue2 data() 里的 `menuOpen`(:205)。
+const menuOpen = ref(false)
+// 删除/卸载确认弹窗。对齐 Vue2 data() 里的 `confirm`(:206,本仓避开与 Vue `computed`
+// 内建 confirm 全局同名的歧义,改叫 confirmOpen)。
+const confirmOpen = ref(false)
+// `.sk-pill-more` 按钮 + `.sk-menu` 下拉的包裹元素,对齐 Vue2 `ref="menuWrap"`(:33)。
+const menuWrap = ref<HTMLElement | null>(null)
+
+// 外部点击关闭菜单。复用既有 `useClickOutside` composable(见文件头注释「实现选择」)
+// 而不是手写 Vue2 :214-225 那份 `watch(menuOpen)` 里条件式 add/removeEventListener。
+useClickOutside(menuWrap, () => { menuOpen.value = false })
+
+// `skill.id` 变化时复位菜单与确认弹窗,对齐 Vue2 `watch: { 'skill.id'() { … } }`(:226-229)。
+watch(() => props.skill?.id, () => {
+  menuOpen.value = false
+  confirmOpen.value = false
+})
+
+// 复制 SKILL.md 到剪贴板 + 打勾态(偏离申报 1,见文件头注释)。
+const { copiedKey, copy: copyToClipboard } = useCopyFeedback()
+
+// 对齐 Vue2 `closeAnd(fn)`(:235):先收起菜单,再执行传入的动作。
+function closeAnd(fn?: () => void) {
+  menuOpen.value = false
+  fn?.()
+}
+
+// 对齐 Vue2 菜单第一项 `$emit('toggle', skill.id, !skill.enabled)`(:38)。拆成具名函数
+// (而不是模板里内联 `() => emit('toggle', skill.id, !skill.enabled)`)是因为 vue-tsc
+// 对 `v-else` 分支里 `skill` 的非空窄化不会穿透进模板内联箭头函数体
+// (TS18047 `'skill' is possibly 'null'`),具名函数在 <script> 里用 `props.skill` 重新
+// 判空即可规避,行为与内联写法完全等价。
+function toggleFromMenu() {
+  const s = props.skill
+  if (!s) return
+  emit('toggle', s.id, !s.enabled)
+}
+
+// 对齐 Vue2 `copyMarkdown()`(:243-253)——手写的 clipboard/execCommand 兜底已被
+// `useCopyFeedback` 内部的 `copyText` 取代(偏离申报 1)。
+function copyMarkdown() {
+  copyToClipboard(props.skill?.md ?? '', 'skillmd')
+}
+
+// 对齐 Vue2 `exportSkill()`(:255-262):建一个隐藏 `<a>`,靠 `download` 属性触发浏览器
+// 下载,而不是导航当前页面。`service.ai.exportSkillURL` 是同步 URL builder(非 axios
+// 调用),token 走 `?token=` query 兜底。
+function exportSkill() {
+  const s = props.skill
+  if (!s) return
+  const a = document.createElement('a')
+  a.href = service.ai.exportSkillURL(s.id)
+  a.download = (s.name || 'skill') + '.tar.gz'
+  document.body.appendChild(a)
+  a.click()
+  a.remove()
+}
+
+// 对齐 Vue2 `doDelete()`(:236-239)。
+function doDelete() {
+  const s = props.skill
+  if (!s) return
+  confirmOpen.value = false
+  emit('delete', s.id)
+}
+
 // 对齐 Vue2 :79，但输入换成原始 trigger 枚举（偏离 4，见文件头注释）。
 const triggerText = computed(() => {
   const s = props.skill
   if (!s) return ''
   const ref = triggerLabel(s.trigger, s.name)
   return ref ? t(ref.key, ref.params ?? {}) : s.trigger
 })
 
 // 对齐 Vue2 :83，`authorLabel` 只本地化后端硬编码的字面量 'You'，其余原样显示。
 const authorText = computed(() => {
   const s = props.skill
   if (!s) return ''
   const ref = authorLabel(s.author)
   return ref ? t(ref.key) : s.author
 })
 
 // 对齐 Vue2 :90 `Number(skill.calls || 0).toLocaleString()`。
 const totalCount = computed(() => Number(props.skill?.calls || 0).toLocaleString())
 
+// 顶部条「开关」的 title,对齐 Vue2 :24 `:title="skill.enabled ? $t('Disable') : $t('Enable')"`。
+const switchTitle = computed(() => (props.skill?.enabled ? t('aiSkDisable') : t('aiSkEnable')))
+
+// 「更多」菜单第一项(暂停/启用)的文案,对齐 Vue2 :40。
+const pauseLabel = computed(() => (props.skill?.enabled ? t('aiSkDisableTemporarily') : t('aiSkEnable')))
+
+// 「更多」菜单危险项 + 确认弹窗的文案:内置技能用「卸载」措辞,用户自建的用「删除」措辞。
+// 对齐 Vue2 :53(菜单项)与 :158-179(弹窗标题/正文/按钮),内置那条正文是 D3 改过的
+// 实话文案(公共约束 §3 偏离 2:后端只写 uninstalled=1 标记,全仓无恢复接口)。
+const dangerMenuLabel = computed(() => (props.skill?.system ? t('aiSkUninstall') : t('aiSkDeleteSkill')))
+const confirmTitle = computed(() => (props.skill?.system ? t('aiSkUninstallTitle') : t('aiSkDeleteTitle')))
+const confirmBody = computed(() => (props.skill?.system ? t('aiSkUninstallBody') : t('aiSkDeleteBody')))
+const confirmButtonLabel = computed(() => (props.skill?.system ? t('aiSkUninstall') : t('aiSkDelete')))
+
+// 对齐 Vue2 :169 `$t('{count} previous runs', { count: Number(skill.calls || 0).toLocaleString() })`。
+// 与 totalCount 是同一个格式化公式,分开建一个 computed 只是为了让确认弹窗与 :90 那处
+// 元信息格互不影响、各自独立演化(其实当前值恒等,若未来拆开格式化规则不必回头改这里)。
+const confirmRunsText = computed(() => t('aiSkNPrevRuns', { count: totalCount.value }))
+
 // 对齐 Vue2 :130 `$t('{n} files', { n: (skill.files || []).length })`（段头 hint，
 // 复用 aiSkNFiles —— 与下方单个文件行的 size 本地化是同一个键的两种用法）。
 const filesHint = computed(() => t('aiSkNFiles', { n: (props.skill?.files || []).length }))
 
 // 对齐 Vue2 :211（this.skill && this.skill.md || ''）；`renderMarkdown` 内部已做
 // DOMPurify 消毒，可安全 v-html。
 const mdHTML = computed(() => renderMarkdown(props.skill?.md || ''))
 
 // 对齐 Vue2 :141 `f.size` 原样显示；本仓额外把文件夹的 "(N files)" 格式过一遍
 // fileSizeLabel() 做本地化，字节单位（"12 B"/"1.0 KB"）原样透传。
@@ -106,31 +241,59 @@ function tryInChat() {
         </div>
       </div>
     </template>
     <template v-else>
       <div class="sk-detail-bar">
         <SkillTile :color="skill.color" :icon="skill.icon" :size="28" :radius="8" />
         <div class="sk-name">
           <span>{{ skill.title }}</span>
           <code>{{ skill.name }}</code>
         </div>
-        <!-- P3b: .sw 开关插在这里,.sk-name 与 .sk-pill-try 之间
-             (Vue2 SkillDetail.vue:21-28,`role="switch"` + `@click="$emit('toggle', …)"`)。
-             本期不渲染。 -->
+        <!-- .sw 开关,对齐 Vue2 :21-28。只接 SetSwitch 的 @change,不接 v-model ——
+             状态的真源是父组件列表项里的 skill.enabled,本组件只把意图往上冒泡。 -->
+        <SetSwitch
+          :model-value="skill.enabled"
+          :disabled="!!busy[skill.id]"
+          :title="switchTitle"
+          @change="emit('toggle', skill.id, !skill.enabled)"
+        />
         <button class="sk-pill-try" :title="t('aiSkTryInChat')" @click="tryInChat">
           <AgentIcon name="sparkle" :size="13" />
           {{ t('aiSkTryInChat') }}
         </button>
-        <!-- P3b: .sk-pill-more + .sk-menu 下拉插在这里,.sk-pill-try 之后
-             (Vue2 SkillDetail.vue:33-56,`menuWrap` 容器包 `.sk-pill-more` 按钮 +
-             `v-if="menuOpen"` 的 `.sk-menu`:禁用/复制 SKILL.md/导出/删除四项)。
-             本期不渲染。 -->
+        <!-- .sk-pill-more + .sk-menu 下拉,对齐 Vue2 :33-56。`menuWrap` 容器包按钮 +
+             `v-if="menuOpen"` 的菜单:暂停/启用 · 复制 SKILL.md · 导出技能 · <hr> ·
+             危险项(卸载/删除)。 -->
+        <div ref="menuWrap" style="position: relative">
+          <button class="sk-pill-more" @click="menuOpen = !menuOpen">
+            <AgentIcon name="settings" :size="16" />
+          </button>
+          <div v-if="menuOpen" class="sk-menu">
+            <button @click="closeAnd(toggleFromMenu)">
+              <AgentIcon name="pause" :size="13" />
+              {{ pauseLabel }}
+            </button>
+            <button @click="closeAnd(copyMarkdown)">
+              <AgentIcon name="edit" :size="13" />
+              {{ copiedKey === 'skillmd' ? t('aiCopied') : t('aiSkCopyMd') }}
+            </button>
+            <button @click="closeAnd(exportSkill)">
+              <AgentIcon name="download" :size="13" />
+              {{ t('aiSkExport') }}
+            </button>
+            <hr>
+            <button data-danger="true" @click="closeAnd(() => { confirmOpen = true })">
+              <AgentIcon name="trash" :size="13" />
+              {{ dangerMenuLabel }}
+            </button>
+          </div>
+        </div>
       </div>
 
       <div class="sk-detail-body">
         <div class="sk-detail-inner">
           <div class="sk-meta-grid">
             <div class="sk-meta-cell">
               <div class="lbl">{{ t('aiSkStatus') }}</div>
               <div class="val" :data-disabled="!skill.enabled ? 'true' : 'false'">
                 <span class="dot" />
                 {{ skill.enabled ? t('aiSkActive') : t('aiSkPaused') }}
@@ -195,13 +358,45 @@ function tryInChat() {
                 v-if="!skill.files || skill.files.length === 0"
                 class="sk-file-row"
                 style="color: var(--text-tertiary)"
               >
                 <span class="name">{{ t('aiSkNoBundledFiles') }}</span>
               </div>
             </div>
           </div>
         </div>
       </div>
+
+      <!-- 删除/卸载确认弹窗,对齐 Vue2 :155-184。不套 SkModal——reka Dialog 原语直接拼出
+           Vue2 的确切 DOM(理由见文件头注释「偏离申报 2」)。 -->
+      <DialogRoot :open="confirmOpen" @update:open="confirmOpen = $event">
+        <DialogPortal to=".set-app" defer>
+          <DialogOverlay class="sk-modal-bg">
+            <DialogContent class="sk-modal sk-confirm" :aria-describedby="undefined">
+              <VisuallyHidden as-child><DialogTitle>{{ confirmTitle }}</DialogTitle></VisuallyHidden>
+              <div class="sk-confirm-body">
+                <h3>{{ confirmTitle }}</h3>
+                <p>{{ confirmBody }}</p>
+                <div class="sk-confirm-skill">
+                  <SkillTile :color="skill.color" :icon="skill.icon" :size="28" :radius="8" />
+                  <div class="skill-line">
+                    <div class="name">{{ skill.name }}</div>
+                    <div class="runs">{{ confirmRunsText }}</div>
+                  </div>
+                </div>
+              </div>
+              <div class="sk-modal-foot">
+                <div class="right">
+                  <button class="sk-btn ghost" @click="confirmOpen = false">{{ t('aiCancel') }}</button>
+                  <button class="sk-btn danger" @click="doDelete">
+                    <AgentIcon name="trash" :size="13" />
+                    {{ confirmButtonLabel }}
+                  </button>
+                </div>
+              </div>
+            </DialogContent>
+          </DialogOverlay>
+        </DialogPortal>
+      </DialogRoot>
     </template>
   </div>
 </template>
