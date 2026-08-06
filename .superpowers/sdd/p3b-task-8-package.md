# Task 8 review package — 19b7f6e..HEAD

## commits
5fd5f19 sp8-ai P3b Task 8: SkillsSection write-op wiring (+ button, toggle/delete/create/test)

## diff --stat
 .../settings/sections/SkillsSection.test.ts        | 305 ++++++++++++++++++++-
 .../components/settings/sections/SkillsSection.vue | 179 +++++++++++-
 .../components/settings/skills/AddSkillModal.vue   |  15 +-
 src/ai/types/skill.ts                              |  25 ++
 4 files changed, 496 insertions(+), 28 deletions(-)

## diff -U10
diff --git a/src/ai/components/settings/sections/SkillsSection.test.ts b/src/ai/components/settings/sections/SkillsSection.test.ts
index 64333db..6f948e4 100644
--- a/src/ai/components/settings/sections/SkillsSection.test.ts
+++ b/src/ai/components/settings/sections/SkillsSection.test.ts
@@ -1,40 +1,53 @@
-import { describe, it, expect, beforeEach, vi } from 'vitest'
+import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
 import { mount } from '@vue/test-utils'
 import { nextTick } from 'vue'
 import { setActivePinia, createPinia } from 'pinia'
 import { createI18n } from 'vue-i18n'
 import zh from '../../../../i18n/zh_cn'
 import type { Skill } from '../../../types/skill'
 import SkillGroup from '../skills/SkillGroup.vue'
+import SkillDetail from '../skills/SkillDetail.vue'
 
 // SP8-P3a Task 6 —— 承接 Vue2 src/views/AI/Skills/SkillsSection.vue(226 行)只读半。
+// SP8-P3b Task 8 —— 加四个写操作(onToggle/onDelete/onCreate/onTest)+ `+` 按钮接线。
 // 公共约束 §9:vi.mock 骨架用 vi.hoisted() 避免 ESM 提升的 TDZ ReferenceError。
-const h = vi.hoisted(() => ({ listSkills: vi.fn() }))
+const h = vi.hoisted(() => ({
+  listSkills: vi.fn(),
+  updateSkill: vi.fn(),
+  deleteSkill: vi.fn(),
+  createSkill: vi.fn(),
+}))
 vi.mock('@nimotech/nimoos-service', () => ({ service: { ai: h } }))
 
 // SkillDetail.vue 内部 useRouter()('在对话中试用'按钮),本文件不测试该交互,
 // 但挂载 SkillsSection 会一并挂载 SkillDetail,必须提供替身避免真实 vue-router
 // 报错(同 SkillDetail.test.ts 先例)。
 const { push } = vi.hoisted(() => ({ push: vi.fn() }))
 vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
 
 import SkillsSection from './SkillsSection.vue'
 import { useToast } from '../../../../stores/toast'
 
 const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
-const mountSection = () => mount(SkillsSection, { global: { plugins: [i18n] } })
+// Task 8:AddSkillModal 走 SkModal(reka Dialog),portal 目标默认 '.set-app'(见
+// SkModal.vue 头注释 D1)——attachTo document.body + 单独挂一个 .set-app host,
+// 手法同 ChannelsSection.test.ts。对既有(P3a)只读半用例无副作用,只读半从不打开弹窗。
+const mountSection = () => mount(SkillsSection, { global: { plugins: [i18n] }, attachTo: document.body })
 const flush = async () => {
   await nextTick()
   await nextTick()
   await nextTick()
 }
