# Task 7 review package — c13e102..HEAD

## commits
d8078aa sp8-ai P3b Task 7: D4 disabled-skill try-in-chat confirm + mount TestPanel

## diff --stat
 .../components/settings/skills/SkillDetail.test.ts | 118 ++++++++++++++++++++-
 src/ai/components/settings/skills/SkillDetail.vue  | 118 +++++++++++++++++++--
 2 files changed, 224 insertions(+), 12 deletions(-)

## diff -U10
diff --git a/src/ai/components/settings/skills/SkillDetail.test.ts b/src/ai/components/settings/skills/SkillDetail.test.ts
index 90a6203..50d92bb 100644
--- a/src/ai/components/settings/skills/SkillDetail.test.ts
+++ b/src/ai/components/settings/skills/SkillDetail.test.ts
@@ -182,24 +182,32 @@ describe('SkillDetail(只读半 + P3b 写操作半)', () => {
   it('last_used 为空字符串时显示 em dash(—),不做任何相对时间映射', () => {
     const w = mountDetail(makeSkill({ last_used: '' }))
     expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).toContain('—')
   })
 
   it('描述段:原样显示 description,不经过任何本地化', () => {
     const w = mountDetail(makeSkill({ description: '一段自由文本描述,含标点。' }))
     expect(w.find('.sk-description').text()).toBe('一段自由文本描述,含标点。')
   })
 
-  it('TestPanel 占位:描述段与 SKILL.md 段之间没有渲染任何写操作控件(P3b 范围)', () => {
+  // 【反转,SP8-P3b Task 7,公共约束 §9 明确要求「反转不是删除」】P3a 版本(改前原文见
+  // 上方本次 diff)断言 TestPanel「完全不渲染」;T7 把它挂回 Vue2 :108-112 对应的位置,
+  // 现在要断言的是**存在且顺序正确**——不只是"存在"就算数(存在但被塞到文件末尾也会
+  // 通过一个弱断言,钉不住"夹在描述段与 SKILL.md 段之间"这个位置要求),所以按 DOM
+  // 顺序遍历所有 `.sk-section-title`,断言 TestPanel 自己的段头标题恰好夹在
+  // "描述"与"SKILL.md"两个标题之间。
+  it('TestPanel 挂载在描述段与 SKILL.md 段之间(P3b 落地,按 DOM 顺序断言,不只是「存在」)', () => {
     const w = mountDetail(makeSkill())
-    expect(w.findComponent({ name: 'TestPanel' }).exists()).toBe(false)
-    expect(w.find('.sk-test').exists()).toBe(false)
+    const tp = w.findComponent({ name: 'TestPanel' })
+    expect(tp.exists()).toBe(true)
+    const titles = w.findAll('.sk-section-title').map((n) => n.text())
+    expect(titles).toEqual(['描述', '沙箱测试', 'SKILL.md', '附带文件'])
   })
 
   it('SKILL.md 段:markdown 渲染出真实 HTML(不是转义后的原文本)', () => {
     const w = mountDetail(makeSkill({ md: '# Title\n\nSome **bold** text.' }))
     const mdHtml = w.find('.sk-md').html()
     expect(mdHtml).toContain('<strong>bold</strong>')
     expect(mdHtml).not.toContain('# Title')
   })
 
   it('SKILL.md 为空字符串时不抛错,渲染空内容', () => {
@@ -218,23 +226,26 @@ describe('SkillDetail(只读半 + P3b 写操作半)', () => {
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
+    // 【SP8-P3b Task 7 更新】TestPanel 挂回描述段与 SKILL.md 段之间后,它自己的段头
+    // 也带一个 `.sk-section-hint`(aiSkTestHint),序列从 3 个变成 4 个,「附带文件」
+    // 段的 hint 相应从下标 2 挪到下标 3——这是结构性位移,不是断言被削弱。
     const hints = w.findAll('.sk-section-hint')
-    expect(hints).toHaveLength(3)
-    expect(hints[2].text()).toBe('2 个文件')
+    expect(hints).toHaveLength(4)
+    expect(hints[3].text()).toBe('2 个文件')
   })
 
   it('目录尺寸 "(3 files)" 被本地化成中文「3 个文件」,普通文件字节单位原样透传', () => {
     const w = mountDetail(makeSkill({
       files: [
         { name: 'assets', size: '(3 files)' },
         { name: 'notes.txt', size: '12 B' },
       ],
     }))
     const rows = w.findAll('.sk-file-row')
@@ -486,11 +497,108 @@ describe('SkillDetail(只读半 + P3b 写操作半)', () => {
     const w = mountDetail(makeSkill({ id: 'sk-1', system: false }))
     await w.find('.sk-pill-more').trigger('click')
     await w.findAll('.sk-menu button')[3].trigger('click')
     await flush()
     expect(host.querySelector('.sk-confirm')).not.toBeNull()
 
     await w.setProps({ skill: makeSkill({ id: 'sk-2' }) })
     await flush()
     expect(host.querySelector('.sk-confirm')).toBeNull()
   })
+
+  // ===== SP8-P3b Task 7 —— D4 弹窗(停用技能「在对话中试用」先提示) + TestPanel test 转发 =====
+  // D4 弹窗走 SkModal(标准壳),不是上面删除确认弹窗那套裸 reka 原语,故断言走
+  // `.sk-modal-title`/`.sk-btn.primary`/`.sk-btn.ghost` 这套 SkModal 既有先例
+  // (同 ChannelsSection.test.ts「3. genCode…」用例查 `.sk-modal` 的手法),而不是
+  // `.sk-confirm*`(那是删除弹窗专属的类名)。
+
+  it('D4:停用技能点「在对话中试用」不跳转,弹出确认弹窗(标题/正文命中 i18n 文案)', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-1', enabled: false }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+    expect(push).not.toHaveBeenCalled()
+    expect(host.querySelector('.sk-modal-title')?.textContent).toBe('该技能已停用')
+    expect(host.querySelector('.sk-modal')?.textContent).toContain('停用的技能不会被加载')
+  })
+
+  it('D4「启用并试用」:emit toggle(id,true) 且此刻未 push;父组件把 enabled 改成 true 后才 push', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-5', enabled: false }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+
+    const enableBtn = host.querySelector('.sk-btn.primary') as HTMLButtonElement
+    enableBtn.click()
+    await flush()
+    expect(w.emitted('toggle')).toEqual([['sk-5', true]])
+    // 发 toggle 那一刻还没跳转——父组件还没告知启用是否成功,弹窗已收起。
+    expect(push).not.toHaveBeenCalled()
+    expect(host.querySelector('.sk-modal')).toBeNull()
+
+    // 父组件把 enabled 真的改成 true(toggle 成功)之后,才补一次 push。
+    await w.setProps({ skill: makeSkill({ id: 'sk-5', enabled: true }) })
+    await flush()
+    expect(push).toHaveBeenCalledTimes(1)
+    expect(push).toHaveBeenCalledWith({ path: '/ai/agent', query: { skill: 'sk-5' } })
+  })
+
+  it('D4:toggle 失败(父组件不改 enabled)→ 永不 push', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-6', enabled: false }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
+    await flush()
+    expect(w.emitted('toggle')).toEqual([['sk-6', true]])
+
+    // 父组件请求失败:enabled 原样不变(仍是 false)——不是"取消"，是失败态。
+    await w.setProps({ skill: makeSkill({ id: 'sk-6', enabled: false }) })
+    await flush()
+    expect(push).not.toHaveBeenCalled()
+  })
+
+  it('D4:点「取消」关闭弹窗,不 push、不 emit toggle', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-7', enabled: false }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+    ;(host.querySelector('.sk-btn.ghost') as HTMLButtonElement).click()
+    await flush()
+    expect(host.querySelector('.sk-modal')).toBeNull()
+    expect(push).not.toHaveBeenCalled()
+    expect(w.emitted('toggle')).toBeUndefined()
+  })
+
+  it('D4「启用并试用」挂号后切到别的技能,原技能迟到的 enabled=true 不再触发 push(残留清除,pendingTryId 一次性语义)', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-10', enabled: false }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
+    await flush()
+    expect(w.emitted('toggle')).toEqual([['sk-10', true]])
+
+    // 响应到达前,用户已经切到另一个技能——skill.id 变化的 watch 会清掉挂号。
+    await w.setProps({ skill: makeSkill({ id: 'sk-11', enabled: false }) })
+    await flush()
+
+    // 迟到的响应此刻才把 sk-10 的 enabled 改成 true(用户又切回了 sk-10)——因为
+    // 挂号已经在切换那一刻被清空,不应该被误读成"待跳转"而 push。
+    await w.setProps({ skill: makeSkill({ id: 'sk-10', enabled: true }) })
+    await flush()
+    expect(push).not.toHaveBeenCalled()
+  })
+
+  it('enabled === true 时点「在对话中试用」直接跳转,不弹 D4 弹窗(P3a 既有行为未回归)', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-42', enabled: true }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+    expect(push).toHaveBeenCalledTimes(1)
+    expect(push).toHaveBeenCalledWith({ path: '/ai/agent', query: { skill: 'sk-42' } })
+    expect(host.querySelector('.sk-modal')).toBeNull()
+  })
+
+  it('TestPanel 的 test 事件被向上转发成本组件的 test emit', async () => {
+    const w = mountDetail(makeSkill())
+    const tp = w.findComponent({ name: 'TestPanel' })
+    expect(tp.exists()).toBe(true)
+    tp.vm.$emit('test')
+    await flush()
+    expect(w.emitted('test')).toHaveLength(1)
+  })
 })
