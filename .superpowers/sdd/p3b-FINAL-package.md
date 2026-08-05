# P3b 全支线 review package — 4bfabfc..HEAD

## commits
f6792a8 sp8-ai P3b Task 8 fix: strengthen two space-blind assertions in SkillsSection.test.ts
5fd5f19 sp8-ai P3b Task 8: SkillsSection write-op wiring (+ button, toggle/delete/create/test)
19b7f6e sp8-ai P3b Task 7 fix: D4 modal stays open until toggle succeeds; pendingTryId RED coverage
d8078aa sp8-ai P3b Task 7: D4 disabled-skill try-in-chat confirm + mount TestPanel
c13e102 sp8-ai P3b Task 6: SkillDetail write ops (switch/menu/copy/export) + delete confirm dialog
c27e050 sp8-ai P3b Task 5: add AddSkillModal.vue (skills write area)
af1cdc0 sp8-ai P3b Task 4: sandbox test panel (TestPanel.vue)
e1a53c7 sp8-ai P3b Task 3: sandbox skill-test SSE transport (skillTestTransport)
f4a859d sp8-ai P3b Task 2 fix: half-width punctuation + real byte constant (review T2)
b8357ee sp8-ai P3b Task 2: skills write-half sandboxRun/skillsErrorKey utils + i18n keys
f613947 sp8-ai P3b Task 1: skills-styles write-half CSS base + pause icon

## diff --stat
 src/ai/components/icons/AgentIcon.vue              |   3 +
 src/ai/components/settings/SkModal.test.ts         |  35 ++
 src/ai/components/settings/SkModal.vue             |  14 +-
 .../settings/sections/SkillsSection.test.ts        | 337 ++++++++++++++-
 .../components/settings/sections/SkillsSection.vue | 179 +++++++-
 .../settings/skills/AddSkillModal.test.ts          | 258 +++++++++++
 .../components/settings/skills/AddSkillModal.vue   | 268 ++++++++++++
 .../components/settings/skills/SkillDetail.test.ts | 478 ++++++++++++++++++++-
 src/ai/components/settings/skills/SkillDetail.vue  | 366 +++++++++++++++-
 .../components/settings/skills/TestPanel.test.ts   | 277 ++++++++++++
 src/ai/components/settings/skills/TestPanel.vue    | 236 ++++++++++
 src/ai/services/skillTestTransport.test.ts         |  95 ++++
 src/ai/services/skillTestTransport.ts              |  52 +++
 src/ai/styles/settingsStyles.test.ts               |  11 +
 src/ai/styles/sk-shared.scss                       |   5 +
 src/ai/styles/skills-styles.scss                   | 303 ++++++++++++-
 src/ai/styles/tokens.scss                          |  11 +
 src/ai/types/skill.ts                              |  25 ++
 src/ai/util/sandboxRun.test.ts                     | 118 +++++
 src/ai/util/sandboxRun.ts                          |  73 ++++
 src/ai/util/skillsErrorKey.test.ts                 | 172 ++++++++
 src/ai/util/skillsErrorKey.ts                      |  77 ++++
 src/i18n/en_us.ts                                  |  80 ++++
 src/i18n/messageSyntax.test.ts                     |  96 +++++
 src/i18n/zh_cn.ts                                  |  89 ++++
 25 files changed, 3594 insertions(+), 64 deletions(-)

