# P3b 终审修复轮 — f6792a8..HEAD

## commits
3b108f8 sp8-ai P3b FINAL fix: C1 slugify-before-validate + I1 pendingTryId leak + I2 empty-error-as-success + 5 minors

## diff --stat
 .../components/settings/sections/SkillsSection.vue | 15 +++-
 .../settings/skills/AddSkillModal.test.ts          | 27 ++++++-
 .../components/settings/skills/SkillDetail.test.ts | 35 +++++++++
 src/ai/components/settings/skills/SkillDetail.vue  | 21 ++++-
 .../components/settings/skills/TestPanel.test.ts   | 24 ++++++
 src/ai/components/settings/skills/TestPanel.vue    | 42 +++++++---
 src/ai/styles/skills-styles.scss                   |  8 +-
 src/ai/types/skill.ts                              | 13 +++-
 src/ai/util/sandboxRun.test.ts                     | 10 ++-
 src/ai/util/sandboxRun.ts                          | 13 +++-
 src/ai/util/skillsErrorKey.test.ts                 | 89 +++++++++++++++++++---
 src/ai/util/skillsErrorKey.ts                      | 48 +++++++++++-
 12 files changed, 303 insertions(+), 42 deletions(-)

## diff -U10
diff --git a/src/ai/components/settings/sections/SkillsSection.vue b/src/ai/components/settings/sections/SkillsSection.vue
index 65a74e5..53acaac 100644
--- a/src/ai/components/settings/sections/SkillsSection.vue
+++ b/src/ai/components/settings/sections/SkillsSection.vue
@@ -161,27 +161,38 @@ async function reload() {
     // 偏离 2(见文件头注释):Vue2 `console.error` 不照抄,失败走全局 danger toast。
     toast.show(t('aiSkLoadFailed'), 3000, 'danger')
   } finally {
     loading.value = false
   }
 }
 
 onMounted(() => reload())
 
 // 对齐 Vue2 `onToggle`(:147-161)。单层取数(见文件头注释「单层取数」第一条)。
+//
+// 【P3b 终审 M5 修复】此前 `idx !== -1 && updated` 为假(后端返回意外形状,如空体)
+// 时列表不更新,却照样走 `try` 分支底部弹成功 toast——今天 PATCH 恒返 200 裸
+// skill 不会触发,但一旦触发,列表原地不动 + 一条"已启用/已暂停"的假成功提示,叠加
+// `SkillDetail.vue` D4 的 `watch(enabled)`(等的正是这个 `updated` 落到 props 上)会
+// 让 D4 弹窗永远等不到 `enabled` 真的变化、卡在打开状态,用户毫无线索。改成:只有
+// 真的替换了列表项才算成功;否则走失败分支(与请求异常同一条 danger toast)。
 async function onToggle(id: string, enabled: boolean) {
   busy.value = { ...busy.value, [id]: true }
   try {
     const updated = (await service.ai.updateSkill(id, { enabled })) as Skill | undefined
     const idx = skills.value.findIndex((s) => s.id === id)
-    if (idx !== -1 && updated) skills.value.splice(idx, 1, updated)
-    toast.show(enabled ? t('aiSkEnabledToast') : t('aiSkPausedToast'))
+    if (idx !== -1 && updated) {
+      skills.value.splice(idx, 1, updated)
+      toast.show(enabled ? t('aiSkEnabledToast') : t('aiSkPausedToast'))
+    } else {
+      toast.show(t('aiSkUpdateFailed'), 3000, 'danger')
+    }
   } catch {
     toast.show(t('aiSkUpdateFailed'), 3000, 'danger')
   } finally {
     const next = { ...busy.value }
     delete next[id]
     busy.value = next
   }
 }
 
 // 对齐 Vue2 `onDelete`(:162-183)。DELETE 是 204 无内容,不读返回值(见文件头注释
diff --git a/src/ai/components/settings/skills/AddSkillModal.test.ts b/src/ai/components/settings/skills/AddSkillModal.test.ts
index 3503036..3fa5e59 100644
--- a/src/ai/components/settings/skills/AddSkillModal.test.ts
+++ b/src/ai/components/settings/skills/AddSkillModal.test.ts
@@ -102,39 +102,62 @@ describe('AddSkillModal', () => {
       title: 'invoice-tagger',
       description: 'Tags invoices automatically',
       trigger: 'auto',
       color: 'blue',
       md: '',
       examples: [],
       scripts: [{ path: 'scripts/run.py', content: 'print(1)' }],
     })
   })
 