diff --git a/src/ai/components/settings/skills/SkillDetail.vue b/src/ai/components/settings/skills/SkillDetail.vue
index 0181db6..4e5b809 100644
--- a/src/ai/components/settings/skills/SkillDetail.vue
+++ b/src/ai/components/settings/skills/SkillDetail.vue
@@ -55,22 +55,52 @@
   `<span class="dot" />` 不再携带任何内联样式或颜色相关 data 属性。
 
   【last_used 不做映射】照 Vue2 :88 原样 `skill.last_used || '—'`。若后端将来在
   该字段写入英文相对时间串（如 "3 hours ago"），此处需要补一层本地化映射——目前
   后端契约（NimoOS-AI/service/skills.go）该字段就是任意字符串或空串，无需处理。
 
   【TestPanel 占位】Vue2 :108-112 里 `TestPanel` 夹在「描述」与「SKILL.md」两个
   `.sk-section` 之间。P3a 不渲染它，两段直接相邻；下方模板里留了一行注释标出
   P3b 要插回的确切位置，避免插错顺序。
 
-  【不取,留给 T7】`TestPanel`/`runTest` 占位(:166-167 那处注释)不是本任务范围,
-  按协调者要求原样不动。
+  SP8-P3b Task 7 —— D4 弹窗(停用技能「在对话中试用」先提示) + 挂 TestPanel。
+
+  【偏离申报 3,公共约束 §3 偏离 3 / 任务书 D4】收 P3a 挂账③:后端
+  `NimoOS-AI/service/skills_runtime.go:57` 把 `disabled` 的技能排除出运行时视图,停用
+  技能点「在对话中试用」时 `X-Skill-Id` 照发但 agent 找不到 `SKILL.md`,界面零反馈。
+  Vue2 `SkillDetail.vue:240-242 tryInChat()` 完全不看 `skill.enabled`,永远直接跳转 ——
+  这是要修的可复现错误行为,不是要照抄的“视觉/交互”。改成:`skill.enabled === false`
+  时不跳转,改弹一个 D4 确认弹窗(「启用并试用」/取消);`enabled === true` 时行为不变
+  (P3a 已实现,直接跳转)。**这个弹窗 Vue2 里完全不存在**(用户 2026-07-30 拍板新增),
+  不是复刻目标,所以走标准壳 `SkModal`(见下方「两种弹窗外壳并存」注释),不是本文件里
+  删除确认弹窗那套 reka 原语手拼。
+
+  【两种弹窗外壳并存,不是不一致】本文件同时有两套弹窗写法:删除/卸载确认弹窗用裸 reka
+  Dialog 原语手拼(见上方「偏离申报 2」),因为它要逐像素复刻 Vue2 一个**没有标题栏**的
+  弹窗,`SkModal` 强制渲染标题栏+关闭按钮的形状套不上去;D4 这个弹窗是本期新增、
+  Vue2 没有对应物,没有“复刻目标”,所以直接用现成的标准壳 `SkModal`
+  (`:open`+`@update:open`+默认插槽+`#footer`,先例 `sections/ChannelsSection.vue:427`),
+  拿它自带的 Esc/焦点陷阱/`.set-app` 作用域处理免费。两者选型依据同一条规则:「有逐像素
+  复刻目标 → 手拼贴近 Vue2;无复刻目标(本期新增 UI)→ 用标准壳」,不是风格漂移。
+
+  【`pendingTryId` 一次性语义】「启用并试用」发 `emit('toggle', id, true)` 后,必须等
+  **父组件真的把这个技能的 `enabled` 改成 true**(toggle 成功)才跳转;toggle 失败时父组件
+  不改 `enabled`,`watch` 不会看到值变化,自然不跳转,不需要额外的失败分支。用一个
+  `pendingTryId`(记录发起请求那一刻的技能 id,而不是布尔标志)而不是定时器/await emit
+  (emit 是同步的、没有返回值,等不到“父组件处理完”这个事实)。三条清除路径:
+  ① 跳转前(`watch` 命中 `enabled===true` 且 id 匹配时)立即置空,防止以后这个技能任何
+     一次“开关开→用户手动点开”都被误读成“待跳转”而把用户重新导航走;
+  ② 点「取消」立即置空;
+  ③ `skill.id` 变化时置空(与既有 `menuOpen`/`confirmOpen` 复位共用同一个 watch)—— 这样
+     切到另一个技能后,上一个技能的挂号不会残留、也不会在多个 watcher 之间靠触发顺序
+     猜测谁先跑:`watch(enabled)` 回调里额外核对 `skill.id === pendingTryId`,两层防御
+     叠加,不依赖 Vue 内部 watcher 调度顺序这个实现细节。
 
   零 <style> 块:用到的每个 class(sk-detail*、sk-name、sk-pill-try、sk-meta-grid、
   sk-meta-cell、sk-section*、sk-description、sk-md、sk-file-row、sw、sk-pill-more、
   sk-menu、sk-modal-bg、sk-modal、sk-confirm*、sk-modal-foot、sk-btn)均已存在于
   skills-styles.scss(Task 1)或 sk-shared.scss(既有)。
 -->
 <script setup lang="ts">
 import { computed, ref, watch } from 'vue'
 import { useI18n } from 'vue-i18n'
 import { useRouter } from 'vue-router'