## diff -U10
diff --git a/src/ai/components/icons/AgentIcon.vue b/src/ai/components/icons/AgentIcon.vue
index 8932d9b..8fe21e5 100644
--- a/src/ai/components/icons/AgentIcon.vue
+++ b/src/ai/components/icons/AgentIcon.vue
@@ -13,20 +13,23 @@ const PATHS: Record<string, string> = {
   mic: '<rect x="8" y="3" width="4" height="9" rx="2" /><path d="M5 10a5 5 0 0 0 10 0M10 15v3M7 18h6" />',
   image: '<rect x="3" y="3" width="14" height="14" rx="2" /><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" /><path d="M3 13l4-4 4 4 3-3 3 3" />',
   folder: '<path d="M3 6a1 1 0 0 1 1-1h3l2 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z" />',
   search: '<circle cx="9" cy="9" r="5" /><path d="M13 13l4 4" />',
   sparkle: '<path d="M10 3l1.5 4.5L16 9l-4.5 1.5L10 15l-1.5-4.5L4 9l4.5-1.5L10 3zM16 13l.7 1.8L18.5 15l-1.8.7L16 17.5l-.7-1.8L13.5 15l1.8-.7L16 13z" fill="currentColor" stroke="none" />',
   chev: '<path d="M7 5l5 5-5 5" />',
   chevDown: '<path d="M5 7l5 5 5-5" />',
   check: '<path d="M4 10l4 4 8-8" />',
   x: '<path d="M5 5l10 10M15 5L5 15" />',
   play: '<path d="M6 4l10 6-10 6V4z" fill="currentColor" stroke="none" />',
+  // SP8-P3b Task 1 —— TestPanel(P3b)运行态用。20 单位坐标系,stroke 走 currentColor,
+  // 不传具名色。放在 play 相邻处(同属媒体控制类图标)。
+  pause: '<path d="M7 4v12M13 4v12"/>',
   code: '<path d="M7 6l-4 4 4 4M13 6l4 4-4 4M11 4l-2 12" />',
   star: '<path d="M10 2l2.5 5.5 5.5.6-4 4 1 5.5L10 15l-5 2.6 1-5.5-4-4 5.5-.6L10 2z" fill="currentColor" stroke="none" />',
   download: '<path d="M10 3v10M5 9l5 5 5-5"/><path d="M3 17h14"/>',
   // SP8-P2b 验收反馈(2026-07-30)新增:外链/在新标签页打开。20 单位坐标系,无需 scale 包裹。
   // 「Open Phoenix」原本借用 download,语义不符(它不下载任何东西,是开一个网页)。
   external: '<path d="M11 3h6v6"/><path d="M17 3l-8 8"/><path d="M15 11.5V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4.5"/>',
   upload: '<path d="M10 17V7M5 11l5-5 5 5"/><path d="M3 3h14"/>',
   trash: '<path d="M3 5h14M8 5V3h4v2M5 5l1 12h8l1-12"/>',
   settings: '<g transform="scale(0.8333)"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></g>',
   // SP8-P2b Task 1 —— 1:1 取自 Vue2 src/views/AI/Skills/SkillIcon.vue:24。
diff --git a/src/ai/components/settings/SkModal.test.ts b/src/ai/components/settings/SkModal.test.ts
index 5dc6fb2..db06bbf 100644
--- a/src/ai/components/settings/SkModal.test.ts
+++ b/src/ai/components/settings/SkModal.test.ts
@@ -58,20 +58,55 @@ describe('SkModal', () => {
   it('点关闭按钮 emit update:open=false', async () => {
     const w = mount(SkModal, { props: { open: true, title: 't' }, attachTo: document.body })
     await nextTick()
     const x = host.querySelector('.sk-x') as HTMLElement
     expect(x).not.toBeNull()
     x.click()
     await nextTick()
     expect(w.emitted('update:open')).toEqual([[false]])
   })
 
+  // SP8-P3b Task 5 —— footerLeft 插槽(AddSkillModal 消费:左边「保存在这台 NAS 本地」
+  // 说明,右边取消/创建按钮),纯增量,不改动上面任何既有断言。
+  it('footerLeft 插槽渲染成 .right 的前置兄弟节点(左右两栏并存)', async () => {
+    mount(SkModal, {
+      props: { open: true, title: 't' },
+      slots: {
+        footerLeft: '<span class="save-note-probe">保存说明</span>',
+        footer: '<button class="fbtn2">创建</button>',
+      },
+      attachTo: document.body,
+    })
+    await nextTick()
+    const foot = host.querySelector('.sk-modal-foot') as HTMLElement
+    expect(foot).not.toBeNull()
+    const left = foot.querySelector('.save-note-probe')
+    const right = foot.querySelector('.right .fbtn2')
+    expect(left).not.toBeNull()
+    expect(right).not.toBeNull()
+    // 左栏必须在 DOM 顺序上先于 .right(即视觉上落在它左边,而不是被塞进 .right 内部)
+    expect(left!.compareDocumentPosition(right!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
+    expect(right!.closest('.right')).not.toBeNull()
+    expect(left!.closest('.right')).toBeNull()
+  })
+
+  it('只传 footerLeft、不传 footer 时仍渲染 .sk-modal-foot(条件逻辑要自洽,本期暂无消费方这么用)', async () => {
+    mount(SkModal, {
+      props: { open: true, title: 't' },
+      slots: { footerLeft: '<span class="only-left-probe">仅左栏</span>' },
+      attachTo: document.body,
+    })
+    await nextTick()
+    expect(host.querySelector('.sk-modal-foot')).not.toBeNull()
+    expect(host.querySelector('.only-left-probe')).not.toBeNull()
+  })
+
   it('portalTo 可覆盖(给非设置页复用留口)', async () => {
     const other = document.createElement('div')
     other.id = 'other-host'
     document.body.appendChild(other)
     mount(SkModal, { props: { open: true, title: 't', portalTo: '#other-host' }, attachTo: document.body })
     await nextTick()
     expect(other.querySelector('.sk-modal')).not.toBeNull()
     expect(host.querySelector('.sk-modal')).toBeNull()
   })
 })
diff --git a/src/ai/components/settings/SkModal.vue b/src/ai/components/settings/SkModal.vue
index 0a3939a..a34ba76 100644
--- a/src/ai/components/settings/SkModal.vue
+++ b/src/ai/components/settings/SkModal.vue
@@ -15,36 +15,46 @@
 -->
 <script setup lang="ts">
 import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui'
 import AgentIcon from '../icons/AgentIcon.vue'
 
 const props = withDefaults(
   defineProps<{ open: boolean; title: string; portalTo?: string }>(),
   { portalTo: '.set-app' },
 )
 const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()
-const slots = defineSlots<{ default?: () => unknown; footer?: () => unknown }>()
+// SP8-P3b Task 5 —— 加一个可选的 footerLeft 插槽。Vue2 AddSkillModal.vue:96-108 的底栏是
+// 两栏:左边 `.save-note`(保存说明 + check 图标)、右边 `.right`(取消/创建两个按钮),
+// sk-shared.scss:139-150 的 `.sk-modal-foot` 本来就同时支持 `.save-note` 与 `.right`
+// (后者 `margin-left: auto`),但本组件原先把 `#footer` 插槽整个塞进 `.right` 里 ——
+// AddSkillModal 若只用现成插槽,「保存在本机」那行会被推到右边贴着按钮,与 Vue2 视觉不符。
+// 纯增量:footerLeft 缺省不传时 <slot name="footerLeft" /> 不渲染任何内容,现有三个消费方
+// (ChannelsSection 两处、McpTokensSection 一处)只传 #footer,行为不变。
+const slots = defineSlots<{ default?: () => unknown; footer?: () => unknown; footerLeft?: () => unknown }>()
 </script>
 
 <template>
   <DialogRoot :open="props.open" @update:open="emit('update:open', $event)">
     <DialogPortal :to="props.portalTo" defer>
       <DialogOverlay class="sk-modal-bg">
         <DialogContent class="sk-modal" :aria-describedby="undefined">
           <div class="sk-modal-head">
             <DialogTitle class="sk-modal-title">{{ props.title }}</DialogTitle>
             <button type="button" class="sk-x" @click="emit('update:open', false)">
               <AgentIcon name="x" :size="14" />
             </button>
           </div>
           <div class="sk-modal-body"><slot /></div>
-          <div v-if="slots.footer" class="sk-modal-foot">
+          <!-- v-if 同时看两个插槽:只传 footerLeft 不传 footer 这条件在逻辑上也要立得住
+               (哪怕本期没有消费方这么用),不能写一个只覆盖 footer 单侧的条件。 -->
+          <div v-if="slots.footer || slots.footerLeft" class="sk-modal-foot">
+            <slot name="footerLeft" />
             <div class="right"><slot name="footer" /></div>
           </div>
         </DialogContent>
       </DialogOverlay>
     </DialogPortal>
   </DialogRoot>
 </template>
 
 <style scoped>
 /* 关闭按钮:Vue2 里是 McpTokensSection.vue:241-244 的 .mcp-x 与
diff --git a/src/ai/components/settings/sections/SkillsSection.test.ts b/src/ai/components/settings/sections/SkillsSection.test.ts
index 64333db..e2117b2 100644
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
@@ -232,10 +256,317 @@ describe('SkillsSection(只读半)', () => {
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
+  // brief §10.2 明确点名的条件:钉住「只有删的是当前选中项才落到剩余第一项」。
+  //
+  // 【评审 Important,已修】原 fixture 只有两项([a, b]),选中 a(默认第一项),删 b——
+  // 删完剩 [a],此时不管 `if (activeId.value === id)` 那个条件生效与否,`activeId`
+  // 落点都是 'a'(条件生效:原地不动,仍是 a;条件被删/无条件回落 skills[0]:也是 a),
+  // 两种实现给出同一结果,断言分辨不出来,是空转用例(评审 RED 探针实测:把条件整个删掉,
+  // 23 例仍全绿)。改成三项 `[a, b, c]`,先切到 **c**(不是删完后剩余列表的第一项)再删
+  // **b**——条件生效:activeId 仍是 c;条件被删(无条件回落 skills[0]):activeId 会错误
+  // 地跳成 a。两种实现在这个 fixture 下必然分道,断言才有判别力。
+  it('删的不是当前选中项时 activeId 不变,详情面板仍显示原选中的技能', async () => {
+    h.listSkills.mockResolvedValue([
+      makeSkill({ id: 'a', name: 'skill-a', title: 'Skill A' }),
+      makeSkill({ id: 'b', name: 'skill-b', title: 'Skill B' }),
+      makeSkill({ id: 'c', name: 'skill-c', title: 'Skill C' }),
+    ])
+    h.deleteSkill.mockResolvedValue(undefined)
+    const w = mountSection()
+    await flush()
+    // 先切到第三项(c)——删完剩余列表 [a, c] 的第一项是 a,不是 c,两种实现的分歧点。
+    await w.findAll('.sk-item')[2].trigger('click')
+    await flush()
+    expect(w.find('.sk-name span').text()).toBe('Skill C')
+
+    const detail = w.findComponent(SkillDetail)
+    detail.vm.$emit('delete', 'b') // 删的是 b,不是当前选中的 c
+    await flush()
+
+    expect(w.findAll('.sk-item')).toHaveLength(2)
+    // activeId 必须仍是 c——若条件被删(无条件回落 skills[0]),这里会变成 'Skill A'。
+    expect(w.find('.sk-name span').text()).toBe('Skill C')
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
+  // 【同档自查,见任务报告「同档自查」段】原版只在 a(默认选中的第一项,index 0)上
+  // 调用一次 `test`,再切到 b 断言 b 没被污染——如果实现把 `findIndex(s =>
+  // s.id===activeId.value)` 错写成硬编码 `idx = 0`,这条测试仍然全绿(a 恰好就是
+  // index 0,断言值与"正确实现"完全相同),抓不到这类回归。补一段:切到 b 之后**也**
+  // 调用一次 `test`,断言改的是 b(index 1)而不是 a——硬编码 `idx = 0` 的实现会在
+  // 这一步改错 a,断言精确报红(RED 探针见任务报告)。
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
+
+    // 现在 b 是选中项(index 1,不是 0)——再调用一次 test,必须改的是 b。硬编码
+    // `idx = 0` 的实现会在这一步改错成 a,下面两条断言会精确报红。
+    detail.vm.$emit('test')
+    await flush()
+    expect(w.find('.sk-name span').text()).toBe('Skill B') // 仍显示 b,不受影响
+    expect(w.findAll('.sk-meta-cell')[3].find('.val').text()).toContain('Just now')
+    expect(w.findAll('.sk-meta-cell')[3].find('.total').text()).toBe('· 共 6 次') // b: 5+1
+
+    // 切回 a,确认 a 的数据停在第一次调用后的值(4 次),没有被第二次 test() 误伤。
+    await w.findAll('.sk-item')[0].trigger('click')
+    await flush()
+    expect(w.find('.sk-name span').text()).toBe('Skill A')
+    expect(w.findAll('.sk-meta-cell')[3].find('.total').text()).toBe('· 共 4 次')
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
diff --git a/src/ai/components/settings/skills/AddSkillModal.test.ts b/src/ai/components/settings/skills/AddSkillModal.test.ts
new file mode 100644
index 0000000..3503036
--- /dev/null
+++ b/src/ai/components/settings/skills/AddSkillModal.test.ts
@@ -0,0 +1,258 @@
+import { describe, it, expect, beforeEach, afterEach } from 'vitest'
+import { mount } from '@vue/test-utils'
+import { nextTick } from 'vue'
+import { createI18n } from 'vue-i18n'
+import zh from '../../../../i18n/zh_cn'
+import AddSkillModal from './AddSkillModal.vue'
+import { SKILL_COLOR_IDS } from './SkillTile.vue'
+
+// SP8-P3b Task 5 —— AddSkillModal.vue 的测试。挂载手法与 ChannelsSection.test.ts /
+// SkModal.test.ts 一致:SkModal 的 DialogPortal 默认 portal 到 '.set-app',目标元素必须
+// 在组件挂载前就存在于 DOM。
+//
+// jsdom 里 File.prototype.text 不存在(已实测,见任务报告),brief 允许「若不可用则
+// mock」——这里不构造真实 File,直接给 <input type="file"> 的 files 属性喂一个
+// 「够用的假 FileList」(带 name/size/text() 的普通对象数组;数组本身可迭代,
+// Array.from() 在组件里就够用了),用 Object.defineProperty 覆盖只读的 .files。
+
+function withHost() {
+  const host = document.createElement('div')
+  host.className = 'set-app'
+  document.body.appendChild(host)
+  return host
+}
+
+const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
+
+function mountModal(props: Partial<{ open: boolean; saving: boolean; serverError: string }> = {}) {
+  return mount(AddSkillModal, {
+    props: { open: true, saving: false, serverError: '', ...props },
+    global: { plugins: [i18n] },
+    attachTo: document.body,
+  })
+}
+
+const flush = async () => { await nextTick(); await nextTick(); await nextTick() }
+// 组件的打开态聚焦用 setTimeout(fn, 0)(宏任务)覆盖 reka 的默认 mount-auto-focus
+// (见组件头注释「reka 初始焦点实测结论」),纯微任务级的 flush() 追不上,需要真的
+// 让一个宏任务跑完。
+const macroFlush = async () => { await flush(); await new Promise((r) => setTimeout(r, 0)); await flush() }
+
+function nameInput() {
+  return document.querySelector('.sk-modal .sk-field:nth-of-type(1) input') as HTMLInputElement
+}
+function descInput() {
+  return document.querySelector('.sk-modal .sk-field:nth-of-type(2) textarea') as HTMLTextAreaElement
+}
+function submitBtn() {
+  return document.querySelector('.sk-modal-foot .sk-btn.primary') as HTMLButtonElement
+}
+function fileInput() {
+  return document.querySelector('.sk-modal input[type="file"]') as HTMLInputElement
+}
+
+function setValue(el: HTMLInputElement | HTMLTextAreaElement, v: string) {
+  el.value = v
+  el.dispatchEvent(new Event('input'))
+}
+
+function pickFiles(files: Array<{ name: string; size: number; text: () => Promise<string> }>) {
+  Object.defineProperty(fileInput(), 'files', { value: files, configurable: true })
+  fileInput().dispatchEvent(new Event('change'))
+}
+
+beforeEach(() => { withHost() })
+afterEach(() => { document.body.innerHTML = '' })
+
+describe('AddSkillModal', () => {
+  it('两字段非空才启用创建按钮', async () => {
+    mountModal()
+    await macroFlush()
+    expect(submitBtn().disabled).toBe(true) // 两字段都空
+
+    setValue(nameInput(), 'invoice-tagger')
+    await flush()
+    expect(submitBtn().disabled).toBe(true) // 只填了名称
+
+    setValue(descInput(), '标记发票')
+    await flush()
+    expect(submitBtn().disabled).toBe(false) // 两字段都非空
+
+    setValue(nameInput(), '   ')
+    await flush()
+    expect(submitBtn().disabled).toBe(true) // 名称退回纯空格
+  })
+
+  it('提交 payload 逐字段正确:title===name、scripts 路径前缀 scripts/、examples: []', async () => {
+    const w = mountModal()
+    await macroFlush()
+    setValue(nameInput(), 'invoice-tagger')
+    setValue(descInput(), 'Tags invoices automatically')
+    await flush()
+
+    pickFiles([{ name: 'run.py', size: 100, text: async () => 'print(1)' }])
+    await flush()
+
+    submitBtn().click()
+    await flush()
+
+    expect(w.emitted('save')).toHaveLength(1)
+    expect(w.emitted('save')![0][0]).toEqual({
+      name: 'invoice-tagger',
+      title: 'invoice-tagger',
+      description: 'Tags invoices automatically',
+      trigger: 'auto',
+      color: 'blue',
+      md: '',
+      examples: [],
+      scripts: [{ path: 'scripts/run.py', content: 'print(1)' }],
+    })
+  })
+
+  it('名称非法(含大写/下划线)→ 行内错误(aiSkErrBadId)且不 emit save(钉住偏离 2)', async () => {
+    const w = mountModal()
+    await macroFlush()
+    setValue(nameInput(), 'Invoice_Tagger')
+    setValue(descInput(), '合法描述')
+    await flush()
+    // valid 只查两字段非空,不做格式校验 —— 按钮此时应可点
+    expect(submitBtn().disabled).toBe(false)
+
+    submitBtn().click()
+    await flush()
+
+    const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
+    expect(err).not.toBeNull()
+    expect(err.getAttribute('role')).toBe('alert')
+    expect(err.textContent).toBe(zh.aiSkErrBadId)
+    expect(w.emitted('save')).toBeUndefined()
+  })
+
+  it('描述超过 256 个 Unicode 码点 → 行内错误(aiSkErrDescTooLong)且不 emit save', async () => {
+    const w = mountModal()
+    await macroFlush()
+    setValue(nameInput(), 'invoice-tagger')
+    setValue(descInput(), 'a'.repeat(257))
+    await flush()
+
+    submitBtn().click()
+    await flush()
+
+    const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
+    expect(err.textContent).toBe(zh.aiSkErrDescTooLong)
+    expect(w.emitted('save')).toBeUndefined()
+  })
+
+  it('7 个颜色点渲染,data-color 顺序与 SKILL_COLOR_IDS 一致;点击切换 data-active;零内联颜色(钉住偏离 1)', async () => {
+    mountModal()
+    await macroFlush()
+    const dots = Array.from(document.querySelectorAll('.sk-modal .sk-color-dot')) as HTMLElement[]
+    expect(dots).toHaveLength(7)
+    expect(dots.map((d) => d.dataset.color)).toEqual([...SKILL_COLOR_IDS])
+    expect(dots[0].dataset.active).toBe('true') // 默认 color: 'blue' = 第一个 id
+    // 钉住偏离 1:任何一个色点都不许带内联 style(Vue2 :61 是 :style="{ background: c.bg }")
+    dots.forEach((d) => expect(d.getAttribute('style')).toBeNull())
+
+    dots[3].click()
+    await nextTick()
+    expect(dots[3].dataset.active).toBe('true')
+    expect(dots[0].dataset.active).toBe('false')
+  })
+
+  it('三个触发选项互斥切换', async () => {
+    mountModal()
+    await macroFlush()
+    const opts = Array.from(document.querySelectorAll('.sk-modal .sk-trig-option')) as HTMLElement[]
+    expect(opts).toHaveLength(3)
+    expect(opts[0].dataset.active).toBe('true') // 默认 trigger: 'auto'
+
+    opts[1].click()
+    await nextTick()
+    expect(opts[1].dataset.active).toBe('true')
+    expect(opts[0].dataset.active).toBe('false')
+    expect(opts[2].dataset.active).toBe('false')
+
+    opts[2].click()
+    await nextTick()
+    expect(opts[2].dataset.active).toBe('true')
+    expect(opts[1].dataset.active).toBe('false')
+  })
+
+  it('>1 MiB 文件被跳过且出现行内提示;≤1 MiB 的正常读入(钉住偏离 3)', async () => {
+    mountModal()
+    await macroFlush()
+    pickFiles([
+      { name: 'small.py', size: 100, text: async () => 'print(1)' },
+      { name: 'big.bin', size: 1024 * 1024 + 1, text: async () => 'should-not-be-read' },
+    ])
+    await flush()
+
+    expect(document.body.textContent).toContain('small.py')
+    expect(document.body.textContent).not.toContain('big.bin')
+    const expectedHint = zh.aiSkFilesSkippedTooBig.replace('{n}', '1')
+    expect(document.body.textContent).toContain(expectedHint)
+  })
+
+  it('恰好 1 MiB 的文件不算超限(边界:size > 1024*1024 才跳过)', async () => {
+    mountModal()
+    await macroFlush()
+    pickFiles([{ name: 'exact.bin', size: 1024 * 1024, text: async () => 'ok' }])
+    await flush()
+    expect(document.body.textContent).toContain('exact.bin')
+    expect(document.body.textContent).not.toContain(zh.aiSkFilesSkippedTooBig.replace('{n}', '1'))
+  })
+
+  it('saving 为 true 时按钮文案变为「创建中…」且禁用', async () => {
+    mountModal({ saving: true })
+    await macroFlush()
+    setValue(nameInput(), 'foo')
+    setValue(descInput(), 'bar')
+    await flush()
+    expect(submitBtn().disabled).toBe(true)
+    expect(submitBtn().textContent).toContain(zh.aiSkCreating)
+  })
+
+  it('serverError 非空时显示在行内错误位', async () => {
+    mountModal({ serverError: zh.aiSkErrDuplicate })
+    await macroFlush()
+    const err = document.querySelector('.sk-modal .sk-field-err') as HTMLElement
+    expect(err).not.toBeNull()
+    expect(err.textContent).toBe(zh.aiSkErrDuplicate)
+  })
+
+  // reka 初始焦点实测结论的回归守卫:见组件头注释,默认会被 FocusScope 抢到 .sk-x,
+  // 这里钉住显式覆盖之后真的落在名称输入框上。
+  it('打开时焦点最终落在名称输入框(覆盖 reka 默认聚焦到 .sk-x 关闭按钮)', async () => {
+    mountModal()
+    await macroFlush()
+    expect(document.activeElement).toBe(nameInput())
+  })
+
+  it('关闭后重新打开:表单复位为初始值(组件常驻,不像 Vue2 每次打开都是全新实例)', async () => {
+    const w = mountModal()
+    await macroFlush()
+    setValue(nameInput(), 'foo')
+    setValue(descInput(), 'bar')
+    await flush()
+
+    await w.setProps({ open: false })
+    await flush()
+    await w.setProps({ open: true })
+    await macroFlush()
+
+    expect(nameInput().value).toBe('')
+    expect(descInput().value).toBe('')
+  })
+
+  it('取消按钮 emit update:open(false),不 emit save', async () => {
+    const w = mountModal()
+    await macroFlush()
+    const cancelBtn = Array.from(document.querySelectorAll('.sk-modal-foot .sk-btn.ghost'))
+      .find((b) => b.textContent?.trim() === zh.aiCancel) as HTMLButtonElement
+    expect(cancelBtn).toBeTruthy()
+    cancelBtn.click()
+    await flush()
+    expect(w.emitted('update:open')).toEqual([[false]])
+    expect(w.emitted('save')).toBeUndefined()
+  })
+})
diff --git a/src/ai/components/settings/skills/AddSkillModal.vue b/src/ai/components/settings/skills/AddSkillModal.vue
new file mode 100644
index 0000000..dd2e14b
--- /dev/null
+++ b/src/ai/components/settings/skills/AddSkillModal.vue
@@ -0,0 +1,268 @@
+<!--
+  SP8-P3b Task 5 —— 1:1 移植自 Vue2 src/views/AI/Skills/AddSkillModal.vue(188 行)。
+
+  外壳换成 SkModal(reka Dialog),不照抄 Vue2 裸 `.sk-modal-bg` + `@click.self`
+  (P2b Task 3 已定先例,视觉规则不变)。footer 用 SkModal 本任务新加的 `footerLeft`
+  插槽承载「保存在这台 NAS 本地」说明,`footer` 插槽承载取消/创建两个按钮 —— 对齐
+  Vue2 :96-108 的两栏布局(左 `.save-note`,右 `.right`),详见 SkModal.vue 头注释。
+
+  ===== 三处拍板偏离(逐条三件套,公共约束 §3.6/3.7/3.8,brief §5.1)=====
+
+  【偏离 1 —— 颜色圆点不用内联 :style】
+  Vue2 :56-64 用 `:style="{ background: c.bg }"` 内联传渐变字符串,本仓禁内联颜色
+  (公共约束 §6)。改 `:data-color="id"`,底色由 T1 埋进 skills-styles.scss:717-723 的
+  7 条 `[data-color=…]` 规则供(值为 P3a Task 1 建的 `--grad-sk-*` token)。选中态仍走
+  `:data-active`,与 Vue2 :60 语义一致。
+
+  【偏离 2 —— 提交前本地校验】
+  Vue2 :173-174 `submit()` 只查 `!this.valid`(两字段非空),填完一整屏才被后端一句英文
+  顶回来。这里 submit() 先跑 T2 的 `validateSkillForm(name, description)`(逐条对齐后端
+  skills_store.go 的校验规则),非 null 则把对应 i18n 键渲染进 `.sk-field-err`(落在
+  `.sk-modal-body` 顶部,先于所有字段)。`valid`(按钮禁用条件,:137-139)仍只查两字段
+  非空 —— 完整校验只在点击时跑,不塞进禁用态,否则用户不知道为什么点不动。
+  `serverError` prop 与本地校验错误显示在同一个位——本地校验通不过时不会发请求,两者
+  天然互斥,不需要额外的优先级判断。
+
+  【偏离 3 —— >1 MiB 文件不再静默丢弃】
+  Vue2 :164-167 `f.size > 1024*1024` 直接 `continue`,用户看不到文件消失。这里改为累计
+  跳过数(`skippedCount`),达到 >0 时在文件字段下方追加一条 `.sk-field-hint`,文案
+  `aiSkFilesSkippedTooBig`(先例:P1c1 附件管线的 500 MB 门)。
+
+  ===== reka 初始焦点实测结论(任务书要求先实测,不要照猜)=====
+  用 SkModal.vue 现有测试同款手法起了一个探针挂载(mount 后连续 `nextTick` 查
+  `document.activeElement`):reka Dialog 的 FocusScope 默认把 mount-auto-focus 落在
+  DialogContent 内**第一个可聚焦元素**——本组件里那是 SkModal 内置的 `.sk-x` 关闭按钮
+  (它在 DOM 顺序上先于本组件的名称输入框),不是名称框。与 Vue2 :133-135「打开即聚焦
+  名称输入框」不一致,所以需要显式 `focus()`。
+  但进一步实测发现:reka 的 auto-focus 分派发生在 `FocusScope` 自己的
+  `watchEffect(async () => { await nextTick(); ...dispatchMountAutoFocus... })` 里,
+  与本组件在 `watch(() => props.open, ...)` 里同样用 `nextTick()` 再 `focus()` 是**同一
+  微任务级时序在赛跑**——实测两者谁赢不确定(在 jsdom 环境下 reka 的分派后跑,直接抢回
+  `.sk-x`)。改成宏任务级延迟(`setTimeout(fn, 0)`)后实测稳定胜出、落在名称输入框上,
+  不再被 reka 的默认行为抢走(不修改 SkModal 本身的默认聚焏逃辑,只在本组件里用更晚的
+  时机覆盖它,不影响 ChannelsSection/McpTokensSection 两个既有消费方的默认聚焦)。
+
+  ===== 非「拍板偏离」但需要说明的实现细节 =====
+  Vue2 每次打开这个弹窗都是父级 `v-if` 重新创建一份组件实例(`mounted()` 天然只跑一次,
+  表单永远从空白开始)。本组件走 SkModal 的 `open` prop 控制可见性,组件实例本身是
+  常驻的,不会随每次打开/关闭重新创建——若不显式复位,「取消」后再次打开会看到上一次
+  残留的输入。这不是新增行为,是为了在架构变化后仍旧还原 Vue2 那个「每次打开都是空表单」
+  的可见行为:`watch(open)` 在关闭时（`v === false`）复位全部字段,不在这里额外申报为
+  行为偏离。
+-->
+<script setup lang="ts">
+import { ref, computed, watch } from 'vue'
+import { useI18n } from 'vue-i18n'
+import SkModal from '../SkModal.vue'
+import AgentIcon from '../../icons/AgentIcon.vue'
+import { SKILL_COLOR_IDS } from './SkillTile.vue'
+import { validateSkillForm } from '../../../util/skillsErrorKey'
+// SP8-P3b Task 8 —— 协调者预先解歧义①:`SkillFormPayload`/`SkillScript` 挪到
+// `types/skill.ts` 并导出(纯搬移,字段未改),供 `SkillsSection.vue` 的 `onCreate`
+// 标注 `@save` payload 类型。见 skill.ts 头注释「Task 8」段。
+import type { SkillFormPayload } from '../../../types/skill'
+
+interface PickedFile { name: string; content: string; size: number }
+
+const props = defineProps<{ open: boolean; saving: boolean; serverError: string }>()
+const emit = defineEmits<{
+  (e: 'update:open', v: boolean): void
+  (e: 'save', payload: SkillFormPayload): void
+}>()
+
+const { t } = useI18n()
+
+const name = ref('')
+const description = ref('')
+const trigger = ref<'auto' | 'slash' | 'manual'>('auto')
+const color = ref<string>(SKILL_COLOR_IDS[0]) // Vue2 data() color: 'blue' —— 首个 id 即 blue
+const md = ref('')
+const files = ref<PickedFile[]>([])
+const skippedCount = ref(0)
+const localErrorKey = ref('')
+
+const nameInputEl = ref<HTMLInputElement | null>(null)
+const filesInputEl = ref<HTMLInputElement | null>(null)
+
+// Vue2 :137-139 —— 按钮禁用条件只查两字段非空,完整校验只在 submit() 时跑。
+const valid = computed(() => name.value.trim().length > 0 && description.value.trim().length > 0)
+
+// 偏离 2:本地校验错误优先显示;两者互斥(本地校验不过就不会发请求,serverError 不会
+// 与本地错误同时非空)。
+const errorText = computed(() => (localErrorKey.value ? t(localErrorKey.value) : props.serverError || ''))
+
+// 对齐 ChannelsSection.vue:176-177 的既定手法——用户一动字段就撤掉旧错误,免得改完
+// 还挂着上一次的红字。
+watch([name, description], () => { localErrorKey.value = '' })
+
+const triggerOptions: { id: 'auto' | 'slash' | 'manual'; nameKey: string; descKey: string }[] = [
+  { id: 'auto', nameKey: 'aiSkTrigOptAuto', descKey: 'aiSkTrigDescAuto' },
+  { id: 'slash', nameKey: 'aiSkTrigOptSlash', descKey: 'aiSkTrigDescSlash' },
+  // 手动选项名复用 aiSkTagManual(与技能列表的「手动」标签同一个词,Vue2 :147 用的也是
+  // 同一个 $t('Manual')),公共约束 §7 点名的可复用键之一。
+  { id: 'manual', nameKey: 'aiSkTagManual', descKey: 'aiSkTrigDescManual' },
+]
+
+// Vue2 :150-153 computed mdPlaceholder。
+const mdPlaceholder = computed(() => {
+  const head = name.value.trim() || t('aiSkMdPlaceholderHead')
+  return `## ${head}\n\n${t('aiSkMdPlaceholderBody')}`
+})
+
+function resetForm() {
+  name.value = ''
+  description.value = ''
+  trigger.value = 'auto'
+  color.value = SKILL_COLOR_IDS[0]
+  md.value = ''
+  files.value = []
+  skippedCount.value = 0
+  localErrorKey.value = ''
+  if (filesInputEl.value) filesInputEl.value.value = ''
+}
+
+watch(
+  () => props.open,
+  (v) => {
+    if (!v) {
+      resetForm()
+      return
+    }
+    // 显式聚焦名称输入框,对齐 Vue2 :133-135。见头注释「reka 初始焦点实测结论」——
+    // 必须是宏任务级延迟才能稳定压过 reka FocusScope 自己的 mount-auto-focus。
+    setTimeout(() => { nameInputEl.value?.focus() }, 0)
+  },
+  { immediate: true },
+)
+
+async function onFilesPicked(e: Event) {
+  const input = e.target as HTMLInputElement
+  const list = Array.from(input.files || [])
+  const out: PickedFile[] = []
+  let skipped = 0
+  for (const f of list) {
+    if (f.size > 1024 * 1024) {
+      // 偏离 3:Vue2 :164-167 直接 continue 静默丢弃,这里累计跳过数,行内提示。
+      skipped++
+      continue
+    }
+    const text = await f.text()
+    out.push({ name: f.name, content: text, size: f.size })
+  }
+  files.value = out
+  skippedCount.value = skipped
+}
+
+function submit() {
+  if (!valid.value) return
+  const key = validateSkillForm(name.value, description.value)
+  if (key) {
+    localErrorKey.value = key
+    return
+  }
+  localErrorKey.value = ''
+  emit('save', {
+    name: name.value.trim(),
+    title: name.value.trim(),
+    description: description.value.trim(),
+    trigger: trigger.value,
+    color: color.value,
+    md: md.value.trim(),
+    examples: [],
+    scripts: files.value.map((f) => ({ path: 'scripts/' + f.name, content: f.content })),
+  })
+}
+
+function onCancel() {
+  emit('update:open', false)
+}
+</script>
+
+<template>
+  <SkModal :open="props.open" :title="t('aiSkAddTitle')" @update:open="(v) => emit('update:open', v)">
+    <p v-if="errorText" class="sk-field-err" role="alert">{{ errorText }}</p>
+
+    <div class="sk-field">
+      <label class="sk-field-label">{{ t('aiSkFieldName') }}</label>
+      <input
+        ref="nameInputEl"
+        type="text"
+        :placeholder="t('aiSkNamePlaceholder')"
+        v-model="name"
+        @keydown.enter.prevent
+      >
+      <div class="sk-field-hint">{{ t('aiSkNameHint') }}</div>
+    </div>
+
+    <div class="sk-field">
+      <label class="sk-field-label">{{ t('aiSkDescription') }}</label>
+      <textarea :placeholder="t('aiSkDescPlaceholder')" v-model="description" />
+      <div class="sk-field-hint">{{ t('aiSkDescFormHint') }}</div>
+    </div>
+
+    <div class="sk-field">
+      <label class="sk-field-label">{{ t('aiSkTrigger') }}</label>
+      <div class="sk-trig-options">
+        <button
+          v-for="o in triggerOptions" :key="o.id" type="button" class="sk-trig-option"
+          :data-active="trigger === o.id ? 'true' : 'false'"
+          @click="trigger = o.id"
+        >
+          <span class="name">{{ t(o.nameKey) }}</span>
+          <span class="desc">{{ t(o.descKey) }}</span>
+        </button>
+      </div>
+    </div>
+
+    <div class="sk-field">
+      <label class="sk-field-label">{{ t('aiSkFieldColor') }}</label>
+      <div class="sk-color-row">
+        <div
+          v-for="id in SKILL_COLOR_IDS" :key="id" class="sk-color-dot"
+          :data-color="id"
+          :data-active="color === id ? 'true' : 'false'"
+          @click="color = id"
+        />
+      </div>
+    </div>
+
+    <div class="sk-field">
+      <label class="sk-field-label">
+        SKILL.md
+        <span class="sk-field-optional">({{ t('aiSkOptional') }})</span>
+      </label>
+      <textarea
+        v-model="md"
+        :placeholder="mdPlaceholder"
+        style="min-height: 110px; font-family: var(--font-mono); font-size: 12.5px"
+      />
+    </div>
+
+    <div class="sk-field">
+      <label class="sk-field-label">
+        {{ t('aiSkScriptFiles') }}
+        <span class="sk-field-optional">({{ t('aiSkOptional') }})</span>
+      </label>
+      <input ref="filesInputEl" type="file" multiple @change="onFilesPicked">
+      <div class="sk-field-hint">{{ t('aiSkScriptsHint') }}</div>
+      <div v-if="skippedCount > 0" class="sk-field-hint">{{ t('aiSkFilesSkippedTooBig', { n: skippedCount }) }}</div>
+      <ul v-if="files.length" style="font-size: 12px; color: var(--text-tertiary); margin-top: 6px">
+        <li v-for="f in files" :key="f.name">{{ f.name }} — {{ f.size }} B</li>
+      </ul>
+    </div>
+
+    <template #footerLeft>
+      <span class="save-note">
+        <AgentIcon name="check" :size="11" />
+        {{ t('aiSkSavedLocally') }}
+      </span>
+    </template>
+    <template #footer>
+      <button type="button" class="sk-btn ghost" @click="onCancel">{{ t('aiCancel') }}</button>
+      <button type="button" class="sk-btn primary" :disabled="!valid || props.saving" @click="submit">
+        <AgentIcon name="plus" :size="13" />
+        {{ props.saving ? t('aiSkCreating') : t('aiSkCreate') }}
+      </button>
+    </template>
+  </SkModal>
+</template>
diff --git a/src/ai/components/settings/skills/SkillDetail.test.ts b/src/ai/components/settings/skills/SkillDetail.test.ts
index 7aa8832..5f0809b 100644
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
@@ -136,24 +182,32 @@ describe('SkillDetail(只读半)', () => {
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
@@ -172,23 +226,26 @@ describe('SkillDetail(只读半)', () => {
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
@@ -209,11 +266,404 @@ describe('SkillDetail(只读半)', () => {
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
+  // 【评审 Important 1,任务书简化了设计文档 §9.4:「成功才跳转;失败则留在弹窗 +
+  // danger toast,不跳转」——弹窗必须保持打开直到父组件真的把 enabled 改成 true,不是
+  // 发 toggle 那一刻就关。下面三条覆盖 ①点了之后弹窗仍开且未 push ②enabled 变 true
+  // 后弹窗关闭+push ③失败(prop 不变)→ 弹窗仍开、永不 push。】
+
+  it('D4「启用并试用」:点击后弹窗仍开、未 push,只 emit toggle(id,true)', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-5', enabled: false }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+
+    const enableBtn = host.querySelector('.sk-btn.primary') as HTMLButtonElement
+    enableBtn.click()
+    await flush()
+    expect(w.emitted('toggle')).toEqual([['sk-5', true]])
+    // 发 toggle 那一刻还没跳转——父组件还没告知启用是否成功,弹窗必须留在原地
+    // (设计文档 §9.4,不是「发了就关」)。
+    expect(push).not.toHaveBeenCalled()
+    expect(host.querySelector('.sk-modal-title')?.textContent).toBe('该技能已停用')
+  })
+
+  it('D4「启用并试用」:父组件把 enabled 真的改成 true(toggle 成功)后,弹窗关闭 + push 同一步发生', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-5', enabled: false }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
+    await flush()
+
+    await w.setProps({ skill: makeSkill({ id: 'sk-5', enabled: true }) })
+    await flush()
+    expect(push).toHaveBeenCalledTimes(1)
+    expect(push).toHaveBeenCalledWith({ path: '/ai/agent', query: { skill: 'sk-5' } })
+    expect(host.querySelector('.sk-modal')).toBeNull()
+  })
+
+  it('D4:toggle 失败(父组件不改 enabled)→ 弹窗仍开、永不 push', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-6', enabled: false }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
+    await flush()
+    expect(w.emitted('toggle')).toEqual([['sk-6', true]])
+
+    // 父组件请求失败:enabled 原样不变(仍是 false)——不是"取消"，是失败态。
+    // 弹窗必须留在原地(设计文档 §9.4),用户能再点一次或点取消;danger toast 由
+    // 父组件(T8 SkillsSection.onToggle)负责,本组件不重复发。
+    await w.setProps({ skill: makeSkill({ id: 'sk-6', enabled: false }) })
+    await flush()
+    expect(push).not.toHaveBeenCalled()
+    expect(host.querySelector('.sk-modal-title')?.textContent).toBe('该技能已停用')
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
+  // 【评审 Important 2 之①】钉住「跳转前清空 pendingTryId」这道防线本身(与上面「残留
+  // 清除」那条不同——那条钉的是 skill.id 变化时的复位 watch;这条钉的是成功分支自己
+  // 清空 pendingTryId,同一技能不换 id 也要成立)。RED 验证:把成功分支里的
+  // `pendingTryId.value = null` 删掉 → 这条用例精确报红(第二次 push 被多算一次)。
+  it('D4:成功跳转一次后,同一技能之后被手动开关多次,push 总次数仍是 1(挂号已被消费,不会残留重复触发)', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-3', enabled: false }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
+    await flush()
+    await w.setProps({ skill: makeSkill({ id: 'sk-3', enabled: true }) })
+    await flush()
+    expect(push).toHaveBeenCalledTimes(1)
+
+    // 用户之后自己用开关把这个技能关闭再打开——不该被误读成"待跳转"而再跳一次。
+    await w.setProps({ skill: makeSkill({ id: 'sk-3', enabled: false }) })
+    await flush()
+    await w.setProps({ skill: makeSkill({ id: 'sk-3', enabled: true }) })
+    await flush()
+    expect(push).toHaveBeenCalledTimes(1)
+  })
+
+  // 【评审 Important 2 之②】钉住 `if (enabled === true)` 这个判断本身。构造合成竞态:
+  // D4 弹窗打开期间(点确认之前),技能被别处启用(enabled 变 true)——此时 pendingTryId
+  // 还是 null,watcher 空转;随后用户仍然点了确认(pendingTryId 挂号),因为 enabled
+  // 已经是 true、不会再触发"从非 true 到 true"的变化,pendingTryId 悬而不清;紧接着
+  // enabled 被别处改回 false,watcher 第一次真正触发,newVal=false——必须不 push。
+  // RED 验证:把 `if (enabled === true)` 判断删掉(变成一进 if 块就无条件清挂号+push)
+  // → 这条用例精确报红。
+  it('D4:挂号后 watcher 第一次真正触发时 enabled 是 false(不是 true)→ 不 push(钉住 `if (enabled === true)` 判断)', async () => {
+    const w = mountDetail(makeSkill({ id: 'sk-9', enabled: false }))
+    await w.find('.sk-pill-try').trigger('click')
+    await flush()
+    // 合成竞态:弹窗打开期间技能被别处启用(此时还没点确认,pendingTryId 仍是 null)。
+    await w.setProps({ skill: makeSkill({ id: 'sk-9', enabled: true }) })
+    await flush()
+    expect(push).not.toHaveBeenCalled()
+    // 用户仍然点了确认——enabled 已经是 true,不构成"变化",watcher 不会再触发,
+    // pendingTryId 挂号后悬而不清。
+    ;(host.querySelector('.sk-btn.primary') as HTMLButtonElement).click()
+    await flush()
+    expect(w.emitted('toggle')).toEqual([['sk-9', true]])
+    // enabled 被别处改回 false——watcher 第一次真正触发,newVal 是 false。
+    await w.setProps({ skill: makeSkill({ id: 'sk-9', enabled: false }) })
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
index c09014b..ecb7fd2 100644
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
@@ -21,116 +55,346 @@
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
 
-  零 <style> 块:用到的每个 class（sk-detail*、sk-name、sk-pill-try、sk-meta-grid、
-  sk-meta-cell、sk-section*、sk-description、sk-md、sk-file-row）均已存在于
-  skills-styles.scss（Task 1）或 sk-shared.scss（既有）。
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
+
+  【评审后修订(Important 1,任务书 D4 的简化 vs 设计文档 §9.4 原话)】任务书把
+  §9.4「先 `toggle(id, true)`,**成功才跳转**;失败则**留在弹窗** + danger toast,不
+  跳转」简化成了「发 toggle 后关弹窗」,只保留了半句(失败不跳转),漏了「成功前弹窗
+  必须留在原地」——这是任务书对设计文档的简化遗漏,以设计文档为准:`confirmEnableAndTry`
+  不再在发 toggle 那一刻就关 `tryModalOpen`,而是保持打开;`watch(enabled)` 命中
+  `id 匹配 && enabled===true` 时**同一步**关弹窗 + 跳转。toggle 失败时 `enabled`
+  不变,弹窗因此保持打开,用户可以再点一次「启用并试用」或点「取消」。danger toast
+  由父组件(T8 `SkillsSection.onToggle`)负责,本组件不重复发。
+  顺带(自主判断范围,非设计文档强制):`busy[skill.id]` 为真(toggle 请求飞行中)时
+  「启用并试用」按钮 `disabled`,防止用户在请求还没返回时重复点击、叠加发出多次
+  `toggle` 请求。
+
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
+import SkModal from '../SkModal.vue'
+import TestPanel from './TestPanel.vue'
+
+// Vue2 SkillDetail.vue:200-201 `skill: { type: Object, default: null }` +
+// `busy: { type: Object, default: () => ({}) }`(飞行中禁用的技能 id 集合,由父组件
+// SkillsSection 在 toggle/delete 请求进行中维护,驱动开关的 disabled 态)。
+const props = withDefaults(
+  defineProps<{ skill: Skill | null; busy?: Record<string, boolean> }>(),
+  { busy: () => ({}) },
+)
 
-// Vue2 SkillDetail.vue:200 `skill: { type: Object, default: null }`。
-// `busy`（:201）不移植 —— 写操作专用 prop，本任务不涉及任何写操作。
-const props = defineProps<{ skill: Skill | null }>()
+// 对齐 Vue2 :27(`$emit('toggle', …)`)与 :238(`$emit('delete', …)`)。
+// `test` 是 T7 新增:把 TestPanel 的 `test`(只在沙箱真正成功完成时才发,见
+// TestPanel.vue 头注释偏离 D5)原样往上转发,不在本文件里加任何额外触发条件。
+const emit = defineEmits<{
+  (e: 'toggle', id: string, enabled: boolean): void
+  (e: 'delete', id: string): void
+  (e: 'test'): void
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
+// D4:停用技能点「在对话中试用」的确认弹窗(Vue2 没有对应物,本期新增,见文件头注释
+// 「偏离申报 3」)。
+const tryModalOpen = ref(false)
+// D4「启用并试用」的一次性挂号:记录发起 toggle 那一刻的技能 id(不是布尔标志),
+// 见文件头注释「pendingTryId 一次性语义」。
+const pendingTryId = ref<string | null>(null)
+
+// 外部点击关闭菜单。复用既有 `useClickOutside` composable(见文件头注释「实现选择」)
+// 而不是手写 Vue2 :214-225 那份 `watch(menuOpen)` 里条件式 add/removeEventListener。
+useClickOutside(menuWrap, () => { menuOpen.value = false })
+
+// `skill.id` 变化时复位菜单与确认弹窗,对齐 Vue2 `watch: { 'skill.id'() { … } }`(:226-229)。
+// D4:同一处一并复位 tryModalOpen/pendingTryId(清除路径③,见文件头注释)——切到另一个
+// 技能后,上一个技能的「启用并试用」挂号不能残留。
+watch(() => props.skill?.id, () => {
+  menuOpen.value = false
+  confirmOpen.value = false
+  tryModalOpen.value = false
+  pendingTryId.value = null
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
+// D4「启用并试用」:记下当前技能 id 作为一次性挂号,把意图往上冒泡。**不在这里关
+// 弹窗**(评审后修订,见文件头注释「评审后修订」)——设计文档 §9.4 要求「成功才跳转」,
+// 弹窗必须保持打开直到父组件真的把 `enabled` 改成 true;失败时弹窗留在原地,用户能
+// 再点一次或点取消。是否真的启用成功由父组件(SkillsSection)决定——本组件不直接改
+// `skill.enabled`,只观察 props 上的值(下面的 watch)。
+function confirmEnableAndTry() {
+  const s = props.skill
+  if (!s) return
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
+// 变成 true 时才**同一步**关弹窗 + 跳转,随即清空挂号(清除路径①)。toggle 失败时
+// 父组件不会把 `enabled` 改成 true,这里就永远不会看到 true,弹窗保持打开
+// (评审后修订,见文件头注释)——不需要额外的失败分支/定时器。显式核对
+// `s.id === pendingTryId.value` 而不是只信任「skill.id 变化时复位」那处 watch 已经
+// 清空了它:两个 watch 都挂在同一个 `props.skill` 上,不依赖 Vue 内部对同一 tick 里
+// 多个 watcher 的调度顺序这个实现细节。
+watch(() => props.skill?.enabled, (enabled) => {
+  const s = props.skill
+  if (!s || !pendingTryId.value) return
+  if (s.id !== pendingTryId.value) { pendingTryId.value = null; return }
+  if (enabled === true) {
+    pendingTryId.value = null
+    tryModalOpen.value = false
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
@@ -156,22 +420,25 @@ function tryInChat() {
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
@@ -195,13 +462,66 @@ function tryInChat() {
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
+          <!-- busy[skill.id] 为真时禁用(toggle 请求飞行中),防止重复点击叠加发出多次
+               toggle 请求——自主判断范围,见文件头注释「评审后修订」末段。 -->
+          <button
+            class="sk-btn primary"
+            :disabled="!!busy[skill.id]"
+            @click="confirmEnableAndTry"
+          >{{ t('aiSkTryEnableAndTry') }}</button>
+        </template>
+      </SkModal>
     </template>
   </div>
 </template>
diff --git a/src/ai/components/settings/skills/TestPanel.test.ts b/src/ai/components/settings/skills/TestPanel.test.ts
new file mode 100644
index 0000000..9900c1d
--- /dev/null
+++ b/src/ai/components/settings/skills/TestPanel.test.ts
@@ -0,0 +1,277 @@
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { mount, flushPromises } from '@vue/test-utils'
+import { createI18n } from 'vue-i18n'
+import zh from '../../../../i18n/zh_cn'
+import type { Skill } from '../../../types/skill'
+
+// SP8-P3b Task 4 —— 对齐 Vue2 src/views/AI/Skills/TestPanel.vue(182 行)。
+// mock 骨架用 vi.hoisted()(先例 src/ai/stores/agentStore.test.ts:4-19)——裸 const
+// 放 vi.mock 之前会因 ESM 提升抛 TDZ ReferenceError。
+const h = vi.hoisted(() => ({ runSkillTest: vi.fn() }))
+vi.mock('../../../services/skillTestTransport', () => ({ runSkillTest: h.runSkillTest }))
+
+import TestPanel from './TestPanel.vue'
+
+const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
+
+function makeSkill(overrides: Partial<Skill> = {}): Skill {
+  return {
+    id: 's1',
+    name: 'File Organizer',
+    title: 'File Organizer',
+    description: 'organizes files',
+    trigger: 'manual',
+    trigger_human: 'Manual',
+    color: 'blue',
+    icon: 'sparkle',
+    enabled: true,
+    system: false,
+    author: 'Alice',
+    last_used: '',
+    calls: 3,
+    files: [],
+    examples: [],
+    md: '',
+    ...overrides,
+  }
+}
+
+const mountPanel = (skill: Skill) =>
+  mount(TestPanel, { props: { skill }, global: { plugins: [i18n] } })
+
+// 每个测试自己捕获这一轮 runSkillTest 调用传入的 onEvent/onError/signal,并持有一个
+// 可手动 resolve 的 deferred promise,模拟 T3 runSkillTest 在流关闭前一直 pending
+// 的行为(真实实现是 `await sseRequest(...)`,流没关闭 promise 就不会 resolve)。
+type Captured = {
+  onEvent: (ev: Record<string, unknown>) => void
+  onError: (e: unknown) => void
+  signal: AbortSignal
+  resolve: () => void
+}
+function captureNextRun(): Captured {
+  const captured = {} as Captured
+  h.runSkillTest.mockImplementationOnce(
+    (_id: string, _prompt: string, signal: AbortSignal, onEvent: Captured['onEvent'], onError: Captured['onError']) => {
+      captured.onEvent = onEvent
+      captured.onError = onError
+      captured.signal = signal
+      return new Promise<void>(resolve => { captured.resolve = resolve })
+    },
+  )
+  return captured
+}
+
+beforeEach(() => {
+  h.runSkillTest.mockReset()
+})
+
+describe('TestPanel', () => {
+  it('canRun 三态:空 prompt 禁用、有 prompt 启用、running 中禁用', async () => {
+    const w = mountPanel(makeSkill())
+    const btn = w.find('.sk-test-input button')
+    expect(btn.attributes('disabled')).toBeDefined() // 空 prompt
+
+    await w.find('.sk-test-input textarea').setValue('do the thing')
+    expect(btn.attributes('disabled')).toBeUndefined() // 非空 prompt
+
+    const cap = captureNextRun()
+    await btn.trigger('click')
+    expect(btn.attributes('disabled')).toBeDefined() // running 中
+    cap.resolve()
+    await flushPromises()
+  })
+
+  it('Cmd+Enter 触发运行,普通 Enter 不触发', async () => {
+    const w = mountPanel(makeSkill())
+    const textarea = w.find('.sk-test-input textarea')
+    await textarea.setValue('hello')
+
+    await textarea.trigger('keydown', { key: 'Enter' })
+    expect(h.runSkillTest).not.toHaveBeenCalled()
+
+    const cap = captureNextRun()
+    await textarea.trigger('keydown', { key: 'Enter', metaKey: true })
+    expect(h.runSkillTest).toHaveBeenCalledTimes(1)
+    cap.resolve()
+    await flushPromises()
+  })
+
+  it('ctrlKey+Enter 也触发运行(对齐 Vue2 :147 的 e.metaKey || e.ctrlKey)', async () => {
+    const w = mountPanel(makeSkill())
+    const textarea = w.find('.sk-test-input textarea')
+    await textarea.setValue('hello')
+    const cap = captureNextRun()
+    await textarea.trigger('keydown', { key: 'Enter', ctrlKey: true })
+    expect(h.runSkillTest).toHaveBeenCalledTimes(1)
+    cap.resolve()
+    await flushPromises()
+  })
+
+  it('运行中按钮文案变「运行中…」且禁用', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+    expect(w.find('.sk-test-input button').text()).toContain('运行中…')
+    cap.resolve()
+    await flushPromises()
+  })
+
+  it('多个 message_delta 渲染成一行(钉住偏离 D2),tool_call 单独一行', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onEvent({ type: 'message_delta', content: 'Hel' })
+    cap.onEvent({ type: 'message_delta', content: 'lo' })
+    cap.onEvent({ type: 'tool_call', tool: 'grep' })
+    cap.onEvent({ type: 'done' })
+    cap.resolve()
+    await flushPromises()
+
+    const rows = w.findAll('.sk-test-result .step-row')
+    // 若未合并(照抄 Vue2 :162 的逐片 push),这里会是 3 行('Hel'/'lo'/'→ grep')。
+    expect(rows).toHaveLength(2)
+    expect(rows[0].text()).toBe('Hello')
+    expect(rows[1].text()).toContain('→ grep')
+  })
+
+  it('SSE error 事件原样显示后端人类可读文本', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onEvent({ type: 'error', content: 'sandbox timed out' })
+    cap.resolve()
+    await flushPromises()
+
+    const failed = w.find('.sk-test-result .label[data-state="failed"]')
+    expect(failed.exists()).toBe(true)
+    expect(w.find('.sk-test-result').text()).toContain('sandbox timed out')
+  })
+
+  it('HTTP 失败显示带状态码的本地化串,且不回显后端 body 内容', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onError({ status: 500, body: { detail: 'super secret internal path' } })
+    cap.resolve()
+    await flushPromises()
+
+    const text = w.find('.sk-test-result').text()
+    expect(text).toContain('500')
+    expect(text).not.toContain('super secret internal path')
+    expect(text).not.toContain('detail')
+  })
+
+  it('非 HTTP 形状的错误(拿不到 status)落回通用兜底串', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onError(new Error('boom'))
+    cap.resolve()
+    await flushPromises()
+
+    expect(w.find('.sk-test-result').text()).toContain('运行失败')
+  })
+
+  it('成功完成后 emit(test) 恰好一次', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onEvent({ type: 'message_delta', content: 'done thing' })
+    cap.onEvent({ type: 'done' })
+    cap.resolve()
+    await flushPromises()
+
+    expect(w.emitted('test')).toHaveLength(1)
+  })
+
+  it('失败时不 emit(test)(钉住偏离 D5)', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onEvent({ type: 'error', content: 'nope' })
+    cap.resolve()
+    await flushPromises()
+
+    expect(w.emitted('test')).toBeUndefined()
+  })
+
+  it('HTTP 失败(而非 SSE error 事件)时也不 emit(test)', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onError({ status: 422 })
+    cap.resolve()
+    await flushPromises()
+
+    expect(w.emitted('test')).toBeUndefined()
+  })
+
+  it('停用技能显示「技能已关闭」角标,但运行按钮仍可用', async () => {
+    const w = mountPanel(makeSkill({ enabled: false }))
+    expect(w.find('.sk-item-off').exists()).toBe(true)
+    expect(w.find('.sk-item-off').text()).toBe('技能已关闭')
+
+    await w.find('.sk-test-input textarea').setValue('go')
+    expect(w.find('.sk-test-input button').attributes('disabled')).toBeUndefined()
+  })
+
+  it('启用技能不显示「技能已关闭」角标', () => {
+    const w = mountPanel(makeSkill({ enabled: true }))
+    expect(w.find('.sk-item-off').exists()).toBe(false)
+  })
+
+  it('示例提示词点击写进 textarea', async () => {
+    const w = mountPanel(makeSkill({ examples: ['清理下载文件夹', '整理照片'] }))
+    const exButtons = w.findAll('.sk-test-result .ex button')
+    expect(exButtons).toHaveLength(2)
+
+    await exButtons[1].trigger('click')
+    const textarea = w.find('.sk-test-input textarea').element as HTMLTextAreaElement
+    expect(textarea.value).toBe('整理照片')
+  })
+
+  it('有示例但技能无描述示例时不渲染示例区(examples 为空数组)', () => {
+    const w = mountPanel(makeSkill({ examples: [] }))
+    expect(w.find('.sk-test-result .ex').exists()).toBe(false)
+  })
+
+  it('卸载时调用 abort', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    expect(cap.signal.aborted).toBe(false)
+    w.unmount()
+    expect(cap.signal.aborted).toBe(true)
+  })
+
+  it('不实现 output.tokens 死分支:成功文案不含 tokens 相关文本(钉住 Vue2 :70-73 死分支不移植)', async () => {
+    const w = mountPanel(makeSkill())
+    await w.find('.sk-test-input textarea').setValue('go')
+    const cap = captureNextRun()
+    await w.find('.sk-test-input button').trigger('click')
+
+    cap.onEvent({ type: 'done', tokens: 999 })
+    cap.resolve()
+    await flushPromises()
+
+    expect(w.find('.sk-test-result').text()).not.toContain('999')
+    expect(w.find('.sk-test-result').text()).not.toContain('tokens')
+  })
+})
diff --git a/src/ai/components/settings/skills/TestPanel.vue b/src/ai/components/settings/skills/TestPanel.vue
new file mode 100644
index 0000000..e2fbf44
--- /dev/null
+++ b/src/ai/components/settings/skills/TestPanel.vue
@@ -0,0 +1,236 @@
+<!--
+  SP8-P3b Task 4 —— 1:1 移植 Vue2 src/views/AI/Skills/TestPanel.vue(182 行)。
+  由 SkillDetail.vue(T7)插在「描述」与「SKILL.md」两个 `.sk-section` 之间
+  (Vue2 :108-112 的位置,SkillDetail.vue:166-167 已留占位注释)。
+
+  【偏离 D2(公共约束 §3.1,承 T2 sandboxRun.ts 头注)】Vue2 :159-163 每收到一片
+  message/message_delta/text 就 `push` 一个新字符串到 output.steps —— 后端
+  message_delta 是逐词发的(NimoOS-AI/agent/agent.py:1266,1284),照抄会在结果里炸出
+  一大堆单字/单词的独立行。本仓改为消费 T2 `reduceSandboxEvent` 的归约结果:连续文本片
+  会被合并成同一个 `{kind:'text'}` 步骤,工具调用仍单独一行(`{kind:'tool'}`)。
+  本文件不重新实现归约逻辑,只是渲染 T2 已归约好的 `sandbox.steps`。
+
+  【偏离 D5(公共约束 §3.4)】Vue2 一点运行就 `$emit('...')` 让上层 SkillsSection
+  计数 +1(SkillsSection.vue:204-214),而后端 `service/skills.go:352 RecordRun`
+  全仓零调用点、沙箱 SSE 又必 422(见 skillTestTransport.ts 头注「已知后端票」)——
+  两者叠加等于每次「测试」都双重谎报一次成功调用。本仓改为只有
+  `state === 'done' && !sandbox.error`(即真正跑完且没有失败)才 `emit('test')`。
+
+  【HTTP 层失败不回显后端 body】承 P2b「错误不再回显后端 JSON」——onError 拿到
+  `{status}`(非 HTTP 形状则没有 status)时,只用本地化串 `aiSkTestHttpFailed`/
+  `aiSkTestFailed` 兜底,绝不把 `body` 塞进界面。SSE `error` **事件**走的是
+  reduceSandboxEvent 已经写好的 `sandbox.error`(后端人类可读文本,如
+  "sandbox timed out"),原样显示,不算回显后端 JSON,不冲突。
+
+  【失败态样式偏离(协调者预先解歧义,见 p3b-task-4-brief.md 正文)】Vue2 :92-98
+  的失败态靠模板内联样式:`.label` 上 `style="color: var(--danger)"`,`.bullet` 上
+  `style="background: var(--danger); box-shadow: 0 0 0 3px rgba(255,59,48,0.18)"`——
+  后者是字面量 rgba(),违反本仓配色硬约束,内联颜色本身也违规(公共约束 §6)。
+  改为:`.label` 加 `data-state="failed"`,颜色规则搬进
+  skills-styles.scss `.sk-test-result .label` 的 `&[data-state="failed"]` 分支
+  (与既有 running 分支同级,发光圈用 color-mix 派生,手法同该文件 :506-509 的
+  success 态),模板里零内联颜色。
+
+  【机械改动,非逻辑偏离】Vue2 :34 Run 按钮图标 `color="white"` 是具名色字面量,
+  硬约束禁止(即便 color-guard 只扫 `<style>` 块抓不到 prop 里的字面量,规则本身
+  覆盖"一切可见颜色")。按钮容器已在 skills-styles.scss:478 用
+  `color: var(--text-on-accent)` 承载这个前景色(disabled 态另有 :482 的
+  --text-quaternary),这里改成 `color="currentColor"` 继承,视觉结果与 Vue2
+  完全一致(实底 accent 按钮上的浅色字),手法同 SkillTile.vue:57 的既有先例。
+
+  【不移植】`SkillIcon.vue`(公共约束 §3.9,统一用 `../../icons/AgentIcon.vue`)·
+  `runFn` prop 与 Vue2 `{ close }` 返回值协议(改用 T3 `runSkillTest` 的
+  `(id, prompt, signal, onEvent, onError) => Promise<void>` 形状,由本组件自己
+  持有 AbortController,不再需要上层传入可关闭的 stream 对象)· `output.tokens`
+  死分支(Vue2 :70-73,`output.tokens` 全组件从未被赋值,T2 sandboxRun.ts 头注已
+  说明,SandboxState 类型上也没有该字段)。
+
+  零 <style> 块:用到的每个 class(sk-section*、sk-test*、sk-item-off、
+  sk-test-result 及其嵌套 label/bullet/step-row/ex/footer-note/code)均已存在于
+  sk-shared.scss 或 skills-styles.scss(Task 1),已逐个 grep 确认。
+-->
+<script setup lang="ts">
+import { computed, onBeforeUnmount, ref, watch } from 'vue'
+import { useI18n } from 'vue-i18n'
+import type { Skill } from '../../../types/skill'
+import { initSandboxState, reduceSandboxEvent } from '../../../util/sandboxRun'
+import { runSkillTest } from '../../../services/skillTestTransport'
+import AgentIcon from '../../icons/AgentIcon.vue'
+
+// Vue2 TestPanel.vue:110-113 `skill: { type: Object, required: true }`。
+// `runFn`(:113)不移植,见文件头注释——本组件自己调用 T3 的 runSkillTest。
+const props = defineProps<{ skill: Skill }>()
+
+// 对齐 Vue2 SkillsSection.vue:204-214 消费方的期望事件名,但触发条件按偏离 D5
+// 收紧为「只在成功完成时」,见文件头注释。
+const emit = defineEmits<{ test: [] }>()
+
+const { t } = useI18n()
+
+// 对齐 Vue2 data() :115-121。output.tokens 死分支不移植(SandboxState 无该字段)。
+const prompt = ref('')
+const state = ref<'idle' | 'running' | 'done'>('idle')
+const sandbox = ref(initSandboxState())
+// 对齐 Vue2 run() 里的局部变量 startedAt(:157)——普通变量,不是 ref,不需要触发渲染。
+let startedAt = 0
+let ctrl: AbortController | null = null
+
+// 对齐 Vue2 computed.canRun(:124-126)。
+const canRun = computed(() => prompt.value.trim().length > 0 && state.value !== 'running')
+
+// 对齐 Vue2 computed.placeholder(:127-131)。
+const placeholder = computed(() => {
+  const ex = props.skill.examples && props.skill.examples[0]
+  if (ex) return t('aiSkTestPlaceholderEx', { ex })
+  return t('aiSkTestPlaceholder')
+})
+
+// 对齐 Vue2 onKeydown(:146-151)。
+function onKeydown(e: KeyboardEvent) {
+  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
+    e.preventDefault()
+    run()
+  }
+}
+
+function onEvent(ev: Record<string, unknown>) {
+  sandbox.value = reduceSandboxEvent(sandbox.value, ev, Date.now() - startedAt)
+}
+
+// 对齐 Vue2 onEvent 里 ev.type === 'error' 走后端文本的分支之外的、传输层失败路径
+// （T3 runSkillTest 的 onError 回调:非 2xx HTTP 或非 AbortError 的异常）。
+// 有 status → HTTP 层失败本地化串;拿不到 status（非 HTTP 形状）→ 通用兜底串。
+// 两种都不回显后端 body（见文件头注释「HTTP 层失败不回显后端 body」）。
+function onError(e: unknown) {
+  const err = e as { status?: number } | null | undefined
+  const msg = err && typeof err.status === 'number'
+    ? t('aiSkTestHttpFailed', { status: err.status })
+    : t('aiSkTestFailed')
+  sandbox.value = { ...sandbox.value, error: msg }
+}
+
+// 对齐 Vue2 run()(:152-179),但改用 T3 的 Promise 形状而非 Vue2 的
+// `{ onEvent, onClose } => { close }` 回调协议。await 返回后若仍处于 running
+// （即从未收到 SSE 'done' 事件、连接就已关闭)→ 兜底置 done,对齐 Vue2 onClose
+// (:174-177) 的 fallback 语义。仅在成功完成(done 且无 error)时才 emit('test')
+// （偏离 D5,见文件头注释)。
+async function run() {
+  if (!canRun.value) return
+  state.value = 'running'
+  sandbox.value = initSandboxState()
+  startedAt = Date.now()
+  ctrl = new AbortController()
+  await runSkillTest(props.skill.id, prompt.value.trim(), ctrl.signal, onEvent, onError)
+  if (state.value === 'running') state.value = 'done'
+  if (state.value === 'done' && !sandbox.value.error) emit('test')
+}
+
+// 对齐 Vue2 watch: 'skill.id'(:133-141)——原样保留复位逻辑做 1:1 视觉/交互对照。
+// 注意:T7 挂载本组件时会带 `:key="skill.id"`,那种情况下整个组件会被销毁重建,
+// 这个 watcher 实际上不会触发(key 变化直接走 unmount→mount,不会保留组件实例)。
+// 所以真正兜底的清理必须落在下面的 onBeforeUnmount,不能只靠这个 watcher。
+watch(() => props.skill.id, () => {
+  prompt.value = ''
+  state.value = 'idle'
+  sandbox.value = initSandboxState()
+  ctrl?.abort()
+  ctrl = null
+})
+
+// 对齐 Vue2 beforeDestroy(:142-144),即 Vue3 的 onBeforeUnmount。见上面注释:
+// 这是唯一保证一定会执行的清理点(watcher 在 :key 重建场景下不会触发)。
+onBeforeUnmount(() => {
+  ctrl?.abort()
+})
+</script>
+
+<template>
+  <div class="sk-section">
+    <div class="sk-section-head">
+      <div class="sk-section-title">{{ t('aiSkTestTitle') }}</div>
+      <div class="sk-section-hint">{{ t('aiSkTestHint') }}</div>
+    </div>
+    <div class="sk-test">
+      <div class="sk-test-head">
+        <span class="sk-test-pill">{{ t('aiSkTestPill') }}</span>
+        <div style="flex: 1; min-width: 0">
+          <div class="sk-test-title">{{ t('aiSkTestTryName', { name: skill.name }) }}</div>
+          <div class="sk-test-sub">{{ t('aiSkTestDiscard') }}</div>
+        </div>
+        <span
+          v-if="!skill.enabled"
+          class="sk-item-off"
+          :title="t('aiSkTestOffTitle')"
+        >{{ t('aiSkTestOffBadge') }}</span>
+      </div>
+
+      <div class="sk-test-body">
+        <div class="sk-test-input">
+          <textarea
+            v-model="prompt"
+            :placeholder="placeholder"
+            rows="2"
+            @keydown="onKeydown"
+          />
+          <button :disabled="!canRun" @click="run">
+            <AgentIcon name="play" :size="11" color="currentColor" />
+            {{ state === 'running' ? t('aiSkTestRunning') : t('aiSkTestRun') }}
+          </button>
+        </div>
+
+        <div
+          v-if="skill.examples && skill.examples.length && state === 'idle' && sandbox.steps.length === 0 && !sandbox.error"
+          class="sk-test-result"
+          style="background: transparent; border: 0; padding: 8px 2px 0"
+        >
+          <div class="label" style="margin: 0">
+            <AgentIcon name="sparkle" :size="11" />
+            {{ t('aiSkTestExamples') }}
+          </div>
+          <div class="ex">
+            <button
+              v-for="(ex, i) in skill.examples"
+              :key="i"
+              @click="prompt = ex"
+            >{{ ex }}</button>
+          </div>
+        </div>
+
+        <div v-if="state === 'running'" class="sk-test-result">
+          <div class="label" data-state="running">
+            <span class="bullet" />
+            {{ t('aiSkTestRunningLabel') }}
+          </div>
+          <div>{{ t('aiSkTestBootstrapping', { name: skill.name }) }}</div>
+        </div>
+
+        <div v-if="state === 'done' && !sandbox.error" class="sk-test-result">
+          <div class="label">
+            <span class="bullet" />
+            {{ t('aiSkTestCompleted', { ms: sandbox.ms }) }}
+          </div>
+          <div
+            v-for="(s, i) in sandbox.steps"
+            :key="i"
+            class="step-row"
+          >
+            <AgentIcon name="check" :size="12" color="var(--success)" />
+            <div>{{ s.text }}</div>
+          </div>
+          <div class="footer-note">
+            <AgentIcon name="check" :size="11" />
+            {{ t('aiSkTestClosed') }}
+          </div>
+        </div>
+
+        <div v-if="state === 'done' && sandbox.error" class="sk-test-result">
+          <div class="label" data-state="failed">
+            <span class="bullet" />
+            {{ t('aiSkTestFailed') }}
+          </div>
+          <div>{{ sandbox.error }}</div>
+        </div>
+      </div>
+    </div>
+  </div>
+</template>
diff --git a/src/ai/services/skillTestTransport.test.ts b/src/ai/services/skillTestTransport.test.ts
new file mode 100644
index 0000000..70a6010
--- /dev/null
+++ b/src/ai/services/skillTestTransport.test.ts
@@ -0,0 +1,95 @@
+// Mock skeleton copied from ./agentTransport.test.ts:1-19 (SP8-P1b, reviewed) — mocks
+// sseRequest itself (not fetch), matching the "照它的形状写" instruction in
+// p3b-task-3-brief.md. sseRequest's own fetch/401/[DONE]/framing behavior is exercised by
+// .sp8/NimoOS-Service/src/sse.test.ts and is out of scope here.
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+
+const sseRequestMock = vi.fn()
+vi.mock('@nimotech/nimoos-service', () => ({
+  sseRequest: (...args: unknown[]) => sseRequestMock(...args),
+}))
+
+import { runSkillTest } from './skillTestTransport'
+
+describe('runSkillTest', () => {
+  beforeEach(() => {
+    sseRequestMock.mockReset()
+  })
+
+  it('POSTs to the skill-test endpoint with encodeURIComponent(id), { prompt, network: false } body, and no Language header', async () => {
+    sseRequestMock.mockResolvedValue({ ok: true, status: 200 })
+    const onEvent = vi.fn()
+    const onError = vi.fn()
+    const signal = new AbortController().signal
+
+    await runSkillTest('my skill/id', 'hello there', signal, onEvent, onError)
+
+    expect(sseRequestMock).toHaveBeenCalledTimes(1)
+    const [path, opts] = sseRequestMock.mock.calls[0]
+    expect(path).toBe(`/v1/ai/skills/${encodeURIComponent('my skill/id')}/test`)
+    expect(opts.method).toBe('POST')
+    expect(opts.body).toEqual({ prompt: 'hello there', network: false })
+    expect(opts.signal).toBe(signal)
+    // 钉住"不无端偏离":Vue2 streamSkillTest (ai.js:204-258) 从未发过 Language 头,
+    // 本文件也不加(与 runAgentRun 不同,runAgentRun 加是因为它的 Vue2 蓝本加了)。
+    expect(opts.headers ?? {}).not.toHaveProperty('Language')
+    expect(onError).not.toHaveBeenCalled()
+  })
+
+  it('forwards every SSE event to onEvent verbatim, in order, with zero reduction', async () => {
+    let capturedOnEvent: ((evt: unknown) => void) | undefined
+    sseRequestMock.mockImplementation(async (_path: string, opts: any) => {
+      capturedOnEvent = opts.onEvent
+      return { ok: true, status: 200 }
+    })
+    const onEvent = vi.fn()
+    await runSkillTest('sk-1', 'p', new AbortController().signal, onEvent, vi.fn())
+
+    const e1 = { type: 'message_delta', content: 'a' }
+    const e2 = { type: 'message_delta', content: 'b' }
+    const e3 = { type: 'tool_call', name: 'run_shell' }
+    capturedOnEvent!(e1)
+    capturedOnEvent!(e2)
+    capturedOnEvent!(e3)
+
+    expect(onEvent).toHaveBeenCalledTimes(3)
+    expect(onEvent.mock.calls.map(c => c[0])).toEqual([e1, e2, e3])
+  })
+
+  it('on !ok calls onError with {status, body: errorBody} and never calls onEvent', async () => {
+    sseRequestMock.mockResolvedValue({ ok: false, status: 422, errorBody: { detail: 'missing provider header' } })
+    const onEvent = vi.fn()
+    const onError = vi.fn()
+    await runSkillTest('sk-1', 'p', new AbortController().signal, onEvent, onError)
+
+    expect(onError).toHaveBeenCalledWith({ status: 422, body: { detail: 'missing provider header' } })
+    expect(onEvent).not.toHaveBeenCalled()
+  })
+
+  it('swallows AbortError from sseRequest silently — onError never called, promise resolves (does not throw)', async () => {
+    const abortErr = new Error('aborted')
+    abortErr.name = 'AbortError'
+    sseRequestMock.mockRejectedValue(abortErr)
+    const onEvent = vi.fn()
+    const onError = vi.fn()
+
+    await expect(
+      runSkillTest('sk-1', 'p', new AbortController().signal, onEvent, onError),
+    ).resolves.toBeUndefined()
+    expect(onError).not.toHaveBeenCalled()
+    expect(onEvent).not.toHaveBeenCalled()
+  })
+
+  it('reports a non-abort rejection to onError and does not throw', async () => {
+    const err = new Error('network down')
+    sseRequestMock.mockRejectedValue(err)
+    const onEvent = vi.fn()
+    const onError = vi.fn()
+
+    await expect(
+      runSkillTest('sk-1', 'p', new AbortController().signal, onEvent, onError),
+    ).resolves.toBeUndefined()
+    expect(onError).toHaveBeenCalledWith(err)
+    expect(onEvent).not.toHaveBeenCalled()
+  })
+})
diff --git a/src/ai/services/skillTestTransport.ts b/src/ai/services/skillTestTransport.ts
new file mode 100644
index 0000000..ae747b3
--- /dev/null
+++ b/src/ai/services/skillTestTransport.ts
@@ -0,0 +1,52 @@
+// Thin SSE transport for the sandbox skill-test runner ("在对话中试用"以外的独立测试面板).
+// Shape copied from ./agentTransport.ts:21-39 (SP8-P1b, reviewed) — sseRequest already owns
+// Authorization injection, 401→refresh→reconnect-once, [DONE], 204, and AbortError semantics
+// (@nimotech/nimoos-service, see .sp8/NimoOS-Service/src/sse.ts). This file re-implements
+// none of that: it only builds the endpoint/body, calls sseRequest, and forwards each parsed
+// event verbatim to onEvent. Event semantics (accumulating text deltas, step reduction, i18n
+// error text) belong to the consumer (Task 4 TestPanel.vue via sandboxRun.ts), not here.
+//
+// Endpoint/body/headers ported from Vue2 src/service/ai.js:204-258 (streamSkillTest):
+//   POST /v1/ai/skills/${encodeURIComponent(id)}/test, body { prompt, network: false }.
+// Deliberately NOT sending a `Language` header: runAgentRun (agentTransport.ts:34) sends one
+// only because its Vue2 counterpart agentStream.js does; streamSkillTest (ai.js:204-258) never
+// sent one, so adding it here would be an unrequested deviation from the Vue2 blueprint.
+//
+// KNOWN BACKEND GAP — this endpoint returns 422 on a real device today. Not a bug in this
+// file; it's a pre-existing backend ticket the user chose to defer past this sprint
+// (2026-07-30: ship the frontend now, fix the backend later). Three-part root cause,
+// verified against source on 2026-07-30:
+//   1. NimoOS-AI/agent/main.py:2477-2484 — the Python `/agent/sandbox-run` endpoint declares
+//      `x_agent_provider_key`/`x_agent_provider_url` as required FastAPI Header(...) params
+//      (no default), so a request missing either header is rejected by FastAPI's own
+//      validation with 422 before any handler code runs.
+//   2. NimoOS-AI/route/v2/skills_files.go:154-160 — the Go `TestStream` handler only
+//      forwards X-Agent-Provider-{Key,Url,Type} to the Python service *if the browser already
+//      sent them*; it never resolves/injects a provider itself. Contrast route/v2/agent.go:
+//      124-146, which the normal chat run path uses to resolve the active provider (OpenVINO
+//      / Ollama / configured cloud key) and `c.Request().Header.Set(...)` it in before
+//      proxying — TestStream has no equivalent step.
+//   3. The Vue2 frontend (src/service/ai.js:204-258, streamSkillTest) never sent these headers
+//      either, so this has never worked end-to-end in either UI generation.
+// Net effect: with no browser-sent provider headers and no server-side injection, the Python
+// endpoint's required-header validation always fails → 422. Do not "fix" this by fabricating
+// provider headers client-side or by patching the backend as a side effect of this task —
+// out of scope per p3b-common-constraints.md §4 and the user's 2026-07-30 decision.
+import { sseRequest } from '@nimotech/nimoos-service'
+
+export async function runSkillTest(
+  skillId: string,
+  prompt: string,
+  signal: AbortSignal,
+  onEvent: (ev: Record<string, unknown>) => void,
+  onError: (e: unknown) => void,
+): Promise<void> {
+  const outcome = await sseRequest(`/v1/ai/skills/${encodeURIComponent(skillId)}/test`, {
+    method: 'POST',
+    body: { prompt, network: false },
+    signal,
+    onEvent: evt => onEvent(evt as Record<string, unknown>),
+  }).catch(e => { if ((e as Error)?.name !== 'AbortError') onError(e); return null })
+  if (!outcome) return // aborted, or a non-abort rejection already reported via onError
+  if (!outcome.ok) onError({ status: outcome.status, body: outcome.errorBody })
+}
diff --git a/src/ai/styles/settingsStyles.test.ts b/src/ai/styles/settingsStyles.test.ts
index 7e76577..7808900 100644
--- a/src/ai/styles/settingsStyles.test.ts
+++ b/src/ai/styles/settingsStyles.test.ts
@@ -195,20 +195,31 @@ describe('sk-shared.scss', () => {
       '.sk-modal-body', '.sk-modal-foot', '.sk-field', '.sk-field-label', '.sk-field-hint',
     ]) {
       expect(css).toContain(sel)
     }
   })
 
   it('SP8-P2b Task 1 —— 保留两个入场动画关键帧', () => {
     expect(css).toContain('@keyframes sk-fade-in')
     expect(css).toContain('@keyframes sk-pop')
   })
+
+  // SP8-P3b Task 5 —— AddSkillModal 提交前本地校验命中时用的行内错误条,先例
+  // .chan-field-err(settings-styles.scss:234)。
+  it('SP8-P3b Task 5 —— 导出行内错误类 .sk-field-err,走 --danger token 无裸色', () => {
+    const at = css.indexOf('.sk-field-err {')
+    expect(at, '找不到 .sk-field-err 规则').toBeGreaterThanOrEqual(0)
+    const rule = css.slice(at, css.indexOf('}', at))
+    expect(rule).toContain('color: var(--danger)')
+    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
+    expect(rule).not.toMatch(/rgba?\(/)
+  })
 })
 
 // SP8-P3a 整期终审 I1 守卫 —— `.empty-title`/`.empty-sub` 与 `agent-styles.scss`
 // 的 `.agent-app .empty-title`/`.agent-app .empty-sub` 同优先级碰撞(详见
 // skills-styles.scss:424-450 的三件套注释)。New-UI 独有回归,不是 Vue2 走样:
 // Vue2 蓝本 `Settings/Settings.vue:2` 根节点只有 `class="set-app"`,不含
 // `agent-app`,这两条规则在 Vue2 里永不相遇;New-UI `SettingsPage.vue:371`
 // 根节点是 `agent-app set-app`,两条规则同时命中同一个空态元素,同优先级下
 // 全靠 `router/index.ts` 的 import 顺序侥幸决胜,且 agent-styles 没声明的属性
 // (letter-spacing/margin/color)会直接泄漏进来。
diff --git a/src/ai/styles/sk-shared.scss b/src/ai/styles/sk-shared.scss
index da310ee..afd97f8 100644
--- a/src/ai/styles/sk-shared.scss
+++ b/src/ai/styles/sk-shared.scss
@@ -155,20 +155,25 @@
 .sk-field-label {
   font-size: 12px; font-weight: 600;
   color: var(--text-secondary);
   letter-spacing: -0.005em;
   .sk-field-optional {
     color: var(--text-tertiary);
     font-weight: 400;
   }
 }
 .sk-field-hint { font-size: 11px; color: var(--text-tertiary); }
+// SP8-P3b Task 5 —— 行内校验错误条(AddSkillModal 提交前本地校验命中时用,落在
+// .sk-modal-body 顶部)。先例是 ChannelsSection 添加机器人失败的 .chan-field-err
+// (settings-styles.scss:234),值逐字同款;这里新建同名同款的 .sk-field-err,不借用
+// 带 chan 前缀的那份(那是聊天渠道分区自己的类,借用属于跨分区复用)。
+.sk-field-err { margin: 0 0 6px; font-size: 12px; color: var(--danger); line-height: 1.5; }
 .sk-field input[type="text"],
 .sk-field textarea {
   width: 100%;
   border: 1px solid var(--line);
   border-radius: var(--r-md);
   padding: 9px 12px;
   font-size: 13.5px;
   background: var(--bg-canvas);
   color: var(--text-primary);
   outline: none;
diff --git a/src/ai/styles/skills-styles.scss b/src/ai/styles/skills-styles.scss
index cea865a..a7f330c 100644
--- a/src/ai/styles/skills-styles.scss
+++ b/src/ai/styles/skills-styles.scss
@@ -170,21 +170,39 @@
 .sk-item-off {
   font-size: 10px; font-weight: 600;
   text-transform: uppercase;
   letter-spacing: 0.04em;
   padding: 1px 6px;
   border-radius: 999px;
   background: var(--bg-chip);
   color: var(--text-tertiary);
 }
 
-// `.set-app .sk-add-btn`(Vue2:153-163)不移植 —— 留给 P3b。
+// Vue2 skills-styles.scss:153-163 —— 就地实现(scoped 到 `.set-app` 下的理由与
+// Vue2 相同:压过 `.set-app button { background: transparent }` 重置,见本仓
+// settings-styles.scss:344,specificity (0,1,1) < 这里的 (0,2,0))。
+.set-app .sk-add-btn {
+  display: inline-flex; align-items: center; justify-content: center;
+  width: 30px; height: 30px;
+  border-radius: 8px;
+  background: var(--accent);
+  // 【协调者预先解歧义①】Vue2 skills-styles.scss:158 原文本身就带纯白色前景声明
+  // (不是缺失,是本仓禁色字面量,需脱色成 token)——实底 accent 按钮上的白字,
+  // 复用既有 `--text-on-accent`(两套主题皆有值,tokens.scss:59,267),
+  // 与本档 .sk-pill-try:hover(:246)同一处理。Task 8 会往这个按钮里塞 AgentIcon 且
+  // 不传具名 color(走 currentColor 继承),这条 color 声明就是它的前景色来源。
+  color: var(--text-on-accent);
+  cursor: pointer;
+  transition: all 120ms ease;
+  box-shadow: var(--shadow-sm);
+  &:hover { background: var(--accent-hover); transform: translateY(-1px); }
+}
 
 // Vue2 skills-styles.scss:164-177
 .sk-col-empty {
   padding: 40px 16px;
   text-align: center;
   color: var(--text-tertiary);
   font-size: 13px;
   code {
     background: var(--bg-chip);
     padding: 1px 5px;
@@ -239,22 +257,67 @@
   color: var(--accent);
   border: 1px solid var(--accent-soft);
   transition: all 120ms ease;
   white-space: nowrap;
   flex-shrink: 0;
   cursor: pointer;
   // Vue2 skills-styles.scss:223 原为纯白色(hover 时反白,实底 --accent 背景上的字色)。
   &:hover { background: var(--accent); color: var(--text-on-accent); }
 }
 
-// `.sk-pill-more`(225-234)/`.sw`(235-259)/`.sk-menu`(260-288)不移植 —— 留给 P3b
-// (`.sw` 已存在于 sk-shared.scss,但本任务范围不接线,照 brief 表办)。
+// Vue2 skills-styles.scss:225-234 —— 无色字面量,原样搬。
+.sk-pill-more {
+  width: 32px; height: 32px;
+  border-radius: 50%;
+  display: grid; place-items: center;
+  color: var(--text-secondary);
+  cursor: pointer;
+  &:hover { background: var(--bg-chip); color: var(--text-primary); }
+}
+
+// `.sw`(Vue2:235-259)开工第一步 grep 复核:确认已存在于 sk-shared.scss:66-88
+// (SP8-P2a Task 6 已移植,含 --switch-thumb/--switch-thumb-shadow 两个 token 的
+// 颜色处理),不重复定义。
+
+// Vue2 skills-styles.scss:260-288
+.sk-menu {
+  position: absolute;
+  top: 38px; right: 0;
+  width: 220px;
+  background: var(--bg-elevated);
+  border: 1px solid var(--line);
+  border-radius: var(--r-md);
+  box-shadow: var(--shadow-lg);
+  padding: 4px;
+  z-index: 10;
+  transform-origin: top right;
+  button {
+    width: 100%;
+    text-align: left;
+    display: flex; align-items: center; gap: 9px;
+    padding: 8px 10px;
+    border-radius: var(--r-sm);
+    font-size: 13px; font-weight: 500;
+    color: var(--text-primary);
+    transition: background 100ms ease;
+    &:hover { background: var(--bg-chip); }
+    &[data-danger="true"] {
+      color: var(--danger);
+      // Vue2 skills-styles.scss:283 原为 iOS 红色约 8% 透明度背景字面量——
+      // 本档统一约定(头部说明 + .sk-item-tag data-kind="manual"/"slash" 先例,
+      // 本档 :146,151):用 color-mix 从当前语义色 --danger 派生等比例透明度,
+      // 不新造字面量。
+      &:hover { background: color-mix(in srgb, var(--danger) 8%, transparent); }
+    }
+  }
+  hr { border: 0; border-top: 1px solid var(--line-faint); margin: 4px 0; }
+}
 
 // Vue2 skills-styles.scss:289-301
 .sk-detail-body {
   flex: 1;
   overflow-y: auto;
   padding: 22px 22px 80px;
   min-height: 0;
 }
 .sk-detail-inner {
   max-width: 820px;
@@ -351,21 +414,166 @@
     }
   }
   .name { flex: 1; font-weight: 500; }
   .size {
     font-variant-numeric: tabular-nums;
     font-size: 11px;
     color: var(--text-tertiary);
   }
 }
 
-// `.sk-test*` + `@keyframes skill-pulse`(392-513)不移植 —— 留给 P3b。
+// Test panel
+// Vue2 skills-styles.scss:392-398
+.sk-test {
+  border-radius: var(--r-lg);
+  background: var(--bg-elevated);
+  border: 1px solid var(--line);
+  overflow: hidden;
+  box-shadow: var(--shadow-sm);
+}
+// Vue2 skills-styles.scss:399-404
+.sk-test-head {
+  display: flex; align-items: center; gap: 10px;
+  padding: 12px 14px;
+  border-bottom: 1px solid var(--line-faint);
+  background: var(--bg-canvas);
+}
+// Vue2 skills-styles.scss:405-413
+.sk-test-pill {
+  font-size: 10px; font-weight: 700;
+  letter-spacing: 0.06em;
+  text-transform: uppercase;
+  padding: 2px 7px;
+  border-radius: 999px;
+  background: var(--accent-soft);
+  color: var(--accent);
+}
+// Vue2 skills-styles.scss:414-415
+.sk-test-title { font-size: 13px; font-weight: 600; }
+.sk-test-sub { font-size: 11px; color: var(--text-tertiary); }
+
+// Vue2 skills-styles.scss:417-444
+.sk-test-body { padding: 14px; }
+.sk-test-input {
+  display: flex; gap: 8px;
+  padding: 10px 12px;
+  border-radius: var(--r-md);
+  background: var(--bg-canvas);
+  border: 1px solid var(--line);
+  textarea {
+    flex: 1;
+    border: 0; outline: none; background: transparent; resize: none;
+    font-family: var(--font-sans);
+    font-size: 13px; line-height: 1.5;
+    color: var(--text-primary);
+    min-height: 36px;
+  }
+  button {
+    align-self: flex-end;
+    padding: 6px 12px;
+    font-size: 12px; font-weight: 500;
+    border-radius: var(--r-sm);
+    background: var(--accent);
+    // Vue2 skills-styles.scss:438 原为纯白色前景(实底 accent 按钮上的白字,
+    // 与 .sk-add-btn/.sk-pill-try:hover 同一场景)。复用既有 --text-on-accent。
+    color: var(--text-on-accent);
+    display: inline-flex; align-items: center; gap: 5px;
+    flex-shrink: 0;
+    cursor: pointer;
+    &[disabled] { background: var(--bg-chip); color: var(--text-quaternary); cursor: not-allowed; }
+  }
+}
+// Vue2 skills-styles.scss:445-479
+.sk-test-result {
+  margin-top: 12px;
+  background: var(--bg-sunken);
+  border: 1px solid var(--line-faint);
+  border-radius: var(--r-md);
+  padding: 12px 14px;
+  font-size: 13px;
+  line-height: 1.55;
+  color: var(--text-secondary);
+  .label {
+    display: flex; align-items: center; gap: 8px;
+    font-size: 11px;
+    text-transform: uppercase;
+    letter-spacing: 0.04em;
+    color: var(--text-tertiary);
+    font-weight: 600;
+    margin-bottom: 8px;
+    .bullet {
+      width: 6px; height: 6px; border-radius: 50%;
+      background: var(--success);
+      // Vue2 skills-styles.scss:465 原为 iOS 绿色约 18% 透明度发光圈字面量——
+      // 与 .sk-meta-cell 的「启用」态发光圈(本档 :302-306)完全同族同比例,
+      // 同样用 color-mix 从 --success 派生。
+      box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 18%, transparent);
+    }
+    &[data-state="running"] .bullet {
+      background: var(--accent);
+      animation: skill-pulse 1.4s ease-in-out infinite;
+    }
+    // SP8-P3b Task 4 —— 失败态。Vue2 TestPanel.vue:92-98 靠模板内联样式实现:
+    // `.label` 上 `style="color: var(--danger)"`,`.bullet` 上
+    // `style="background: var(--danger); box-shadow: 0 0 0 3px rgba(255,59,48,0.18)"`。
+    // 后者是字面量 rgba() 且内联颜色本身违反本仓配色硬约束(公共约束 §6),改成
+    // 静态 CSS 分支:发光圈用 color-mix 从 --danger 派生,手法与上方 :506-509 的
+    // success 态发光圈同族同比例(18% 不透明度)。
+    &[data-state="failed"] {
+      color: var(--danger);
+      .bullet {
+        background: var(--danger);
+        box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 18%, transparent);
+      }
+    }
+  }
+  code {
+    font-family: var(--font-mono);
+    font-size: 12px;
+    background: var(--bg-elevated);
+    border: 1px solid var(--line-faint);
+    padding: 1px 5px;
+    border-radius: 4px;
+  }
+  .step-row {
+    display: flex; gap: 8px; align-items: flex-start;
+    margin: 4px 0;
+  }
+  .ex {
+    margin-top: 8px;
+    display: flex; flex-wrap: wrap; gap: 6px;
+    button {
+      font-size: 11.5px;
+      padding: 4px 9px;
+      border-radius: 999px;
+      background: var(--bg-elevated);
+      border: 1px solid var(--line);
+      color: var(--text-secondary);
+      transition: all 120ms ease;
+      cursor: pointer;
+      &:hover { border-color: var(--accent); color: var(--accent); }
+    }
+  }
+  .footer-note {
+    margin-top: 10px;
+    padding-top: 10px;
+    border-top: 1px solid var(--line-faint);
+    font-size: 11px;
+    color: var(--text-tertiary);
+    display: inline-flex; align-items: center; gap: 6px;
+  }
+}
+// Vue2 skills-styles.scss:508-511
+@keyframes skill-pulse {
+  0%,100% { opacity: 1; transform: scale(1); }
+  50%     { opacity: 0.6; transform: scale(0.85); }
+}
 
 // SKILL.md preview
 // Vue2 skills-styles.scss:514-547
 .sk-md {
   padding: 16px 18px;
   font-size: 13.5px;
   line-height: 1.65;
   color: var(--text-primary);
   pre {
     background: var(--bg-sunken);
@@ -445,26 +653,105 @@
     font-size: 15px; font-weight: 600; color: var(--text-primary);
     letter-spacing: normal; margin: 0;
   }
   .empty-sub {
     font-size: 13px; max-width: 320px;
     color: inherit; margin: 0;
   }
 }
 
 // `.sk-modal*`(575-616)已存在于 sk-shared.scss:96-136,`.sk-field*`(617-647)已存在
-// 于 sk-shared.scss:154-183,`.sk-trig-*`/`.sk-color-*`(648-685)不移植(留给 P3b),
-// `.sk-modal-foot`(686-697)已存在于 sk-shared.scss:139-150,`.sk-btn`(698-726)已
-// 存在于 sk-shared.scss:29-55,均不重复定义。
+// 于 sk-shared.scss:154-183,`.sk-modal-foot`(686-697)已存在于 sk-shared.scss:139-150,
+// `.sk-btn`(698-726)已存在于 sk-shared.scss:29-55,均不重复定义。
+
+// Vue2 skills-styles.scss:648-669 —— 无色字面量,原样搬。
+.sk-trig-options {
+  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
+}
+.sk-trig-option {
+  display: flex; flex-direction: column; gap: 4px;
+  padding: 10px 12px;
+  border-radius: var(--r-md);
+  background: var(--bg-canvas);
+  border: 1px solid var(--line);
+  cursor: pointer;
+  transition: all 120ms ease;
+  text-align: left;
+  &:hover { border-color: var(--line-strong); }
+  &[data-active="true"] {
+    border-color: var(--accent);
+    background: var(--accent-softer);
+    box-shadow: 0 0 0 3px var(--accent-softer);
+  }
+  .name { font-size: 13px; font-weight: 600; }
+  .desc { font-size: 11px; color: var(--text-tertiary); line-height: 1.35; }
+}
+
+// Vue2 skills-styles.scss:670-685
+.sk-color-row { display: flex; gap: 8px; align-items: center; }
+.sk-color-dot {
+  width: 28px; height: 28px;
+  border-radius: 9px;
+  cursor: pointer;
+  position: relative;
+  transition: transform 100ms ease;
+  // Vue2 skills-styles.scss:677 原为白色约 20% 透明度内描边发光字面量——
+  // 与 .sk-tile(本档 :123)的 --gloss-inset 同族(彩色色块 + 白色内描边发光),
+  // 但 Vue2 两处字面量透明度不同(约 20% 对约 18%)。按本仓
+  // 既有惯例(同族不同值 → 各开独立 token 以精确保留原值,先例 tokens.scss:175-180
+  // 的 --modal-scrim-soft 相对 --modal-scrim)新增 --gloss-inset-dot,不与
+  // --gloss-inset 合并复用(会引入可见的透明度漂移)。见 tokens.scss 新增处。
+  box-shadow: var(--gloss-inset-dot), var(--shadow-xs);
+  &:hover { transform: translateY(-1px); }
+  &[data-active="true"]::after {
+    content: ""; position: absolute; inset: -3px;
+    border-radius: 11px;
+    border: 2px solid var(--accent);
+  }
+  // 【偏离(公共约束 §3 偏离 8,brief §1.2 第二条)】Vue2 AddSkillModal.vue:61 用
+  // `:style="{ background: c.bg }"` 内联传底色字面量(渐变字符串)—— 本仓禁止内联
+  // 颜色。改为 `data-color` 属性 + 下面 7 条静态规则,值取 P3a Task 1 已建的
+  // `--grad-sk-*` 7 个 token(tokens.scss:228-234,已 grep 逐个复核存在且拼写一致)。
+  // 7 个 id(blue/purple/pink/orange/green/teal/slate)取自 Vue2 SkillTile.vue:18-26
+  // COLORS 的 key,与本仓 SkillTile.vue 的 SKILL_COLOR_IDS 逐一比对一致。Task 5
+  // (AddSkillModal 组件)负责在 dot 元素上写 `:data-color="c.id"`。
+  &[data-color="blue"]   { background: var(--grad-sk-blue); }
+  &[data-color="purple"] { background: var(--grad-sk-purple); }
+  &[data-color="pink"]   { background: var(--grad-sk-pink); }
+  &[data-color="orange"] { background: var(--grad-sk-orange); }
+  &[data-color="green"]  { background: var(--grad-sk-green); }
+  &[data-color="teal"]   { background: var(--grad-sk-teal); }
+  &[data-color="slate"]  { background: var(--grad-sk-slate); }
+}
 
 // `.sk-toast` + `@keyframes sk-toast-rise`(727-753)永不移植 —— 改用全局 AppToast
-// (公共约束 §3 偏离 3)。`.sk-confirm*`(754-773)不移植 —— 留给 P3b。
+// (公共约束 §3 偏离 3)。
+
+// Vue2 skills-styles.scss:754-773 —— 无色字面量,原样搬。
+.sk-confirm { width: min(420px, 100%); }
+.sk-confirm-body {
+  padding: 22px 22px 8px;
+  text-align: left;
+  h3 { font-size: 16px; font-weight: 600; margin: 0 0 6px; letter-spacing: -0.01em; }
+  p { font-size: 13px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
+}
+.sk-confirm-skill {
+  margin-top: 12px;
+  padding: 10px 12px;
+  display: flex; align-items: center; gap: 10px;
+  background: var(--bg-canvas);
+  border: 1px solid var(--line-faint);
+  border-radius: var(--r-md);
+  .skill-line { flex: 1; min-width: 0; }
+  .name { font-size: 13px; font-weight: 600; }
+  .runs { font-size: 11px; color: var(--text-tertiary); }
+}
 
 // Spinner (for list loading)
 // Vue2 skills-styles.scss:774-781
 .sk-spinner {
   width: 18px; height: 18px;
   border-radius: 50%;
   border: 2px solid var(--line);
   border-top-color: var(--accent);
   animation: sk-spin 700ms linear infinite;
 }
diff --git a/src/ai/styles/tokens.scss b/src/ai/styles/tokens.scss
index 483f94f..57d5614 100644
--- a/src/ai/styles/tokens.scss
+++ b/src/ai/styles/tokens.scss
@@ -145,20 +145,28 @@
   --danger-soft-faint: rgba(215, 73, 59, 0.06);
   /* Lighter purple gradient stop (McpCallCard tile) — decorative, not redefined
      per-theme, same convention as --purple itself not being redefined in dark. */
   --purple-light: #C18CFF;
   --teal-soft: rgba(48, 176, 199, 0.12);
   /* Fixed-darkness scrim for photo-thumbnail hover overlays — intentionally same
      value in both themes (a darkening overlay on an image, not a UI surface). */
   --scrim-dark: rgba(0, 0, 0, 0.35);
   /* Tiny inset gloss highlight on colored tiles (McpCallCard) — same in both themes. */
   --gloss-inset: inset 0 0 0 0.5px rgba(255, 255, 255, 0.18);
+  /* SP8-P3b Task 1 — same "colored chip + white inset gloss" family as
+     --gloss-inset above, used by .sk-color-dot (skills-styles.scss) in the
+     AddSkillModal color picker. Vue2 source (skills-styles.scss:677) uses a
+     distinct opacity (0.2) from --gloss-inset's 0.18 — kept as its own token to
+     preserve Vue2's exact value rather than drift by reusing --gloss-inset
+     (same precedent as --modal-scrim-soft being separate from --modal-scrim
+     below). Theme-invariant chrome, same in both themes. */
+  --gloss-inset-dot: inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);
 
   /* SP8-P1b Task 9 — SearchImageLightbox is a fullscreen black "stage" (a photo
      viewer chrome, like Photos/Preview), intentionally theme-invariant — same
      rationale as --scrim-dark/--gloss-inset above, not a skin surface. */
   --overlay-scrim: rgba(0, 0, 0, 0.92);
   --overlay-fg-strong: rgba(255, 255, 255, 0.95);
   --overlay-fg-soft: rgba(255, 255, 255, 0.6);
   --overlay-chip-bg: rgba(255, 255, 255, 0.1);
   --overlay-chip-bg-hover: rgba(255, 255, 255, 0.2);
   --overlay-chip-border: rgba(255, 255, 255, 0.16);
@@ -301,20 +309,23 @@
   --danger-soft-border: rgba(240, 119, 107, 0.24);
   --purple-soft: rgba(175, 82, 222, 0.18);
   --purple-soft-border: rgba(175, 82, 222, 0.26);
   --purple-soft-faint: rgba(175, 82, 222, 0.11);
   --success-soft-faint: rgba(79, 184, 112, 0.11);
   --danger-soft-faint: rgba(240, 119, 107, 0.1);
   --purple-light: #C18CFF;
   --teal-soft: rgba(48, 176, 199, 0.2);
   --scrim-dark: rgba(0, 0, 0, 0.35);
   --gloss-inset: inset 0 0 0 0.5px rgba(255, 255, 255, 0.18);
+  /* SP8-P3b Task 1 — dark-theme value for --gloss-inset-dot above (same value as
+     light block — theme-invariant, see comment there). */
+  --gloss-inset-dot: inset 0 0 0 0.5px rgba(255, 255, 255, 0.2);
 
   /* SP8-P1b Task 9 — same values as light block (all theme-invariant chrome, see
      comments there); dark-theme copies exist only to satisfy "every token has a
      value in both blocks" for tokens that aren't var()-composed. */
   --overlay-scrim: rgba(0, 0, 0, 0.92);
   --overlay-fg-strong: rgba(255, 255, 255, 0.95);
   --overlay-fg-soft: rgba(255, 255, 255, 0.6);
   --overlay-chip-bg: rgba(255, 255, 255, 0.1);
   --overlay-chip-bg-hover: rgba(255, 255, 255, 0.2);
   --overlay-chip-border: rgba(255, 255, 255, 0.16);
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
diff --git a/src/ai/util/sandboxRun.test.ts b/src/ai/util/sandboxRun.test.ts
new file mode 100644
index 0000000..54437d8
--- /dev/null
+++ b/src/ai/util/sandboxRun.test.ts
@@ -0,0 +1,118 @@
+import { describe, it, expect } from 'vitest'
+import { initSandboxState, reduceSandboxEvent, type SandboxState } from './sandboxRun'
+
+describe('sandboxRun', () => {
+  it('initSandboxState starts empty/idle', () => {
+    expect(initSandboxState()).toEqual({ steps: [], ms: null, error: '', done: false })
+  })
+
+  it('two consecutive message_delta merge into one step, text appended in order', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'message_delta', content: 'Hel' }, 0)
+    s = reduceSandboxEvent(s, { type: 'message_delta', content: 'lo' }, 0)
+    expect(s.steps).toEqual([{ kind: 'text', text: 'Hello' }])
+  })
+
+  it('text and message also participate in the same accumulation', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'message_delta', content: 'A' }, 0)
+    s = reduceSandboxEvent(s, { type: 'message', content: 'B' }, 0)
+    s = reduceSandboxEvent(s, { type: 'text', content: 'C' }, 0)
+    expect(s.steps).toEqual([{ kind: 'text', text: 'ABC' }])
+  })
+
+  it('text -> tool_call -> text yields 3 steps, 3rd is a new text step', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'text', content: 'before' }, 0)
+    s = reduceSandboxEvent(s, { type: 'tool_call', tool: 'grep' }, 0)
+    s = reduceSandboxEvent(s, { type: 'text', content: 'after' }, 0)
+    expect(s.steps).toEqual([
+      { kind: 'text', text: 'before' },
+      { kind: 'tool', text: '→ grep' },
+      { kind: 'text', text: 'after' },
+    ])
+  })
+
+  it('tool_call without ev.tool falls back to ev.name', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'tool_call', name: 'search_files' }, 0)
+    expect(s.steps).toEqual([{ kind: 'tool', text: '→ search_files' }])
+  })
+
+  it('tool_call with neither tool nor name falls back to the literal "tool"', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'tool_call' }, 0)
+    expect(s.steps).toEqual([{ kind: 'tool', text: '→ tool' }])
+  })
+
+  it('error event writes error', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'error', content: 'sandbox exploded' }, 0)
+    expect(s.error).toBe('sandbox exploded')
+  })
+
+  it('error event with no content writes empty string, not "null"/"undefined"', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'error' }, 0)
+    expect(s.error).toBe('')
+  })
+
+  it('done event writes done and ms from the caller-supplied elapsedMs', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'text', content: 'x' }, 0)
+    s = reduceSandboxEvent(s, { type: 'done' }, 4242)
+    expect(s.done).toBe(true)
+    expect(s.ms).toBe(4242)
+  })
+
+  it('unknown event type leaves state unchanged (same reference)', () => {
+    const s = initSandboxState()
+    const next = reduceSandboxEvent(s, { type: 'thinking', content: 'hmm' }, 0)
+    expect(next).toBe(s)
+  })
+
+  it('message_delta with empty string content leaves state unchanged', () => {
+    const s = initSandboxState()
+    const next = reduceSandboxEvent(s, { type: 'message_delta', content: '' }, 0)
+    expect(next).toBe(s)
+  })
+
+  it('message_delta with non-string content leaves state unchanged', () => {
+    const s = initSandboxState()
+    const next = reduceSandboxEvent(s, { type: 'message_delta', content: 123 }, 0)
+    expect(next).toBe(s)
+  })
+
+  it('does not mutate the input state object in place', () => {
+    const s = initSandboxState()
+    const originalSteps = s.steps
+    reduceSandboxEvent(s, { type: 'text', content: 'hello' }, 0)
+    // Original object passed in must be untouched: same array reference, still empty.
+    expect(s.steps).toBe(originalSteps)
+    expect(s.steps.length).toBe(0)
+  })
+
+  it('does not mutate an input state that already has steps (array not shared)', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'text', content: 'first' }, 0)
+    const before = s.steps
+    const beforeLength = before.length
+    reduceSandboxEvent(s, { type: 'text', content: 'more' }, 0)
+    expect(s.steps).toBe(before)
+    expect(s.steps.length).toBe(beforeLength)
+  })
+
+  // RED-probe style regression: Vue2 TestPanel.vue:70-73 has an `output.tokens != null`
+  // template branch, but `output.tokens` is never assigned anywhere in that component —
+  // a dead branch. We deliberately do not carry a `tokens` field on SandboxState. This
+  // pins that decision: even if a `done` event arrives with a `tokens` payload, the
+  // resulting state must not gain a `tokens` property.
+  it('does not add a tokens field even if the done event carries one (dead Vue2 branch, not ported)', () => {
+    let s = initSandboxState()
+    s = reduceSandboxEvent(s, { type: 'done', tokens: 999 }, 10)
+    expect('tokens' in (s as unknown as Record<string, unknown>)).toBe(false)
+    // Type-level pin: SandboxState has no tokens field, so this would not compile if added.
+    const check: SandboxState = s
+    expect(check.done).toBe(true)
+  })
+})
diff --git a/src/ai/util/sandboxRun.ts b/src/ai/util/sandboxRun.ts
new file mode 100644
index 0000000..84f8afe
--- /dev/null
+++ b/src/ai/util/sandboxRun.ts
@@ -0,0 +1,73 @@
+// SP8-P3b Task 2 —— 对齐 Vue2 src/views/AI/Skills/TestPanel.vue:160-172 的 SSE 事件归约逻辑。
+//
+// Vue2 每收到一片 message/message_delta/text 就 push 一个新的字符串到 output.steps
+// （:162 `this.output.steps.push(ev.content)`），逐词流式发送时会在结果列表里炸出一大堆
+// 单字/单词的独立行，而不是一段连续文本。后端 message_delta 是逐词发的
+// （NimoOS-AI/agent/agent.py:1266,1284），Vue2 这里没适配。
+// 【拍板偏离 D2，见 p3b-common-constraints.md §3.1】本仓改成：连续的文本片如果上一步也是
+// text，就把新内容追加到同一步里；工具调用（tool_call）仍然单独起一行。
+//
+// 纯函数：不读时钟（elapsedMs 由调用方传入，便于测试），不就地修改传入的 state，
+// 每次返回一个新对象（包括 steps 数组本身，即使内容未变也返回新引用是可接受的——
+// 但为避免不必要的对象抖动，无变化路径直接原样返回入参 s）。
+//
+// 不实现 `tokens`：Vue2 模板 TestPanel.vue:70-73 有 `output.tokens != null` 分支，
+// 但 `output.tokens` 全组件从未被赋值（`data()` 里初始化为 null 后再无写入点）——
+// 是死分支。照 P3a 处理 trigger_human 的先例，此处不复刻这个字段，SandboxState 类型上
+// 没有 tokens，.test.ts 里有一条探针钉死这一点。
+
+export type SandboxStep = { kind: 'text' | 'tool'; text: string }
+
+export type SandboxState = {
+  steps: SandboxStep[]
+  ms: number | null
+  error: string
+  done: boolean
+}
+
+export function initSandboxState(): SandboxState {
+  return { steps: [], ms: null, error: '', done: false }
+}
+
+/**
+ * 对齐 Vue2 TestPanel.vue run() 里 onEvent 回调（:158-172）。
+ * 事件取舍见 p3b-task-2-brief.md §2.1 的表；忽略 thinking/tool_result/confirmation_required
+ * 等其余事件类型。返回新的 SandboxState，不修改入参 s 或 s.steps。
+ */
+export function reduceSandboxEvent(
+  s: SandboxState,
+  ev: Record<string, unknown>,
+  elapsedMs: number
+): SandboxState {
+  const type = ev.type
+
+  if (type === 'message_delta' || type === 'message' || type === 'text') {
+    const content = ev.content
+    if (typeof content !== 'string' || content === '') return s
+    const steps = s.steps.slice()
+    const last = steps[steps.length - 1]
+    if (last && last.kind === 'text') {
+      steps[steps.length - 1] = { kind: 'text', text: last.text + content }
+    } else {
+      steps.push({ kind: 'text', text: content })
+    }
+    return { ...s, steps }
+  }
+
+  if (type === 'tool_call') {
+    const name = (ev.tool as string | undefined) ?? (ev.name as string | undefined) ?? 'tool'
+    const steps = s.steps.slice()
+    steps.push({ kind: 'tool', text: '→ ' + name })
+    return { ...s, steps }
+  }
+
+  if (type === 'error') {
+    return { ...s, error: String(ev.content ?? '') }
+  }
+
+  if (type === 'done') {
+    return { ...s, done: true, ms: elapsedMs }
+  }
+
+  return s
+}
diff --git a/src/ai/util/skillsErrorKey.test.ts b/src/ai/util/skillsErrorKey.test.ts
new file mode 100644
index 0000000..2414e12
--- /dev/null
+++ b/src/ai/util/skillsErrorKey.test.ts
@@ -0,0 +1,172 @@
+import { describe, it, expect } from 'vitest'
+import { createSkillErrorKey, validateSkillForm } from './skillsErrorKey'
+
+/** Wrap a raw backend string the way axios would, so createSkillErrorKey can read it. */
+function errWith(message: string) {
+  return { response: { data: { message } } }
+}
+
+describe('createSkillErrorKey', () => {
+  // Real Go error strings, taken verbatim from NimoOS-AI/service/skills_store.go
+  // (fmt.Errorf("%w: <reason>", ErrBadSkillID / ErrBadDescription / ErrDuplicateSkill /
+  // ErrBadPath / ErrBundleTooLarge) and the SKILL.md size message).
+  it('maps "skill already exists"', () => {
+    expect(createSkillErrorKey(errWith('skill already exists'))).toBe('aiSkErrDuplicate')
+  })
+
+  it('maps "invalid skill id"', () => {
+    expect(createSkillErrorKey(errWith('invalid skill id'))).toBe('aiSkErrBadId')
+  })
+
+  it('maps "invalid skill description: description required"', () => {
+    expect(createSkillErrorKey(errWith('invalid skill description: description required'))).toBe(
+      'aiSkErrDescRequired'
+    )
+  })
+
+  it('maps "invalid skill description: longer than 256 characters"', () => {
+    expect(
+      createSkillErrorKey(errWith('invalid skill description: longer than 256 characters'))
+    ).toBe('aiSkErrDescTooLong')
+  })
+
+  it('maps "invalid skill description: must be a single line"', () => {
+    expect(
+      createSkillErrorKey(errWith('invalid skill description: must be a single line'))
+    ).toBe('aiSkErrDescSingleLine')
+  })
+
+  it('maps "invalid skill description: \'<\' and \'>\' are not allowed"', () => {
+    expect(
+      createSkillErrorKey(errWith("invalid skill description: '<' and '>' are not allowed"))
+    ).toBe('aiSkErrDescAngle')
+  })
+
+  it('maps "invalid skill description: control characters are not allowed"', () => {
+    expect(
+      createSkillErrorKey(errWith('invalid skill description: control characters are not allowed'))
+    ).toBe('aiSkErrDescControl')
+  })
+
+  it('maps "invalid file path in bundle"', () => {
+    expect(createSkillErrorKey(errWith('invalid file path in bundle'))).toBe('aiSkErrBadPath')
+  })
+
+  it('maps "bundle exceeds size limits"', () => {
+    expect(createSkillErrorKey(errWith('bundle exceeds size limits'))).toBe('aiSkErrBundleTooLarge')
+  })
+
+  // MaxSkillMDBytes = 50 * 1024 = 51200 (NimoOS-AI/service/skills_store.go:121); the
+  // error is fmt.Errorf("SKILL.md exceeds %d bytes (got %d)", MaxSkillMDBytes, size)
+  // at skills_store.go:155/229. Real limit, not a made-up number.
+  it('maps "SKILL.md exceeds 51200 bytes (got 60000)" (case-insensitive)', () => {
+    expect(createSkillErrorKey(errWith('SKILL.md exceeds 51200 bytes (got 60000)'))).toBe(
+      'aiSkErrMdTooLarge'
+    )
+  })
+
+  it('falls back to aiSkErrCreateFailed for an unrecognized backend string', () => {
+    expect(createSkillErrorKey(errWith('something went sideways'))).toBe('aiSkErrCreateFailed')
+  })
+
+  it('falls back to aiSkErrCreateFailed when no error string can be extracted', () => {
+    expect(createSkillErrorKey(new Error('network down'))).toBe('aiSkErrCreateFailed')
+    expect(createSkillErrorKey(undefined)).toBe('aiSkErrCreateFailed')
+    expect(createSkillErrorKey(null)).toBe('aiSkErrCreateFailed')
+  })
+
+  it('reads .detail when .message is absent (FastAPI shape)', () => {
+    expect(createSkillErrorKey({ response: { data: { detail: 'skill already exists' } } })).toBe(
+      'aiSkErrDuplicate'
+    )
+  })
+
+  it('is case-insensitive on the backend string', () => {
+    expect(createSkillErrorKey(errWith('SKILL ALREADY EXISTS'))).toBe('aiSkErrDuplicate')
+  })
+})
+
+describe('validateSkillForm', () => {
+  it('rejects an empty name', () => {
+    expect(validateSkillForm('', 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('rejects a whitespace-only name', () => {
+    expect(validateSkillForm('   ', 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('accepts a single-character name ("a")', () => {
+    expect(validateSkillForm('a', 'a valid description')).toBe(null)
+  })
+
+  it('rejects uppercase letters in the name', () => {
+    expect(validateSkillForm('Invoice-Tagger', 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('rejects underscores in the name', () => {
+    expect(validateSkillForm('invoice_tagger', 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('rejects a name starting with a dash', () => {
+    expect(validateSkillForm('-invoice-tagger', 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('rejects a name ending with a dash', () => {
+    expect(validateSkillForm('invoice-tagger-', 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('accepts a name exactly at the 64-char boundary', () => {
+    // 1 leading + 62 middle + 1 trailing = 64 chars total, matches skillIDRe exactly.
+    const name = 'a' + 'b'.repeat(62) + 'c'
+    expect(name.length).toBe(64)
+    expect(validateSkillForm(name, 'a valid description')).toBe(null)
+  })
+
+  it('rejects a name one char past the 64-char boundary', () => {
+    const name = 'a' + 'b'.repeat(63) + 'c'
+    expect(name.length).toBe(65)
+    expect(validateSkillForm(name, 'a valid description')).toBe('aiSkErrBadId')
+  })
+
+  it('rejects an empty description', () => {
+    expect(validateSkillForm('valid-name', '')).toBe('aiSkErrDescRequired')
+  })
+
+  it('rejects a whitespace-only description', () => {
+    expect(validateSkillForm('valid-name', '   ')).toBe('aiSkErrDescRequired')
+  })
+
+  it('accepts a description exactly at the 256-char boundary', () => {
+    const description = 'x'.repeat(256)
+    expect(validateSkillForm('valid-name', description)).toBe(null)
+  })
+
+  it('rejects a description one char past the 256-char boundary', () => {
+    const description = 'x'.repeat(257)
+    expect(validateSkillForm('valid-name', description)).toBe('aiSkErrDescTooLong')
+  })
+
+  it('rejects a description containing a newline', () => {
+    expect(validateSkillForm('valid-name', 'line one\nline two')).toBe('aiSkErrDescSingleLine')
+  })
+
+  it('rejects a description containing a carriage return', () => {
+    expect(validateSkillForm('valid-name', 'line one\rline two')).toBe('aiSkErrDescSingleLine')
+  })
+
+  it('rejects a description containing "<"', () => {
+    expect(validateSkillForm('valid-name', 'use <tag> here')).toBe('aiSkErrDescAngle')
+  })
+
+  it('rejects a description containing ">"', () => {
+    expect(validateSkillForm('valid-name', 'a > b')).toBe('aiSkErrDescAngle')
+  })
+
+  it('rejects a description containing a control character (\\x07)', () => {
+    expect(validateSkillForm('valid-name', 'bell\x07here')).toBe('aiSkErrDescControl')
+  })
+
+  it('returns null when both name and description are valid', () => {
+    expect(validateSkillForm('invoice-tagger', 'Tags invoices when they arrive.')).toBe(null)
+  })
+})
diff --git a/src/ai/util/skillsErrorKey.ts b/src/ai/util/skillsErrorKey.ts
new file mode 100644
index 0000000..54dc6e8
--- /dev/null
+++ b/src/ai/util/skillsErrorKey.ts
@@ -0,0 +1,77 @@
+// SP8-P3b Task 2 —— 技能新建/更新的错误归一 + 前端预校验。
+//
+// createSkillErrorKey 的形状照 src/ai/util/channelsFormat.ts:65-76 (addBotErrorKey)：
+// 取 e.response.data.message ?? .detail ?? data，String 化后 trim().toLowerCase()，
+// 按包含匹配判定，认不出的一律落通用兜底键，后端原文永不回显
+// （承 p3b-common-constraints.md §4 数据契约「HTTP 层失败不回显后端 body」）。
+//
+// 后端 NimoOS-AI/service/skills_store.go 的 validateSkillDescription 用
+// `fmt.Errorf("%w: <reason>", ErrBadDescription)` 包装，所以串形如
+// "invalid skill description: description required" —— 带前缀。匹配顺序：
+// 先判更具体的 description 子类（"description required" / "longer than 256
+// characters" / "must be a single line" / "'<' and '>' are not allowed" 里的
+// "are not allowed" + 含 '<' / "control characters are not allowed"），
+// 再判 "invalid skill description" 本身，最后落 aiSkErrCreateFailed 兜底。
+//
+// validateSkillForm 是【拍板偏离①，见 p3b-common-constraints.md §3.6】：Vue2
+// AddSkillModal.vue:137-139 提交前只查了 name/description 非空，填完一整屏才被后端一句
+// 英文顶回来。这里在前端做与后端同款的校验规则，规则逐条对
+// NimoOS-AI/service/skills_store.go:37-59 的 validateSkillDescription 与
+// skillIDRe（:86）——已回源核对，两处正则字面一致，见本任务报告。
+
+/** 对齐 channelsFormat.ts:66-70 的取错误串形状：response.data.message ?? .detail ?? data。 */
+function extractErrorString(e: unknown): string {
+  const data = (e as { response?: { data?: unknown } } | null | undefined)?.response?.data
+  const raw =
+    data && typeof data === 'object'
+      ? (data as { message?: unknown }).message ?? (data as { detail?: unknown }).detail
+      : data
+  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
+}
+
+/**
+ * 后端错误 → i18n 键。对齐 p3b-task-2-brief.md §2.2 的表。
+ * 已回源核对 NimoOS-AI/service/skills_store.go 的错误串字面量（见任务报告）。
+ */
+export function createSkillErrorKey(e: unknown): string {
+  const s = extractErrorString(e)
+
+  if (s.includes('skill already exists')) return 'aiSkErrDuplicate'
+  if (s.includes('invalid skill id')) return 'aiSkErrBadId'
+  if (s.includes('description required')) return 'aiSkErrDescRequired'
+  if (s.includes('longer than 256 characters')) return 'aiSkErrDescTooLong'
+  if (s.includes('must be a single line')) return 'aiSkErrDescSingleLine'
+  if (s.includes('are not allowed') && s.includes('<')) return 'aiSkErrDescAngle'
+  if (s.includes('control characters are not allowed')) return 'aiSkErrDescControl'
+  if (s.includes('invalid file path in bundle')) return 'aiSkErrBadPath'
+  if (s.includes('bundle exceeds size limits')) return 'aiSkErrBundleTooLarge'
+  if (s.includes('skill.md exceeds')) return 'aiSkErrMdTooLarge'
+  return 'aiSkErrCreateFailed'
+}
+
+// 回源核对结论（NimoOS-AI/service/skills_store.go:86 与 agent/main.py:2489）：两处正则
+// 字面完全一致，均为 /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/ —— 首尾必须是小写字母或数字，
+// 中间可含短横线，总长 1–64。brief 表里给的这条是对的，不存在需要以 Go 为准改写的分歧。
+const SKILL_ID_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/
+
+/**
+ * 前端预校验，规则逐条对齐 skills_store.go 的 ValidateSkillID + validateSkillDescription。
+ * 全过返回 null；否则返回对应的 i18n 错误键。
+ */
+export function validateSkillForm(name: string, description: string): string | null {
+  const trimmedName = name.trim()
+  if (trimmedName === '' || !SKILL_ID_RE.test(trimmedName)) return 'aiSkErrBadId'
+
+  const trimmedDescription = description.trim()
+  if (trimmedDescription === '') return 'aiSkErrDescRequired'
+  // Array.from(...).length counts Unicode code points, matching Go's
+  // utf8.RuneCountInString(d) in skills_store.go:49 more closely than
+  // JS's native .length (UTF-16 code units, which over-counts astral chars).
+  if (Array.from(trimmedDescription).length > 256) return 'aiSkErrDescTooLong'
+  if (/[\n\r]/.test(trimmedDescription)) return 'aiSkErrDescSingleLine'
+  if (trimmedDescription.includes('<') || trimmedDescription.includes('>')) return 'aiSkErrDescAngle'
+  // eslint-disable-next-line no-control-regex
+  if (/[\x00-\x1f\x7f]/.test(trimmedDescription)) return 'aiSkErrDescControl'
+
+  return null
+}
diff --git a/src/i18n/en_us.ts b/src/i18n/en_us.ts
index 2c9d71d..e102d06 100644
--- a/src/i18n/en_us.ts
+++ b/src/i18n/en_us.ts
@@ -1226,11 +1226,91 @@ export default {
   aiSkTriggerSlash: '/{name}',
 
   // SP8-P3a post-acceptance addendum — "skill attached" banner inside the
   // composer (user-requested 2026-07-30, no Vue2 counterpart; see the header
   // comment in AgentComposer.vue and
   // .superpowers/sdd/p3a-post-skillbanner-brief.md). {name} is filled by an
   // <i18n-t> named slot with <code>; the value itself carries no markup.
   aiSkPendingBanner: 'Skill {name} is attached — it will apply to your next message',
   aiSkPendingDetach: 'Detach skill',
   // <<< SP8-P3a
+  // >>> SP8-P3b Task 2 — skills section "write half": add/enable/disable/uninstall/
+  // delete/sandbox test. See zh_cn.ts for which lines are Vue2-less new copy.
+  aiSkAddSkill: 'Add skill',
+  aiSkDisable: 'Disable',
+  aiSkEnable: 'Enable',
+  aiSkDisableTemporarily: 'Disable temporarily',
+  aiSkCopyMd: 'Copy SKILL.md',
+  aiSkExport: 'Export skill',
+  aiSkUninstall: 'Uninstall',
+  aiSkDeleteSkill: 'Delete skill',
+  aiSkDelete: 'Delete',
+  aiSkUninstallTitle: 'Uninstall this skill?',
+  aiSkDeleteTitle: 'Delete this skill?',
+  aiSkUninstallBody:
+    "It will be removed from this NAS. This interface cannot restore it — you would need to reinstall the system or put the skill folder back by hand.",
+  aiSkDeleteBody: 'This permanently deletes the skill and its SKILL.md from your NAS. This cannot be undone.',
+  aiSkNPrevRuns: '{count} previous runs',
+  aiSkEnabledToast: 'Skill enabled',
+  aiSkPausedToast: 'Skill paused',
+  aiSkUpdateFailed: 'Update failed',
+  aiSkUninstalledName: 'Uninstalled {name}',
+  aiSkDeletedName: 'Deleted {name}',
+  aiSkDeleteFailed: 'Delete failed',
+  aiSkAddedName: 'Added {name}',
+  aiSkAddTitle: 'Add a new skill',
+  aiSkFieldName: 'Name',
+  aiSkNamePlaceholder: 'e.g. invoice-tagger',
+  aiSkNameHint: 'Lowercase, dashes only — this becomes the slash command.',
+  aiSkDescPlaceholder: 'When should Nimo use this skill? What does it do?',
+  aiSkDescFormHint: 'A clear description helps Nimo pick the right skill automatically.',
+  aiSkFieldColor: 'Color',
+  aiSkOptional: 'optional',
+  aiSkScriptFiles: 'Script files',
+  aiSkScriptsHint: "Files are stored inside scripts/{'<'}name{'>'} in the bundle.",
+  aiSkSavedLocally: 'Saved locally on this NAS',
+  aiSkCreating: 'Creating…',
+  aiSkCreate: 'Create skill',
+  aiSkTrigOptAuto: 'Automatic',
+  aiSkTrigDescAuto: 'Nimo decides when to use it',
+  aiSkTrigOptSlash: 'Slash command',
+  aiSkTrigDescSlash: 'Run with /name in chat',
+  aiSkTrigDescManual: 'Only when explicitly invoked',
+  aiSkMdPlaceholderHead: 'Your skill',
+  aiSkMdPlaceholderBody: 'Describe how the skill works…',
+  aiSkFilesSkippedTooBig: '{n} file(s) larger than 1 MiB were skipped',
+  aiSkErrDuplicate: 'A skill with this name already exists',
+  aiSkErrBadId:
+    'Name may only contain lowercase letters, digits and dashes, and cannot start or end with a dash',
+  aiSkErrDescRequired: 'Description is required',
+  aiSkErrDescTooLong: 'Description cannot exceed 256 characters',
+  aiSkErrDescSingleLine: 'Description must be a single line',
+  aiSkErrDescAngle: "Description cannot contain {'<'} or {'>'}",
+  aiSkErrDescControl: 'Description cannot contain control characters',
+  aiSkErrBadPath: 'Invalid file path in bundle',
+  aiSkErrBundleTooLarge: 'Bundle exceeds size limits',
+  aiSkErrMdTooLarge: 'SKILL.md is too large',
+  aiSkErrCreateFailed: 'Could not create skill',
+  aiSkTestTitle: 'Test in sandbox',
+  aiSkTestHint: "Runs in an isolated container — won't touch real files.",
+  aiSkTestPill: 'Sandbox',
+  aiSkTestTryName: 'Try {name} without affecting your NAS',
+  aiSkTestDiscard: 'Inputs and outputs are discarded after the run.',
+  aiSkTestOffTitle: 'Skill is disabled — testing still works',
+  aiSkTestOffBadge: 'Skill off',
+  aiSkTestRun: 'Run',
+  aiSkTestRunning: 'Running…',
+  aiSkTestExamples: 'Example prompts',
+  aiSkTestRunningLabel: 'Running in sandbox…',
+  aiSkTestBootstrapping: 'Bootstrapping {name} environment…',
+  aiSkTestCompleted: 'Completed in {ms} ms',
+  aiSkTestClosed: 'Sandbox closed. No files were modified.',
+  aiSkTestFailed: 'Run failed',
+  aiSkTestPlaceholderEx: 'Try: "{ex}"',
+  aiSkTestPlaceholder: 'Run the skill on a sample folder',
+  aiSkTestHttpFailed: 'Sandbox run failed (HTTP {status})',
+  aiSkTryDisabledTitle: 'This skill is paused',
+  aiSkTryDisabledBody:
+    'A paused skill is not loaded, so trying it in chat will have no effect. Enable it first?',
+  aiSkTryEnableAndTry: 'Enable and try',
+  // <<< SP8-P3b Task 2
 }
diff --git a/src/i18n/messageSyntax.test.ts b/src/i18n/messageSyntax.test.ts
index 62e62c8..3dc6113 100644
--- a/src/i18n/messageSyntax.test.ts
+++ b/src/i18n/messageSyntax.test.ts
@@ -43,20 +43,116 @@ describe('i18n message syntax', () => {
         legacy: false,
         locale: 'zh_cn',
         messages: { zh_cn: zh },
       })
       const message = i18nZh.global.t('aiSlashNoFolders')
       expect(message).toContain('@')
       expect(message).toBe('还没有可见目录 —— 先用 @ 选一个')
     })
   })
 
+  // SP8-P3b Task 2: aiSkScriptsHint / aiSkErrDescAngle both contain literal angle
+  // brackets, written as {'<'}/{'>'} escapes (probe confirmed vue-i18n 9 renders bare
+  // <>  without erroring too, but logs an "[intlify] Detected HTML" console warning —
+  // the escaped form renders identically without that warning, so it's what's shipped).
+  // Same failure mode as the P1c1 bare-@ incident this file was created to guard
+  // against: pin the resolved rendering so a future edit that breaks the escape shows
+  // up here instead of silently mangling the UI.
+  describe('aiSkScriptsHint and aiSkErrDescAngle keys (angle-bracket escapes)', () => {
+    it('should resolve the literal angle brackets in zh_cn aiSkScriptsHint', () => {
+      const i18nZh = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
+      const message = i18nZh.global.t('aiSkScriptsHint')
+      expect(message).toBe('文件会保存在 bundle 的 scripts/<name> 路径下。')
+    })
+
+    it('should resolve the literal angle brackets in en_us aiSkScriptsHint', () => {
+      const i18nEn = createI18n({ legacy: false, locale: 'en_us', messages: { en_us: en } })
+      const message = i18nEn.global.t('aiSkScriptsHint')
+      expect(message).toBe('Files are stored inside scripts/<name> in the bundle.')
+    })
+
+    it('should resolve the literal angle brackets in zh_cn aiSkErrDescAngle', () => {
+      const i18nZh = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
+      const message = i18nZh.global.t('aiSkErrDescAngle')
+      expect(message).toBe('描述里不能包含 < 和 >')
+    })
+
+    it('should resolve the literal angle brackets in en_us aiSkErrDescAngle', () => {
+      const i18nEn = createI18n({ legacy: false, locale: 'en_us', messages: { en_us: en } })
+      const message = i18nEn.global.t('aiSkErrDescAngle')
+      expect(message).toBe('Description cannot contain < or >')
+    })
+  })
+
+  // SP8-P3b Task 2 后续修复(评审 Important):aiSkUninstallTitle/aiSkDeleteTitle 的
+  // zh_cn 问号被手抖打成了全角 U+FF1F，而任务书表格与权威源
+  // NimoOS-UI/src/assets/lang/zh_CN.json:931-932 都是半角 U+003F —— 违反「不许改
+  // 标点」硬约束，且当时没有任何自动化断言覆盖这两个键的具体内容，只靠人工逐字符
+  // grep 才抓到。这里补一条程序化守卫，钉死本期新增的这批 aiSk* 键（P3b Task 2 引入
+  // 的 74 个）在 zh_cn 里不出现全角 ？/！/：。
+  //
+  // 范围有意收窄到"本期新增键"，不扩到全量 zh_cn.ts：既有键可能合法使用全角标点
+  // （例如 P3a 期确认过 aiSkEmpty 权威源就是半角逗号，但没有逐一核对过全量文件里
+  // 每个既有键的每种标点是否都对应半角权威源），把全量键都卷进来风险是把未经核对的
+  // 假设编码成断言、制造新的误报。若后续任务要扩大覆盖面，应先逐键回权威源核对。
+  describe('P3b Task 2 aiSk* keys — no accidental full-width punctuation', () => {
+    // 与 zh_cn.ts 里 "// >>> SP8-P3b Task 2" ... "// <<< SP8-P3b Task 2" 标记块内的
+    // 74 个新增键一一对应（见 p3b-task-2-report.md 的"新增键清单"）。
+    const p3bTask2Keys = [
+      'aiSkAddedName', 'aiSkAddSkill', 'aiSkAddTitle', 'aiSkCopyMd', 'aiSkCreate',
+      'aiSkCreating', 'aiSkDelete', 'aiSkDeleteBody', 'aiSkDeletedName', 'aiSkDeleteFailed',
+      'aiSkDeleteSkill', 'aiSkDeleteTitle', 'aiSkDescFormHint', 'aiSkDescPlaceholder',
+      'aiSkDisable', 'aiSkDisableTemporarily', 'aiSkEnable', 'aiSkEnabledToast',
+      'aiSkErrBadId', 'aiSkErrBadPath', 'aiSkErrBundleTooLarge', 'aiSkErrCreateFailed',
+      'aiSkErrDescAngle', 'aiSkErrDescControl', 'aiSkErrDescRequired', 'aiSkErrDescSingleLine',
+      'aiSkErrDescTooLong', 'aiSkErrDuplicate', 'aiSkErrMdTooLarge', 'aiSkExport',
+      'aiSkFieldColor', 'aiSkFieldName', 'aiSkFilesSkippedTooBig', 'aiSkMdPlaceholderBody',
+      'aiSkMdPlaceholderHead', 'aiSkNameHint', 'aiSkNamePlaceholder', 'aiSkNPrevRuns',
+      'aiSkOptional', 'aiSkPausedToast', 'aiSkSavedLocally', 'aiSkScriptFiles',
+      'aiSkScriptsHint', 'aiSkTestBootstrapping', 'aiSkTestClosed', 'aiSkTestCompleted',
+      'aiSkTestDiscard', 'aiSkTestExamples', 'aiSkTestFailed', 'aiSkTestHint',
+      'aiSkTestHttpFailed', 'aiSkTestOffBadge', 'aiSkTestOffTitle', 'aiSkTestPill',
+      'aiSkTestPlaceholder', 'aiSkTestPlaceholderEx', 'aiSkTestRun', 'aiSkTestRunning',
+      'aiSkTestRunningLabel', 'aiSkTestTitle', 'aiSkTestTryName', 'aiSkTrigDescAuto',
+      'aiSkTrigDescManual', 'aiSkTrigDescSlash', 'aiSkTrigOptAuto', 'aiSkTrigOptSlash',
+      'aiSkTryDisabledBody', 'aiSkTryDisabledTitle', 'aiSkTryEnableAndTry', 'aiSkUninstall',
+      'aiSkUninstallBody', 'aiSkUninstalledName', 'aiSkUninstallTitle', 'aiSkUpdateFailed',
+    ] as const
+
+    it('covers exactly the 74 keys this task added (list itself does not drift)', () => {
+      expect(p3bTask2Keys.length).toBe(74)
+    })
+
+    it('should not contain full-width ？, ！ or ： in any zh_cn value from this batch', () => {
+      const fullWidthPunctuation = /[？！：]/
+      const violations: Array<{ key: string; value: string }> = []
+      for (const key of p3bTask2Keys) {
+        const value = (zh as Record<string, unknown>)[key]
+        if (typeof value !== 'string') continue
+        if (fullWidthPunctuation.test(value)) violations.push({ key, value })
+      }
+      if (violations.length > 0) {
+        const details = violations.map((v) => `${v.key} = "${v.value}"`).join('\n')
+        expect.fail(
+          `Found full-width ？/！/： in P3b Task 2 zh_cn values (should be half-width ?/!/: per the authoritative Vue2 zh_CN.json):\n${details}`
+        )
+      }
+    })
+
+    it('aiSkUninstallTitle and aiSkDeleteTitle end with a half-width "?" (U+003F), matching NimoOS-UI/src/assets/lang/zh_CN.json:931-932', () => {
+      expect(zh.aiSkUninstallTitle).toBe('卸载这个技能?')
+      expect(zh.aiSkUninstallTitle.codePointAt(zh.aiSkUninstallTitle.length - 1)).toBe(0x3f)
+      expect(zh.aiSkDeleteTitle).toBe('删除这个技能?')
+      expect(zh.aiSkDeleteTitle.codePointAt(zh.aiSkDeleteTitle.length - 1)).toBe(0x3f)
+    })
+  })
+
   describe('bare @ guard (unescaped @ detection)', () => {
     it('should not allow bare @ in any key (only {@} escapes or @:key references)', () => {
       const locales = [
         { name: 'zh_cn', messages: zh },
         { name: 'en_us', messages: en },
       ]
 
       const violations: Array<{ locale: string; key: string; value: string }> = []
 
       for (const { name, messages } of locales) {
diff --git a/src/i18n/zh_cn.ts b/src/i18n/zh_cn.ts
index d4f70d4..5b7da79 100644
--- a/src/i18n/zh_cn.ts
+++ b/src/i18n/zh_cn.ts
@@ -1228,11 +1228,100 @@ export default {
   aiSkAuthorYou: '你',
   aiSkTriggerSlash: '/{name}',
 
   // SP8-P3a 验收后追加 —— 输入框内「已挂载技能」提示条(用户 2026-07-30 当面要求
   // 新增,Vue2 无对应 UI;见 AgentComposer.vue 顶部注释与
   // .superpowers/sdd/p3a-post-skillbanner-brief.md)。{name} 由 <i18n-t> 具名插槽
   // 用 <code> 填充,值本身不含 <code> 标签。
   aiSkPendingBanner: '已挂载技能 {name},将应用于下一条消息',
   aiSkPendingDetach: '取消挂载',
   // <<< SP8-P3a
+  // >>> SP8-P3b Task 2 —— 技能分区「写操作」半:新建/启停/卸载/删除/沙箱测试。
+  // 加粗行(见任务书 §2.3)在下方逐条标注为「Vue2 没有的新文案」。
+  aiSkAddSkill: '添加技能',
+  aiSkDisable: '禁用',
+  aiSkEnable: '启用',
+  aiSkDisableTemporarily: '临时禁用',
+  aiSkCopyMd: '复制 SKILL.md',
+  aiSkExport: '导出技能',
+  aiSkUninstall: '卸载',
+  aiSkDeleteSkill: '删除技能',
+  aiSkDelete: '删除', // 拍板不复用 aiConfirm(P1a 弹窗标题误用按钮文案的历史遗留),按任务书新增
+  aiSkUninstallTitle: '卸载这个技能?',
+  aiSkDeleteTitle: '删除这个技能?',
+  // 新文案(D3 拍板):Vue2 SkillDetail.vue:161 承诺「以后可从内置目录重新安装」,
+  // 但后端 service/skills.go:330-340 只写 uninstalled=1 标记、全仓无恢复接口 —— 说实话。
+  aiSkUninstallBody:
+    '技能将从这台 NAS 移除。此界面无法恢复,需要重装系统或手工把技能目录放回。',
+  aiSkDeleteBody: '这会永久删除该技能及其 SKILL.md 文件,无法恢复。',
+  aiSkNPrevRuns: '历史运行 {count} 次',
+  aiSkEnabledToast: '技能已启用',
+  aiSkPausedToast: '技能已暂停',
+  aiSkUpdateFailed: '更新失败',
+  aiSkUninstalledName: '已卸载 {name}',
+  aiSkDeletedName: '已删除 {name}',
+  aiSkDeleteFailed: '删除失败',
+  aiSkAddedName: '已添加 {name}',
+  aiSkAddTitle: '添加新技能',
+  aiSkFieldName: '名称',
+  aiSkNamePlaceholder: '例如:invoice-tagger',
+  aiSkNameHint: '仅小写字母与短横线 —— 这个名字会作为斜杠命令使用。',
+  aiSkDescPlaceholder: 'Nimo 应该在什么时候用这个技能?它做什么?',
+  aiSkDescFormHint: '清晰的描述能帮助 Nimo 自动挑选合适的技能。',
+  aiSkFieldColor: '颜色',
+  aiSkOptional: '可选',
+  aiSkScriptFiles: '脚本文件',
+  // 尖括号实测:vue-i18n 9 对裸 `<`/`>` 渲染无异常,但会打印
+  // "[intlify] Detected HTML in ... message" 控制台警告；本仓沿用既有转义惯例
+  // ({'@'} 等),用 {'<'}/{'>'} 转义写法,渲染结果与裸字面完全一致但不触发该警告。
+  aiSkScriptsHint: '文件会保存在 bundle 的 scripts/{\'<\'}name{\'>\'} 路径下。',
+  aiSkSavedLocally: '保存在这台 NAS 本地',
+  aiSkCreating: '创建中…',
+  aiSkCreate: '创建技能',
+  aiSkTrigOptAuto: '自动触发',
+  aiSkTrigDescAuto: '由 Nimo 自行决定何时使用',
+  aiSkTrigOptSlash: '斜杠命令',
+  aiSkTrigDescSlash: '在对话中输入 /name 触发',
+  aiSkTrigDescManual: '仅在明确调用时',
+  aiSkMdPlaceholderHead: '你的技能',
+  aiSkMdPlaceholderBody: '描述这个技能的工作方式…',
+  // 新文案(拍板偏离⑦):Vue2 AddSkillModal.vue:164-167 对 >1 MiB 的脚本文件直接
+  // continue 静默丢弃,用户看不到文件消失 —— 改为提示。
+  aiSkFilesSkippedTooBig: '{n} 个文件超过 1 MiB,已跳过',
+  aiSkErrDuplicate: '已存在同名技能',
+  aiSkErrBadId: '名称只能用小写字母、数字和短横线,且不能以短横线开头或结尾',
+  aiSkErrDescRequired: '请填写描述',
+  aiSkErrDescTooLong: '描述不能超过 256 个字符',
+  aiSkErrDescSingleLine: '描述必须是单行',
+  aiSkErrDescAngle: '描述里不能包含 {\'<\'} 和 {\'>\'}',
+  aiSkErrDescControl: '描述里不能包含控制字符',
+  aiSkErrBadPath: '脚本文件路径不合法',
+  aiSkErrBundleTooLarge: '技能包体积超出限制',
+  aiSkErrMdTooLarge: 'SKILL.md 太大',
+  aiSkErrCreateFailed: '无法创建技能',
+  aiSkTestTitle: '沙箱测试',
+  aiSkTestHint: '在隔离环境中运行,不会影响真实文件。',
+  aiSkTestPill: '沙箱',
+  aiSkTestTryName: '试用 {name},不影响你的 NAS',
+  aiSkTestDiscard: '运行结束后输入和输出会被丢弃。',
+  aiSkTestOffTitle: '技能已禁用,但仍可在沙箱中测试',
+  aiSkTestOffBadge: '技能已关闭',
+  aiSkTestRun: '运行',
+  aiSkTestRunning: '运行中…',
+  aiSkTestExamples: '示例提示',
+  aiSkTestRunningLabel: '在沙箱中运行…',
+  aiSkTestBootstrapping: '正在准备 {name} 运行环境…',
+  aiSkTestCompleted: '用时 {ms} 毫秒',
+  aiSkTestClosed: '沙箱已关闭,没有文件被修改。',
+  aiSkTestFailed: '运行失败',
+  aiSkTestPlaceholderEx: '试试:"{ex}"',
+  aiSkTestPlaceholder: '在示例文件夹上运行该技能',
+  // 新文案:沙箱运行失败的 HTTP 状态码提示(设计要求本地化文案 + 状态码,不回显后端 body)。
+  aiSkTestHttpFailed: '沙箱运行失败(HTTP {status})',
+  // 新文案(D4 拍板,收 P3a 挂账③):停用技能点「在对话中试用」先提示,而不是
+  // X-Skill-Id 照发但 agent 找不到 SKILL.md 造成的零反馈(skills_runtime.go:57)。
+  aiSkTryDisabledTitle: '该技能已停用',
+  aiSkTryDisabledBody:
+    '停用的技能不会被加载,现在去对话里试用不会有任何效果。要先启用它吗?',
+  aiSkTryEnableAndTry: '启用并试用',
+  // <<< SP8-P3b Task 2
 }