-  it('名称非法(含大写/下划线)→ 行内错误(aiSkErrBadId)且不 emit save(钉住偏离 2)', async () => {
+  // 【P3b 终审 C1】此前用 'Invoice_Tagger' 当"非法名字"的例子——但后端先
+  // `slugify(name)` 再校验(skills_store.go:221),'Invoice_Tagger' 会被 slug 成合法
+  // 的 'invoice-tagger',后端/Vue2 都能建成功,不是一个真的非法例子(把这条钉成"非法"
+  // 就是把 C1 那个功能回退编码进了断言)。换成 slugify 之后仍然是空串的真非法输入
+  // (纯中文,没有任何 [a-z0-9] 字符能保留下来)。
+  it('名称非法(slugify 后仍无合法字符,如纯中文)→ 行内错误(aiSkErrBadId)且不 emit save(钉住偏离 2)', async () => {
     const w = mountModal()
     await macroFlush()
-    setValue(nameInput(), 'Invoice_Tagger')
+    setValue(nameInput(), '仅中文技能名')
     setValue(descInput(), '合法描述')
     await flush()
     // valid 只查两字段非空,不做格式校验 —— 按钮此时应可点
     expect(submitBtn().disabled).toBe(false)
 
     submitBtn().click()
     await flush()
 
     const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
     expect(err).not.toBeNull()
     expect(err.getAttribute('role')).toBe('alert')
     expect(err.textContent).toBe(zh.aiSkErrBadId)
     expect(w.emitted('save')).toBeUndefined()
   })
 
+  // 【P3b 终审 C1,补充用例】'Invoice_Tagger' 这类"看起来非法但 slugify 后合法"的
+  // 名字必须能建成功——payload 里的 name/title 仍是原始 trimmed 输入(后端自己再
+  // slugify 一次生成 id),前端不改写用户输入。
+  it('名称含大写/下划线但 slugify 后合法(如 "Invoice_Tagger")→ 校验通过、正常 emit save', async () => {
+    const w = mountModal()
+    await macroFlush()
+    setValue(nameInput(), 'Invoice_Tagger')
+    setValue(descInput(), '合法描述')
+    await flush()
+
+    submitBtn().click()
+    await flush()
+
+    expect(document.querySelector('.sk-modal .sk-field-err')).toBeNull()
+    expect(w.emitted('save')).toHaveLength(1)
+    expect(w.emitted('save')![0][0]).toMatchObject({ name: 'Invoice_Tagger', title: 'Invoice_Tagger' })
+  })
+
   it('描述超过 256 个 Unicode 码点 → 行内错误(aiSkErrDescTooLong)且不 emit save', async () => {
     const w = mountModal()
     await macroFlush()
     setValue(nameInput(), 'invoice-tagger')
     setValue(descInput(), 'a'.repeat(257))
     await flush()
 
     submitBtn().click()
     await flush()
 
diff --git a/src/ai/components/settings/skills/SkillDetail.test.ts b/src/ai/components/settings/skills/SkillDetail.test.ts
index 5f0809b..44feecf 100644
--- a/src/ai/components/settings/skills/SkillDetail.test.ts
+++ b/src/ai/components/settings/skills/SkillDetail.test.ts
@@ -314,20 +314,30 @@ describe('SkillDetail(只读半 + P3b 写操作半)', () => {
   })
 
   it('更多菜单:外部 mousedown 关闭菜单,菜单内部点击不触发外部关闭逻辑', async () => {
     const w = mountDetail(makeSkill())
     await w.find('.sk-pill-more').trigger('click')
     expect(w.find('.sk-menu').exists()).toBe(true)
 
     document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
     await flush()
     expect(w.find('.sk-menu').exists()).toBe(false)
+
+    // 【P3b 终审 M2】上面只测了"外部"，标题里承诺的"菜单内部点击不触发外部关闭逻辑"
+    // 之前零断言——`useClickOutside` 判定用 `el.contains(event.target)`（见该 composable
+    // 头注释），`.sk-menu` 是 `menuWrap` 的子元素，在它内部 mousedown 理应被判定为
+    // "在内部"、不关闭菜单。这里补回标题承诺的那一半。
+    await w.find('.sk-pill-more').trigger('click')
+    expect(w.find('.sk-menu').exists()).toBe(true)
+    w.find('.sk-menu button').element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
+    await flush()
+    expect(w.find('.sk-menu').exists()).toBe(true)
   })
 
   it('菜单项顺序与文案:暂停/启用 → 复制 SKILL.md → 导出技能 → <hr> → 危险项', async () => {
     const w = mountDetail(makeSkill({ enabled: true, system: false }))
     await w.find('.sk-pill-more').trigger('click')
     const menu = w.find('.sk-menu')
     const buttons = menu.findAll('button')
     expect(buttons).toHaveLength(4)
     expect(buttons[0].text()).toContain('临时禁用')
     expect(buttons[1].text()).toContain('复制 SKILL.md')
@@ -575,20 +585,45 @@ describe('SkillDetail(只读半 + P3b 写操作半)', () => {
     const w = mountDetail(makeSkill({ id: 'sk-7', enabled: false }))
     await w.find('.sk-pill-try').trigger('click')
     await flush()
     ;(host.querySelector('.sk-btn.ghost') as HTMLButtonElement).click()
     await flush()
     expect(host.querySelector('.sk-modal')).toBeNull()
     expect(push).not.toHaveBeenCalled()
     expect(w.emitted('toggle')).toBeUndefined()
   })
 
+  // 【P3b 终审 I1】点「取消」/`skill.id` 变化之外,SkModal 自带的 X 关闭按钮
+  // (`.sk-x`)、reka 的 Esc、点遮罩都只走 `@update:open`——此前这条路径没清
+  // `pendingTryId`,挂号悬着后,用户之后随便用顶部条开关把这个技能启用一次(与
+  // 「启用并试用」毫无关系的操作)也会被误判成"待跳转"而 push。RED 验证:把
+  // `onTryModalOpenChange` 里的 `if (!v) pendingTryId.value = null` 删掉 → 这条精确
+  // 报红(push 被调用 1 次,断言期望 0 次)。
+  it('D4:用 .sk-x 关闭弹窗(不是取消按钮)后清挂号——之后手动开关启用该技能不应触发 push', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-8', enabled: false }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
+    await flush()
+    expect(w.emitted('toggle')).toEqual([['sk-8', true]])
+
+    // toggle 请求“失败”(父组件从不把 enabled 改成 true)——用 X 关掉弹窗,而不是点取消。
+    ;(host.querySelector('.sk-x') as HTMLButtonElement).click()
+    await flush()
+    expect(host.querySelector('.sk-modal')).toBeNull()
+
+    // 之后用户自己在顶部条把这个技能启用(与「启用并试用」无关的独立操作)。
+    await w.setProps({ skill: makeSkill({ id: 'sk-8', enabled: true }) })
+    await flush()
+    expect(push).not.toHaveBeenCalled()
+  })
+
   it('D4「启用并试用」挂号后切到别的技能,原技能迟到的 enabled=true 不再触发 push(残留清除,pendingTryId 一次性语义)', async () => {
     const w = mountDetail(makeSkill({ id: 'sk-10', enabled: false }))
     await w.find('.sk-pill-try').trigger('click')
     await flush()
     ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
     await flush()
     expect(w.emitted('toggle')).toEqual([['sk-10', true]])
 
     // 响应到达前,用户已经切到另一个技能——skill.id 变化的 watch 会清掉挂号。
     await w.setProps({ skill: makeSkill({ id: 'sk-11', enabled: false }) })
diff --git a/src/ai/components/settings/skills/SkillDetail.vue b/src/ai/components/settings/skills/SkillDetail.vue
index ecb7fd2..b6433a4 100644
--- a/src/ai/components/settings/skills/SkillDetail.vue
+++ b/src/ai/components/settings/skills/SkillDetail.vue
@@ -299,24 +299,37 @@ function tryInChat() {
 // 弹窗必须保持打开直到父组件真的把 `enabled` 改成 true;失败时弹窗留在原地,用户能
 // 再点一次或点取消。是否真的启用成功由父组件(SkillsSection)决定——本组件不直接改
 // `skill.enabled`,只观察 props 上的值(下面的 watch)。
 function confirmEnableAndTry() {
   const s = props.skill
   if (!s) return
   pendingTryId.value = s.id
   emit('toggle', s.id, true)
 }
 
-// D4「取消」:清除路径②(见文件头注释)。不 emit toggle,不跳转。
+// 【P3b 终审 I1 修复】D4 弹窗的关闭方式不止「取消」按钮:`SkModal` 自带 `.sk-x` 关闭
+// 按钮 + reka Dialog 的 Esc / 点遮罩关闭,这三种都只走 `@update:open`,此前只有「取消」
+// 与「skill.id 变化」两处清了 `pendingTryId`,漏了这条——挂号悬着后,用户若之后自己在
+// 顶部条把这个技能的开关打开(与「启用并试用」完全无关的操作),下面的
+// `watch(enabled)` 仍会命中 `s.id === pendingTryId.value && enabled === true`,把
+// 用户莫名跳转到 `/ai/agent`。这正是清除路径①头注释要防的场景,只是漏了「关闭这个
+// 弹窗」这一条入口。统一走这一个 handler:任何把弹窗关闭的方式(取消按钮 / X / Esc /
+// 点遮罩)都经它清挂号,不再各自维护一份。
+function onTryModalOpenChange(v: boolean) {
+  tryModalOpen.value = v
+  if (!v) pendingTryId.value = null
+}
+
+// D4「取消」:清除路径②(见文件头注释)。不 emit toggle,不跳转——复用上面的 handler,
+// 与 X/Esc/遮罩走同一条清理逻辑。
 function cancelTryModal() {
-  tryModalOpen.value = false
-  pendingTryId.value = null
+  onTryModalOpenChange(false)
 }
 
 // D4 一次性跳转:只在「当前 props.skill 就是发起挂号的那个技能」且它的 `enabled`
 // 变成 true 时才**同一步**关弹窗 + 跳转,随即清空挂号(清除路径①)。toggle 失败时
 // 父组件不会把 `enabled` 改成 true,这里就永远不会看到 true,弹窗保持打开
 // (评审后修订,见文件头注释)——不需要额外的失败分支/定时器。显式核对
 // `s.id === pendingTryId.value` 而不是只信任「skill.id 变化时复位」那处 watch 已经
 // 清空了它:两个 watch 都挂在同一个 `props.skill` 上,不依赖 Vue 内部对同一 tick 里
 // 多个 watcher 的调度顺序这个实现细节。
 watch(() => props.skill?.enabled, (enabled) => {
@@ -501,21 +514,21 @@ watch(() => props.skill?.enabled, (enabled) => {
           </DialogOverlay>
         </DialogPortal>
       </DialogRoot>
 
       <!-- D4:停用技能「在对话中试用」先提示(见文件头注释「偏离申报 3」)。这个弹窗
            Vue2 里不存在,没有逐像素复刻目标,所以用标准壳 SkModal,不套上面那份 reka
            原语手拼(两种外壳并存的理由见文件头注释「两种弹窗外壳并存,不是不一致」)。 -->
       <SkModal
         :open="tryModalOpen"
         :title="t('aiSkTryDisabledTitle')"
-        @update:open="tryModalOpen = $event"
+        @update:open="onTryModalOpenChange"
       >
         <p>{{ t('aiSkTryDisabledBody') }}</p>
         <template #footer>
           <button class="sk-btn ghost" @click="cancelTryModal">{{ t('aiCancel') }}</button>
           <!-- busy[skill.id] 为真时禁用(toggle 请求飞行中),防止重复点击叠加发出多次
                toggle 请求——自主判断范围,见文件头注释「评审后修订」末段。 -->
           <button
             class="sk-btn primary"
             :disabled="!!busy[skill.id]"
             @click="confirmEnableAndTry"
diff --git a/src/ai/components/settings/skills/TestPanel.test.ts b/src/ai/components/settings/skills/TestPanel.test.ts
index 9900c1d..6c76e29 100644
--- a/src/ai/components/settings/skills/TestPanel.test.ts
+++ b/src/ai/components/settings/skills/TestPanel.test.ts
@@ -201,20 +201,44 @@ describe('TestPanel', () => {
     const cap = captureNextRun()
     await w.find('.sk-test-input button').trigger('click')
 
     cap.onEvent({ type: 'error', content: 'nope' })
     cap.resolve()
     await flushPromises()
 
     expect(w.emitted('test')).toBeUndefined()
   })
 
+  // 【P3b 终审 I2】后端 agent/agent.py:999 发 `{"type":"error","content": str(e)}`,
+  // 对某些异常 `str(e)` 是空串——此前 reducer/面板拿 `error !== ''` 判定失败,空串会
+  // 被误判成成功(渲染出「用时  毫秒」+「沙箱已关闭」的成功文案),还会多算一次
+  // emit('test'),同时踩穿 D5「只在成功完成时 +1」。RED 验证:把
+  // `sandboxRun.ts` 的 error 分支改回不写 `failed` / 把 TestPanel 的判断改回
+  // `!sandbox.error` → 这条精确报红(失败态 label 消失、emit 变成有值)。
+  it('error 事件 content 为空串时仍判定为失败(不是成功),且不 emit(test)(钉住 P3b 终审 I2)', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onEvent({ type: 'error', content: '' })
+    cap.onEvent({ type: 'done' })
+    cap.resolve()
+    await flushPromises()
+
+    const failed = w.find('.sk-test-result .label[data-state="failed"]')
+    expect(failed.exists()).toBe(true)
+    // 成功态的「用时…毫秒」文案不应该出现。
+    expect(w.find('.sk-test-result').text()).not.toContain('沙箱已关闭')
+    expect(w.emitted('test')).toBeUndefined()
+  })
+
   it('HTTP 失败(而非 SSE error 事件)时也不 emit(test)', async () => {
     const w = mountPanel(makeSkill())
     await w.find('.sk-test-input textarea').setValue('go')
     const cap = captureNextRun()
     await w.find('.sk-test-input button').trigger('click')
 
     cap.onError({ status: 422 })
     cap.resolve()
     await flushPromises()
 
diff --git a/src/ai/components/settings/skills/TestPanel.vue b/src/ai/components/settings/skills/TestPanel.vue
index e2fbf44..c166e2b 100644
--- a/src/ai/components/settings/skills/TestPanel.vue
+++ b/src/ai/components/settings/skills/TestPanel.vue
@@ -16,23 +16,24 @@
   两者叠加等于每次「测试」都双重谎报一次成功调用。本仓改为只有
   `state === 'done' && !sandbox.error`(即真正跑完且没有失败)才 `emit('test')`。
 
   【HTTP 层失败不回显后端 body】承 P2b「错误不再回显后端 JSON」——onError 拿到
   `{status}`(非 HTTP 形状则没有 status)时,只用本地化串 `aiSkTestHttpFailed`/
   `aiSkTestFailed` 兜底,绝不把 `body` 塞进界面。SSE `error` **事件**走的是
   reduceSandboxEvent 已经写好的 `sandbox.error`(后端人类可读文本,如
   "sandbox timed out"),原样显示,不算回显后端 JSON,不冲突。
 
   【失败态样式偏离(协调者预先解歧义,见 p3b-task-4-brief.md 正文)】Vue2 :92-98
-  的失败态靠模板内联样式:`.label` 上 `style="color: var(--danger)"`,`.bullet` 上
-  `style="background: var(--danger); box-shadow: 0 0 0 3px rgba(255,59,48,0.18)"`——
-  后者是字面量 rgba(),违反本仓配色硬约束,内联颜色本身也违规(公共约束 §6)。
+  的失败态靠模板内联样式:`.label` 上内联 `color: var(--danger)`,`.bullet` 上内联
+  背景色 + 一圈约 18% 不透明度的 iOS 红发光圈(字面量写死的 rgba,颜色即 --danger
+  token 现在的色值)——后者违反本仓配色硬约束(禁字面量 rgba),内联颜色本身也违规
+  (公共约束 §6)。
   改为:`.label` 加 `data-state="failed"`,颜色规则搬进
   skills-styles.scss `.sk-test-result .label` 的 `&[data-state="failed"]` 分支
   (与既有 running 分支同级,发光圈用 color-mix 派生,手法同该文件 :506-509 的
   success 态),模板里零内联颜色。
 
   【机械改动,非逻辑偏离】Vue2 :34 Run 按钮图标 `color="white"` 是具名色字面量,
   硬约束禁止(即便 color-guard 只扫 `<style>` 块抓不到 prop 里的字面量,规则本身
   覆盖"一切可见颜色")。按钮容器已在 skills-styles.scss:478 用
   `color: var(--text-on-accent)` 承载这个前景色(disabled 态另有 :482 的
   --text-quaternary),这里改成 `color="currentColor"` 继承,视觉结果与 Vue2
@@ -56,20 +57,31 @@ import type { Skill } from '../../../types/skill'
 import { initSandboxState, reduceSandboxEvent } from '../../../util/sandboxRun'
 import { runSkillTest } from '../../../services/skillTestTransport'
 import AgentIcon from '../../icons/AgentIcon.vue'
 
 // Vue2 TestPanel.vue:110-113 `skill: { type: Object, required: true }`。
 // `runFn`(:113)不移植,见文件头注释——本组件自己调用 T3 的 runSkillTest。
 const props = defineProps<{ skill: Skill }>()
 
 // 对齐 Vue2 SkillsSection.vue:204-214 消费方的期望事件名,但触发条件按偏离 D5
 // 收紧为「只在成功完成时」,见文件头注释。
+//
+// 【P3b 终审 M3,显式申报】设计文档 §6 与 Vue2 `SkillsSection.vue:204`
+// (`onTest({id})`)的事件都带 `id` payload,本文件落成裸 `emit('test')`——这是一处
+// 未申报的偏离,终审已指出。补交申报而不是改回带 id:探针实测过当前无害——
+// `SkillDetail.vue` 用 `:key="skill.id"` 挂载本组件,永远只为 `activeSkill` 渲染
+// 一个实例,父组件 `SkillsSection.onTest()` 读的 `activeId` 因此恒等于本组件当前
+// `skill.id`;而且 Vue 3 的 `emit` 对已卸载实例是 no-op,切换技能时中断的沙箱不会
+// 把迟到的 `test` 记到新技能头上(`watch(skill.id)`/`onBeforeUnmount` 已经 abort 掉
+// 请求)。若未来 `SkillDetail`/`SkillsSection` 的挂载方式变化(不再靠 `:key` 强制
+// 单实例),这个假设会失效,应改回 `emit('test', { id: skill.id })` 并让父组件用
+// payload 定位,而不是继续依赖 `activeId` 隐式相等。
 const emit = defineEmits<{ test: [] }>()
 
 const { t } = useI18n()
 
 // 对齐 Vue2 data() :115-121。output.tokens 死分支不移植(SandboxState 无该字段)。
 const prompt = ref('')
 const state = ref<'idle' | 'running' | 'done'>('idle')
 const sandbox = ref(initSandboxState())
 // 对齐 Vue2 run() 里的局部变量 startedAt(:157)——普通变量,不是 ref,不需要触发渲染。
 let startedAt = 0
@@ -99,37 +111,41 @@ function onEvent(ev: Record<string, unknown>) {
 
 // 对齐 Vue2 onEvent 里 ev.type === 'error' 走后端文本的分支之外的、传输层失败路径
 // （T3 runSkillTest 的 onError 回调:非 2xx HTTP 或非 AbortError 的异常）。
 // 有 status → HTTP 层失败本地化串;拿不到 status（非 HTTP 形状）→ 通用兜底串。
 // 两种都不回显后端 body（见文件头注释「HTTP 层失败不回显后端 body」）。
 function onError(e: unknown) {
   const err = e as { status?: number } | null | undefined
   const msg = err && typeof err.status === 'number'
     ? t('aiSkTestHttpFailed', { status: err.status })
     : t('aiSkTestFailed')
-  sandbox.value = { ...sandbox.value, error: msg }
+  // failed 显式置真(P3b 终审 I2 同一处修复的对称写法——传输层失败本来就一定有一条
+  // 非空的本地化文案,这里不依赖 error 是否非空来判定失败态)。
+  sandbox.value = { ...sandbox.value, error: msg, failed: true }
 }
 
 // 对齐 Vue2 run()(:152-179),但改用 T3 的 Promise 形状而非 Vue2 的
 // `{ onEvent, onClose } => { close }` 回调协议。await 返回后若仍处于 running
 // （即从未收到 SSE 'done' 事件、连接就已关闭)→ 兜底置 done,对齐 Vue2 onClose
-// (:174-177) 的 fallback 语义。仅在成功完成(done 且无 error)时才 emit('test')
-// （偏离 D5,见文件头注释)。
+// (:174-177) 的 fallback 语义。仅在成功完成(done 且未 failed)时才 emit('test')
+// （偏离 D5,见文件头注释)。判 `sandbox.value.failed` 而不是 `!sandbox.value.error`
+// (P3b 终审 I2)——`error` 事件的 content 对某些后端异常是空串,`!error` 会把这种
+// 失败误判成成功,连带让 D5「只在成功完成时 +1」失守。
 async function run() {
   if (!canRun.value) return
   state.value = 'running'
   sandbox.value = initSandboxState()
   startedAt = Date.now()
   ctrl = new AbortController()
   await runSkillTest(props.skill.id, prompt.value.trim(), ctrl.signal, onEvent, onError)
   if (state.value === 'running') state.value = 'done'
-  if (state.value === 'done' && !sandbox.value.error) emit('test')
+  if (state.value === 'done' && !sandbox.value.failed) emit('test')
 }
 
 // 对齐 Vue2 watch: 'skill.id'(:133-141)——原样保留复位逻辑做 1:1 视觉/交互对照。
 // 注意:T7 挂载本组件时会带 `:key="skill.id"`,那种情况下整个组件会被销毁重建,
 // 这个 watcher 实际上不会触发(key 变化直接走 unmount→mount,不会保留组件实例)。
 // 所以真正兜底的清理必须落在下面的 onBeforeUnmount,不能只靠这个 watcher。
 watch(() => props.skill.id, () => {
   prompt.value = ''
   state.value = 'idle'
   sandbox.value = initSandboxState()
@@ -172,21 +188,21 @@ onBeforeUnmount(() => {
             rows="2"
             @keydown="onKeydown"
           />
           <button :disabled="!canRun" @click="run">
             <AgentIcon name="play" :size="11" color="currentColor" />
             {{ state === 'running' ? t('aiSkTestRunning') : t('aiSkTestRun') }}
           </button>
         </div>
 
         <div
-          v-if="skill.examples && skill.examples.length && state === 'idle' && sandbox.steps.length === 0 && !sandbox.error"
+          v-if="skill.examples && skill.examples.length && state === 'idle' && sandbox.steps.length === 0 && !sandbox.failed"
           class="sk-test-result"
           style="background: transparent; border: 0; padding: 8px 2px 0"
         >
           <div class="label" style="margin: 0">
             <AgentIcon name="sparkle" :size="11" />
             {{ t('aiSkTestExamples') }}
           </div>
           <div class="ex">
             <button
               v-for="(ex, i) in skill.examples"
@@ -197,40 +213,44 @@ onBeforeUnmount(() => {
         </div>
 
         <div v-if="state === 'running'" class="sk-test-result">
           <div class="label" data-state="running">
             <span class="bullet" />
             {{ t('aiSkTestRunningLabel') }}
           </div>
           <div>{{ t('aiSkTestBootstrapping', { name: skill.name }) }}</div>
         </div>
 
-        <div v-if="state === 'done' && !sandbox.error" class="sk-test-result">
+        <div v-if="state === 'done' && !sandbox.failed" class="sk-test-result">
           <div class="label">
             <span class="bullet" />
             {{ t('aiSkTestCompleted', { ms: sandbox.ms }) }}
           </div>
           <div
             v-for="(s, i) in sandbox.steps"
             :key="i"
             class="step-row"
           >
             <AgentIcon name="check" :size="12" color="var(--success)" />
             <div>{{ s.text }}</div>
           </div>
           <div class="footer-note">
             <AgentIcon name="check" :size="11" />
             {{ t('aiSkTestClosed') }}
           </div>
         </div>
 
-        <div v-if="state === 'done' && sandbox.error" class="sk-test-result">
+        <div v-if="state === 'done' && sandbox.failed" class="sk-test-result">
           <div class="label" data-state="failed">
             <span class="bullet" />
             {{ t('aiSkTestFailed') }}
           </div>
-          <div>{{ sandbox.error }}</div>
+          <!-- P3b 终审 I2:error 事件的 content 可能是空串(后端某些异常 str(e) 为
+               空)——设计 §5「空则留空，由 UI 填本地化兜底文案」这半此前没做,空串
+               会原样渲染成一段空白正文。兜底复用既有键 aiSkTestFailed(上面 label
+               已经在用),不新增键。 -->
+          <div>{{ sandbox.error || t('aiSkTestFailed') }}</div>
         </div>
       </div>
     </div>
   </div>
 </template>
diff --git a/src/ai/styles/skills-styles.scss b/src/ai/styles/skills-styles.scss
index a7f330c..90a430f 100644
--- a/src/ai/styles/skills-styles.scss
+++ b/src/ai/styles/skills-styles.scss
@@ -505,24 +505,24 @@
       background: var(--success);
       // Vue2 skills-styles.scss:465 原为 iOS 绿色约 18% 透明度发光圈字面量——
       // 与 .sk-meta-cell 的「启用」态发光圈(本档 :302-306)完全同族同比例,
       // 同样用 color-mix 从 --success 派生。
       box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 18%, transparent);
     }
     &[data-state="running"] .bullet {
       background: var(--accent);
       animation: skill-pulse 1.4s ease-in-out infinite;
     }
-    // SP8-P3b Task 4 —— 失败态。Vue2 TestPanel.vue:92-98 靠模板内联样式实现:
-    // `.label` 上 `style="color: var(--danger)"`,`.bullet` 上
-    // `style="background: var(--danger); box-shadow: 0 0 0 3px rgba(255,59,48,0.18)"`。
-    // 后者是字面量 rgba() 且内联颜色本身违反本仓配色硬约束(公共约束 §6),改成
+    // SP8-P3b Task 4 —— 失败态。Vue2 TestPanel.vue:92-98 靠模板内联样式实现:`.label`
+    // 上内联 `color: var(--danger)`,`.bullet` 上内联背景色 + 一圈约 18% 不透明度的
+    // iOS 红发光圈(字面量写死的 rgba,颜色即 --danger token 现在的色值)——后者是
+    // 字面量 rgba() 且内联颜色本身违反本仓配色硬约束(公共约束 §6),改成
     // 静态 CSS 分支:发光圈用 color-mix 从 --danger 派生,手法与上方 :506-509 的
     // success 态发光圈同族同比例(18% 不透明度)。
     &[data-state="failed"] {
       color: var(--danger);
       .bullet {
         background: var(--danger);
         box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 18%, transparent);
       }
     }
   }
diff --git a/src/ai/types/skill.ts b/src/ai/types/skill.ts
index 5ea930e..cb21967 100644
--- a/src/ai/types/skill.ts
+++ b/src/ai/types/skill.ts
@@ -1,15 +1,22 @@
 // SP8-P3a Task 2 —— 逐字照后端 DTO `NimoOS-AI/service/skills.go:10-32` 的 json tag。
 // 字段顺序与命名与后端 struct 一一对应,不新增/不省略字段(`trigger_human` 见下方
-// 单独说明)。后端 `GET /v2/ai/skills`、`GET /v2/ai/skills/:id` 均直接
+// 单独说明)。后端 `GET /v1/ai/skills`、`GET /v1/ai/skills/:id` 均直接
 // `c.JSON(200, out)` 裸序列化该 struct(或其数组)——无信封,消费端单层取数
 // (公共约束 §4)。
+//
+// 【P3b 终审 M4】本文件三处路径注释此前误写成 `/v2/ai/skills`——已改成 `/v1/ai/skills`。
+// 真实前缀:Go 侧 `route/v2.go:88` 是 `e.Group(common.V2APIPath)`,
+// `common/constants.go:23` 定义 `V2APIPath = "/v1/ai"`(“v2” 指的是这批 handler 的
+// 代码世代/包名,不是 URL 版本号),路由挂在 `route/v2.go:207-215`(`g.GET("/skills",
+// ...)` 等)—— 拼起来是 `/v1/ai/skills`,纯文档漂移,不影响运行时行为(实际请求走
+// 共享包 `@nimotech/nimoos-service`,不读这段注释里的路径字符串)。
 
 /** 对齐后端 `SkillFile`(skills.go:29-32)。`size` 是后端已格式化好的展示串
  *  (如 `"12 B"` / `"1.0 KB"` / `"(3 files)"`),不是原始字节数。 */
 export interface SkillFile {
   name: string
   size: string
 }
 
 /** 对齐后端 `Skill`(skills.go:10-27)。 */
 export interface Skill {
@@ -34,28 +41,28 @@ export interface Skill {
   examples: string[]
   md: string
 }
 
 // SP8-P3b Task 8 —— 协调者预先解歧义①(p3b-task-8-brief.md「已授权的偏离」)。
 // 纯搬移自 `AddSkillModal.vue`(原为未导出的组件内部 interface),字段一个字未改。
 // 挪到这里导出的理由:`SkillsSection.vue` 的 `onCreate` 处理函数需要这个类型标注
 // `@save` 事件的 payload;interface 不会获得隐式索引签名,把参数类型写成
 // `Record<string, unknown>` 会被 `vue-tsc` 判为不兼容(TS2345)。
 
-/** 对齐 `POST /v2/ai/skills` 请求体里单个脚本文件的形状(bundle 内一个 `scripts/*` 条目)。 */
+/** 对齐 `POST /v1/ai/skills` 请求体里单个脚本文件的形状(bundle 内一个 `scripts/*` 条目)。 */
 export interface SkillScript {
   path: string
   content: string
 }
 
 /** 对齐 `AddSkillModal.vue` `submit()` emit 的 `save` payload 形状,也是
- *  `service.ai.createSkill()` 请求体的形状(`POST /v2/ai/skills`)。 */
+ *  `service.ai.createSkill()` 请求体的形状(`POST /v1/ai/skills`)。 */
 export interface SkillFormPayload {
   name: string
   title: string
   description: string
   trigger: 'auto' | 'slash' | 'manual'
   color: string
   md: string
   examples: string[]
   scripts: SkillScript[]
 }
diff --git a/src/ai/util/sandboxRun.test.ts b/src/ai/util/sandboxRun.test.ts
index 54437d8..5cce9c6 100644
--- a/src/ai/util/sandboxRun.test.ts
+++ b/src/ai/util/sandboxRun.test.ts
@@ -1,16 +1,16 @@
 import { describe, it, expect } from 'vitest'
 import { initSandboxState, reduceSandboxEvent, type SandboxState } from './sandboxRun'
 
 describe('sandboxRun', () => {
   it('initSandboxState starts empty/idle', () => {
-    expect(initSandboxState()).toEqual({ steps: [], ms: null, error: '', done: false })
+    expect(initSandboxState()).toEqual({ steps: [], ms: null, error: '', failed: false, done: false })
   })
 
   it('two consecutive message_delta merge into one step, text appended in order', () => {
     let s = initSandboxState()
     s = reduceSandboxEvent(s, { type: 'message_delta', content: 'Hel' }, 0)
     s = reduceSandboxEvent(s, { type: 'message_delta', content: 'lo' }, 0)
     expect(s.steps).toEqual([{ kind: 'text', text: 'Hello' }])
   })
 
   it('text and message also participate in the same accumulation', () => {
@@ -38,30 +38,34 @@ describe('sandboxRun', () => {
     s = reduceSandboxEvent(s, { type: 'tool_call', name: 'search_files' }, 0)
     expect(s.steps).toEqual([{ kind: 'tool', text: '→ search_files' }])
   })
 
   it('tool_call with neither tool nor name falls back to the literal "tool"', () => {
     let s = initSandboxState()
     s = reduceSandboxEvent(s, { type: 'tool_call' }, 0)
     expect(s.steps).toEqual([{ kind: 'tool', text: '→ tool' }])
   })
 
-  it('error event writes error', () => {
+  it('error event writes error and sets failed', () => {
     let s = initSandboxState()
     s = reduceSandboxEvent(s, { type: 'error', content: 'sandbox exploded' }, 0)
     expect(s.error).toBe('sandbox exploded')
+    expect(s.failed).toBe(true)
   })
 
-  it('error event with no content writes empty string, not "null"/"undefined"', () => {
+  it('error event with no content writes empty string, not "null"/"undefined" — but still sets failed (P3b 终审 I2)', () => {
     let s = initSandboxState()
     s = reduceSandboxEvent(s, { type: 'error' }, 0)
     expect(s.error).toBe('')
+    // 这条是 I2 的核心钉子:content 为空不等于"没失败"。后端 agent.py:999 的
+    // str(e) 对某些异常就是空串,消费端必须仍能区分"失败但没有文本"与"成功"。
+    expect(s.failed).toBe(true)
   })
 
   it('done event writes done and ms from the caller-supplied elapsedMs', () => {
     let s = initSandboxState()
     s = reduceSandboxEvent(s, { type: 'text', content: 'x' }, 0)
     s = reduceSandboxEvent(s, { type: 'done' }, 4242)
     expect(s.done).toBe(true)
     expect(s.ms).toBe(4242)
   })
 
diff --git a/src/ai/util/sandboxRun.ts b/src/ai/util/sandboxRun.ts
index 84f8afe..2a5dff9 100644
--- a/src/ai/util/sandboxRun.ts
+++ b/src/ai/util/sandboxRun.ts
@@ -11,29 +11,37 @@
 // 每次返回一个新对象（包括 steps 数组本身，即使内容未变也返回新引用是可接受的——
 // 但为避免不必要的对象抖动，无变化路径直接原样返回入参 s）。
 //
 // 不实现 `tokens`：Vue2 模板 TestPanel.vue:70-73 有 `output.tokens != null` 分支，
 // 但 `output.tokens` 全组件从未被赋值（`data()` 里初始化为 null 后再无写入点）——
 // 是死分支。照 P3a 处理 trigger_human 的先例，此处不复刻这个字段，SandboxState 类型上
 // 没有 tokens，.test.ts 里有一条探针钉死这一点。
 
 export type SandboxStep = { kind: 'text' | 'tool'; text: string }
 
+// 【P3b 终审 I2】`failed` 与 `error` 解耦。设计 §5 写的是「error = String(ev.content
+// ?? '')(空则留空，由 UI 填本地化兜底文案）」——本 reducer 一直照做，但在这个改动
+// 之前状态上没有独立的失败标志，TestPanel 只能拿 `sandbox.error` 非空来判定"失败"。
+// 后端 `NimoOS-AI/agent/agent.py:999` 发的是 `{"type":"error","content": str(e)}`，
+// `str(e)` 对某些异常（如不带消息构造的异常）是空串——此时 `error === ''`，消费端会
+// 把一次真实失败误判为成功。`failed` 只在收到 `error` 事件时置真，与 content 文本
+// 是否为空完全无关；`error` 继续只承载"要不要显示后端原文"这一件事。
 export type SandboxState = {
   steps: SandboxStep[]
   ms: number | null
   error: string
+  failed: boolean
   done: boolean
 }
 
 export function initSandboxState(): SandboxState {
-  return { steps: [], ms: null, error: '', done: false }
+  return { steps: [], ms: null, error: '', failed: false, done: false }
 }
 
 /**
  * 对齐 Vue2 TestPanel.vue run() 里 onEvent 回调（:158-172）。
  * 事件取舍见 p3b-task-2-brief.md §2.1 的表；忽略 thinking/tool_result/confirmation_required
  * 等其余事件类型。返回新的 SandboxState，不修改入参 s 或 s.steps。
  */
 export function reduceSandboxEvent(
   s: SandboxState,
   ev: Record<string, unknown>,
@@ -55,19 +63,20 @@ export function reduceSandboxEvent(
   }
 
   if (type === 'tool_call') {
     const name = (ev.tool as string | undefined) ?? (ev.name as string | undefined) ?? 'tool'
     const steps = s.steps.slice()
     steps.push({ kind: 'tool', text: '→ ' + name })
     return { ...s, steps }
   }
 
   if (type === 'error') {
-    return { ...s, error: String(ev.content ?? '') }
+    // failed=true 无条件置(与 content 是否为空无关，见上方类型注释——P3b 终审 I2）。
+    return { ...s, error: String(ev.content ?? ''), failed: true }
   }
 
   if (type === 'done') {
     return { ...s, done: true, ms: elapsedMs }
   }
 
   return s
 }
diff --git a/src/ai/util/skillsErrorKey.test.ts b/src/ai/util/skillsErrorKey.test.ts
index 2414e12..da67884 100644
--- a/src/ai/util/skillsErrorKey.test.ts
+++ b/src/ai/util/skillsErrorKey.test.ts
@@ -1,12 +1,12 @@
 import { describe, it, expect } from 'vitest'
-import { createSkillErrorKey, validateSkillForm } from './skillsErrorKey'
+import { createSkillErrorKey, validateSkillForm, slugify } from './skillsErrorKey'
 
 /** Wrap a raw backend string the way axios would, so createSkillErrorKey can read it. */
 function errWith(message: string) {
   return { response: { data: { message } } }
 }
 
 describe('createSkillErrorKey', () => {
   // Real Go error strings, taken verbatim from NimoOS-AI/service/skills_store.go
   // (fmt.Errorf("%w: <reason>", ErrBadSkillID / ErrBadDescription / ErrDuplicateSkill /
   // ErrBadPath / ErrBundleTooLarge) and the SKILL.md size message).
@@ -92,34 +92,57 @@ describe('validateSkillForm', () => {
   })
 
   it('rejects a whitespace-only name', () => {
     expect(validateSkillForm('   ', 'a valid description')).toBe('aiSkErrBadId')
   })
 
   it('accepts a single-character name ("a")', () => {
     expect(validateSkillForm('a', 'a valid description')).toBe(null)
   })
 
-  it('rejects uppercase letters in the name', () => {
-    expect(validateSkillForm('Invoice-Tagger', 'a valid description')).toBe('aiSkErrBadId')
+  // P3b 终审 C1 —— 这四条此前把 'aiSkErrBadId' 钉成了断言，但后端先 slugify(name) 再
+  // 校验（skills_store.go:221），这四个原始名字全部会被 slugify 成合法 id
+  // （"Invoice-Tagger"/"invoice_tagger" -> "invoice-tagger"，前后导 '-' 被
+  // strings.Trim 去掉）——后端能建成功，Vue2（只查非空）也能建成功，本仓之前对着
+  // "同款校验"的名义把它们堵死了，是可复现的功能回退，不是合法的校验结果。
+  // 改前（错误，已删）：
+  //   expect(validateSkillForm('Invoice-Tagger', ...)).toBe('aiSkErrBadId')
+  //   expect(validateSkillForm('invoice_tagger', ...)).toBe('aiSkErrBadId')
+  //   expect(validateSkillForm('-invoice-tagger', ...)).toBe('aiSkErrBadId')
+  //   expect(validateSkillForm('invoice-tagger-', ...)).toBe('aiSkErrBadId')
+  it('accepts uppercase letters in the name (backend slugifies before validating)', () => {
+    expect(validateSkillForm('Invoice-Tagger', 'a valid description')).toBe(null)
   })
 
-  it('rejects underscores in the name', () => {
-    expect(validateSkillForm('invoice_tagger', 'a valid description')).toBe('aiSkErrBadId')
+  it('accepts underscores in the name (slugify folds them into a single dash)', () => {
+    expect(validateSkillForm('invoice_tagger', 'a valid description')).toBe(null)
   })
 
-  it('rejects a name starting with a dash', () => {
-    expect(validateSkillForm('-invoice-tagger', 'a valid description')).toBe('aiSkErrBadId')
+  it('accepts a name starting with a dash (leading separator is dropped, not written)', () => {
+    expect(validateSkillForm('-invoice-tagger', 'a valid description')).toBe(null)
   })
 
-  it('rejects a name ending with a dash', () => {
-    expect(validateSkillForm('invoice-tagger-', 'a valid description')).toBe('aiSkErrBadId')
+  it('accepts a name ending with a dash (trailing separator is trimmed by slugify)', () => {
+    expect(validateSkillForm('invoice-tagger-', 'a valid description')).toBe(null)
+  })
+
+  it('accepts a name with spaces and mixed case (realistic UI input, e.g. "Invoice Tagger")', () => {
+    expect(validateSkillForm('Invoice Tagger', 'a valid description')).toBe(null)
+  })
+
+  // 真·非法输入：slug 之后仍然/依然不满足 skillIDRe。
+  it('rejects a name made entirely of non-alphanumeric characters (slugifies to an empty string)', () => {
+    expect(validateSkillForm('!!!___---', 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('rejects a name that is pure Chinese characters (slugifies to an empty string, no [a-z0-9] survives)', () => {
+    expect(validateSkillForm('发票标签', 'a valid description')).toBe('aiSkErrBadId')
   })
 
   it('accepts a name exactly at the 64-char boundary', () => {
     // 1 leading + 62 middle + 1 trailing = 64 chars total, matches skillIDRe exactly.
     const name = 'a' + 'b'.repeat(62) + 'c'
     expect(name.length).toBe(64)
     expect(validateSkillForm(name, 'a valid description')).toBe(null)
   })
 
   it('rejects a name one char past the 64-char boundary', () => {
@@ -163,10 +186,58 @@ describe('validateSkillForm', () => {
   })
 
   it('rejects a description containing a control character (\\x07)', () => {
     expect(validateSkillForm('valid-name', 'bell\x07here')).toBe('aiSkErrDescControl')
   })
 
   it('returns null when both name and description are valid', () => {
     expect(validateSkillForm('invoice-tagger', 'Tags invoices when they arrive.')).toBe(null)
   })
 })
+
+// P3b 终审 C1 —— slugify 逐行移植自 NimoOS-AI/service/skills_store.go:17-35，
+// 这里直接钉住移植结果，不只是通过 validateSkillForm 间接测。
+describe('slugify', () => {
+  it('lowercases and leaves an already-valid slug unchanged', () => {
+    expect(slugify('invoice-tagger')).toBe('invoice-tagger')
+  })
+
+  it('folds internal spaces into a single dash', () => {
+    expect(slugify('Invoice Tagger')).toBe('invoice-tagger')
+  })
+
+  it('folds underscores into a single dash', () => {
+    expect(slugify('invoice_tagger')).toBe('invoice-tagger')
+  })
+
+  it('uppercases fold to lowercase', () => {
+    expect(slugify('INVOICE')).toBe('invoice')
+  })
+
+  it('collapses a run of consecutive separators into one dash, not one per separator', () => {
+    expect(slugify('invoice   ___---tagger')).toBe('invoice-tagger')
+  })
+
+  it('drops a leading separator entirely (no dash is written before the first alnum char)', () => {
+    expect(slugify('  -invoice-tagger')).toBe('invoice-tagger')
+  })
+
+  it('trims a trailing separator', () => {
+    expect(slugify('invoice-tagger--  ')).toBe('invoice-tagger')
+  })
+
+  it('returns an empty string when no [a-z0-9] character survives (pure symbols)', () => {
+    expect(slugify('!!!___---')).toBe('')
+  })
+
+  it('returns an empty string for pure Chinese input (no ASCII alnum to keep)', () => {
+    expect(slugify('发票标签')).toBe('')
+  })
+
+  it('returns an empty string for an all-whitespace input', () => {
+    expect(slugify('   ')).toBe('')
+  })
+
+  it('preserves digits and digit-leading input (backend comment: "123 skill" must not be rejected)', () => {
+    expect(slugify('123 skill')).toBe('123-skill')
+  })
+})
diff --git a/src/ai/util/skillsErrorKey.ts b/src/ai/util/skillsErrorKey.ts
index 54dc6e8..1cc2db6 100644
--- a/src/ai/util/skillsErrorKey.ts
+++ b/src/ai/util/skillsErrorKey.ts
@@ -11,20 +11,30 @@
 // 先判更具体的 description 子类（"description required" / "longer than 256
 // characters" / "must be a single line" / "'<' and '>' are not allowed" 里的
 // "are not allowed" + 含 '<' / "control characters are not allowed"），
 // 再判 "invalid skill description" 本身，最后落 aiSkErrCreateFailed 兜底。
 //
 // validateSkillForm 是【拍板偏离①，见 p3b-common-constraints.md §3.6】：Vue2
 // AddSkillModal.vue:137-139 提交前只查了 name/description 非空，填完一整屏才被后端一句
 // 英文顶回来。这里在前端做与后端同款的校验规则，规则逐条对
 // NimoOS-AI/service/skills_store.go:37-59 的 validateSkillDescription 与
 // skillIDRe（:86）——已回源核对，两处正则字面一致，见本任务报告。
+//
+// 【P3b 终审 C1 修复】"与后端同款"指的是校验对象要一致，不只是正则字面一致——后端
+// skills_store.go:221 是 `id := slugify(r.Name)` **先转换、再拿转换结果去过
+// skillIDRe**（skills_store.go:82-85 的注释明写这是故意的："allows digit-leading
+// IDs so slugify of names like '123 skill' don't get rejected"）。本文件此前直接拿
+// **原始 name** 去测 skillIDRe，比后端更严：像 "Invoice Tagger" / "invoice_tagger"
+// 这类后端 slugify 后能建成功（Vue2 也能建，Vue2 只查非空）的名字，会被这里直接堵死、
+// 请求都发不出去——这是可复现的功能回退，不是"同款校验"该有的行为。
+// 修法：移植一份 `slugify`（逐行对齐 Go 版 skills_store.go:17-35），validateSkillForm
+// 改成校验 `slugify(name)` 而非原始 name。
 
 /** 对齐 channelsFormat.ts:66-70 的取错误串形状：response.data.message ?? .detail ?? data。 */
 function extractErrorString(e: unknown): string {
   const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
   const raw =
     data && typeof data === 'object'
       ? (data as { message?: unknown }).message ?? (data as { detail?: unknown }).detail
       : data
   return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
 }
@@ -47,27 +57,61 @@ export function createSkillErrorKey(e: unknown): string {
   if (s.includes('bundle exceeds size limits')) return 'aiSkErrBundleTooLarge'
   if (s.includes('skill.md exceeds')) return 'aiSkErrMdTooLarge'
   return 'aiSkErrCreateFailed'
 }
 
 // 回源核对结论（NimoOS-AI/service/skills_store.go:86 与 agent/main.py:2489）：两处正则
 // 字面完全一致，均为 /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/ —— 首尾必须是小写字母或数字，
 // 中间可含短横线，总长 1–64。brief 表里给的这条是对的，不存在需要以 Go 为准改写的分歧。
 const SKILL_ID_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/
 
+/**
+ * 逐行移植自 NimoOS-AI/service/skills_store.go:17-35（`slugify`）。后端在校验前先跑
+ * 这一步（skills_store.go:221 `id := slugify(r.Name)`），再拿 slug 去过 skillIDRe——
+ * 本函数必须做完全一样的事，否则前端校验的对象就和后端实际校验的对象不是同一个值
+ * （P3b 终审 C1）。逐条对齐 Go 版逻辑：
+ *   1. 转小写 + 去首尾空白（Go: `strings.ToLower(strings.TrimSpace(s))`）。
+ *   2. 逐个 code point 扫描：`[a-z0-9]` 原样保留；其余字符折叠成**单个**'-'
+ *      （`dash` 标志防止连续分隔符产生多个 '-'；`out.length > 0` 这个条件让前导分隔符
+ *      不产生 '-' —— 对应 Go 版 `b.Len() > 0`）。
+ *   3. 最后去掉首尾的 '-'（Go: `strings.Trim(b.String(), "-")`）。
+ * `for...of` 按 Unicode code point 迭代，与 Go 的 `for _, r := range s`（按 rune 迭代）
+ * 语义一致，故对中日文等多字节字符的处理与后端等价（均判定为非 [a-z0-9]，折叠成 '-'）。
+ */
+export function slugify(s: string): string {
+  let out = ''
+  let dash = false
+  for (const ch of s.trim().toLowerCase()) {
+    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
+      out += ch
+      dash = false
+    } else if (!dash && out.length > 0) {
+      out += '-'
+      dash = true
+    }
+  }
+  return out.replace(/^-+/, '').replace(/-+$/, '')
+}
+
 /**
  * 前端预校验，规则逐条对齐 skills_store.go 的 ValidateSkillID + validateSkillDescription。
  * 全过返回 null；否则返回对应的 i18n 错误键。
+ *
+ * 【P3b 终审 C1】校验对象是 `slugify(name)`，不是原始 name——见上方 `slugify` 注释与
+ * NimoOS-AI/service/skills_store.go:221（`id := slugify(r.Name)`）+ :91-96
+ * （`ValidateSkillID` 拿 slug 后的 id 去过 `skillIDRe`）。名字全是非法字符时
+ * slug 为空串，空串不满足 `skillIDRe`（至少需要 1 个 `[a-z0-9]` 字符），
+ * 自然落回 'aiSkErrBadId'，与后端 `ValidateSkillID('')` 拒绝的结论一致。
  */
 export function validateSkillForm(name: string, description: string): string | null {
-  const trimmedName = name.trim()
-  if (trimmedName === '' || !SKILL_ID_RE.test(trimmedName)) return 'aiSkErrBadId'
+  const id = slugify(name)
+  if (!SKILL_ID_RE.test(id)) return 'aiSkErrBadId'
 
   const trimmedDescription = description.trim()
   if (trimmedDescription === '') return 'aiSkErrDescRequired'
   // Array.from(...).length counts Unicode code points, matching Go's
   // utf8.RuneCountInString(d) in skills_store.go:49 more closely than
   // JS's native .length (UTF-16 code units, which over-counts astral chars).
   if (Array.from(trimmedDescription).length > 256) return 'aiSkErrDescTooLong'
   if (/[\n\r]/.test(trimmedDescription)) return 'aiSkErrDescSingleLine'
   if (trimmedDescription.includes('<') || trimmedDescription.includes('>')) return 'aiSkErrDescAngle'
   // eslint-disable-next-line no-control-regex