@@ -79,54 +109,69 @@ import {
   DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, VisuallyHidden,
 } from 'reka-ui'
 import type { Skill } from '../../../types/skill'
 import { triggerLabel, authorLabel, fileSizeLabel } from '../../../util/skillsFormat'
 import { renderMarkdown } from '../../../markdown/renderMarkdown'
 import { useClickOutside } from '../../../composables/useClickOutside'
 import { useCopyFeedback } from '../../../composables/useCopyFeedback'
 import AgentIcon from '../../icons/AgentIcon.vue'
 import SkillTile from './SkillTile.vue'
 import SetSwitch from '../SetSwitch.vue'
+import SkModal from '../SkModal.vue'
+import TestPanel from './TestPanel.vue'
 
 // Vue2 SkillDetail.vue:200-201 `skill: { type: Object, default: null }` +
 // `busy: { type: Object, default: () => ({}) }`(飞行中禁用的技能 id 集合,由父组件
 // SkillsSection 在 toggle/delete 请求进行中维护,驱动开关的 disabled 态)。
 const props = withDefaults(
   defineProps<{ skill: Skill | null; busy?: Record<string, boolean> }>(),
   { busy: () => ({}) },
 )
 
 // 对齐 Vue2 :27(`$emit('toggle', …)`)与 :238(`$emit('delete', …)`)。