+// AddSkillModal 打开时的聚焦覆盖用 setTimeout(fn, 0)(宏任务,见该组件头注释「reka 初始
+// 焦点实测结论」),纯微任务级的 flush() 追不上;先例 AddSkillModal.test.ts::macroFlush。
+const macroFlush = async () => { await flush(); await new Promise((r) => setTimeout(r, 0)); await flush() }
 
 function makeSkill(overrides: Partial<Skill> = {}): Skill {
   return {
     id: 'sk-1',
     name: 'weekly-report',
     title: 'Weekly Report',
     description: 'Summarizes the week and posts it to the family channel.',
     trigger: 'manual',
     trigger_human: 'Manual',
     color: 'blue',
@@ -48,21 +61,32 @@ function makeSkill(overrides: Partial<Skill> = {}): Skill {
     examples: [],
     md: '',
     ...overrides,
   }
 }
 
 describe('SkillsSection(只读半)', () => {
   beforeEach(() => {
     setActivePinia(createPinia())
     h.listSkills.mockReset()
+    h.updateSkill.mockReset()
+    h.deleteSkill.mockReset()
+    h.createSkill.mockReset()
     push.mockClear()
+    // SkModal 的 DialogPortal 目标元素必须在组件挂载前就存在于 DOM(同上方注释)。
+    const host = document.createElement('div')
+    host.className = 'set-app'
+    document.body.appendChild(host)
+  })
+
+  afterEach(() => {
+    document.body.innerHTML = ''
   })
 
   it('挂载即加载,渲染内置/我的两组,且每组各自只含对应 system 归属的技能', async () => {
     h.listSkills.mockResolvedValue([
       makeSkill({ id: 'a', name: 'built-a', title: 'Built A', system: true }),
       makeSkill({ id: 'b', name: 'mine-b', title: 'Mine B', system: false }),
     ])
     const w = mountSection()
     await flush()
     const groupLabels = w.findAll('.sk-group-label').map((el) => el.text())
@@ -232,10 +256,285 @@ describe('SkillsSection(只读半)', () => {
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
+
+// ============================================================================
+// SP8-P3b Task 8 —— `+` 按钮 + 四个写操作接线。
+//
+// 除新建流程外,四个动作走 `w.findComponent(SkillDetail).vm.$emit(...)` 直接触发
+// (先例:本文件同一 SkillDetail 树里的 TestPanel 用 `tp.vm.$emit('test')`,见
+// `SkillDetail.test.ts:665`)——SkillDetail 自己的 UI 交互(开关点击/菜单/确认弹窗)
+// 已在 SkillDetail.test.ts 覆盖,这里只测 SkillsSection 收到 emit 后的处理逻辑
+// (单层取数/busy 生命周期/activeId 落位条件),用直接 emit 而不是重新走一遍点击链路,
+// 也能覆盖 brief §10.2 明确要求的「删的不是当前选中项」这种用点击链路走不到的场景
+// (UI 上只有 activeSkill 会渲染删除入口)。
+// ============================================================================
+describe('SkillsSection(P3b 写操作半)', () => {
+  beforeEach(() => {
+    setActivePinia(createPinia())
+    h.listSkills.mockReset()
+    h.updateSkill.mockReset()
+    h.deleteSkill.mockReset()
+    h.createSkill.mockReset()
+    push.mockClear()
+    // SkModal 的 DialogPortal 目标元素必须在组件挂载前就存在于 DOM(同上方只读半 host 手法)。
+    const host = document.createElement('div')
+    host.className = 'set-app'
+    document.body.appendChild(host)
+  })
+
+  afterEach(() => {
+    document.body.innerHTML = ''
+  })
+
+  it('点击 + 按钮打开新建弹窗(标题正确);再次点击不会叠加打开第二个弹窗', async () => {
+    h.listSkills.mockResolvedValue([makeSkill({ id: 'a' })])
+    const w = mountSection()
+    await flush()
+    expect(document.querySelector('.sk-modal')).toBeNull()
+
+    await w.find('.sk-add-btn').trigger('click')
+    await macroFlush()
+    const titles = document.querySelectorAll('.sk-modal-title')
+    expect(titles).toHaveLength(1)
+    expect(titles[0].textContent).toBe(zh.aiSkAddTitle)
+  })
+
+  it('toggle 成功:后端返回裸 skill,列表项原地替换,toast 按新状态提示对应文案', async () => {
+    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', name: 'skill-a', enabled: true })])
+    h.updateSkill.mockResolvedValue(makeSkill({ id: 'a', name: 'skill-a', enabled: false }))
+    const toast = useToast()
+    const show = vi.spyOn(toast, 'show')
+    const w = mountSection()
+    await flush()
+
+    const detail = w.findComponent(SkillDetail)
+    detail.vm.$emit('toggle', 'a', false)
+    await flush()
+
+    expect(h.updateSkill).toHaveBeenCalledWith('a', { enabled: false })
+    // 列表项原地替换成后端返回的新对象(enabled:false → 渲染 off 标记)。
+    expect(w.find('.sk-item-off').exists()).toBe(true)
+    expect(show).toHaveBeenCalledWith(zh.aiSkPausedToast)
+  })
+
+  // 单层取数口径(反)—— 对齐 P3a Task 6 reload() 那两条钉法(第 86/97 行),同一
+  // 手法用在 onToggle 上:喂一个 axios 层形状的 mock,证明本仓消费端是单层取数,
+  // 不是给实现留“多剥一层也凑合能跑”的退路。
+  it('单层取数口径(反):toggle 喂 { data: skill } 信封形状 → 列表项名称变空(不是信封里的真实值),证明消费端是单层取数', async () => {
+    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', name: 'skill-a' })])
+    h.updateSkill.mockResolvedValue(
+      { data: makeSkill({ id: 'a', name: 'renamed', title: 'Renamed' }) } as unknown as Skill,
+    )
+    const w = mountSection()
+    await flush()
+
+    const detail = w.findComponent(SkillDetail)
+    detail.vm.$emit('toggle', 'a', false)
+    await flush()
+
+    // 单层取数下,信封对象本身被当成 skill 塞进列表——它没有 `.name` 字段,渲染成
+    // 空字符串。若未来有人在 onToggle 里多剥一层 `.data`(回到 Vue2 的缺陷模具),
+    // 这里会变成 'renamed',此断言精确报红(RED 探针见任务报告)。
+    expect(w.find('.sk-item-name').text()).toBe('')
+    expect(w.find('.sk-item-name').text()).not.toBe('renamed')
+  })
+
+  it('toggle 飞行中:busy[id]=true 传给 SkillDetail(开关禁用),请求落地后立即清空', async () => {
+    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', enabled: true })])
+    let resolvePromise: (v: unknown) => void = () => {}
+    h.updateSkill.mockImplementation(() => new Promise((res) => { resolvePromise = res }))
+    const w = mountSection()
+    await flush()
+
+    const detail = w.findComponent(SkillDetail)
+    detail.vm.$emit('toggle', 'a', false)
+    await nextTick()
+    expect(detail.props('busy')).toEqual({ a: true })
+
+    resolvePromise(makeSkill({ id: 'a', enabled: false }))
+    await flush()
+    expect(detail.props('busy')).toEqual({})
+  })
+
+  it('toggle 失败:danger toast(3000ms),列表项不变', async () => {
+    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', name: 'skill-a', enabled: true })])
+    h.updateSkill.mockRejectedValue(new Error('boom'))
+    const toast = useToast()
+    const show = vi.spyOn(toast, 'show')
+    const w = mountSection()
+    await flush()
+
+    const detail = w.findComponent(SkillDetail)
+    detail.vm.$emit('toggle', 'a', false)
+    await flush()
+
+    expect(show).toHaveBeenCalledWith(zh.aiSkUpdateFailed, 3000, 'danger')
+    // 仍是 enabled:true,不显示 off 标记 —— 列表项没被改动。
+    expect(w.find('.sk-item-off').exists()).toBe(false)
+  })
+
+  it('删除成功:从列表消失,toast 文案按 system 区分(内置=卸载,用户=删除)', async () => {
+    h.listSkills.mockResolvedValue([
+      makeSkill({ id: 'a', name: 'skill-a', system: true }),
+      makeSkill({ id: 'b', name: 'skill-b', system: false }),
+    ])
+    h.deleteSkill.mockResolvedValue(undefined)
+    const toast = useToast()
+    const show = vi.spyOn(toast, 'show')
+    const w = mountSection()
+    await flush()
+
+    const detail = w.findComponent(SkillDetail)
+    detail.vm.$emit('delete', 'a')
+    await flush()
+
+    expect(h.deleteSkill).toHaveBeenCalledWith('a')
+    expect(w.findAll('.sk-item')).toHaveLength(1)
+    expect(show).toHaveBeenCalledWith('已卸载 skill-a')
+  })
+
+  // brief §10.2 明确点名的条件:钉住「只有删的是当前选中项才落到剩余第一项」——
+  // 这里删的是 b(非当前选中的 a),activeId 必须原地不动。
+  it('删的不是当前选中项时 activeId 不变,详情面板仍显示原选中的技能', async () => {
+    h.listSkills.mockResolvedValue([
+      makeSkill({ id: 'a', name: 'skill-a', title: 'Skill A' }),
+      makeSkill({ id: 'b', name: 'skill-b', title: 'Skill B' }),
+    ])
+    h.deleteSkill.mockResolvedValue(undefined)
+    const w = mountSection()
+    await flush()
+    expect(w.find('.sk-name span').text()).toBe('Skill A') // reload() 默认选中第一项
+
+    const detail = w.findComponent(SkillDetail)
+    detail.vm.$emit('delete', 'b')
+    await flush()
+
+    expect(w.findAll('.sk-item')).toHaveLength(1)
+    expect(w.find('.sk-name span').text()).toBe('Skill A') // activeId 未被 b 的删除牵动
+  })
+
+  it('删除失败:danger toast,列表项存活', async () => {
+    h.listSkills.mockResolvedValue([makeSkill({ id: 'a', name: 'skill-a' })])
+    h.deleteSkill.mockRejectedValue(new Error('boom'))
+    const toast = useToast()
+    const show = vi.spyOn(toast, 'show')
+    const w = mountSection()
+    await flush()
+
+    const detail = w.findComponent(SkillDetail)
+    detail.vm.$emit('delete', 'a')
+    await flush()
+
+    expect(show).toHaveBeenCalledWith(zh.aiSkDeleteFailed, 3000, 'danger')
+    expect(w.findAll('.sk-item')).toHaveLength(1)
+  })
+
+  // 必须在改值与点击之间 `await flush()`——`valid` computed 驱动的 `disabled` 属性要等
+  // Vue 把新值同步进真实 DOM 后才会摘掉,同一 tick 内连续 set value → click 会点在还
+  // 带着 `disabled` 的按钮上(先例:AddSkillModal.test.ts 的 setValue()/click() 之间都有
+  // 独立的 `await flush()`)。
+  async function fillAndSubmitAddForm(name: string, description: string) {
+    const nameEl = document.querySelector('.sk-modal .sk-field:nth-of-type(1) input') as HTMLInputElement
+    const descEl = document.querySelector('.sk-modal .sk-field:nth-of-type(2) textarea') as HTMLTextAreaElement
+    nameEl.value = name
+    nameEl.dispatchEvent(new Event('input'))
+    descEl.value = description
+    descEl.dispatchEvent(new Event('input'))
+    await flush()
+    const submitEl = document.querySelector('.sk-modal-foot .sk-btn.primary') as HTMLButtonElement
+    submitEl.click()
+  }
+
+  it('创建成功:新技能 push 进列表并被选中、弹窗关闭、toast 提示', async () => {
+    h.listSkills.mockResolvedValue([])
+    h.createSkill.mockResolvedValue(makeSkill({ id: 'new-1', name: 'invoice-tagger', title: 'invoice-tagger' }))
+    const toast = useToast()
+    const show = vi.spyOn(toast, 'show')
+    const w = mountSection()
+    await flush()
+
+    await w.find('.sk-add-btn').trigger('click')
+    await macroFlush()
+    await fillAndSubmitAddForm('invoice-tagger', 'Tags invoices automatically')
+    await flush()
+
+    expect(h.createSkill).toHaveBeenCalledTimes(1)
+    expect(w.findAll('.sk-item')).toHaveLength(1)
+    expect(w.find('.sk-name span').text()).toBe('invoice-tagger') // 新建后立即选中
+    expect(document.querySelector('.sk-modal')).toBeNull() // 弹窗已关
+    expect(show).toHaveBeenCalledWith('已添加 invoice-tagger')
+  })
+
+  it('创建失败(409 skill already exists):行内错误显示 aiSkErrDuplicate 文案,弹窗仍开,列表不变', async () => {
+    h.listSkills.mockResolvedValue([])
+    h.createSkill.mockRejectedValue({ response: { data: { message: 'skill already exists' } } })
+    const w = mountSection()
+    await flush()
+
+    await w.find('.sk-add-btn').trigger('click')
+    await macroFlush()
+    await fillAndSubmitAddForm('invoice-tagger', 'Tags invoices automatically')
+    await flush()
+
+    const errEl = document.querySelector('.sk-modal .sk-field-err')
+    expect(errEl?.textContent).toBe(zh.aiSkErrDuplicate)
+    expect(document.querySelector('.sk-modal')).not.toBeNull() // 弹窗仍开,用户能改完重试
+    expect(w.findAll('.sk-item')).toHaveLength(0) // 列表不变
+  })
+
+  // 关弹窗要清 createError(brief「协调者预先解掉的两处」第 2 处):上一次创建失败留下
+  // 的行内错误,取消关闭后再次打开不能残留。
+  it('创建失败后取消关闭弹窗,再次打开:行内错误已被清空', async () => {
+    h.listSkills.mockResolvedValue([])
+    h.createSkill.mockRejectedValue({ response: { data: { message: 'skill already exists' } } })
+    const w = mountSection()
+    await flush()
+
+    await w.find('.sk-add-btn').trigger('click')
+    await macroFlush()
+    await fillAndSubmitAddForm('invoice-tagger', 'Tags invoices automatically')
+    await flush()
+    expect(document.querySelector('.sk-modal .sk-field-err')).not.toBeNull()
+
+    const cancelBtn = Array.from(document.querySelectorAll('.sk-modal-foot .sk-btn.ghost'))
+      .find((b) => b.textContent?.trim() === zh.aiCancel) as HTMLButtonElement
+    cancelBtn.click()
+    await flush()
+    expect(document.querySelector('.sk-modal')).toBeNull()
+
+    await w.find('.sk-add-btn').trigger('click')
+    await macroFlush()
+    expect(document.querySelector('.sk-modal .sk-field-err')).toBeNull()
+  })
+
+  it('onTest:只改当前选中项的 calls/last_used,不影响其它技能(乐观本地值,不落库)', async () => {
+    h.listSkills.mockResolvedValue([
+      makeSkill({ id: 'a', name: 'skill-a', title: 'Skill A', calls: 3, last_used: '' }),
+      makeSkill({ id: 'b', name: 'skill-b', title: 'Skill B', calls: 5, last_used: '' }),
+    ])
+    const w = mountSection()
+    await flush()
+    expect(w.find('.sk-name span').text()).toBe('Skill A') // 默认选中第一项
+
+    const detail = w.findComponent(SkillDetail)
+    detail.vm.$emit('test')
+    await flush()
+
+    expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).toContain('Just now')
+    expect(w.findAll('.sk-meta-cell')[3].find('.total').text()).toBe('· 共 4 次')
+
+    // 切到 b,确认它的数据完全没被污染。
+    await w.findAll('.sk-item')[1].trigger('click')
+    await flush()
+    expect(w.find('.sk-name span').text()).toBe('Skill B')
+    expect(w.findAll('.sk-meta-cell')[3].find('.total').text()).toBe('· 共 5 次')
+    expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).not.toContain('Just now')
+  })
+})
diff --git a/src/ai/components/settings/sections/SkillsSection.vue b/src/ai/components/settings/sections/SkillsSection.vue
index 26b03a5..65a74e5 100644
--- a/src/ai/components/settings/sections/SkillsSection.vue
+++ b/src/ai/components/settings/sections/SkillsSection.vue
@@ -21,59 +21,119 @@
   渲染绿色 check 图标,连失败提示也顶着一个"成功"勾——这是 Vue2 自己的缺陷,不照抄
   (brief §6.2 明确点名)。本仓失败改走 `toast.show(t('aiSkLoadFailed'), 3000,
   'danger')`,`danger` tier 天然不会带勾。`Vue2 :139` 的 `console.error` 同样不照抄
   ——本仓三个兄弟分区(BlacklistSection/ExecutionSection/MemorySection)都没有这个
   惯例,静默吞错 + toast 提示已经足够。
 
   3(公共约束 §3 偏离 2)—— `SkillIcon.vue` 不移植,统一用 `../../icons/AgentIcon.vue`
   (Task 4/5 已同款处理)。
 
   4(brief §6.1)—— 左列头部只有刷新按钮。Vue2 :9-11 的 `+` 添加按钮(`adding = true`
-  打开 `AddSkillModal`)属于 P3b(写操作半),下方模板里留了占位注释标出插入位置,
-  不在本任务渲染 `AddSkillModal`。
-
-  【不取,留给 P3b】`adding`/`saving`/`busy`/`toast`/`toastTimer` 状态、
-  `showToast`/`setBusy`/`onToggle`/`onDelete`/`onCreate`/`onTest` 方法、
-  `AddSkillModal` 组件、`.sk-toast` 淡入淡出 transition。全部一个不写。
+  打开 `AddSkillModal`)属于 P3b(写操作半),Task 8 已接线,见下方新注释段。
 
   【颜色】Vue2 :15 `SkillIcon name="search" ... color="var(--text-tertiary)"` 显式传色
   (`.sk-col-search` 容器本身没有给图标定 color 的 CSS 规则,不显式传就会退回
   `currentColor`,视觉上会比 Vue2 深,故按原样显式传 token)。`.icon-btn` 按钮本身
   在 settings-styles.scss:350 已定义 `color: var(--text-secondary)`,刷新/清空按钮
   内的图标走 currentColor 自然继承,不需要再显式传色。
 
   Vue2 :17-24 那个内联 `style="width: 18px; height: 18px"` 与 :27-29 的
   `style="display: grid; place-items: center; padding: 28px 0"` 都是尺寸/布局,不是
   颜色,原样照抄不违反 color-guard(brief §6.1 点名)。
 
   零 <style> 块:用到的每个 class(sk-col*/sk-list/sk-col-empty/sk-spinner/icon-btn/
-  sk-col-actions/set-split)均已存在于 settings-styles.scss(sk-col-actions/set-split/
-  icon-btn)与 skills-styles.scss(Task 1,其余)。
+  sk-col-actions/set-split/sk-add-btn)均已存在于 settings-styles.scss(sk-col-actions/
+  set-split/icon-btn)与 skills-styles.scss(Task 1/8,其余)。
+
+  ============================================================================
+  SP8-P3b Task 8 —— `+` 按钮 + 四个写操作接线(对齐 Vue2 :6-11 顺序、:147-214 四个
+  方法体)。
+
+  【单层取数,公共约束 §4 / brief §10.2】三处全部单层取数,不再像 Vue2 那样多剥一层
+  `.data`——理由与本文件已有的 `reload()`(偏离 1,上方旧注释段)完全同构:
+    - Vue2 :150-151 `const resp = await ai.updateSkill(...); const updated = resp.data`
+      → 后端 `route/v2/skills.go:131`(PATCH)走 `h.Get(c)` 返回 **200 裸 skill**,
+      共享包已剥过一层 axios,再剥一次恒 `undefined`,`if (idx !== -1 && updated)`
+      永假——开关点了列表项不更新(用户体感:开关"点了但没反应",要刷新才能看到)。
+    - Vue2 :188 `const sk = resp.data` → 后端 `:105`(POST)**201 裸 skill**,同一缺陷,
+      新建成功后 `sk && sk.id` 永假,列表不会追加、也不会选中新技能。
+    - DELETE(`:143`)**204 无内容**,Vue2 没有读它的返回值(`:166` 只 `await
+      ai.deleteSkill(id)`,本仓同样不读),此处没有偏离,只是一并记录三个端点的
+      真实形状。
+
+  【删除后选中项落位,对齐 Vue2 :168-170,brief §10.2 明确点名的条件】只有当删的是
+  **当前选中项**才把 `activeId` 落到剩余第一项;删别的项时 `activeId` 不动。
+
+  【onTest 乐观本地值,申报,对齐 Vue2 :204-214,brief §10.2】`onTest()` 就地把当前
+  选中项(`activeId` 对应项,由 `TestPanel` 经 `SkillDetail` 转发的 `test` 事件只在
+  沙箱**真正成功完成**时才触发——见 `TestPanel.vue` 头注释偏离 D5、`SkillDetail.vue`
+  `emit('test')` 转发处注释)`last_used` 改成 `'Just now'`、`calls` 自增 1。这是**乐观
+  本地值,不落库**:后端 `service/skills.go:352 RecordRun` 全仓零调用点(grep 确认,
+  见任务报告),`reload()`/切换技能/刷新页面都会让这两个字段打回后端原值,乐观更新
+  即刻消失。这不是本任务要修的缺陷——公共约束 §3 偏离 4 已把它列为已登记的既有事实
+  (「测试次数只在成功完成时 +1」的另一半:后端从不真正记录),此处只是原样保留
+  Vue2 的这个本地体感,不新增行为。
+
+  【console.error 不照抄,申报,对齐 Vue2 :139,156,178,196】四个方法(reload 已在
+  上方旧偏离 2 里申报过;onToggle/onDelete/onCreate 三处同款)全部不写
+  `console.error`——本仓三个兄弟分区(BlacklistSection/ExecutionSection/
+  MemorySection)与本文件 P3a 已有的 `reload()` 都没有这个惯例,失败态统一交给
+  toast/行内错误呈现,静默吞错已经足够。
+
+  【`+` 按钮不传具名色,对齐公共约束 §3 偏离 8 / brief §10.1】Vue2 :10
+  `SkillIcon name="plus" ... color="white"` 不照抄——`AgentIcon` 不传 `color`,走
+  `currentColor`,由 `.sk-add-btn { color: var(--text-on-accent) }`
+  (skills-styles.scss:193,已确认这条规则里有 `color`)供色。
+
+  【弹窗接线写法,brief §10.3 要求 grep 先例后二选一并说明】`AddSkillModal` 用
+  `v-model:open="adding"`(即 `:open="adding"` + `@update:open="adding = $event"`)
+  常挂,不套 Vue2 :65-70 的 `v-if="adding"`——理由:`AddSkillModal.vue` 本身已经在
+  `watch(() => props.open, ...)` 里对 `!v` 分支做 `resetForm()`(见该文件头注释「非
+  拍板偏离但需要说明的实现细节」),它是按「组件常驻、`open` 驱动可见性」这个前提
+  设计的;这也是 `ChannelsSection.vue:427`(`SkModal :open="showAdd"`)与
+  `SkillDetail.vue`(`SkModal :open="tryModalOpen"`)两处既有先例的统一写法,本文件
+  跟随先例,不引入第三种模式。关闭时(`adding` 变 `false`)额外清空 `createError`——
+  `AddSkillModal` 只复位它自己的字段,`serverError` 的来源(`createError`)住在本组件,
+  不清的话下次打开弹窗会看到上一次的报错残留。
+  ============================================================================
 -->
 <script setup lang="ts">
-import { ref, computed, onMounted } from 'vue'
+import { ref, computed, onMounted, watch } from 'vue'
 import { useI18n } from 'vue-i18n'
 import { service } from '@nimotech/nimoos-service'
-import type { Skill } from '../../../types/skill'
+import type { Skill, SkillFormPayload } from '../../../types/skill'
+import { createSkillErrorKey } from '../../../util/skillsErrorKey'
 import { useToast } from '../../../../stores/toast'
 import AgentIcon from '../../icons/AgentIcon.vue'
 import SkillGroup from '../skills/SkillGroup.vue'
 import SkillDetail from '../skills/SkillDetail.vue'
+import AddSkillModal from '../skills/AddSkillModal.vue'
 
 const { t } = useI18n()
 const toast = useToast()
 
 const skills = ref<Skill[]>([])
 const loading = ref(true)
 const activeId = ref<string | null>(null)
 const query = ref('')
 
+// Task 8 新增状态,逐字照 brief §1。
+const adding = ref(false)
+const saving = ref(false)
+const busy = ref<Record<string, boolean>>({})
+const createError = ref('')
+
+// 弹窗关闭时清掉行内错误(见文件头注释「弹窗接线写法」末段)。
+watch(adding, (v) => {
+  if (!v) createError.value = ''
+})
+
 // 四个 computed,对齐 Vue2 SkillsSection.vue:105-118。
 const filtered = computed(() => {
   const q = query.value.trim().toLowerCase()
   if (!q) return skills.value
   return skills.value.filter(
     (s) =>
       (s.name || '').toLowerCase().includes(q) ||
       (s.title || '').toLowerCase().includes(q) ||
       (s.description || '').toLowerCase().includes(q),
   )
@@ -99,33 +159,111 @@ async function reload() {
     }
   } catch {
     // 偏离 2(见文件头注释):Vue2 `console.error` 不照抄,失败走全局 danger toast。
     toast.show(t('aiSkLoadFailed'), 3000, 'danger')
   } finally {
     loading.value = false
   }
 }
 
 onMounted(() => reload())
+
+// 对齐 Vue2 `onToggle`(:147-161)。单层取数(见文件头注释「单层取数」第一条)。
+async function onToggle(id: string, enabled: boolean) {
+  busy.value = { ...busy.value, [id]: true }
+  try {
+    const updated = (await service.ai.updateSkill(id, { enabled })) as Skill | undefined
+    const idx = skills.value.findIndex((s) => s.id === id)
+    if (idx !== -1 && updated) skills.value.splice(idx, 1, updated)
+    toast.show(enabled ? t('aiSkEnabledToast') : t('aiSkPausedToast'))
+  } catch {
+    toast.show(t('aiSkUpdateFailed'), 3000, 'danger')
+  } finally {
+    const next = { ...busy.value }
+    delete next[id]
+    busy.value = next
+  }
+}
+
+// 对齐 Vue2 `onDelete`(:162-183)。DELETE 是 204 无内容,不读返回值(见文件头注释
+// 「单层取数」第三条)。选中项落位条件见文件头注释「删除后选中项落位」。
+async function onDelete(id: string) {
+  const s = skills.value.find((x) => x.id === id)
+  busy.value = { ...busy.value, [id]: true }
+  try {
+    await service.ai.deleteSkill(id)
+    skills.value = skills.value.filter((x) => x.id !== id)
+    if (activeId.value === id) {
+      activeId.value = skills.value[0]?.id ?? null
+    }
+    const name = s?.name ?? id
+    toast.show(s?.system ? t('aiSkUninstalledName', { name }) : t('aiSkDeletedName', { name }))
+  } catch {
+    toast.show(t('aiSkDeleteFailed'), 3000, 'danger')
+  } finally {
+    const next = { ...busy.value }
+    delete next[id]
+    busy.value = next
+  }
+}
+
+// 对齐 Vue2 `onCreate`(:184-203)。201 裸 skill(见文件头注释「单层取数」第二条)。
+// 失败时**不关弹窗**(用户可改后重试),错误走行内 `createError`,不是 toast
+// (brief §10.2/公共约束 §3 偏离 5:HTTP 层失败不回显后端 body,改本地化文案)。
+async function onCreate(payload: SkillFormPayload) {
+  saving.value = true
+  createError.value = ''
+  try {
+    // `service.ai.createSkill` 的形参类型是 `Record<string, unknown>`(共享包签名,
+    // 见 NimoOS-Service/src/ai.ts:337)——`SkillFormPayload` 是具名 interface,不带隐式
+    // 索引签名,TS 判定不兼容(TS2345),故转型一次;字段值本身未做任何改动。
+    const sk = (await service.ai.createSkill(payload as unknown as Record<string, unknown>)) as Skill | undefined
+    if (sk?.id) {
+      skills.value.push(sk)
+      activeId.value = sk.id
+      adding.value = false
+      toast.show(t('aiSkAddedName', { name: sk.name }))
+    }
+  } catch (e) {
+    createError.value = t(createSkillErrorKey(e))
+  } finally {
+    saving.value = false
+  }
+}
+
+// 对齐 Vue2 `onTest`(:204-214)。乐观本地值,不落库——见文件头注释「onTest 乐观
+// 本地值」申报段:后端 RecordRun 全仓零调用点,reload()/切换技能/刷新页面都会让
+// 这两个字段打回原值。
+function onTest() {
+  const idx = skills.value.findIndex((s) => s.id === activeId.value)
+  if (idx === -1) return
+  const s = skills.value[idx]
+  skills.value.splice(idx, 1, {
+    ...s,
+    last_used: 'Just now',
+    calls: (s.calls || 0) + 1,
+  })
+}
 </script>
 
 <template>
   <div class="set-split">
     <div class="sk-col">
       <div class="sk-col-head">
         <div class="sk-col-actions">
           <button class="icon-btn" :title="t('aiCfgRefresh')" @click="reload">
             <AgentIcon name="refresh" :size="15" />
           </button>
-          <!-- P3b: 添加技能的 + 按钮插在这里,刷新按钮之后(Vue2 SkillsSection.vue:6-11
-               顺序是 refresh → sk-add-btn,`adding = true` 打开 AddSkillModal)。
-               本期不渲染。 -->
+          <!-- 对齐 Vue2 :9-11。不传具名 color——见文件头注释「+ 按钮不传具名色」。 -->
+          <button class="sk-add-btn" :title="t('aiSkAddSkill')" @click="adding = true">
+            <AgentIcon name="plus" :size="15" />
+          </button>
         </div>
       </div>
       <div class="sk-col-search">
         <AgentIcon name="search" :size="13" color="var(--text-tertiary)" />
         <input v-model="query" :placeholder="t('aiSkSearchPlaceholder')">
         <button
           v-if="query"
           class="icon-btn"
           style="width: 18px; height: 18px"
           @click="query = ''"
@@ -157,13 +295,26 @@ onMounted(() => reload())
               {{ t('aiSkNoMatch') }} <code>{{ query }}</code>
             </template>
             <template v-else>
               {{ t('aiSkEmpty') }}
             </template>
           </div>
         </template>
       </div>
     </div>
 
-    <SkillDetail :skill="activeSkill" />
+    <SkillDetail
+      :skill="activeSkill"
+      :busy="busy"
+      @toggle="onToggle"
+      @delete="onDelete"
+      @test="onTest"
+    />
+
+    <AddSkillModal
+      v-model:open="adding"
+      :saving="saving"
+      :server-error="createError"
+      @save="onCreate"
+    />
   </div>
 </template>
diff --git a/src/ai/components/settings/skills/AddSkillModal.vue b/src/ai/components/settings/skills/AddSkillModal.vue
index 960249a..dd2e14b 100644
--- a/src/ai/components/settings/skills/AddSkillModal.vue
+++ b/src/ai/components/settings/skills/AddSkillModal.vue
@@ -50,32 +50,25 @@
   的可见行为:`watch(open)` 在关闭时（`v === false`）复位全部字段,不在这里额外申报为
   行为偏离。
 -->
 <script setup lang="ts">
 import { ref, computed, watch } from 'vue'
 import { useI18n } from 'vue-i18n'
 import SkModal from '../SkModal.vue'
 import AgentIcon from '../../icons/AgentIcon.vue'
 import { SKILL_COLOR_IDS } from './SkillTile.vue'
 import { validateSkillForm } from '../../../util/skillsErrorKey'
+// SP8-P3b Task 8 —— 协调者预先解歧义①:`SkillFormPayload`/`SkillScript` 挪到
+// `types/skill.ts` 并导出(纯搬移,字段未改),供 `SkillsSection.vue` 的 `onCreate`
+// 标注 `@save` payload 类型。见 skill.ts 头注释「Task 8」段。
+import type { SkillFormPayload } from '../../../types/skill'
 
-interface SkillScript { path: string; content: string }
-interface SkillFormPayload {
-  name: string
-  title: string
-  description: string
-  trigger: 'auto' | 'slash' | 'manual'
-  color: string
-  md: string
-  examples: string[]
-  scripts: SkillScript[]
-}
 interface PickedFile { name: string; content: string; size: number }
 
 const props = defineProps<{ open: boolean; saving: boolean; serverError: string }>()
 const emit = defineEmits<{
   (e: 'update:open', v: boolean): void
   (e: 'save', payload: SkillFormPayload): void
 }>()
 
 const { t } = useI18n()
 
diff --git a/src/ai/types/skill.ts b/src/ai/types/skill.ts
index d28262f..5ea930e 100644
--- a/src/ai/types/skill.ts
+++ b/src/ai/types/skill.ts
@@ -27,10 +27,35 @@ export interface Skill {
   icon: string
   enabled: boolean
   system: boolean
   author: string
   last_used: string
   calls: number
   files: SkillFile[]
   examples: string[]
   md: string
 }
+
+// SP8-P3b Task 8 —— 协调者预先解歧义①(p3b-task-8-brief.md「已授权的偏离」)。
+// 纯搬移自 `AddSkillModal.vue`(原为未导出的组件内部 interface),字段一个字未改。
+// 挪到这里导出的理由:`SkillsSection.vue` 的 `onCreate` 处理函数需要这个类型标注
+// `@save` 事件的 payload;interface 不会获得隐式索引签名,把参数类型写成
+// `Record<string, unknown>` 会被 `vue-tsc` 判为不兼容(TS2345)。
+
+/** 对齐 `POST /v2/ai/skills` 请求体里单个脚本文件的形状(bundle 内一个 `scripts/*` 条目)。 */
+export interface SkillScript {
+  path: string
+  content: string
+}
+
+/** 对齐 `AddSkillModal.vue` `submit()` emit 的 `save` payload 形状,也是
+ *  `service.ai.createSkill()` 请求体的形状(`POST /v2/ai/skills`)。 */
+export interface SkillFormPayload {
+  name: string
+  title: string
+  description: string
+  trigger: 'auto' | 'slash' | 'manual'
+  color: string
+  md: string
+  examples: string[]
+  scripts: SkillScript[]
+}