+// `test` 是 T7 新增:把 TestPanel 的 `test`(只在沙箱真正成功完成时才发,见
+// TestPanel.vue 头注释偏离 D5)原样往上转发,不在本文件里加任何额外触发条件。
 const emit = defineEmits<{
   (e: 'toggle', id: string, enabled: boolean): void
   (e: 'delete', id: string): void
+  (e: 'test'): void
 }>()
 
 const { t } = useI18n()
 const router = useRouter()
 
 // 顶部条「更多」下拉菜单。对齐 Vue2 data() 里的 `menuOpen`(:205)。
 const menuOpen = ref(false)
 // 删除/卸载确认弹窗。对齐 Vue2 data() 里的 `confirm`(:206,本仓避开与 Vue `computed`
 // 内建 confirm 全局同名的歧义,改叫 confirmOpen)。
 const confirmOpen = ref(false)
 // `.sk-pill-more` 按钮 + `.sk-menu` 下拉的包裹元素,对齐 Vue2 `ref="menuWrap"`(:33)。
 const menuWrap = ref<HTMLElement | null>(null)
+// D4:停用技能点「在对话中试用」的确认弹窗(Vue2 没有对应物,本期新增,见文件头注释
+// 「偏离申报 3」)。
+const tryModalOpen = ref(false)
+// D4「启用并试用」的一次性挂号:记录发起 toggle 那一刻的技能 id(不是布尔标志),
+// 见文件头注释「pendingTryId 一次性语义」。
+const pendingTryId = ref<string | null>(null)
 
 // 外部点击关闭菜单。复用既有 `useClickOutside` composable(见文件头注释「实现选择」)
 // 而不是手写 Vue2 :214-225 那份 `watch(menuOpen)` 里条件式 add/removeEventListener。
 useClickOutside(menuWrap, () => { menuOpen.value = false })
 
 // `skill.id` 变化时复位菜单与确认弹窗,对齐 Vue2 `watch: { 'skill.id'() { … } }`(:226-229)。
+// D4:同一处一并复位 tryModalOpen/pendingTryId(清除路径③,见文件头注释)——切到另一个
+// 技能后,上一个技能的「启用并试用」挂号不能残留。
 watch(() => props.skill?.id, () => {
   menuOpen.value = false
   confirmOpen.value = false
+  tryModalOpen.value = false
+  pendingTryId.value = null
 })
 
 // 复制 SKILL.md 到剪贴板 + 打勾态(偏离申报 1,见文件头注释)。
 const { copiedKey, copy: copyToClipboard } = useCopyFeedback()
 
 // 对齐 Vue2 `closeAnd(fn)`(:235):先收起菜单,再执行传入的动作。
 function closeAnd(fn?: () => void) {
   menuOpen.value = false
   fn?.()
 }
@@ -216,25 +261,66 @@ const filesHint = computed(() => t('aiSkNFiles', { n: (props.skill?.files || [])
 // DOMPurify 消毒，可安全 v-html。
 const mdHTML = computed(() => renderMarkdown(props.skill?.md || ''))
 
 // 对齐 Vue2 :141 `f.size` 原样显示；本仓额外把文件夹的 "(N files)" 格式过一遍
 // fileSizeLabel() 做本地化，字节单位（"12 B"/"1.0 KB"）原样透传。
 function fileSize(size: string): string {
   const ref = fileSizeLabel(size)
   return ref ? t(ref.key, ref.params ?? {}) : size
 }
 
-// 对齐 Vue2 :240-242 `tryInChat`。
+// 对齐 Vue2 :240-242 `tryInChat`,但收 P3a 挂账③改成正确逻辑(D4,见文件头注释
+// 「偏离申报 3」):Vue2 完全不看 `skill.enabled`,永远直接跳转;停用的技能在 agent
+// 运行时视图里根本不存在(`skills_runtime.go:57`),跳过去試也没有任何反馈。
+// `enabled === true` 时行为不变,直接跳转(P3a 既有实现)。
 function tryInChat() {
-  if (!props.skill) return
-  router.push({ path: '/ai/agent', query: { skill: props.skill.id } })
+  const s = props.skill
+  if (!s) return
+  if (s.enabled === false) {
+    tryModalOpen.value = true
+    return
+  }
+  router.push({ path: '/ai/agent', query: { skill: s.id } })
+}
+
+// D4「启用并试用」:先关弹窗、记下当前技能 id 作为一次性挂号,再把意图往上冒泡。
+// 是否真的启用成功由父组件(SkillsSection)决定——本组件不直接改 `skill.enabled`,
+// 只观察 props 上的值(下面的 watch)。
+function confirmEnableAndTry() {
+  const s = props.skill
+  if (!s) return
+  tryModalOpen.value = false
+  pendingTryId.value = s.id
+  emit('toggle', s.id, true)
 }
+
+// D4「取消」:清除路径②(见文件头注释)。不 emit toggle,不跳转。
+function cancelTryModal() {
+  tryModalOpen.value = false
+  pendingTryId.value = null
+}
+
+// D4 一次性跳转:只在「当前 props.skill 就是发起挂号的那个技能」且它的 `enabled`
+// 变成 true 时才跳转,随即清空挂号(清除路径①)。toggle 失败时父组件不会把 `enabled`
+// 改成 true,这里就永远不会看到 true,从而永远不跳转——不需要额外的失败分支/定时器。
+// 显式核对 `s.id === pendingTryId.value` 而不是只信任「skill.id 变化时复位」那处 watch
+// 已经清空了它:两个 watch 都挂在同一个 `props.skill` 上,不依赖 Vue 内部对同一 tick
+// 里多个 watcher 的调度顺序这个实现细节。
+watch(() => props.skill?.enabled, (enabled) => {
+  const s = props.skill
+  if (!s || !pendingTryId.value) return
+  if (s.id !== pendingTryId.value) { pendingTryId.value = null; return }
+  if (enabled === true) {
+    pendingTryId.value = null
+    router.push({ path: '/ai/agent', query: { skill: s.id } })
+  }
+})
 </script>
 
 <template>
   <div class="sk-detail">
     <template v-if="!skill">
       <div class="sk-detail-empty">
         <div class="sk-detail-empty-inner">
           <div class="orb" />
           <div class="empty-title">{{ t('aiSkPickLeft') }}</div>
           <div class="empty-sub">{{ t('aiSkPickLeftSub') }}</div>
@@ -319,22 +405,25 @@ function tryInChat() {
           <div class="sk-section">
             <div class="sk-section-head">
               <div class="sk-section-title">{{ t('aiSkDescription') }}</div>
               <div class="sk-section-hint">{{ t('aiSkDescHint') }}</div>
             </div>
             <div class="sk-section-body">
               <div class="sk-description">{{ skill.description }}</div>
             </div>
           </div>
 
-          <!-- P3b: TestPanel 插回这里（Vue2 SkillDetail.vue:108-112），夹在「描述」
-               与「SKILL.md」之间，见文件头注释。 -->
+          <!-- Vue2 SkillDetail.vue:108-112:TestPanel 夹在「描述」与「SKILL.md」之间。
+               :key="skill.id" 对齐 Vue2 :109——切换技能时整个组件销毁重建(TestPanel.vue
+               头注释已说明:key 变化不会触发它内部的 skill.id watcher,真正兜底的清理
+               落在它自己的 onBeforeUnmount)。test 事件原样转发,见 emits 定义处注释。 -->
+          <TestPanel :key="skill.id" :skill="skill" @test="emit('test')" />
 
           <div class="sk-section">
             <div class="sk-section-head">
               <div class="sk-section-title">SKILL.md</div>
               <div class="sk-section-hint">{{ t('aiSkMdHint') }}</div>
             </div>
             <div class="sk-section-body">
               <div class="sk-md" v-html="mdHTML" />
             </div>
           </div>
@@ -390,13 +479,28 @@ function tryInChat() {
                   <button class="sk-btn danger" @click="doDelete">
                     <AgentIcon name="trash" :size="13" />
                     {{ confirmButtonLabel }}
                   </button>
                 </div>
               </div>
             </DialogContent>
           </DialogOverlay>
         </DialogPortal>
       </DialogRoot>
+
+      <!-- D4:停用技能「在对话中试用」先提示(见文件头注释「偏离申报 3」)。这个弹窗
+           Vue2 里不存在,没有逐像素复刻目标,所以用标准壳 SkModal,不套上面那份 reka
+           原语手拼(两种外壳并存的理由见文件头注释「两种弹窗外壳并存,不是不一致」)。 -->
+      <SkModal
+        :open="tryModalOpen"
+        :title="t('aiSkTryDisabledTitle')"
+        @update:open="tryModalOpen = $event"
+      >
+        <p>{{ t('aiSkTryDisabledBody') }}</p>
+        <template #footer>
+          <button class="sk-btn ghost" @click="cancelTryModal">{{ t('aiCancel') }}</button>
+          <button class="sk-btn primary" @click="confirmEnableAndTry">{{ t('aiSkTryEnableAndTry') }}</button>
+        </template>
+      </SkModal>
     </template>
   </div>
 </template>
